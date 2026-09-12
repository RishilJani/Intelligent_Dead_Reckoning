import torch
import torch.nn as nn
import torch.nn.functional as F

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
        
        # 4 * 192 = 768 representation (e.g. mean, max, last, first or similar)
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

    def forward(self, x, raw_gyro_z_mean=None):
        # x: (B, 20, 10) -> (B, 10, 20) for Conv1d
        if raw_gyro_z_mean is None:
            # If not explicitly passed, feature index 5 is gyro_z
            raw_gyro_z_mean = x[:, :, 5].mean(dim=1, keepdim=True) # (B, 1)
            
        x_cnn = x.transpose(1, 2)
        feat_cnn = self.cnn(x_cnn) # (B, 96, 20)
        
        feat_lstm_in = feat_cnn.transpose(1, 2) # (B, 20, 96)
        lstm_out, _ = self.lstm(feat_lstm_in) # (B, 20, 192)
        
        attn_out, _ = self.attn(lstm_out, lstm_out, lstm_out) # (B, 20, 192)
        
        # 4 pooling representations
        mean_pool = attn_out.mean(dim=1) # (B, 192)
        max_pool, _ = attn_out.max(dim=1) # (B, 192)
        last_step = attn_out[:, -1, :] # (B, 192)
        first_step = attn_out[:, 0, :] # (B, 192)
        
        rep = torch.cat([mean_pool, max_pool, last_step, first_step], dim=-1) # (B, 768)
        
        speed = self.speed_head(rep) # (B, 1)
        yaw_res = self.yaw_residual(rep) # (B, 1)
        yaw_direct = self.yaw_skip(raw_gyro_z_mean) # (B, 1)
        yaw = yaw_direct + yaw_res
        
        return speed, yaw

ckpt = torch.load("best_multitask_model.pt", map_location="cpu", weights_only=False)
model = MultiTaskRegressor()
load_result = model.load_state_dict(ckpt["model_state_dict"], strict=True)
print("Load result:", load_result)
print("Successfully loaded model!")
