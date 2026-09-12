import json
import numpy as np
import torch

with open("assets/models/tf_dual_weights.json", "r") as f:
    dw = json.load(f)

meta = dw["_meta"]
speed_weights = dw["speed"]
yaw_weights = dw["yaw"]

def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -50.0, 50.0)))

def run_lstm_cell(x_t, h_prev, c_prev, W_ih, W_hh, b_ih, b_hh):
    gates = np.dot(W_ih, x_t) + b_ih + np.dot(W_hh, h_prev) + b_hh
    i_gate = sigmoid(gates[0:64])
    f_gate = sigmoid(gates[64:128])
    g_gate = np.tanh(gates[128:192])
    o_gate = sigmoid(gates[192:256])
    c_t = f_gate * c_prev + i_gate * g_gate
    h_t = o_gate * np.tanh(c_t)
    return h_t, c_t

def run_bilstm(inputs, W_ih, W_hh, b_ih, b_hh, W_ih_rev, W_hh_rev, b_ih_rev, b_hh_rev):
    seq_len = len(inputs)
    # Forward
    h_fwd = np.zeros(64, dtype=np.float32)
    c_fwd = np.zeros(64, dtype=np.float32)
    fwd_outputs = []
    for t in range(seq_len):
        h_fwd, c_fwd = run_lstm_cell(inputs[t], h_fwd, c_fwd, W_ih, W_hh, b_ih, b_hh)
        fwd_outputs.append(h_fwd)
    
    # Backward
    h_bwd = np.zeros(64, dtype=np.float32)
    c_bwd = np.zeros(64, dtype=np.float32)
    bwd_outputs = [None] * seq_len
    for t in reversed(range(seq_len)):
        h_bwd, c_bwd = run_lstm_cell(inputs[t], h_bwd, c_bwd, W_ih_rev, W_hh_rev, b_ih_rev, b_hh_rev)
        bwd_outputs[t] = h_bwd

    # Concatenate
    outputs = []
    for t in range(seq_len):
        outputs.append(np.concatenate([fwd_outputs[t], bwd_outputs[t]]))
    return np.array(outputs, dtype=np.float32)

def predict_speed_numpy(raw_window_20x10):
    feat_mean = np.array(meta["speed_model"]["feat_mean"], dtype=np.float32)
    feat_std = np.array(meta["speed_model"]["feat_std"], dtype=np.float32)
    x_norm = (raw_window_20x10 - feat_mean) / feat_std # (20, 10)
    
    # Conv1D 1: in 10, out 32, k=3, pad=1
    # x_norm transposed to (10, 20)
    x_c = x_norm.T
    w_c1 = np.array(speed_weights["cnn.0.weight"], dtype=np.float32) # (32, 10, 3)
    b_c1 = np.array(speed_weights["cnn.0.bias"], dtype=np.float32)
    
    c1_out = np.zeros((32, 20), dtype=np.float32)
    for oc in range(32):
        val = np.zeros(20, dtype=np.float32)
        for ic in range(10):
            padded = np.pad(x_c[ic], (1, 1), mode='constant')
            for k in range(3):
                val += w_c1[oc, ic, k] * padded[k:k+20]
        c1_out[oc] = val + b_c1[oc]
        
    # BatchNorm 1
    gamma1 = np.array(speed_weights["cnn.1.weight"], dtype=np.float32)
    beta1 = np.array(speed_weights["cnn.1.bias"], dtype=np.float32)
    mean1 = np.array(speed_weights["cnn.1.running_mean"], dtype=np.float32)
    var1 = np.array(speed_weights["cnn.1.running_var"], dtype=np.float32)
    
    bn1_out = np.zeros_like(c1_out)
    for c in range(32):
        bn1_out[c] = ((c1_out[c] - mean1[c]) / np.sqrt(var1[c] + 1e-5)) * gamma1[c] + beta1[c]
    relu1_out = np.maximum(0.0, bn1_out)
    
    # Conv1D 2: in 32, out 64, k=3, pad=1
    w_c2 = np.array(speed_weights["cnn.3.weight"], dtype=np.float32)
    b_c2 = np.array(speed_weights["cnn.3.bias"], dtype=np.float32)
    c2_out = np.zeros((64, 20), dtype=np.float32)
    for oc in range(64):
        val = np.zeros(20, dtype=np.float32)
        for ic in range(32):
            padded = np.pad(relu1_out[ic], (1, 1), mode='constant')
            for k in range(3):
                val += w_c2[oc, ic, k] * padded[k:k+20]
        c2_out[oc] = val + b_c2[oc]
        
    # BatchNorm 2
    gamma2 = np.array(speed_weights["cnn.4.weight"], dtype=np.float32)
    beta2 = np.array(speed_weights["cnn.4.bias"], dtype=np.float32)
    mean2 = np.array(speed_weights["cnn.4.running_mean"], dtype=np.float32)
    var2 = np.array(speed_weights["cnn.4.running_var"], dtype=np.float32)
    
    bn2_out = np.zeros_like(c2_out)
    for c in range(64):
        bn2_out[c] = ((c2_out[c] - mean2[c]) / np.sqrt(var2[c] + 1e-5)) * gamma2[c] + beta2[c]
    relu2_out = np.maximum(0.0, bn2_out)
    
    # LSTM input: (20, 64)
    lstm_in = relu2_out.T
    lstm_out = run_bilstm(
        lstm_in,
        np.array(speed_weights["lstm.weight_ih_l0"], dtype=np.float32),
        np.array(speed_weights["lstm.weight_hh_l0"], dtype=np.float32),
        np.array(speed_weights["lstm.bias_ih_l0"], dtype=np.float32),
        np.array(speed_weights["lstm.bias_hh_l0"], dtype=np.float32),
        np.array(speed_weights["lstm.weight_ih_l0_reverse"], dtype=np.float32),
        np.array(speed_weights["lstm.weight_hh_l0_reverse"], dtype=np.float32),
        np.array(speed_weights["lstm.bias_ih_l0_reverse"], dtype=np.float32),
        np.array(speed_weights["lstm.bias_hh_l0_reverse"], dtype=np.float32)
    ) # (20, 128)
    
    # Pooling
    mean_p = np.mean(lstm_out, axis=0) # (128,)
    max_p = np.max(lstm_out, axis=0)   # (128,)
    last_s = lstm_out[-1]              # (128,)
    rep = np.concatenate([mean_p, max_p, last_s]) # (384,)
    
    # Head
    w_h0 = np.array(speed_weights["head.0.weight"], dtype=np.float32)
    b_h0 = np.array(speed_weights["head.0.bias"], dtype=np.float32)
    h0 = np.maximum(0.0, np.dot(w_h0, rep) + b_h0)
    
    w_h3 = np.array(speed_weights["head.3.weight"], dtype=np.float32)
    b_h3 = np.array(speed_weights["head.3.bias"], dtype=np.float32)
    raw_pred = np.dot(w_h3, h0)[0] + b_h3[0]
    
    speed_kmh = max(0.0, raw_pred * meta["speed_model"]["label_std"] + meta["speed_model"]["label_mean"])
    return speed_kmh

def predict_yaw_numpy(raw_window_20x7):
    feat_mean = np.array(meta["yaw_model"]["feat_mean"], dtype=np.float32)
    feat_std = np.array(meta["yaw_model"]["feat_std"], dtype=np.float32)
    x_norm = (raw_window_20x7 - feat_mean) / feat_std
    
    # LSTM Layer 0
    l0_out = run_bilstm(
        x_norm,
        np.array(yaw_weights["lstm.weight_ih_l0"], dtype=np.float32),
        np.array(yaw_weights["lstm.weight_hh_l0"], dtype=np.float32),
        np.array(yaw_weights["lstm.bias_ih_l0"], dtype=np.float32),
        np.array(yaw_weights["lstm.bias_hh_l0"], dtype=np.float32),
        np.array(yaw_weights["lstm.weight_ih_l0_reverse"], dtype=np.float32),
        np.array(yaw_weights["lstm.weight_hh_l0_reverse"], dtype=np.float32),
        np.array(yaw_weights["lstm.bias_ih_l0_reverse"], dtype=np.float32),
        np.array(yaw_weights["lstm.bias_hh_l0_reverse"], dtype=np.float32)
    ) # (20, 128)
    
    # LSTM Layer 1
    l1_out = run_bilstm(
        l0_out,
        np.array(yaw_weights["lstm.weight_ih_l1"], dtype=np.float32),
        np.array(yaw_weights["lstm.weight_hh_l1"], dtype=np.float32),
        np.array(yaw_weights["lstm.bias_ih_l1"], dtype=np.float32),
        np.array(yaw_weights["lstm.bias_hh_l1"], dtype=np.float32),
        np.array(yaw_weights["lstm.weight_ih_l1_reverse"], dtype=np.float32),
        np.array(yaw_weights["lstm.weight_hh_l1_reverse"], dtype=np.float32),
        np.array(yaw_weights["lstm.bias_ih_l1_reverse"], dtype=np.float32),
        np.array(yaw_weights["lstm.bias_hh_l1_reverse"], dtype=np.float32)
    ) # (20, 128)
    
    last_s = l1_out[-1] # (128,)
    
    # Head
    w_h0 = np.array(yaw_weights["head.0.weight"], dtype=np.float32)
    b_h0 = np.array(yaw_weights["head.0.bias"], dtype=np.float32)
    h0 = np.maximum(0.0, np.dot(w_h0, last_s) + b_h0)
    
    w_h3 = np.array(yaw_weights["head.3.weight"], dtype=np.float32)
    b_h3 = np.array(yaw_weights["head.3.bias"], dtype=np.float32)
    raw_pred = np.dot(w_h3, h0)[0] + b_h3[0]
    
    yaw_rate_dps = raw_pred * meta["yaw_model"]["yaw_std"] + meta["yaw_model"]["yaw_mean"]
    return yaw_rate_dps

# Compare with PyTorch test
print("Verifying mathematical parity on sample input...")
from convert_models_to_tf import speed_pt_model, yaw_pt_model, speed_ckpt, yaw_ckpt

sample_speed_input = np.random.randn(20, 10).astype(np.float32)
py_speed = predict_speed_numpy(sample_speed_input)

# PyTorch
with torch.no_grad():
    x_t = torch.tensor((sample_speed_input - np.array(meta["speed_model"]["feat_mean"])) / np.array(meta["speed_model"]["feat_std"]), dtype=torch.float32).unsqueeze(0)
    pt_speed = max(0.0, float(speed_pt_model(x_t).item()) * float(speed_ckpt["label_std"]) + float(speed_ckpt["label_mean"]))

print(f"Speed -> Tensor Engine: {py_speed:.5f} km/h | PyTorch: {pt_speed:.5f} km/h | Diff: {abs(py_speed - pt_speed):.2e}")

sample_yaw_input = np.random.randn(20, 7).astype(np.float32)
py_yaw = predict_yaw_numpy(sample_yaw_input)

# PyTorch
with torch.no_grad():
    y_t = torch.tensor((sample_yaw_input - np.array(meta["yaw_model"]["feat_mean"])) / np.array(meta["yaw_model"]["feat_std"]), dtype=torch.float32).unsqueeze(0)
    pt_yaw = float(yaw_pt_model(y_t).item()) * float(yaw_ckpt["yaw_std"]) + float(yaw_ckpt["yaw_mean"])

print(f"Yaw   -> Tensor Engine: {py_yaw:.5f} deg/s | PyTorch: {pt_yaw:.5f} deg/s | Diff: {abs(py_yaw - pt_yaw):.2e}")
