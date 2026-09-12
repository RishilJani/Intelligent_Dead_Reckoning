import { SensorPipeline, LiveSensorTelemetry } from './sensorPipeline';
import { predictDeadReckoning, ModelPrediction } from './tfInference';

export interface DeadReckoningState {
  lat: number;
  lon: number;
  heading: number;
  speedKmh: number;
  yawRateDps: number;
  mode: 'GPS' | 'TF_DEAD_RECKONING';
  accuracyMeters: number;
  /** true when GPS signal has been received within the freshness window */
  gpsAvailable: boolean;
  /** Real-time sensor telemetry values (accel, gyro, jerk, buffer) */
  telemetry?: LiveSensorTelemetry;
}

export class DeadReckoningEngine {
  private static instance: DeadReckoningEngine | null = null;

  private sensorPipeline: SensorPipeline;
  private isNavigating = false;
  private isOfflineMode = false;
  private lastGpsTimestamp = 0;
  private lastGpsCoords: { lat: number; lon: number; heading: number; speedKmh: number } | null = null;
  /** Timeout in ms: if no GPS fix arrives within this window, GPS is considered lost/offline */
  private readonly GPS_FRESHNESS_MS = 6000;

  // Current dead-reckoning state
  private currentState: DeadReckoningState = {
    lat: 28.6139,
    lon: 77.2090,
    heading: 0,
    speedKmh: 0,
    yawRateDps: 0,
    mode: 'GPS',
    accuracyMeters: 10,
    gpsAvailable: false,
  };

  private activeRouteCoords: [number, number][] = [];
  private onStateUpdateCallbacks: ((state: DeadReckoningState) => void)[] = [];

  // Model prediction 2.0s interval control
  private lastModelInferenceTime = 0;
  private readonly MODEL_INTERVAL_MS = 2000; // 2.0s gap between ONNX neural model predictions
  private lastPredictedSpeedKmh = 0;
  private lastPredictedYawRateDps = 0;

  private constructor() {
    this.sensorPipeline = SensorPipeline.getInstance();
  }

  public static getInstance(): DeadReckoningEngine {
    if (!DeadReckoningEngine.instance) {
      DeadReckoningEngine.instance = new DeadReckoningEngine();
    }
    return DeadReckoningEngine.instance;
  }

  public start(onUpdate?: (state: DeadReckoningState) => void) {
    if (onUpdate) {
      this.onStateUpdateCallbacks.push(onUpdate);
    }
    this.isNavigating = true;
    this.lastModelInferenceTime = 0; // Trigger model inference immediately on first offline frame

    // Immediately broadcast current state so navigation starts in the correct mode
    this.broadcastState();

    this.sensorPipeline.start((windowData) => {
      this.step(windowData);
    });
  }

  public stop() {
    this.isNavigating = false;
    this.sensorPipeline.stop();
    this.onStateUpdateCallbacks = [];
    this.lastModelInferenceTime = 0;
    this.lastPredictedSpeedKmh = 0;
    this.lastPredictedYawRateDps = 0;
  }

  /**
   * Set offline mode. When offline is true, GPS is forced offline,
   * so navigation location is driven by the ONNX dead-reckoning model with 2s epoch gap.
   */
  public setOfflineMode(offline: boolean) {
    this.isOfflineMode = offline;
    if (offline) {
      this.currentState.gpsAvailable = false;
      this.currentState.mode = 'TF_DEAD_RECKONING';
      this.lastModelInferenceTime = 0; // Trigger model inference immediately on next tick

      // Anchor starting position from the last known GPS reading
      if (this.lastGpsCoords) {
        this.currentState.lat = this.lastGpsCoords.lat;
        this.currentState.lon = this.lastGpsCoords.lon;
        if (this.lastGpsCoords.heading !== 0) {
          this.currentState.heading = this.lastGpsCoords.heading;
        }
      }
      this.broadcastState();
    } else {
      // Re-evaluating online state: if we have fresh GPS, switch back
      const isGpsFresh = Date.now() - this.lastGpsTimestamp < this.GPS_FRESHNESS_MS;
      if (isGpsFresh && this.lastGpsCoords) {
        this.currentState.gpsAvailable = true;
        this.currentState.mode = 'GPS';
        this.currentState.lat = this.lastGpsCoords.lat;
        this.currentState.lon = this.lastGpsCoords.lon;
        this.broadcastState();
      }
    }
  }

  public setActiveRoute(coords: [number, number][]) {
    this.activeRouteCoords = coords;
  }

  /**
   * Update with fresh GPS reading from device.
   * When GPS is online, this is the primary and ONLY source for navigation location.
   */
  public updateGpsPosition(lat: number, lon: number, heading: number = 0, speedKmh: number = 0) {
    this.lastGpsTimestamp = Date.now();

    // Noise deadband & ZUPT filter:
    // 1. Any GPS speed < 2.5 km/h is satellite clock jitter/drift, clamp to 0
    // 2. If phone is motionless on a table or stopped in traffic, clamp to 0
    let cleanSpeed = speedKmh < 2.5 ? 0 : speedKmh;
    if (this.sensorPipeline.isStationary()) {
      cleanSpeed = 0;
    }

    this.lastGpsCoords = { lat, lon, heading, speedKmh: cleanSpeed };

    // When offline mode is enabled, ignore GPS position
    if (this.isOfflineMode) {
      return;
    }

    // GPS is online -> navigation location strictly follows GPS signal
    this.currentState.lat = lat;
    this.currentState.lon = lon;
    if (heading !== 0) this.currentState.heading = heading;
    this.currentState.speedKmh = cleanSpeed;
    this.currentState.yawRateDps = 0;
    this.currentState.mode = 'GPS';
    this.currentState.gpsAvailable = true;
    this.currentState.accuracyMeters = 8;
    this.broadcastState();
  }

  /**
   * 10Hz Step:
   *  - When GPS is ONLINE: navigation location is driven purely by GPS signal.
   *  - When GPS is OFFLINE: (only then) location is predicted by the on-device ONNX model.
   */
  private step(windowData: number[][]) {
    if (!this.isNavigating) return;

    try {
      const now = Date.now();
      const isGpsUsable =
        !this.isOfflineMode &&
        this.lastGpsCoords !== null &&
        now - this.lastGpsTimestamp < this.GPS_FRESHNESS_MS;

      const dt = 0.1; // 10Hz = 100ms

      const telemetry = this.sensorPipeline.getLatestTelemetry();
      this.currentState.telemetry = telemetry;

      // Check if phone is motionless (e.g. placed on a table)
      const isStationary = this.sensorPipeline.isStationary();

      if (isGpsUsable && this.lastGpsCoords) {
        // ── GPS IS ONLINE ──────────────────────────────────────────
        // Location comes strictly from GPS signal!
        this.currentState.mode = 'GPS';
        this.currentState.gpsAvailable = true;
        this.currentState.lat = this.lastGpsCoords.lat;
        this.currentState.lon = this.lastGpsCoords.lon;
        // If motionless on a table, speed is strictly 0 regardless of GPS multipath jitter
        this.currentState.speedKmh = isStationary ? 0 : this.lastGpsCoords.speedKmh;
        this.currentState.yawRateDps = 0;
        this.currentState.accuracyMeters = 8;
        if (this.lastGpsCoords.heading !== 0) {
          this.currentState.heading = this.lastGpsCoords.heading;
        }

        // Broadcast state with real-time sensor telemetry
        this.broadcastState();
        // Do NOT run dead reckoning or overwrite lat/lon while GPS is online!
      } else {
        // ── GPS IS OFFLINE (Signal lost / unavailable / offline mode) ──
        // If device is stationary on table, speed and yaw rate are immediately 0
        if (isStationary) {
          this.lastPredictedSpeedKmh = 0;
          this.lastPredictedYawRateDps = 0;
        } else if (now - this.lastModelInferenceTime >= this.MODEL_INTERVAL_MS) {
          // Execute Model prediction with a 2-second interval gap (20 samples window @ 10Hz)
          try {
            const pred: ModelPrediction = predictDeadReckoning(windowData);
            this.lastPredictedSpeedKmh = Math.max(0, pred.speedKmh);
            this.lastPredictedYawRateDps = pred.yawRateDps;
            this.lastModelInferenceTime = now;
          } catch (modelErr) {
            console.warn('[DeadReckoningEngine] Model inference warning:', modelErr);
          }
        }

        this.currentState.mode = 'TF_DEAD_RECKONING';
        this.currentState.gpsAvailable = false;
        this.currentState.speedKmh = isStationary ? 0 : this.lastPredictedSpeedKmh;
        this.currentState.yawRateDps = isStationary ? 0 : this.lastPredictedYawRateDps;

        // 1. Integrate yaw rate -> update heading smoothly at 10Hz
        const dTheta = this.lastPredictedYawRateDps * dt;
        this.currentState.heading = (this.currentState.heading + dTheta + 360) % 360;

        // 2. Compute displacement from predicted speed
        const speedMps = this.lastPredictedSpeedKmh / 3.6;
        const distMeters = speedMps * dt;

        const headingRad = (this.currentState.heading * Math.PI) / 180;
        const dx = distMeters * Math.sin(headingRad); // East
        const dy = distMeters * Math.cos(headingRad); // North

        // Earth radius ≈ 6,371,000 m
        const dLat = (dy / 6371000) * (180 / Math.PI);
        const dLon =
          (dx / (6371000 * Math.cos((this.currentState.lat * Math.PI) / 180))) *
          (180 / Math.PI);

        let nextLat = this.currentState.lat + dLat;
        let nextLon = this.currentState.lon + dLon;

        // 3. Snap to route polyline to reduce drift
        if (this.activeRouteCoords.length > 1 && distMeters > 0.02) {
          const snapped = this.snapToRoute(nextLat, nextLon);
          if (snapped) {
            nextLat = snapped.lat;
            nextLon = snapped.lon;
          }
        }

        this.currentState.lat = nextLat;
        this.currentState.lon = nextLon;
        this.currentState.accuracyMeters = 15;

        // Broadcast state (with 10Hz real-time sensor telemetry)
        this.broadcastState();
      }
    } catch (e) {
      console.warn('Dead reckoning step error:', e);
    }
  }

  private snapToRoute(lat: number, lon: number): { lat: number; lon: number } | null {
    if (this.activeRouteCoords.length < 2) return null;
    let minD = Infinity;
    let bestPt = null;

    for (let i = 0; i < this.activeRouteCoords.length; i++) {
      const pt = this.activeRouteCoords[i];
      const d = Math.hypot(lat - pt[0], lon - pt[1]);
      if (d < minD && d < 0.0006) {
        // Within ~50 meters of route
        minD = d;
        bestPt = { lat: pt[0], lon: pt[1] };
      }
    }
    return bestPt;
  }

  private broadcastState() {
    const copy = { ...this.currentState };
    for (const cb of this.onStateUpdateCallbacks) {
      cb(copy);
    }
  }
}
