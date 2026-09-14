import os
import json
import torch

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ckpt_path = os.path.join(ROOT_DIR, "best_speed_model2.pt")
models_dir = os.path.join(ROOT_DIR, "assets", "models")
os.makedirs(models_dir, exist_ok=True)

print(f"Loading checkpoint: {ckpt_path}")
ckpt = torch.load(ckpt_path, map_location="cpu", weights_only=False)

speed_sd = ckpt["model_state_dict"]
print(f"Number of state_dict keys: {len(speed_sd)}")

feat_mean = [float(x) for x in ckpt["feat_mean"]]
feat_std = [float(x) for x in ckpt["feat_std"]]
label_mean = float(ckpt["label_mean"])
label_std = float(ckpt["label_std"])
val_loss = float(ckpt.get("val_loss", 0.0))
epoch = int(ckpt.get("epoch", 0))

print(f"label_mean: {label_mean}, label_std: {label_std}, epoch: {epoch}, val_loss: {val_loss}")

weights = {}
for k, v in speed_sd.items():
    weights[k] = v.cpu().numpy().tolist()

speed_data = {
    "_meta": {
        "format": "TensorFlow_Speed_Model_Weights",
        "speed_model": {
            "arch": "TFSpeedRegressor",
            "source_checkpoint": "best_speed_model2.pt",
            "task": "vehicle_speed_kmh",
            "in_shape": [20, 10],
            "feat_mean": feat_mean,
            "feat_std": feat_std,
            "label_mean": label_mean,
            "label_std": label_std,
            "val_loss": val_loss,
            "epoch": epoch,
            "features": [
                "accel_x", "accel_y", "accel_z",
                "gyro_x", "gyro_y", "gyro_z",
                "accel_mag", "linear_accel_mag", "gyro_mag", "jerk"
            ]
        }
    },
    "speed": weights
}

out_path = os.path.join(models_dir, "tf_speed_weights.json")
with open(out_path, "w") as f:
    json.dump(speed_data, f)

print(f"Successfully saved {out_path} ({len(weights)} weight tensors).")
