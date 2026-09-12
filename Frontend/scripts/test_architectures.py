import torch
import torch.nn as nn

# Test SpeedRegressor
class SpeedRegressorCandidate1(nn.Module):
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
        # 128 * 3 = 384
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

speed_ckpt = torch.load("speed_prediction_cursor.pt", map_location="cpu", weights_only=False)
speed_sd = speed_ckpt["model_state_dict"]

model1 = SpeedRegressorCandidate1()
load_res = model1.load_state_dict(speed_sd, strict=True)
print("SpeedRegressor loaded successfully with exact strict match:", load_res)

x_dummy = torch.randn(2, 20, 10)
out_speed = model1(x_dummy)
print("Speed model forward pass successful! Output shape:", out_speed.shape)

# Test YawRegressor
class YawRegressorCandidate1(nn.Module):
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
        out, (h_n, c_n) = self.lstm(x) # out: (B, 20, 128)
        # Check if last_step or mean_pool or h_n
        last_step = out[:, -1, :]
        return self.head(last_step)

yaw_ckpt = torch.load("yaw_canbus_model.pt", map_location="cpu", weights_only=False)
yaw_sd = yaw_ckpt["model_state_dict"]

model2 = YawRegressorCandidate1()
load_res2 = model2.load_state_dict(yaw_sd, strict=True)
print("YawRegressor loaded successfully with exact strict match:", load_res2)

y_dummy = torch.randn(2, 20, 7)
out_yaw = model2(y_dummy)
print("Yaw model forward pass successful! Output shape:", out_yaw.shape)
