# Model input parameters

This file documents the exact input expected by the two requested PyTorch
checkpoints.

> The requested file `speed_prediction_cursor.pt` does not exist in the
> project. The available checkpoint is named `spped_prediction_cursor.pt`
> (with `spped` misspelled), and the details below describe that file.

## `canbus_yaw_model.pt`

### Task and output

- **Task:** CAN-bus yaw-rate regression
- **Output:** one scalar yaw rate in degrees/second (`deg/s`)
- **Output de-normalization:**

```text
yaw_rate_deg_s = model_output * 4.8296685 - 0.3365564
```

### Input tensor

```text
shape: (batch, 20, 7)
dtype: float32
```

- **20 samples:** 1.0 second at 20 Hz
- **7 channels:** six IMU channels plus cumulative gyro-z integral
- **Window stride used during training:** 0.25 seconds
- **Normalization:** `(raw_value - feat_mean) / feat_std`

| Index | Feature | Source / meaning | Unit |
|---:|---|---|---|
| 0 | `accel_x` | `MS_IMU.linear_accel[0]` | m/s² |
| 1 | `accel_y` | `MS_IMU.linear_accel[1]` | m/s² |
| 2 | `accel_z` | `MS_IMU.linear_accel[2]` | m/s² |
| 3 | `gyro_x` | `MS_IMU.rotation_rate[0]` | rad/s |
| 4 | `gyro_y` | `MS_IMU.rotation_rate[1]` | rad/s |
| 5 | `gyro_z` | `MS_IMU.rotation_rate[2]` | rad/s |
| 6 | `gyro_z_integral` | cumulative sum of `gyro_z / 20` | rad |

### Normalization parameters

Feature order is exactly the table order above.

```python
feat_mean = [
    -0.014376686, -0.059543498, 9.813111305,
     0.000018765, -0.000013931, -0.002416109, -0.001270706
]

feat_std = [
    0.705729306, 0.515651285, 0.428838283,
    0.020422908, 0.025737843, 0.085474059, 0.050660394
]
```

### Network parameters

- Architecture: `YawRegressor`
- Bidirectional LSTM
- LSTM hidden size: 64
- LSTM layers: 2
- Dropout: 0.2
- Trainable parameters: 145,025

## `spped_prediction_cursor.pt`

This is the available checkpoint corresponding to the requested
`speed_prediction_cursor.pt` name.

### Task and output

- **Task:** vehicle-speed regression
- **Output:** one scalar vehicle speed in km/h
- **Output de-normalization:**

```text
speed_kmh = model_output * 26.3564720 + 38.4870377
```

- Evaluation clamps negative predictions to 0 km/h.

### Input tensor

```text
shape: (batch, 20, 10)
dtype: float32
```

- **20 samples:** 2.0 seconds at 10 Hz
- **10 channels:** raw and engineered IO-VNBD IMU features
- **Window stride used by IO-VNBD preprocessing:** 5 samples (0.5 seconds)
- **Normalization:** `(raw_value - feat_mean) / feat_std`

| Index | Feature | Definition | Unit |
|---:|---|---|---|
| 0 | `accel_x` | smartphone accelerometer x | m/s² |
| 1 | `accel_y` | smartphone accelerometer y | m/s² |
| 2 | `accel_z` | smartphone accelerometer z | m/s² |
| 3 | `gyro_x` | smartphone gyroscope x | rad/s |
| 4 | `gyro_y` | smartphone gyroscope y | rad/s |
| 5 | `gyro_z` | smartphone gyroscope z / vehicle-yaw-aligned axis | rad/s |
| 6 | `accel_mag` | `sqrt(accel_x² + accel_y² + accel_z²)` | m/s² |
| 7 | `linear_accel_mag` | `accel_mag - 9.80665` | m/s² |
| 8 | `gyro_mag` | `sqrt(gyro_x² + gyro_y² + gyro_z²)` | rad/s |
| 9 | `jerk` | sample-to-sample `accel_mag` change × 10 Hz | m/s³ |

### Normalization parameters

Feature order is exactly the table order above.

```python
feat_mean = [
    0.009647287, -0.021446407, 9.847479820,
    0.000424114, -0.000593470, -0.001610990,
    9.924965858, 0.118315935, 0.113157600, 0.0
]

feat_std = [
    0.881257058, 0.880139351, 0.336685210,
    0.053567443, 0.048062719, 0.076377876,
    0.363425553, 0.363426149, 0.133504346, 3.480813026
]
```

### Network parameters

- Architecture: `SpeedRegressor`
- CNN input channels: 10
- CNN channels: 32 then 64
- Convolution kernel size: 3
- LSTM: bidirectional, hidden size 64, 1 layer
- Dropout: 0.28
- Loss used for the checkpoint: Huber loss on z-scored speed

## Minimal inference preparation

For either checkpoint, construct raw windows in the feature order documented
above, convert them to `float32`, and normalize each channel with that
checkpoint's own `feat_mean` and `feat_std`. Do not share normalization
statistics between the yaw and speed checkpoints.

```python
X_normalized = (X_raw - feat_mean) / feat_std
```
