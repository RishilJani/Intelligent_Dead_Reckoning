import torch

ckpt = torch.load("best_multitask_model.pt", map_location="cpu", weights_only=False)
sd = ckpt["model_state_dict"]
print(f"Total state dict entries: {len(sd)}")
for k, v in sd.items():
    print(f"{k}: shape={v.shape}, dtype={v.dtype}")
