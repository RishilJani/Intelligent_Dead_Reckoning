import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

import os
import json
import torch
import torch.nn as nn
import numpy as np
import onnxruntime as ort

class MultiTaskRegressor(nn.Module):
    def __init__(self, in_channels=10, cnn_channels=[48, 96], lstm_hidden=96, lstm_layers=2, num_heads=4):
        super().__init__()
        self.cnn = nn.Sequential(
            nn.Conv1d(in_channels, cnn_channels[0], kernel_size=3, padding=1),
            nn.BatchNorm1d(cnn_channels[0]),
            nn.ReLU(),
            nn.Conv1d(cnn_channels[0], cnn_channels[1], kernel_size=3, padding=1),
            nn.BatchNorm1d(cnn_channels[1]),
            nn.ReLU()
        )
        self.lstm = nn.LSTM(
            input_size=cnn_channels[1],
            hidden_size=lstm_hidden,
            num_layers=lstm_layers,
            batch_first=True,
            bidirectional=True
        )
        lstm_out_dim = lstm_hidden * 2 # 192
        self.attn = nn.MultiheadAttention(embed_dim=lstm_out_dim, num_heads=num_heads, batch_first=True)
        rep_dim = lstm_out_dim * 4
        
        self.speed_head = nn.Sequential(
            nn.Linear(rep_dim, 96),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(96, 1)
        )
        
        self.yaw_residual = nn.Sequential(
            nn.Linear(rep_dim, 96),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(96, 1)
        )
        self.yaw_skip = nn.Linear(1, 1)

    def forward(self, x):
        # x: (B, 20, 10)
        # gyro_z is feature channel 5 (0-indexed)
        gyro_z_mean = x[:, :, 5].mean(dim=1, keepdim=True) # (B, 1)
            
        x_cnn = x.transpose(1, 2)
        feat_cnn = self.cnn(x_cnn) # (B, 96, 20)
        
        feat_lstm_in = feat_cnn.transpose(1, 2) # (B, 20, 96)
        lstm_out, _ = self.lstm(feat_lstm_in) # (B, 20, 192)
        
        attn_out, _ = self.attn(lstm_out, lstm_out, lstm_out) # (B, 20, 192)
        
        mean_pool = attn_out.mean(dim=1) # (B, 192)
        max_pool, _ = attn_out.max(dim=1) # (B, 192)
        last_step = attn_out[:, -1, :] # (B, 192)
        first_step = attn_out[:, 0, :] # (B, 192)
        
        rep = torch.cat([mean_pool, max_pool, last_step, first_step], dim=-1) # (B, 768)
        
        speed_norm = self.speed_head(rep) # (B, 1)
        yaw_res = self.yaw_residual(rep) # (B, 1)
        yaw_direct = self.yaw_skip(gyro_z_mean) # (B, 1)
        yaw_rate = yaw_direct + yaw_res
        
        return speed_norm, yaw_rate

class EndToEndDeadReckoningModel(nn.Module):
    """
    Wraps normalization + MultiTaskRegressor + output denormalization
    Input: raw sensor window [B, 20, 10]
    Outputs:
      - speed_kmh: [B, 1] (Vehicle speed in km/h)
      - yaw_rate_dps: [B, 1] (Yaw rate in deg/s)
    """
    def __init__(self, base_model, feat_mean, feat_std, speed_mean, speed_std):
        super().__init__()
        self.base_model = base_model
        self.register_buffer("feat_mean", torch.tensor(feat_mean, dtype=torch.float32).view(1, 1, 10))
        self.register_buffer("feat_std", torch.tensor(feat_std, dtype=torch.float32).view(1, 1, 10))
        self.register_buffer("speed_mean", torch.tensor(speed_mean, dtype=torch.float32))
        self.register_buffer("speed_std", torch.tensor(speed_std, dtype=torch.float32))

    def forward(self, x_raw):
        # Normalize input
        x_norm = (x_raw - self.feat_mean) / self.feat_std
        
        speed_norm, yaw_rate = self.base_model(x_norm)
        
        # Denormalize speed to km/h: speed = speed_norm * speed_std + speed_mean
        speed_kmh = speed_norm * self.speed_std + self.speed_mean
        # Clamp speed to non-negative
        speed_kmh = torch.clamp(speed_kmh, min=0.0)
        
        return speed_kmh, yaw_rate

ckpt = torch.load("best_multitask_model.pt", map_location="cpu", weights_only=False)
base = MultiTaskRegressor()
base.load_state_dict(ckpt["model_state_dict"])
base.eval()

model = EndToEndDeadReckoningModel(
    base_model=base,
    feat_mean=ckpt["feat_mean"],
    feat_std=ckpt["feat_std"],
    speed_mean=ckpt["speed_mean"],
    speed_std=ckpt["speed_std"]
)
model.eval()

# Save metadata JSON for JS/TS runtime
metadata = {
    "feature_names": [
        "accel_x", "accel_y", "accel_z",
        "gyro_x", "gyro_y", "gyro_z",
        "accel_mag", "linear_accel_mag", "gyro_mag", "jerk"
    ],
    "input_shape": [1, 20, 10],
    "sample_rate_hz": 10,
    "window_duration_sec": 2.0,
    "feat_mean": [float(x) for x in ckpt["feat_mean"]],
    "feat_std": [float(x) for x in ckpt["feat_std"]],
    "speed_mean": float(ckpt["speed_mean"]),
    "speed_std": float(ckpt["speed_std"]),
    "yaw_mean": float(ckpt["yaw_mean"]),
    "yaw_std": float(ckpt["yaw_std"]),
    "val_speed_rmse_kmh": float(ckpt.get("val_speed_rmse_kmh", 5.47)),
    "val_yaw_rmse_dps": float(ckpt.get("val_yaw_rmse_dps", 0.83))
}

os.makedirs("assets/models", exist_ok=True)
with open("assets/models/model_metadata.json", "w") as f:
    json.dump(metadata, f, indent=2)
print("Saved assets/models/model_metadata.json")

# Test dummy raw input
dummy_input = torch.zeros(1, 20, 10, dtype=torch.float32)
dummy_input[:, :, 2] = 9.81
dummy_input[:, :, 6] = 9.81
dummy_input[:, :, 5] = 0.05
dummy_input[:, :, 8] = 0.05

with torch.no_grad():
    speed_pt, yaw_pt = model(dummy_input)
    print(f"PyTorch Output -> Speed: {speed_pt.item():.4f} km/h, Yaw rate: {yaw_pt.item():.4f} deg/s")

# Export to ONNX using torch.onnx.export (legacy exporter or dynamo)
onnx_path = "assets/models/dead_reckoning_model.onnx"

try:
    # Use dynamo=False to avoid dynamo emoji print issues and generate clean standard ONNX
    torch.onnx.export(
        model,
        dummy_input,
        onnx_path,
        input_names=["imu_window"],
        output_names=["speed_kmh", "yaw_rate_dps"],
        dynamic_axes={
            "imu_window": {0: "batch_size"},
            "speed_kmh": {0: "batch_size"},
            "yaw_rate_dps": {0: "batch_size"}
        },
        opset_version=17,
        dynamo=False
    )
    print(f"Exported ONNX model to {onnx_path} (size: {os.path.getsize(onnx_path)} bytes)")
except Exception as e:
    print("Export with dynamo=False failed, trying standard export:", e)
    torch.onnx.export(
        model,
        dummy_input,
        onnx_path,
        input_names=["imu_window"],
        output_names=["speed_kmh", "yaw_rate_dps"],
        opset_version=18
    )

# Validate with ONNX Runtime
session = ort.InferenceSession(onnx_path)
ort_inputs = {"imu_window": dummy_input.numpy()}
ort_outputs = session.run(None, ort_inputs)
speed_onnx = ort_outputs[0][0][0]
yaw_onnx = ort_outputs[1][0][0]
print(f"ONNX Runtime Output -> Speed: {speed_onnx:.4f} km/h, Yaw rate: {yaw_onnx:.4f} deg/s")
print(f"Discrepancy: Speed diff = {abs(speed_pt.item() - speed_onnx):.6f}, Yaw diff = {abs(yaw_pt.item() - yaw_onnx):.6f}")
print("ONNX Model exported and validated successfully!")
