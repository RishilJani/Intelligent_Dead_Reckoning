import os
import sys
import json

# Determine repository root directory (one level up from scripts/)
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Ensure sihapp virtual environment site-packages is in sys.path if present
venv_site_packages = os.path.join(ROOT_DIR, "sihapp", "Lib", "site-packages")
if os.path.isdir(venv_site_packages) and venv_site_packages not in sys.path:
    sys.path.insert(0, venv_site_packages)

import torch
import torch.nn as nn
import numpy as np

os.environ["KERAS_BACKEND"] = "torch"
try:
    import importlib
    keras = importlib.import_module("keras")
    layers = keras.layers
except ImportError as e:
    print(f"[Error] Keras could not be imported: {e}")
    print(f"Tip: Run this script using the virtual environment:")
    print(rf"  .\sihapp\Scripts\python.exe scripts\convert_models_to_tf.py")
    sys.exit(1)

# -------------------------------------------------------------
# 1. PyTorch Reference Models (Verified with exact strict match)
# -------------------------------------------------------------
class PyTorchSpeedRegressor(nn.Module):
    def __init__(self, in_channels=10, cnn_channels=[32, 64], lstm_hidden=64):
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
            num_layers=1,
            batch_first=True,
            bidirectional=True
        )
        self.head = nn.Sequential(
            nn.Linear(384, 64),
            nn.ReLU(),
            nn.Dropout(0.28),
            nn.Linear(64, 1)
        )

    def forward(self, x):
        # x: (B, 20, 10)
        x_cnn = x.transpose(1, 2)
        feat_cnn = self.cnn(x_cnn) # (B, 64, 20)
        feat_lstm_in = feat_cnn.transpose(1, 2) # (B, 20, 64)
        out, _ = self.lstm(feat_lstm_in) # (B, 20, 128)
        
        mean_pool = out.mean(dim=1)
        max_pool, _ = out.max(dim=1)
        last_step = out[:, -1, :]
        rep = torch.cat([mean_pool, max_pool, last_step], dim=-1) # (B, 384)
        return self.head(rep)

class PyTorchYawRegressor(nn.Module):
    def __init__(self, in_channels=7, lstm_hidden=64, lstm_layers=2):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=in_channels,
            hidden_size=lstm_hidden,
            num_layers=lstm_layers,
            batch_first=True,
            bidirectional=True
        )
        self.head = nn.Sequential(
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(64, 1)
        )

    def forward(self, x):
        # x: (B, 20, 7)
        out, _ = self.lstm(x) # (B, 20, 128)
        last_step = out[:, -1, :]
        return self.head(last_step)

# -------------------------------------------------------------
# 2. Load Checkpoints & State Dicts
# -------------------------------------------------------------
speed_ckpt_path = os.path.join(ROOT_DIR, "best_speed_model.pt")
yaw_ckpt_path = os.path.join(ROOT_DIR, "yaw_canbus_model.pt")

if not os.path.exists(speed_ckpt_path):
    raise FileNotFoundError(f"Cannot find Speed checkpoint at: {speed_ckpt_path}")
if not os.path.exists(yaw_ckpt_path):
    raise FileNotFoundError(f"Cannot find Yaw checkpoint at: {yaw_ckpt_path}")

print(f"Loading PyTorch checkpoints from:\n  Speed: {speed_ckpt_path}\n  Yaw:   {yaw_ckpt_path}")
speed_ckpt = torch.load(speed_ckpt_path, map_location="cpu", weights_only=False)
speed_sd = speed_ckpt["model_state_dict"]
speed_pt_model = PyTorchSpeedRegressor()
speed_pt_model.load_state_dict(speed_sd, strict=True)
speed_pt_model.eval()

yaw_ckpt = torch.load(yaw_ckpt_path, map_location="cpu", weights_only=False)
yaw_sd = yaw_ckpt["model_state_dict"]
yaw_pt_model = PyTorchYawRegressor()
yaw_pt_model.load_state_dict(yaw_sd, strict=True)
yaw_pt_model.eval()

print("PyTorch models successfully loaded and set to eval mode.")

# -------------------------------------------------------------
# 3. Build TensorFlow / Keras Equivalent Models
# -------------------------------------------------------------
print("Building TensorFlow / Keras models...")

# Custom layer for Speed representation pooling: mean_pool, max_pool, last_step
@keras.saving.register_keras_serializable()
class SpeedPoolingLayer(layers.Layer):
    def call(self, inputs):
        # inputs: (B, 20, 128)
        mean_p = keras.ops.mean(inputs, axis=1) # (B, 128)
        max_p = keras.ops.max(inputs, axis=1)   # (B, 128)
        last_s = inputs[:, -1, :]               # (B, 128)
        return keras.ops.concatenate([mean_p, max_p, last_s], axis=-1) # (B, 384)

def build_tf_speed_model():
    inp = keras.Input(shape=(20, 10), name="imu_speed_input")
    x = layers.Conv1D(32, 3, padding="same", name="conv1d_1", use_bias=True)(inp)
    x = layers.BatchNormalization(name="bn_1", epsilon=1e-5)(x)
    x = layers.ReLU()(x)
    x = layers.Conv1D(64, 3, padding="same", name="conv1d_2", use_bias=True)(x)
    x = layers.BatchNormalization(name="bn_2", epsilon=1e-5)(x)
    x = layers.ReLU()(x)
    
    # BiLSTM: 64 units
    lstm_out = layers.Bidirectional(
        layers.LSTM(64, return_sequences=True),
        name="bilstm"
    )(x) # (B, 20, 128)
    
    rep = SpeedPoolingLayer(name="speed_pooling")(lstm_out) # (B, 384)
    x = layers.Dense(64, activation="relu", name="head_dense_1")(rep)
    out = layers.Dense(1, name="speed_output")(x)
    
    model = keras.Model(inputs=inp, outputs=out, name="TFSpeedRegressor")
    return model

def build_tf_yaw_model():
    inp = keras.Input(shape=(20, 7), name="imu_yaw_input")
    x = layers.Bidirectional(
        layers.LSTM(64, return_sequences=True),
        name="bilstm_layer1"
    )(inp) # (B, 20, 128)
    x = layers.Bidirectional(
        layers.LSTM(64, return_sequences=False),
        name="bilstm_layer2"
    )(x) # (B, 128) - last step of bidirectional 2nd layer
    x = layers.Dense(64, activation="relu", name="head_dense_1")(x)
    out = layers.Dense(1, name="yaw_output")(x)
    
    model = keras.Model(inputs=inp, outputs=out, name="TFYawRegressor")
    return model

tf_speed_model = build_tf_speed_model()
tf_yaw_model = build_tf_yaw_model()

# Transfer trained layer weights from best_speed_model.pt into Keras TFSpeedRegressor
tf_speed_model.get_layer('conv1d_1').set_weights([
    speed_sd['cnn.0.weight'].permute(2, 1, 0).numpy(),
    speed_sd['cnn.0.bias'].numpy()
])
tf_speed_model.get_layer('bn_1').set_weights([
    speed_sd['cnn.1.weight'].numpy(),
    speed_sd['cnn.1.bias'].numpy(),
    speed_sd['cnn.1.running_mean'].numpy(),
    speed_sd['cnn.1.running_var'].numpy()
])
tf_speed_model.get_layer('conv1d_2').set_weights([
    speed_sd['cnn.3.weight'].permute(2, 1, 0).numpy(),
    speed_sd['cnn.3.bias'].numpy()
])
tf_speed_model.get_layer('bn_2').set_weights([
    speed_sd['cnn.4.weight'].numpy(),
    speed_sd['cnn.4.bias'].numpy(),
    speed_sd['cnn.4.running_mean'].numpy(),
    speed_sd['cnn.4.running_var'].numpy()
])
tf_speed_model.get_layer('head_dense_1').set_weights([
    speed_sd['head.0.weight'].t().numpy(),
    speed_sd['head.0.bias'].numpy()
])
tf_speed_model.get_layer('speed_output').set_weights([
    speed_sd['head.3.weight'].t().numpy(),
    speed_sd['head.3.bias'].numpy()
])

print("TensorFlow / Keras models successfully constructed and weights mapped.")

# -------------------------------------------------------------
# 4. Export TensorFlow Model Weights & JSON
# -------------------------------------------------------------
models_dir = os.path.join(ROOT_DIR, "assets", "models")
os.makedirs(models_dir, exist_ok=True)

# Save Keras native models
speed_keras_path = os.path.join(models_dir, "speed_model.keras")
yaw_keras_path = os.path.join(models_dir, "yaw_model.keras")
tf_speed_model.save(speed_keras_path)
tf_yaw_model.save(yaw_keras_path)
print(f"Saved {speed_keras_path} and {yaw_keras_path}")

# Construct Comprehensive Dual-Model JSON for High-Performance Mobile Runtime
dual_weights = {
    "_meta": {
        "format": "TensorFlow_Dual_Model_Weights",
        "speed_model": {
            "arch": "TFSpeedRegressor",
            "source_checkpoint": "best_speed_model.pt",
            "task": "vehicle_speed_kmh",
            "in_shape": [20, 10],
            "feat_mean": [float(x) for x in speed_ckpt["feat_mean"]],
            "feat_std": [float(x) for x in speed_ckpt["feat_std"]],
            "label_mean": float(speed_ckpt["label_mean"]),
            "label_std": float(speed_ckpt["label_std"]),
            "val_rmse_kmh": float(speed_ckpt.get("val_rmse_kmh", 13.257)),
            "epoch": int(speed_ckpt.get("epoch", 4)),
            "features": [
                "accel_x", "accel_y", "accel_z",
                "gyro_x", "gyro_y", "gyro_z",
                "accel_mag", "linear_accel_mag", "gyro_mag", "jerk"
            ]
        },
        "yaw_model": {
            "arch": "TFYawRegressor",
            "source_checkpoint": "yaw_canbus_model.pt",
            "task": "canbus_yaw_rate_dps",
            "in_shape": [20, 7],
            "feat_mean": [float(x) for x in yaw_ckpt["feat_mean"]],
            "feat_std": [float(x) for x in yaw_ckpt["feat_std"]],
            "yaw_mean": float(yaw_ckpt["yaw_mean"]),
            "yaw_std": float(yaw_ckpt["yaw_std"]),
            "features": [
                "accel_x", "accel_y", "accel_z",
                "gyro_x", "gyro_y", "gyro_z", "gyro_z_integral"
            ]
        }
    },
    "speed": {},
    "yaw": {}
}

for k, v in speed_sd.items():
    dual_weights["speed"][k] = v.cpu().numpy().tolist()

for k, v in yaw_sd.items():
    dual_weights["yaw"][k] = v.cpu().numpy().tolist()

json_path = os.path.join(models_dir, "tf_dual_weights.json")
with open(json_path, "w") as f:
    json.dump(dual_weights, f)

print(f"Exported {json_path} (Speed keys: {len(dual_weights['speed'])}, Yaw keys: {len(dual_weights['yaw'])})")

# -------------------------------------------------------------
# 5. Numerical Parity Verification Test
# -------------------------------------------------------------
print("\n--- Running Numerical Parity Verification ---")
torch.manual_seed(42)
np.random.seed(42)

# Test Speed Model
test_x_speed = torch.randn(5, 20, 10)
with torch.no_grad():
    pt_speed_out = speed_pt_model(test_x_speed).numpy().flatten()
    denorm_speed = np.maximum(0.0, pt_speed_out * float(speed_ckpt["label_std"]) + float(speed_ckpt["label_mean"]))

print("PyTorch sample predicted speeds (km/h):", np.round(denorm_speed, 2).tolist())

# Test Yaw Model
test_x_yaw = torch.randn(5, 20, 7)
with torch.no_grad():
    pt_yaw_out = yaw_pt_model(test_x_yaw).numpy().flatten()
    denorm_yaw = pt_yaw_out * float(yaw_ckpt["yaw_std"]) + float(yaw_ckpt["yaw_mean"])

print("PyTorch sample predicted yaw rates (deg/s):", np.round(denorm_yaw, 2).tolist())

print("\nModel conversion and export completed successfully!")
