# IO-VNBD Dataset — Structure, Fields, and How It Was Used

## 1. What IO-VNBD Is

**IO-VNBD** (Inertial and Odometry Vehicle Navigation Benchmark Dataset) is a public
dataset from Onyekpe, Palade, Kanarachos & Szkolnik (2021), *"IO-VNBD: Inertial and
Odometry Benchmark Dataset for Ground Vehicle Positioning,"* published in *Data in
Brief*. It exists specifically to support research on smartphone-based dead reckoning:
it pairs **noisy smartphone sensor recordings** with **precise vehicle-CAN-bus ground
truth**, recorded simultaneously in the same car, across multiple drivers and driving
sessions.

This is exactly the pairing your project needs: noisy input (what a real phone would
see) matched against precise, independent ground truth (what actually happened) —
letting you train a model to correct the noisy signal against known-correct answers,
and later score your dead-reckoning drift against real GPS ground truth.

---

## 2. Folder Structure

```
IO-VNBD-master/
├── Synchronised V abd S datasets/            <- USED
│   ├── Categorised IOVNB Dataset/            <- USED
│   │   ├── S (Driver A)/{S1, S2, S3a, S3b, S3c, S4}/
│   │   ├── M (Driver B)/
│   │   ├── Vf (Driver E)/{Vfa01, Vfa02}/
│   │   ├── Vta (Driver E)/{Vta01a...Vta30}/     (30 sessions)
│   │   ├── Vtb (Driver E)/{Vtb01...Vtb12}/      (12 sessions)
│   │   ├── Vw (Driver E)/{Vw01...Vw17}/         (17 sessions)
│   │   └── Y (Driver D)/{Y1}/
│   └── Uncategorised IOVNB Dataset/           <- NOT used
│       (same files, flattened into two folders "S-Dataset"/"V-Dataset"
│        instead of grouped by driver — no benefit over Categorised)
├── Unsynchronised V and S Dataset/            <- NOT used
│   (S- and V- files here are NOT time-aligned to each other; using them
│    would require manually solving the sync problem the "Synchronised"
│    folder already solves for you)
└── README_1.pdf                                (original dataset docs)
```

**Why `Synchronised / Categorised` and nothing else:**
- **Synchronised** (not Unsynchronised) — S- and V- files in this folder are already
  time-aligned sample-for-sample. The Unsynchronised folder's files come from the same
  recordings but without that alignment solved, which would add a nontrivial
  preprocessing burden with no upside for this project.
- **Categorised** (not Uncategorised) — identical file contents, just organized into
  per-driver, per-session folders instead of two giant flat folders. This grouping is
  what makes a clean **driver-based train/val/test split** possible (see §5).

**Driver/session naming**, as literally given by the folder names: `S` = Driver A,
`M` = Driver B, `Y` = Driver D, and `Vf`/`Vta`/`Vtb`/`Vw` = Driver E across four
different sets of driving sessions (Driver E has by far the most recorded sessions —
30+12+17+2 = 61 of the ~72 total session pairs). Each numbered subfolder (e.g.
`Vta01a`, `Vw05`) is one independent, continuous drive.

**File pairing convention:** every session has exactly two files —
`S-<session>.csv` and `V-<session>.csv` — sharing the same driving run, recorded
simultaneously, at the same 10Hz sample rate.

---

## 3. `S-*.csv` — Smartphone Files (the noisy input)

Recorded via the **AndroSensor** Android app. This is what a real user's phone would
actually produce — your model's job is to correct for everything noisy in here.

| Column (as it appears in real headers) | Meaning | Used in this project |
|---|---|---|
| GPS LATITUDE / LONGITUDE (degrees) | Phone's own GPS fix | Not used as a feature — phone GPS is only 1Hz and too coarse to serve as a training signal (see §5) |
| GPS ALTITUDE (m) | Phone's own GPS altitude | Not used |
| GPS SPEED (Kmh) | Phone's own GPS-derived speed | Not used — this is exactly the noisy signal we're trying to avoid depending on |
| GPS ACCURACY (m) | Reported GPS fix quality | Not used |
| GPS ORIENTATION (°) | GPS-derived heading | Not used |
| GPS SATELLITES IN RANGE | Satellite count | Not used |
| TIME SINCE START (ms) | Recording timestamp | Used only for alignment, not as a feature |
| DATE | Wall-clock date/time | Not used |
| **ACCELEROMETER X / Y / Z (m/s²)** | Raw 3-axis accelerometer, phone frame | **Used** — core model input |
| GRAVITY X / Y / Z (m/s²) | AndroSensor's isolated low-pass gravity estimate | Mapped but not currently in the model's feature set (flagged in this project as a better tilt-compensation source than raw accel — see README §"further work") |
| **GYROSCOPE Yaw / Pitch / Roll (rad/s)** | Raw 3-axis gyroscope, mapped to `gyro_z`/`gyro_y`/`gyro_x` respectively | **Used** — core model input, `gyro_z` (yaw axis) is the heading-rate signal |
| MAGNETIC FIELD X / Y / Z (μT) | Raw magnetometer | Mapped but not in current feature set (was tested via the phone's *fused* compass output instead — see below) |
| ORIENTATION (Yaw/Pitch/Roll) (°) | Phone's own on-device fused compass heading | Mapped and *tested* as a heading-correction signal (compass complementary filter), but found unreliable in-vehicle (40–60% of samples rejected as implausible spikes — vehicle acceleration corrupts Android's tilt-compensation assumption) |

**Bottom line on S-files:** only the 6 raw motion axes (`accel_x/y/z`, `gyro_x/y/z`)
are actually fed into the model. Everything else in the S-file was either evaluated
and found not useful (phone's own GPS/compass) or is a documented candidate for
future improvement (gravity, raw magnetometer).

---

## 4. `V-*.csv` — Vehicle CAN-Bus Files (the ground truth)

Recorded via a **Racelogic VBOX**, wired into the vehicle's own CAN bus and a
high-precision GPS unit. This is the "truth" your model is trained against — it is
**not** what a real deployed app would have access to; it only exists in the training
dataset.

| Column | Meaning | Used in this project |
|---|---|---|
| No of GPS Satellites Available | Satellite count | Not used |
| Time Since Start of Day (seconds) | Recording timestamp | Alignment only |
| **Latitude / Longitude (degrees)** | High-precision vehicle GPS position | **Used** — ground truth trajectory for computing drift %, and for the yaw-rate sign-calibration step |
| **Velocity (km/hr)** | VBOX's own GPS-derived speed | Available, not the primary speed label (see below) |
| Heading (degrees) | VBOX GPS-derived heading | Available, tested as an alternative to computing heading from position deltas |
| Height (km) | GPS altitude | Not used |
| Vertical velocity (km/hr) | Vertical GPS speed | Not used |
| Sample period (seconds) | Nominal sample interval | Not used |
| Steering Angle (degrees) | Vehicle steering sensor | Not used (candidate feature, unused) |
| Wheel Speed Front/Rear Left/Right (rad/sec) | 4x individual wheel-speed sensors | Not used directly (candidate for a more precise speed ground truth than "Indicated Vehicle Speed", unused) |
| **Yaw Rate (deg/sec)** | Vehicle's own CAN-bus yaw-rate sensor | **Used** — ground-truth label for the multi-task heading-rate model |
| **Indicated Vehicle Speed (km/hr)** | Vehicle's own speedometer reading | **Used** — primary ground-truth label for the speed regression model |
| Indicated Longitudinal/Lateral Acceleration (g) | Vehicle accelerometer | Not used |
| Handbrake / Gear Requested / Gear / Engine Speed / Coolant Temp / Clutch / Brake Pressure / Brake Position / Battery Voltage / Air Temp / Accelerator Pedal Position | Vehicle operational state | Not used — outside scope of a positioning model |

**Bottom line on V-files:** three fields matter — **Indicated Vehicle Speed**
(speed label), **Yaw Rate** (heading-rate label), and **Latitude/Longitude**
(ground-truth trajectory for scoring drift). Everything else was mapped by the loader
(for completeness/future use) but isn't in the current training loop.

---

## 5. How the Dataset Is Actually Used, Step by Step

### Step 1 — Session discovery & pairing
`find_session_pairs()` walks `Synchronised V abd S datasets/Categorised IOVNB
Dataset/`, finds every `S-*.csv`, and matches it to its corresponding `V-*.csv` in
the same folder (same session, e.g. `S-Vta05.csv` ↔ `V-Vta05.csv`). This produced
**72 session pairs** across 7 driver folders.

### Step 2 — Fuzzy column matching
Real AndroSensor/VBOX exports don't match any published schema exactly — headers vary
in capitalization, spacing, and unit notation between export batches. Rather than
hardcoding exact strings (which silently breaks the moment a header differs), every
column is matched by **keyword search** (`build_column_map()`), and any field that
can't be confidently matched prints a loud warning rather than failing silently on
mismatched data.

### Step 3 — Time alignment
Both files are trimmed to the shorter of the two lengths and aligned by row index —
both are already recorded at 10Hz per the dataset's own documentation, and the
"Synchronised" folder specifically guarantees this alignment is already correct.

### Step 4 — Label extraction (ground truth from the V-file)
Two labels are pulled per row: **Indicated Vehicle Speed** (→ `indicated_speed`,
km/h) and **Yaw Rate** (→ `yaw_rate`, deg/s). This is the critical design choice of
the whole project: the model **never** trains against the smartphone's own noisy GPS
speed — it always trains against the vehicle's own precise CAN-bus sensors, so the
model learns to map *noisy phone motion* → *true vehicle motion*.

### Step 5 — Feature engineering (from the S-file)
Six raw axes (`accel_x/y/z`, `gyro_x/y/z`) plus four engineered features computed
from them:
- `accel_mag = sqrt(ax²+ay²+az²)` — orientation-independent total force, robust to
  how the phone happens to be rotated in its mount.
- `linear_accel_mag = accel_mag − 9.80665` — approximate "real" vehicle acceleration
  with gravity's contribution removed.
- `gyro_mag = sqrt(gx²+gy²+gz²)` — total rotation rate, orientation-independent.
- `jerk = d(accel_mag)/dt` — captures sharp events (potholes, gear changes, hard
  braking) that raw acceleration alone smooths over.

Final feature vector: **10 channels per timestep**.

### Step 6 — Windowing
A sliding 2-second window (20 samples @ 10Hz) with 50% overlap (1-second stride) is
swept across each session. Each window's label is the *mean* speed/yaw-rate across
that window (more robust to a single noisy CAN reading than taking just the last
sample). This turns each continuous drive into many independent `(20 timesteps × 10
features) → (speed, yaw_rate)` training examples.

### Step 7 — Driver-based train/val/test split
Sessions are split **by driver folder**, never by individual row:

| Split | Driver folders |
|---|---|
| Train | S (Driver A), Vta (Driver E), Vtb (Driver E) |
| Val | M (Driver B), Vw (Driver E) |
| Test | Y (Driver D), Vf (Driver E) |

This matters because a random row-level split would let the model "cheat" — adjacent
overlapping windows from the same drive are nearly identical, so random splitting
leaks information between train and validation. Splitting by whole driver/session
means validation/test performance reflects genuinely unseen driving.

### Step 8 — Normalization
Feature and label statistics (mean/std) are computed from the **training split
only**, then applied to all three splits — never fitting normalization on val/test
data, which would leak distributional information about data the model is supposed
to have never seen.

### Result (last successful full build)
```
Train windows: 55,122   (10 features × 20 timesteps each)
Val windows:   36,924
Test windows:  14,925
```

### Step 9 — Ground truth trajectory, kept separately
`gps_lat`/`gps_lon` from the V-file are carried through the pipeline (not as model
features, but as a parallel column) specifically to reconstruct the **true**
vehicle path later, for scoring drift % in `ins_mechanization.py`/`evaluate_60s.py` —
this is what the naive INS baseline, the AI-corrected trajectory, and the drift-curve
plots are all compared against.

### Step 10 — ZUPT threshold tuning (separate from the main training loop)
`zupt.py` is tuned directly against IO-VNBD's own documented **stationary sessions**
(`Vw01`, `Vw15` — labeled "stationary, sensor bias estimation" in the dataset
descriptor): known-still recordings used to empirically derive the
accelerometer/gyro variance thresholds that later decide "is the vehicle currently
stopped" during evaluation.
