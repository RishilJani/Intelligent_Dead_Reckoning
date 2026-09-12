import torch
import json

def inspect_checkpoint(name, path):
    print(f"\n==================== {name} ({path}) ====================")
    data = torch.load(path, map_location="cpu", weights_only=False)
    print("Type:", type(data))
    if isinstance(data, dict):
        print("Keys:", list(data.keys()))
        sd = data.get("model_state_dict", data.get("state_dict", data))
        if isinstance(sd, dict):
            print(f"State dict keys ({len(sd)}):")
            for k, v in sd.items():
                if hasattr(v, 'shape'):
                    print(f"  {k}: {v.shape}, dtype={v.dtype}")
        for k in data.keys():
            if k not in ["model_state_dict", "state_dict"]:
                val = data[k]
                if isinstance(val, (int, float, str, bool)):
                    print(f"  Metadata '{k}': {val}")
                elif isinstance(val, (list, tuple)) and len(val) <= 15:
                    print(f"  Metadata '{k}': {val}")
                elif hasattr(val, 'shape'):
                    print(f"  Metadata Tensor '{k}': shape {val.shape}")
    elif isinstance(data, torch.nn.Module):
        print("Model class:", data.__class__.__name__)
        for name, param in data.named_parameters():
            print(f"  {name}: {param.shape}")

inspect_checkpoint("SPEED MODEL", "speed_prediction_cursor.pt")
inspect_checkpoint("YAW MODEL", "yaw_canbus_model.pt")
