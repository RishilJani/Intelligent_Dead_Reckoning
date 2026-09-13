# Intelligent Dead Reckoning (IDR) with GNSS Fusion
### Smart India Hackathon — Smartphone-based Vehicle Positioning in GNSS-Denied Environments

Turns a standalone smartphone into a lightweight, AI-corrected dead-reckoning system
that seamlessly fuses with GNSS, maintaining lane-level position accuracy through
tunnels, underground parking, and urban canyons — without any OBD-II/vehicle connection.

---

## 1. Problem Being Solved

GNSS (GPS/Galileo/NavIC) signals drop out in tunnels, multi-level parking, dense
forest, and urban canyons, causing navigation apps to freeze or jump. Most vehicles
on Indian roads (two-wheelers, older cars, trucks) have no factory INS — only a
dashboard-mounted smartphone. Raw smartphone IMU (accelerometer + gyroscope) drifts
within seconds if you just double-integrate it, because of sensor bias, chassis
vibration, and mount misalignment.

**Target:** < 10% positional drift during GNSS blackout
(e.g. < 100 m drift over 1 km at 60 km/h in a tunnel).

**Approach:** AI/ML-based dead reckoning (speed regression + bias correction) fused
with GNSS through a Kalman filter, snapped onto real roads via map-matching — running
in real time on-device, and reusable as a standalone edge-deployable engine for
non-smartphone IMUs (e.g. FOG-based, 200Hz).

---

## 2. Repository Structure

```
idr_project/
├── data/
│   ├── raw/                        # IO-VNBD-master (see §3) — not committed, .gitignored
│   └── processed/                  # train.npz / val.npz / test.npz (generated)
├── src/
│   ├── load_iovnbd.py              # dataset loader — matches IO-VNBD's real folder layout
│   ├── zupt.py                     # zero-velocity / zero-angular-rate detector
│   ├── models.py                   # SpeedRegressor (CNN + BiLSTM)
│   ├── ins_mechanization.py        # naive strapdown INS baseline (for drift comparison)
│   ├── ukf_fusion.py               # classical UKF, GNSS+INS fusion backbone
│   ├── train.py                    # training loop for SpeedRegressor
│   ├── evaluate.py                 # trajectory reconstruction + drift % computation
│   └── export_tflite.py            # PyTorch -> ONNX -> TFLite export for on-device
├── android_app/                    # Kotlin app: sensor capture, TFLite inference, UI
│   └── (see §6)
├── trajectory_comparison.png       # GT vs naive-INS vs AI-corrected DR (generated)
├── requirements.txt
└── README.md                       # this file
```

---

## 3. Dataset: IO-VNBD

**Source:** [github.com/onyekpeu/IO-VNBD](https://github.com/onyekpeu/IO-VNBD) —
Onyekpe et al., *"IO-VNBD: Inertial and Odometry Benchmark Dataset for Ground Vehicle
Positioning,"* Data in Brief, 2021.

Download and extract so the tree looks like this (this is the actual layout the
loader expects):

```
data/raw/IO-VNBD-master/
├── Synchronised V abd S datasets/
│   └── Categorised IOVNB Dataset/
│       ├── S (Driver A)/{S1, S2, S3a, S3b, S3c, S4}/S-*.csv, V-*.csv
│       ├── M (Driver B)/S-M.csv, V-M.csv
│       ├── Vf (Driver E)/{V-Vfa01, V-Vfa02}/S-*.csv, V-*.csv
│       ├── Vta (Driver E)/Vta01a … Vta30/S-*.csv, V-*.csv   (30 sessions)
│       ├── Vtb (Driver E)/Vtb01 … Vtb12/S-*.csv, V-*.csv    (12 sessions)
│       ├── Vw (Driver E)/Vw01 … Vw17/S-*.csv, V-*.csv       (17 sessions)
│       └── Y (Driver D)/Y1/S-*.csv, V-*.csv
├── Unsynchronised V and S Dataset/    # not time-aligned — skip unless doing manual sync
└── README_1.pdf                       # original dataset documentation
```

We use **`Synchronised V abd S datasets/Categorised IOVNB Dataset`** exclusively —
S- and V- files here are already time-aligned per session and grouped by driver.

### File meaning (this is the part that trips people up)

| Prefix | Source | Rate | Role in this project |
|---|---|---|---|
| `S-*.csv` | Smartphone (AndroSensor app): accel, gyro, magnetometer, orientation, 1Hz GPS | 10 Hz | **Model input** (noisy IMU) |
| `V-*.csv` | Vehicle CAN bus (Racelogic VBOX): 4x wheel speed, yaw rate, indicated vehicle speed, 10Hz GPS | 10 Hz | **Ground truth label** for training |

We train the speed-regressor on `S-` accelerometer/gyroscope windows, with the
target label taken from the paired `V-` file's **Indicated Vehicle Speed** (not the
smartphone's own GPS speed, which is 1Hz and too coarse to use as a training signal).

---

## 4. Setup

```bash
conda create -n idr python=3.10 -y
conda activate idr
pip install -r requirements.txt
```

`requirements.txt`:
```
torch
numpy
pandas
scipy
matplotlib
scikit-learn
filterpy
osmnx
geopandas
tensorflow
onnx
onnx-tf
leuvenmapmatching
tqdm
```

---

## 5. Pipeline: Data → Trained Model → Drift Plot

### Step 1 — Verify column headers match your actual CSVs
Real AndroSensor/VBOX exports sometimes differ slightly from the published schema.
Run this before anything else:

```bash
python src/load_iovnbd.py
```
This prints the real column names of one sample `S-` and `V-` file. If the loader's
keyword matcher warns it couldn't match a field, open `src/load_iovnbd.py` and adjust
the relevant entry in `S_COLUMN_KEYWORDS` / `V_COLUMN_KEYWORDS`.

### Step 2 — Build the windowed, driver-split dataset
Edit `IO_VNBD_ROOT` and the driver-split lists at the bottom of `load_iovnbd.py`,
then:
```bash
python src/load_iovnbd.py
```
Produces `data/processed/{train,val,test}.npz` — windowed IMU sequences with
speed labels, normalized using train-set statistics.

We split **by driver**, not by random row, so validation/test sessions are driving
styles/vehicles the model has never seen — this matters because random splitting
lets the model "cheat" on near-duplicate adjacent windows.

### Step 3 — Naive INS baseline (your "before AI" number)
```bash
python src/ins_mechanization.py
```
Runs plain double-integration on a held-out GNSS-denied segment. Expect drift to blow
up within 10–30 seconds — this is the number your AI model needs to beat.

### Step 4 — Train the AI speed regressor
```bash
python src/train.py
```
Trains the CNN+BiLSTM `SpeedRegressor` with a Huber loss (robust to pothole spikes),
saves `best_speed_model.pt`, logs train/val loss per epoch.

### Step 4b — Train the multi-task (speed + yaw) model
Rebuild windows first if you have not since labels switched to last-sample:
```bash
python src/load_iovnbd.py --build
python src/train_mutitask.py --epochs 50 --yaw_loss_weight 1.5
python src/evaluate_multitask.py --model best_multitask_model.pt --heading hybrid
```
This is the model used for the < 10% drift target. Inverse-density sampling
reduces speed regression-to-the-mean; hybrid heading blends phone gyro with
learned yaw so heading error does not compound as badly as yaw-only integration.

### Prototype API (Express) + React Native
```bash
cd backend && npm install && npm start
cd mobile && npm install && npx expo start
```
`POST /predict` and `POST /demo` on port 8080. Android emulator API host: `10.0.2.2`.

### Step 5 — Reconstruct trajectory, compute drift %, plot
```bash
python src/evaluate.py
```
Produces `trajectory_comparison.png` (ground truth vs naive INS vs AI-corrected DR)
and prints drift as a percentage of distance traveled — compare against the < 10%
benchmark. **This plot + the trained model is your screening-round deliverable.**

### Step 6 — GNSS+INS fusion (UKF)
```bash
python src/ukf_fusion.py
```
Classical UKF fusion loop: predicts every IMU tick, updates on GNSS fixes when
available. This is the seamless-handoff mechanism between GNSS-aided and pure DR mode.

### Step 7 — Export for on-device inference
```bash
python src/export_tflite.py
```
Converts the trained PyTorch model → ONNX → quantized TFLite (`speed_model.tflite`)
for the Android app.

---

## 6. On-Device (Android)

- Reads `TYPE_ACCELEROMETER`, `TYPE_GYROSCOPE`, `TYPE_MAGNETIC_FIELD` + `FusedLocationProviderClient`.
- Runs `speed_model.tflite` via the TFLite Interpreter on sliding 2-second windows.
- GNSS-quality check (accuracy < 15 m) decides GNSS-aided-INS vs pure dead-reckoning mode.
- UKF fusion core recommended in C++, exposed to Kotlin via JNI, so the same engine
  powers both the mobile app and the standalone edge-deployable software engine
  (satisfies the "not smartphone-only" requirement).

---

## 7. Performance Targets (from problem statement)

| Metric | Target |
|---|---|
| Dead reckoning drift | < 10% of distance traveled (e.g. < 5 m over 50 m in <1 min, or < 100 m over 1 km at 60 km/h) |
| GNSS+INS fusion update rate | 10 Hz on smartphone; ~200 Hz on edge engine with FOG-based IMU |
| Mode switch latency | Milliseconds, on GNSS acquisition/loss |

---

## 8. Status / TODO

- [ ] Confirm real CSV column headers via `inspect_columns()` on full dataset
- [ ] Naive INS baseline drift plot
- [ ] ZUPT detector tuned on stationary IO-VNBD segments (`Vw01`, `Vw15` — labeled
      "stationary, sensor bias estimation" in the dataset descriptor)
- [ ] SpeedRegressor trained, val loss curve logged
- [ ] Trajectory + drift % plot on held-out session
- [ ] UKF fusion running end-to-end on a synchronized session
- [ ] TFLite export under latency/size budget
- [ ] Android app: live sensor capture + inference + mode-switch UI
- [ ] Real-world test drive through a GNSS-denied environment, drift measured

---

## References

- Onyekpe, U., Palade, V., Kanarachos, S., Szkolnik, A. (2021). *IO-VNBD: Inertial
  and Odometry Benchmark Dataset for Ground Vehicle Positioning.* Data in Brief, 35,
  106885. https://doi.org/10.1016/j.dib.2021.106885
- Dataset repository: https://github.com/onyekpeu/IO-VNBD
