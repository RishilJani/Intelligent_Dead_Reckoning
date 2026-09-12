Speed model

### Input

The speed model receives a causal window of shape `(batch, 20, 10)`, covering
2 seconds at 10 Hz. The ten channels are:

1. `accel_x`
2. `accel_y`
3. `accel_z`
4. `gyro_x`
5. `gyro_y`
6. `gyro_z`
7. `accel_mag`
8. `linear_accel_mag`
9. `gyro_mag`
10. `jerk`

Features are normalized using training-split mean and standard deviation.

### Architecture

`SpeedRegressor`:

- Two 1D convolution layers: 32 and 64 channels
- ReLU and batch normalization
- Bidirectional LSTM with hidden size 64
- Last-hidden, mean-pooling, and max-pooling features
- Two fully-connected layers
- One scalar normalized speed output

### Output

The model output is a normalized scalar:

```text
speed_kmh = model_output * label_std + label_mean
speed_mps = max(speed_kmh, 0) / 3.6