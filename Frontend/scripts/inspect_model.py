import torch
import json

ckpt_path = "best_multitask_model.pt"
try:
    data = torch.load(ckpt_path, map_location="cpu", weights_only=False)
    print("Checkpoint Type:", type(data))
    if isinstance(data, dict):
        print("Keys:", data.keys())
        for k in data.keys():
            if isinstance(data[k], (torch.Tensor, list, dict)):
                if isinstance(data[k], torch.Tensor):
                    print(f"  {k}: Tensor of shape {data[k].shape}, dtype {data[k].dtype}")
                elif isinstance(data[k], dict):
                    print(f"  {k}: dict with {len(data[k])} keys -> {list(data[k].keys())[:10]}")
            else:
                print(f"  {k}: {type(data[k])} = {data[k]}")
    elif isinstance(data, torch.nn.Module):
        print("Model directly saved as nn.Module:")
        print(data)
except Exception as e:
    print("Error loading:", e)
