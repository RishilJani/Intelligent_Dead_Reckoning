import os
import json
import torch

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ckpt_path = os.path.join(ROOT_DIR, "walking_speed_model.pt")
models_dir = os.path.join(ROOT_DIR, "assets", "models")
os.makedirs(models_dir, exist_ok=True)

print(f"Loading walking model checkpoint: {ckpt_path}")
ckpt = torch.load(ckpt_path, map_location="cpu", weights_only=False)

sd = ckpt["model_state"]
weights = {}
for k, v in sd.items():
    weights[k] = v.cpu().numpy().tolist()

mean = [float(x) for x in ckpt["mean"]]
std = [float(x) for x in ckpt["std"]]
feature_columns = ckpt.get("feature_columns", [
    "accel_x", "accel_y", "accel_z",
    "gyro_x", "gyro_y", "gyro_z",
    "accel_mag", "gyro_mag", "jerk"
])
window_size = int(ckpt.get("window_size", 10))

data = {
    "_meta": {
        "format": "Walking_Speed_Model_Weights",
        "model": {
            "arch": "WalkingSpeedGRU",
            "source_checkpoint": "walking_speed_model.pt",
            "task": "walking_speed_ms",
            "unit": "m/s",
            "window_size": window_size,
            "feature_columns": feature_columns,
            "mean": mean,
            "std": std
        }
    },
    "weights": weights
}

out_path = os.path.join(models_dir, "walking_speed_weights.json")
with open(out_path, "w") as f:
    json.dump(data, f)

print(f"Successfully exported walking model weights to {out_path} ({len(weights)} weight tensors).")
