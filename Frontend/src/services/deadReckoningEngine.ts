import { SensorPipeline, LiveSensorTelemetry } from './sensorPipeline';
import { predictDeadReckoning, ModelPrediction } from './tfInference';
import { CostingMode } from '@/types/navigation';

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
  /** Multi-tier barrier diagnostics & telemetry for enhanced HUD display */
  rawModelSpeedKmh?: number;
  confirmedSpeedKmh?: number;
  modelConfidence?: number; // 0 - 100%
  activeBarriers?: string[]; // e.g. ['ZUPT_LOCKED', 'KINEMATIC_GUARD', 'SPIKE_GUARD', 'CRAWL_SNAP', 'CEILING_LIMIT']
  isTunnelMode?: boolean;
}

export class DeadReckoningEngine {
  private static instance: DeadReckoningEngine | null = null;

  private sensorPipeline: SensorPipeline;
  private isNavigating = false;
  private isOfflineMode = false;
  private travelMode: CostingMode = 'auto';
  private lastGpsTimestamp = 0;
  private lastGpsCoords: { lat: number; lon: number; heading: number; speedKmh: number; accuracyMeters?: number } | null = null;
  /** Fast offline GPS timeout: if no GPS fix arrives within 1.8s, dead reckoning takes over */
  private readonly GPS_FRESHNESS_MS = 1800;
  private readonly GPS_DEGRADED_ACCURACY_METERS = 30.0;

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
    rawModelSpeedKmh: 0,
    confirmedSpeedKmh: 0,
    modelConfidence: 100,
    activeBarriers: [],
    isTunnelMode: false,
  };

  private activeRouteCoords: [number, number][] = [];
  private routeSegmentIndex = 0;
  private routeSegmentProgressMeters = 0;
  private onStateUpdateCallbacks: ((state: DeadReckoningState) => void)[] = [];

  // Model prediction interval control (2.0s for vehicle, 1.0s for walking)
  private lastModelInferenceTime = 0;
  private readonly MODEL_INTERVAL_MS = 2000; // 2.0s gap between vehicle neural model predictions
  private readonly WALKING_MODEL_INTERVAL_MS = 1000; // 1.0s gap between walking neural model predictions
  private lastPredictedSpeedKmh = 0;
  private lastPredictedYawRateDps = 0;

  // ── MULTI-TIERED BARRIER SYSTEM ───────────────────────────
  // 1. Transient Spike Verification Barrier (Phone twitches / flicks)
  private confirmedSpeedKmh = 0;
  private candidateHighSpeedKmh: number | null = null;
  private readonly SUDDEN_SPEED_JUMP_KMH = 12.0; // Jump threshold to trigger barrier verification
  private readonly SPEED_MAINTAIN_TOLERANCE_KMH = 10.0; // Speed band considered "around that speed"

  // 2. Kinematic G-Force Rate Barrier (Physical vehicle acceleration / braking envelope)
  private readonly MAX_ACCEL_KMH_PER_SEC = 16.2; // 4.5 m/s² max passenger car acceleration
  private readonly MAX_BRAKE_KMH_PER_SEC = 28.8; // 8.0 m/s² max passenger car emergency braking

  // 3. Speed Ceiling Barrier (Hard clamp against model divergence)
  private readonly SPEED_CEILING_KMH = 130.0;

  // 4. Low-Speed Crawl / Creep Barrier (Zero-velocity snapping at stops)
  private readonly CRAWL_SPEED_THRESHOLD_KMH = 3.5;
  private crawlTimerMs = 0;

  // 5. 10Hz Inter-Epoch Smoothing Barrier
  private smoothedSpeedKmh = 0;
  private readonly SMOOTHING_ALPHA = 0.25;

  // 6. Active Barrier Diagnostics & Confidence
  private activeBarriers: Set<string> = new Set();
  private rawModelSpeedKmh = 0;
  private modelConfidence = 100;

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
    this.smoothedSpeedKmh = 0;
    this.candidateHighSpeedKmh = null;
    this.crawlTimerMs = 0;
    this.activeBarriers.clear();
  }

  /**
   * Set offline mode. When offline is true, GPS is forced offline,
   * so navigation location is driven by the dead-reckoning speed model with 2s epoch gap.
   */
  public setOfflineMode(offline: boolean) {
    this.isOfflineMode = offline;
    this.currentState.isTunnelMode = offline;
    if (offline) {
      this.currentState.gpsAvailable = false;
      this.currentState.mode = 'TF_DEAD_RECKONING';
      this.lastModelInferenceTime = 0; // Trigger model inference immediately on next tick

      // Anchor starting position and speed barrier from the last known GPS reading
      if (this.lastGpsCoords) {
        this.currentState.lat = this.lastGpsCoords.lat;
        this.currentState.lon = this.lastGpsCoords.lon;
        this.confirmedSpeedKmh = this.lastGpsCoords.speedKmh || 0;
        this.smoothedSpeedKmh = this.confirmedSpeedKmh;
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

  public toggleTunnelMode(): boolean {
    const nextVal = !this.isOfflineMode;
    this.setOfflineMode(nextVal);
    return nextVal;
  }

  public setCostingMode(mode: CostingMode) {
    this.travelMode = mode;
    // Reset prediction interval timer so new mode model runs immediately
    this.lastModelInferenceTime = 0;
  }

  public getCostingMode(): CostingMode {
    return this.travelMode;
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
  public updateGpsPosition(lat: number, lon: number, heading: number = 0, speedKmh: number = 0, accuracyMeters: number = 8) {
    this.lastGpsTimestamp = Date.now();

    // Noise deadband & ZUPT filter:
    // 1. Any GPS speed < 2.5 km/h is satellite clock jitter/drift, clamp to 0
    // 2. If phone is motionless on a table or stopped in traffic, clamp to 0
    let cleanSpeed = speedKmh < 2.5 ? 0 : speedKmh;
    if (this.sensorPipeline.isStationary()) {
      cleanSpeed = 0;
    }

    this.lastGpsCoords = { lat, lon, heading, speedKmh: cleanSpeed, accuracyMeters };

    // Synchronize route progress while GPS is available
    if (this.activeRouteCoords.length > 1) {
      this.syncRouteProgress(lat, lon);
    }

    // When offline mode is enabled, ignore GPS position
    if (this.isOfflineMode) {
      return;
    }

    // If GPS accuracy has severely degraded (> 30m, e.g. entering a tunnel/urban canyon)
    // and we already have a dead reckoning fix, do not let degraded signal warp the position
    if (accuracyMeters > this.GPS_DEGRADED_ACCURACY_METERS && this.currentState.mode === 'TF_DEAD_RECKONING') {
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
    this.currentState.accuracyMeters = accuracyMeters;
    this.currentState.isTunnelMode = false;

    this.confirmedSpeedKmh = cleanSpeed;
    this.smoothedSpeedKmh = cleanSpeed;
    this.lastPredictedSpeedKmh = cleanSpeed;
    this.candidateHighSpeedKmh = null;

    this.activeBarriers.clear();
    if (this.sensorPipeline.isStationary() || cleanSpeed === 0) {
      this.activeBarriers.add('ZUPT_LOCKED');
    }
    this.currentState.activeBarriers = Array.from(this.activeBarriers);
    this.currentState.rawModelSpeedKmh = cleanSpeed;
    this.currentState.confirmedSpeedKmh = cleanSpeed;
    this.currentState.modelConfidence = 100;

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
        now - this.lastGpsTimestamp < this.GPS_FRESHNESS_MS &&
        (this.lastGpsCoords.accuracyMeters == null || this.lastGpsCoords.accuracyMeters <= this.GPS_DEGRADED_ACCURACY_METERS);

      const dt = 0.1; // 10Hz = 100ms

      const telemetry = this.sensorPipeline.getLatestTelemetry();
      this.currentState.telemetry = telemetry;

      // Check if phone is motionless (e.g. placed on a table)
      const isStationary = this.sensorPipeline.isStationary();

      if (isGpsUsable && this.lastGpsCoords) {
        // ── GPS IS ONLINE ──────────────────────────────────────────
        this.currentState.mode = 'GPS';
        this.currentState.gpsAvailable = true;
        this.currentState.lat = this.lastGpsCoords.lat;
        this.currentState.lon = this.lastGpsCoords.lon;
        this.currentState.speedKmh = isStationary ? 0 : this.lastGpsCoords.speedKmh;
        this.currentState.yawRateDps = 0;
        this.currentState.accuracyMeters = this.lastGpsCoords.accuracyMeters || 8;
        if (this.lastGpsCoords.heading !== 0) {
          this.currentState.heading = this.lastGpsCoords.heading;
        }
        this.confirmedSpeedKmh = this.currentState.speedKmh;
        this.smoothedSpeedKmh = this.currentState.speedKmh;
        this.lastPredictedSpeedKmh = this.currentState.speedKmh;
        this.candidateHighSpeedKmh = null;
        this.currentState.isTunnelMode = false;

        this.activeBarriers.clear();
        if (isStationary || this.currentState.speedKmh === 0) {
          this.activeBarriers.add('ZUPT_LOCKED');
        }
        this.currentState.activeBarriers = Array.from(this.activeBarriers);
        this.currentState.rawModelSpeedKmh = this.currentState.speedKmh;
        this.currentState.confirmedSpeedKmh = this.currentState.speedKmh;
        this.currentState.modelConfidence = 100;

        // Broadcast state with real-time sensor telemetry
        this.broadcastState();
      } else {
        // ── GPS IS OFFLINE (Signal lost / degraded / tunnel / manual offline mode) ──
        this.activeBarriers.clear();

        if (isStationary) {
          this.lastPredictedSpeedKmh = 0;
          this.lastPredictedYawRateDps = 0;
          this.confirmedSpeedKmh = 0;
          this.smoothedSpeedKmh = 0;
          this.candidateHighSpeedKmh = null;
          this.crawlTimerMs = 0;
          this.activeBarriers.add('ZUPT_LOCKED');
        } else {
          const isPedestrian = this.travelMode === 'pedestrian';
          const modelInterval = isPedestrian ? this.WALKING_MODEL_INTERVAL_MS : this.MODEL_INTERVAL_MS;

          if (now - this.lastModelInferenceTime >= modelInterval) {
            // Execute Model prediction (Specialized Walking GRU for pedestrian or Vehicle CNN-LSTM for driving)
            try {
              const pred: ModelPrediction = predictDeadReckoning(windowData, this.travelMode);
              let rawPredSpeed = Math.max(0, pred.speedKmh);
              this.rawModelSpeedKmh = Number(rawPredSpeed.toFixed(1));

              if (isPedestrian) {
                this.activeBarriers.add('WALK_MODEL_ACTIVE');
              } else {
                this.activeBarriers.add('VEHICLE_MODEL_ACTIVE');
              }

              // Dynamic barrier parameters based on active travel mode
              const speedCeiling = isPedestrian ? 12.0 : this.SPEED_CEILING_KMH;
              const maxAccelPerSec = isPedestrian ? 6.0 : this.MAX_ACCEL_KMH_PER_SEC;
              const maxBrakePerSec = isPedestrian ? 8.0 : this.MAX_BRAKE_KMH_PER_SEC;
              const suddenJumpThreshold = isPedestrian ? 4.0 : this.SUDDEN_SPEED_JUMP_KMH;
              const speedMaintainTolerance = isPedestrian ? 3.0 : this.SPEED_MAINTAIN_TOLERANCE_KMH;
              const crawlThreshold = isPedestrian ? 0.9 : this.CRAWL_SPEED_THRESHOLD_KMH;

              // ── BARRIER 1: Physical Speed Ceiling Barrier ───────────────
              if (rawPredSpeed > speedCeiling) {
                rawPredSpeed = speedCeiling;
                this.activeBarriers.add('CEILING_LIMIT');
              }

              // ── BARRIER 2: Kinematic G-Force Rate Barrier ────────────────
              const epochDeltaSec = this.lastModelInferenceTime > 0
                ? Math.min(3.0, (now - this.lastModelInferenceTime) / 1000)
                : (isPedestrian ? 1.0 : 2.0);
              const maxAllowedIncrease = maxAccelPerSec * epochDeltaSec;
              const maxAllowedDecrease = maxBrakePerSec * epochDeltaSec;

              if (rawPredSpeed > this.confirmedSpeedKmh + maxAllowedIncrease) {
                rawPredSpeed = this.confirmedSpeedKmh + maxAllowedIncrease;
                this.activeBarriers.add('KINEMATIC_GUARD');
              } else if (rawPredSpeed < this.confirmedSpeedKmh - maxAllowedDecrease) {
                rawPredSpeed = Math.max(0, this.confirmedSpeedKmh - maxAllowedDecrease);
                this.activeBarriers.add('KINEMATIC_GUARD');
              }

              // ── BARRIER 3: Transient Spike Candidate Verification Barrier 
              if (this.candidateHighSpeedKmh === null) {
                const jump = rawPredSpeed - this.confirmedSpeedKmh;
                if (jump > suddenJumpThreshold) {
                  this.candidateHighSpeedKmh = rawPredSpeed;
                  this.activeBarriers.add('SPIKE_GUARD');
                  this.lastPredictedSpeedKmh = this.confirmedSpeedKmh;
                } else {
                  this.confirmedSpeedKmh = rawPredSpeed;
                  this.lastPredictedSpeedKmh = rawPredSpeed;
                }
              } else {
                const diffFromCandidate = Math.abs(rawPredSpeed - this.candidateHighSpeedKmh);
                const isMaintained =
                  diffFromCandidate <= speedMaintainTolerance ||
                  rawPredSpeed >= this.candidateHighSpeedKmh - (isPedestrian ? 2.0 : 5.0);

                if (isMaintained) {
                  // Sustained speed: genuine acceleration confirmed!
                  this.confirmedSpeedKmh = rawPredSpeed;
                  this.lastPredictedSpeedKmh = rawPredSpeed;
                  this.candidateHighSpeedKmh = null;
                } else {
                  // Transient spike rejected! Discard candidate and keep baseline
                  this.candidateHighSpeedKmh = null;
                  this.activeBarriers.add('SPIKE_REJECTED');
                  if (rawPredSpeed <= this.confirmedSpeedKmh + (isPedestrian ? 1.5 : 5.0)) {
                    this.confirmedSpeedKmh = rawPredSpeed;
                  }
                  this.lastPredictedSpeedKmh = this.confirmedSpeedKmh;
                }
              }

              // ── BARRIER 4: Low-Speed Crawl / Creep Snapping ─────────────
              const linAccel = telemetry?.accelMag ? Math.abs(telemetry.accelMag - 9.81) : 0;
              if (this.confirmedSpeedKmh < crawlThreshold && linAccel < (isPedestrian ? 0.3 : 0.4)) {
                this.crawlTimerMs += modelInterval;
                if (this.crawlTimerMs >= (isPedestrian ? 800 : 1200)) {
                  this.confirmedSpeedKmh = 0;
                  this.lastPredictedSpeedKmh = 0;
                  this.activeBarriers.add('CRAWL_SNAP');
                  this.activeBarriers.add('ZUPT_LOCKED');
                }
              } else {
                this.crawlTimerMs = 0;
              }

              // Real-time device gyroscope yaw rate for telemetry display
              const gyroZ = telemetry?.gyroZ || 0;
              const gyroYawRateDps = -(gyroZ * (180 / Math.PI));
              this.lastPredictedYawRateDps =
                Math.abs(gyroYawRateDps) > 1.0 ? Number(gyroYawRateDps.toFixed(1)) : 0;

              // ── COMPUTE MODEL CONFIDENCE SCORE ────────────────────────
              let confidence = 96;
              if (this.activeBarriers.has('KINEMATIC_GUARD')) confidence -= 12;
              if (this.candidateHighSpeedKmh !== null) confidence -= 14;
              if (this.activeBarriers.has('SPIKE_REJECTED')) confidence -= 8;
              if (telemetry?.isClippingProtected) confidence -= 10;
              if (telemetry?.isTwitchSpikeSuppressed) confidence -= 8;
              if (telemetry?.jerk && telemetry.jerk > 2.0) confidence -= 6;
              this.modelConfidence = Math.max(45, Math.min(99, confidence));

              this.lastModelInferenceTime = now;
            } catch (modelErr) {
              console.warn('[DeadReckoningEngine] Model inference warning:', modelErr);
            }
          }

          // ── BARRIER 5: 10Hz Inter-Epoch Smoothing Barrier ─────────
          // Exponential moving average interpolates smoothly across 2-second inference epochs
          if (this.confirmedSpeedKmh === 0) {
            this.smoothedSpeedKmh = 0;
          } else {
            this.smoothedSpeedKmh += this.SMOOTHING_ALPHA * (this.confirmedSpeedKmh - this.smoothedSpeedKmh);
          }
        }

        this.currentState.mode = 'TF_DEAD_RECKONING';
        this.currentState.gpsAvailable = false;
        this.currentState.speedKmh = isStationary ? 0 : Number(this.smoothedSpeedKmh.toFixed(1));
        this.currentState.yawRateDps = isStationary ? 0 : this.lastPredictedYawRateDps;
        this.currentState.rawModelSpeedKmh = this.rawModelSpeedKmh;
        this.currentState.confirmedSpeedKmh = Number(this.confirmedSpeedKmh.toFixed(1));
        this.currentState.modelConfidence = this.modelConfidence;
        this.currentState.activeBarriers = Array.from(this.activeBarriers);
        this.currentState.isTunnelMode = this.isOfflineMode;

        // Compute forward displacement from accurate speed model
        const speedMps = this.currentState.speedKmh / 3.6;
        const distMeters = speedMps * dt;

        // ── BARRIER 6: Stationary / ZUPT Anti-Drift Lock ──────────
        // Firmly freeze coordinates when stationary or speed is ~0
        if (this.currentState.speedKmh > 0.05 && distMeters > 0.002) {
          if (this.activeRouteCoords.length > 1) {
            // User pointer stays strictly within navigation direction path!
            const nextPos = this.advanceAlongRoute(distMeters);
            this.currentState.lat = nextPos.lat;
            this.currentState.lon = nextPos.lon;
            this.currentState.heading = nextPos.heading;
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
        }

        this.currentState.accuracyMeters = 5;
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
