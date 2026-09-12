import torch
import json
import numpy as np

ckpt = torch.load("best_multitask_model.pt", map_location="cpu", weights_only=False)
sd = ckpt["model_state_dict"]

weights_dict = {}
for k, v in sd.items():
    weights_dict[k] = v.cpu().numpy().tolist()

# Add normalization and stats
weights_dict["_meta"] = {
    "feat_mean": [float(x) for x in ckpt["feat_mean"]],
    "feat_std": [float(x) for x in ckpt["feat_std"]],
    "speed_mean": float(ckpt["speed_mean"]),
    "speed_std": float(ckpt["speed_std"]),
    "yaw_mean": float(ckpt["yaw_mean"]),
    "yaw_std": float(ckpt["yaw_std"]),
    "features": [
        "accel_x", "accel_y", "accel_z",
        "gyro_x", "gyro_y", "gyro_z",
        "accel_mag", "linear_accel_mag", "gyro_mag", "jerk"
    ]
}

with open("assets/models/model_weights.json", "w") as f:
    json.dump(weights_dict, f)

print(f"Exported model_weights.json with {len(weights_dict)} entries!")
