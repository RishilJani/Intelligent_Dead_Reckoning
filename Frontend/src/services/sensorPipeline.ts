import { Platform, NativeModules } from 'react-native';

export type FeatureVector = [
  number, // 0: accel_x
  number, // 1: accel_y
  number, // 2: accel_z
  number, // 3: gyro_x
  number, // 4: gyro_y
  number, // 5: gyro_z
  number, // 6: accel_mag
  number, // 7: linear_accel_mag
  number, // 8: gyro_mag
  number  // 9: jerk
];

export interface LiveSensorTelemetry {
  accelX: number;
  accelY: number;
  accelZ: number;
  accelMag: number;
  gyroX: number;
  gyroY: number;
  gyroZ: number;
  gyroMag: number;
  jerk: number;
  bufferLength: number;
}

function getNativeSensors() {
  if (Platform.OS === 'web') {
    return { Accel: null, Gyro: null };
  }

  let Accel: any = null;
  let Gyro: any = null;

  let hasNativeAccel = false;
  let hasNativeGyro = false;

  // Safely check if native sensor modules are linked into the native APK runtime
  try {
    const { requireOptionalNativeModule } = require('expo-modules-core');
    if (typeof requireOptionalNativeModule === 'function') {
      hasNativeAccel = !!requireOptionalNativeModule('ExponentAccelerometer');
      hasNativeGyro = !!requireOptionalNativeModule('ExponentGyroscope');
    }
  } catch (_e) {
    // If expo-modules-core cannot check, do not assume native modules exist
  }

  // Only load modules if the native binary actually has them registered
  if (hasNativeAccel) {
    try {
      const mod = require('expo-sensors/build/Accelerometer');
      Accel = mod?.default || mod?.Accelerometer || mod;
    } catch (_e) {
      // Graceful fallback
    }
  }

  if (hasNativeGyro) {
    try {
      const mod = require('expo-sensors/build/Gyroscope');
      Gyro = mod?.default || mod?.Gyroscope || mod;
    } catch (_e) {
      // Graceful fallback
    }
  }

  return { Accel, Gyro };
}


export class SensorPipeline {
  private static instance: SensorPipeline | null = null;

  private buffer: FeatureVector[] = [];
  private readonly windowSize = 20; // 2 seconds @ 10Hz
  private isRunning = false;
  private timer: any = null;

  // Latest raw sensor values
  private currentAccel = { x: 0, y: 0, z: 9.81 };
  private currentGyro = { x: 0, y: 0, z: 0 };
  private prevAccelMag = 9.81;

  private accelSub: any = null;
  private gyroSub: any = null;
  private listeners: ((window: number[][]) => void)[] = [];

  public static getInstance(): SensorPipeline {
    if (!SensorPipeline.instance) {
      SensorPipeline.instance = new SensorPipeline();
    }
    return SensorPipeline.instance;
  }

  public start(onWindowReady?: (window: number[][]) => void) {
    if (onWindowReady) {
      this.listeners.push(onWindowReady);
    }
    if (this.isRunning) return;
    this.isRunning = true;

    // Set 10Hz (100ms) update interval
    const updateIntervalMs = 100;

    try {
      if (Platform.OS !== 'web') {
        const { Accel, Gyro } = getNativeSensors();

        if (Accel && typeof Accel.addListener === 'function') {
          if (typeof Accel.setUpdateInterval === 'function') {
            Accel.setUpdateInterval(updateIntervalMs);
          }
          this.accelSub = Accel.addListener((data: { x: number; y: number; z: number }) => {
            // Expo accelerometer outputs in Gs, convert to m/s^2
            const x = (data?.x != null ? data.x : 0) * 9.81;
            const y = (data?.y != null ? data.y : 0) * 9.81;
            const z = (data?.z != null ? data.z : 1) * 9.81;
            this.currentAccel = { x, y, z };
          });
        }

        if (Gyro && typeof Gyro.addListener === 'function') {
          if (typeof Gyro.setUpdateInterval === 'function') {
            Gyro.setUpdateInterval(updateIntervalMs);
          }
          this.gyroSub = Gyro.addListener((data: { x: number; y: number; z: number }) => {
            // Gyroscope outputs in rad/s
            const x = data?.x != null ? data.x : 0;
            const y = data?.y != null ? data.y : 0;
            const z = data?.z != null ? data.z : 0;
            this.currentGyro = { x, y, z };
          });
        }
      } else if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
        // Web browser DeviceMotion API support
        const onDeviceMotion = (e: DeviceMotionEvent) => {
          if (e.accelerationIncludingGravity) {
            this.currentAccel = {
              x: e.accelerationIncludingGravity.x || 0,
              y: e.accelerationIncludingGravity.y || 0,
              z: e.accelerationIncludingGravity.z || 9.81,
            };
          }
          if (e.rotationRate) {
            this.currentGyro = {
              x: (e.rotationRate.alpha || 0) * (Math.PI / 180),
              y: (e.rotationRate.beta || 0) * (Math.PI / 180),
              z: (e.rotationRate.gamma || 0) * (Math.PI / 180),
            };
          }
        };
        window.addEventListener('devicemotion', onDeviceMotion);
        this.accelSub = {
          remove: () => window.removeEventListener('devicemotion', onDeviceMotion),
        };
      }
    } catch (e) {
      console.warn('Sensor subscription notice:', e);
    }

    // 10Hz timer loop: push new 10-feature sample every 100ms
    this.timer = setInterval(() => {
      this.step();
    }, updateIntervalMs);
  }

  public stop() {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.accelSub && typeof this.accelSub.remove === 'function') {
      this.accelSub.remove();
      this.accelSub = null;
    }
    if (this.gyroSub && typeof this.gyroSub.remove === 'function') {
      this.gyroSub.remove();
      this.gyroSub = null;
    }
    this.listeners = [];
  }

  private lastExternalSensorTimestamp = 0;

  private step() {
    const now = Date.now();
    let ax = this.currentAccel.x;
    let ay = this.currentAccel.y;
    let az = this.currentAccel.z;

    let gx = this.currentGyro.x;
    let gy = this.currentGyro.y;
    let gz = this.currentGyro.z;

    // If external hardware bridge has not updated within 300ms, add realistic MEMS sensor noise floor
    if (now - this.lastExternalSensorTimestamp > 300) {
      const jitter = (scale: number) => (Math.random() - 0.5) * scale;
      ax += jitter(0.04);
      ay += jitter(0.04);
      az += jitter(0.04);
      gx += jitter(0.006);
      gy += jitter(0.006);
      gz += jitter(0.006);
    }

    const accelMag = Math.sqrt(ax * ax + ay * ay + az * az);
    const linearAccelMag = Math.abs(accelMag - 9.81);
    const gyroMag = Math.sqrt(gx * gx + gy * gy + gz * gz);
    const jerk = Math.abs(accelMag - this.prevAccelMag) / 0.1; // Delta_t = 0.1s
    this.prevAccelMag = accelMag;

    const sample: FeatureVector = [
      ax,
      ay,
      az,
      gx,
      gy,
      gz,
      accelMag,
      linearAccelMag,
      gyroMag,
      jerk,
    ];

    this.buffer.push(sample);
    if (this.buffer.length > this.windowSize) {
      this.buffer.shift();
    }

    // Always notify listeners with current window on each 10Hz step
    const windowSnapshot = this.getWindow();
    for (const cb of this.listeners) {
      cb(windowSnapshot);
    }
  }

  /**
   * Get the current buffer (fills with stationary baseline if < 20 samples)
   */
  public getWindow(): number[][] {
    if (this.buffer.length === this.windowSize) {
      return this.buffer.map((row) => [...row]);
    }
    // Pad with baseline
    const baseline: FeatureVector = [0, 0, 9.81, 0, 0, 0, 9.81, 0, 0, 0];
    const padded = [...this.buffer];
    while (padded.length < this.windowSize) {
      padded.unshift(baseline);
    }
    return padded.map((row) => [...row]);
  }

  /**
   * Get latest live telemetry values from accelerometer & gyroscope
   */
  public getLatestTelemetry(): LiveSensorTelemetry {
    const ax = this.currentAccel.x;
    const ay = this.currentAccel.y;
    const az = this.currentAccel.z;
    const gx = this.currentGyro.x;
    const gy = this.currentGyro.y;
    const gz = this.currentGyro.z;
    const accelMag = Math.sqrt(ax * ax + ay * ay + az * az);
    const gyroMag = Math.sqrt(gx * gx + gy * gy + gz * gz);
    const jerk = Math.abs(accelMag - this.prevAccelMag) / 0.1;

    return {
      accelX: Number(ax.toFixed(2)),
      accelY: Number(ay.toFixed(2)),
      accelZ: Number(az.toFixed(2)),
      accelMag: Number(accelMag.toFixed(2)),
      gyroX: Number(gx.toFixed(3)),
      gyroY: Number(gy.toFixed(3)),
      gyroZ: Number(gz.toFixed(3)),
      gyroMag: Number(gyroMag.toFixed(3)),
      jerk: Number(jerk.toFixed(1)),
      bufferLength: this.buffer.length,
    };
  }

  /**
   * Feed real-time hardware motion data from mobile WebView sensor bridge
   */
  public feedExternalSensorData(
    ax: number,
    ay: number,
    az: number,
    gx: number,
    gy: number,
    gz: number
  ) {
    this.lastExternalSensorTimestamp = Date.now();
    this.currentAccel = {
      x: Number(ax) || 0,
      y: Number(ay) || 0,
      z: Number(az != null ? az : 9.81),
    };
    this.currentGyro = {
      x: Number(gx) || 0,
      y: Number(gy) || 0,
      z: Number(gz) || 0,
    };
  }

  /**
   * Determine if the physical device is motionless (e.g. resting on a table or stopped).
   * Evaluates high-frequency (10Hz) accelerometer variance, linear acceleration, and gyroscope rotation.
   */
  public isStationary(): boolean {
    const ax = this.currentAccel.x;
    const ay = this.currentAccel.y;
    const az = this.currentAccel.z;
    const gx = this.currentGyro.x;
    const gy = this.currentGyro.y;
    const gz = this.currentGyro.z;
    const accelMag = Math.sqrt(ax * ax + ay * ay + az * az);
    const linearAccelMag = Math.abs(accelMag - 9.81);
    const gyroMag = Math.sqrt(gx * gx + gy * gy + gz * gz);
    const jerk = Math.abs(accelMag - this.prevAccelMag) / 0.1;

    // Stationary thresholds (resting on table or stopped in traffic):
    // Linear acceleration < 0.35 m/s², gyro rotation < 0.08 rad/s, jerk < 0.8 m/s³
    return linearAccelMag < 0.35 && gyroMag < 0.08 && jerk < 0.8;
  }

  private lastGpsSpeedKmh = 0;
  private lastGpsHeading = 0;
  private lastGpsTime = 0;

  /**
   * Feed vehicle dynamics from GPS speed and heading changes
   */
  public feedGpsKinematics(speedKmh: number, heading: number) {
    const now = Date.now();
    // If device is stationary or GPS speed is below noise floor, do not inject artificial acceleration
    if (this.isStationary() || speedKmh < 2.5) {
      this.lastGpsSpeedKmh = 0;
      this.lastGpsHeading = heading;
      this.lastGpsTime = now;
      return;
    }

    if (this.lastGpsTime > 0) {
      const dt = Math.max(0.2, (now - this.lastGpsTime) / 1000);
      const dv = ((speedKmh - this.lastGpsSpeedKmh) / 3.6) / dt; // linear acceleration (m/s²)

      let dHead = heading - this.lastGpsHeading;
      while (dHead > 180) dHead -= 360;
      while (dHead < -180) dHead += 360;
      const yawRate = (dHead * (Math.PI / 180)) / dt; // angular velocity (rad/s)

      // When phone is mounted in car, merge longitudinal acceleration & turn yaw rate
      if (Math.abs(dv) > 0.15) {
        this.currentAccel.y = Number(dv.toFixed(2));
      }
      if (Math.abs(yawRate) > 0.02) {
        this.currentGyro.z = Number(yawRate.toFixed(3));
      }
    }
    this.lastGpsSpeedKmh = speedKmh;
    this.lastGpsHeading = heading;
    this.lastGpsTime = now;
  }
}
