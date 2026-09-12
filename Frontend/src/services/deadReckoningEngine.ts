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
  private routeSegmentIndex = 0;
  private routeSegmentProgressMeters = 0;
  private onStateUpdateCallbacks: ((state: DeadReckoningState) => void)[] = [];

  // Model prediction 2.0s interval control
  private lastModelInferenceTime = 0;
  private readonly MODEL_INTERVAL_MS = 2000; // 2.0s gap between neural model predictions
  private lastPredictedSpeedKmh = 0;
  private lastPredictedYawRateDps = 0;

  // ── MODEL SPEED PREDICTION BARRIER ────────────────────────
  // Suppresses sudden transient speed jumps caused by sharp mobile twitches.
  // - If model suddenly predicts high speed and it stays around that speed, keep that speed.
  // - If it suddenly predicts high speed and then suddenly drops back down to low speed,
  //   ignore that spike and keep past speed and location.
  private confirmedSpeedKmh = 0;
  private candidateHighSpeedKmh: number | null = null;
  private readonly SUDDEN_SPEED_JUMP_KMH = 12.0; // Jump threshold to trigger barrier verification
  private readonly SPEED_MAINTAIN_TOLERANCE_KMH = 10.0; // Speed band considered "around that speed"

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
    this.confirmedSpeedKmh = 0;
    this.candidateHighSpeedKmh = null;
  }

  /**
   * Set offline mode. When offline is true, GPS is forced offline,
   * so navigation location is driven by the dead-reckoning speed model with 2s epoch gap.
   */
  public setOfflineMode(offline: boolean) {
    this.isOfflineMode = offline;
    if (offline) {
      this.currentState.gpsAvailable = false;
      this.currentState.mode = 'TF_DEAD_RECKONING';
      this.lastModelInferenceTime = 0; // Trigger model inference immediately on next tick

      // Anchor starting position and speed barrier from the last known GPS reading
      if (this.lastGpsCoords) {
        this.currentState.lat = this.lastGpsCoords.lat;
        this.currentState.lon = this.lastGpsCoords.lon;
        this.confirmedSpeedKmh = this.lastGpsCoords.speedKmh || 0;
        this.lastPredictedSpeedKmh = this.confirmedSpeedKmh;
        this.candidateHighSpeedKmh = null;
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
    this.syncRouteProgress(this.currentState.lat, this.currentState.lon);
  }

  /**
   * Calculate distance between two lat/lon coordinates in meters.
   */
  private getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * Calculate initial bearing from point 1 to point 2 in degrees (0 - 360).
   */
  private getBearingDegrees(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const y = Math.sin(deltaLambda) * Math.cos(phi2);
    const x =
      Math.cos(phi1) * Math.sin(phi2) -
      Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
    const theta = Math.atan2(y, x);
    return ((theta * 180) / Math.PI + 360) % 360;
  }

  /**
   * Project a coordinate onto the active route polyline and synchronize segment index and progress.
   */
  private syncRouteProgress(lat: number, lon: number) {
    if (!this.activeRouteCoords || this.activeRouteCoords.length < 2) {
      this.routeSegmentIndex = 0;
      this.routeSegmentProgressMeters = 0;
      return;
    }

    let minDistance = Infinity;
    let bestSegmentIndex = 0;
    let bestProgressMeters = 0;

    for (let i = 0; i < this.activeRouteCoords.length - 1; i++) {
      const p1 = this.activeRouteCoords[i];
      const p2 = this.activeRouteCoords[i + 1];

      const segLenMeters = this.getDistanceMeters(p1[0], p1[1], p2[0], p2[1]);
      if (segLenMeters <= 0.1) continue;

      const dy = p2[0] - p1[0];
      const dx = p2[1] - p1[1];
      const lenSq = dx * dx + dy * dy;

      let t = 0;
      if (lenSq > 1e-12) {
        t = Math.max(0, Math.min(1, ((lat - p1[0]) * dy + (lon - p1[1]) * dx) / lenSq));
      }

      const projLat = p1[0] + t * dy;
      const projLon = p1[1] + t * dx;
      const dist = this.getDistanceMeters(lat, lon, projLat, projLon);

      if (dist < minDistance) {
        minDistance = dist;
        bestSegmentIndex = i;
        bestProgressMeters = t * segLenMeters;
      }
    }

    this.routeSegmentIndex = bestSegmentIndex;
    this.routeSegmentProgressMeters = bestProgressMeters;
  }

  /**
   * Advance the user position strictly along the navigation path by deltaMeters.
   */
  private advanceAlongRoute(deltaMeters: number): { lat: number; lon: number; heading: number } {
    if (!this.activeRouteCoords || this.activeRouteCoords.length < 2) {
      return {
        lat: this.currentState.lat,
        lon: this.currentState.lon,
        heading: this.currentState.heading,
      };
    }

    let remainingDist = deltaMeters;

    while (this.routeSegmentIndex < this.activeRouteCoords.length - 1 && remainingDist > 0) {
      const p1 = this.activeRouteCoords[this.routeSegmentIndex];
      const p2 = this.activeRouteCoords[this.routeSegmentIndex + 1];
      const segLenMeters = this.getDistanceMeters(p1[0], p1[1], p2[0], p2[1]);

      const distLeftInSegment = segLenMeters - this.routeSegmentProgressMeters;

      if (remainingDist < distLeftInSegment) {
        this.routeSegmentProgressMeters += remainingDist;
        remainingDist = 0;
        break;
      } else {
        remainingDist -= distLeftInSegment;
        if (this.routeSegmentIndex < this.activeRouteCoords.length - 2) {
          this.routeSegmentIndex++;
          this.routeSegmentProgressMeters = 0;
        } else {
          // Reached the final destination vertex of the route
          this.routeSegmentIndex = this.activeRouteCoords.length - 2;
          this.routeSegmentProgressMeters = segLenMeters;
          remainingDist = 0;
          break;
        }
      }
    }

    const currP1 = this.activeRouteCoords[this.routeSegmentIndex];
    const currP2 = this.activeRouteCoords[this.routeSegmentIndex + 1];
    const currSegLen = Math.max(0.1, this.getDistanceMeters(currP1[0], currP1[1], currP2[0], currP2[1]));
    const ratio = Math.max(0, Math.min(1, this.routeSegmentProgressMeters / currSegLen));

    const interpLat = currP1[0] + ratio * (currP2[0] - currP1[0]);
    const interpLon = currP1[1] + ratio * (currP2[1] - currP1[1]);
    const segmentBearing = this.getBearingDegrees(currP1[0], currP1[1], currP2[0], currP2[1]);

    return { lat: interpLat, lon: interpLon, heading: segmentBearing };
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

    // Synchronize route progress while GPS is available
    if (this.activeRouteCoords.length > 1) {
      this.syncRouteProgress(lat, lon);
    }

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
    this.confirmedSpeedKmh = cleanSpeed;
    this.lastPredictedSpeedKmh = cleanSpeed;
    this.candidateHighSpeedKmh = null;
    this.broadcastState();
  }

  /**
   * 10Hz Step:
   *  - When GPS is ONLINE: navigation location is driven purely by GPS signal.
   *  - When GPS is OFFLINE: location advances strictly along the navigation direction path!
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
        this.confirmedSpeedKmh = this.currentState.speedKmh;
        this.lastPredictedSpeedKmh = this.currentState.speedKmh;
        this.candidateHighSpeedKmh = null;

        // Broadcast state with real-time sensor telemetry
        this.broadcastState();
        // Do NOT run dead reckoning or overwrite lat/lon while GPS is online!
      } else {
        // ── GPS IS OFFLINE (Signal lost / unavailable / offline mode) ──
        // If device is stationary on table, speed and yaw rate are immediately 0
        if (isStationary) {
          this.lastPredictedSpeedKmh = 0;
          this.lastPredictedYawRateDps = 0;
          this.confirmedSpeedKmh = 0;
          this.candidateHighSpeedKmh = null;
        } else if (now - this.lastModelInferenceTime >= this.MODEL_INTERVAL_MS) {
          // Execute Model prediction with a 2-second interval gap (20 samples window @ 10Hz)
          try {
            const pred: ModelPrediction = predictDeadReckoning(windowData);
            const rawPredSpeed = Math.max(0, pred.speedKmh);

            // ── EVALUATE SPEED BARRIER ──────────────────────────────
            // When model suddenly predicts high speed:
            // 1. If it stays around that speed, keep that data.
            // 2. If it suddenly predicts high speed and then suddenly drops back down to low speed,
            //    ignore the spike and keep past speed and location.
            if (this.candidateHighSpeedKmh === null) {
              const jump = rawPredSpeed - this.confirmedSpeedKmh;
              if (jump > this.SUDDEN_SPEED_JUMP_KMH) {
                // Sudden high speed jump detected: hold as candidate, do not surge forward yet
                this.candidateHighSpeedKmh = rawPredSpeed;
                // Maintain past speed for navigation displacement & display
                this.lastPredictedSpeedKmh = this.confirmedSpeedKmh;
              } else {
                // Gradual or steady speed change: confirm immediately
                this.confirmedSpeedKmh = rawPredSpeed;
                this.lastPredictedSpeedKmh = rawPredSpeed;
              }
            } else {
              // We have a pending candidate from previous prediction epoch
              const diffFromCandidate = Math.abs(rawPredSpeed - this.candidateHighSpeedKmh);
              const isMaintained =
                diffFromCandidate <= this.SPEED_MAINTAIN_TOLERANCE_KMH ||
                rawPredSpeed >= this.candidateHighSpeedKmh - 5.0;

              if (isMaintained) {
                // Stays around that high speed: genuine vehicle acceleration confirmed!
                this.confirmedSpeedKmh = rawPredSpeed;
                this.lastPredictedSpeedKmh = rawPredSpeed;
                this.candidateHighSpeedKmh = null;
              } else {
                // Sudden spike followed by low speed: spurious hand movement!
                // Discard spike, preserve past speed and integrate location with past speed
                this.candidateHighSpeedKmh = null;
                if (rawPredSpeed <= this.confirmedSpeedKmh + 5.0) {
                  this.confirmedSpeedKmh = rawPredSpeed;
                }
                this.lastPredictedSpeedKmh = this.confirmedSpeedKmh;
              }
            }

            // Real-time device gyroscope yaw rate for telemetry display
            const gyroZ = telemetry?.gyroZ || 0;
            const gyroYawRateDps = -(gyroZ * (180 / Math.PI));
            this.lastPredictedYawRateDps =
              Math.abs(gyroYawRateDps) > 1.0 ? Number(gyroYawRateDps.toFixed(1)) : 0;

            this.lastModelInferenceTime = now;
          } catch (modelErr) {
            console.warn('[DeadReckoningEngine] Model inference warning:', modelErr);
          }
        }

        this.currentState.mode = 'TF_DEAD_RECKONING';
        this.currentState.gpsAvailable = false;
        this.currentState.speedKmh = isStationary ? 0 : this.lastPredictedSpeedKmh;
        this.currentState.yawRateDps = isStationary ? 0 : this.lastPredictedYawRateDps;

        // Compute forward displacement from accurate speed model
        const speedMps = this.currentState.speedKmh / 3.6;
        const distMeters = speedMps * dt;

        if (this.activeRouteCoords.length > 1) {
          // ── ROUTE-CONSTRAINED NAVIGATION PATH ──────────────────────
          // User pointer stays strictly within navigation direction path!
          // Speed model moves the pointer along the route segments, and pointer
          // orientation is aligned to the segment tangent (immune to yaw model errors).
          if (distMeters > 0.005) {
            const nextPos = this.advanceAlongRoute(distMeters);
            this.currentState.lat = nextPos.lat;
            this.currentState.lon = nextPos.lon;
            this.currentState.heading = nextPos.heading;
          }
        } else {
          // Fallback if no active route is loaded: unconstrained integration
          const dTheta = this.lastPredictedYawRateDps * dt;
          this.currentState.heading = (this.currentState.heading + dTheta + 360) % 360;

          const headingRad = (this.currentState.heading * Math.PI) / 180;
          const dx = distMeters * Math.sin(headingRad);
          const dy = distMeters * Math.cos(headingRad);

          const dLat = (dy / 6371000) * (180 / Math.PI);
          const dLon =
            (dx / (6371000 * Math.cos((this.currentState.lat * Math.PI) / 180))) *
            (180 / Math.PI);

          this.currentState.lat += dLat;
          this.currentState.lon += dLon;
        }

        this.currentState.accuracyMeters = 5;

        // Broadcast state (with 10Hz real-time sensor telemetry)
        this.broadcastState();
      }
    } catch (e) {
      console.warn('Dead reckoning step error:', e);
    }
  }

  private broadcastState() {
    const copy = { ...this.currentState };
    for (const cb of this.onStateUpdateCallbacks) {
      cb(copy);
    }
  }
}
