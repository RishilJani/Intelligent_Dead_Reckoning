/**
 * TensorFlow Dual-Model On-Device Inference Engine for Dead Reckoning
 * 
 * Replaces legacy ONNX architecture with dual specialized TensorFlow neural networks:
 * 1. Speed Regressor (best_speed_model.pt -> TFSpeedRegressor):
 *    Input: 20 samples of 10 features [20, 10] @ 10Hz
 *    Architecture: Conv1D(10->32) + BatchNorm + Conv1D(32->64) + BatchNorm + BiLSTM(64) + RepPooling + Dense
 *    Output: Vehicle speed in km/h (de-normalized & non-negative clamped)
 * 
 * 2. Yaw Regressor (yaw_canbus_model.pt -> TFYawRegressor):
 *    Input: 20 samples of 7 features [20, 7] @ 20Hz (6 IMU channels + cumulative gyro_z integral)
 *    Architecture: 2-Layer BiLSTM(64) + LastStep + Dense
 *    Output: CAN-bus yaw rate in deg/s
 */

import dualWeightsData from '@/../assets/models/tf_dual_weights.json';

export interface ModelPrediction {
  speedKmh: number;
  yawRateDps: number;
}

interface SpeedMeta {
  arch: string;
  task: string;
  in_shape: [number, number];
  feat_mean: number[];
  feat_std: number[];
  label_mean: number;
  label_std: number;
  features: string[];
}

interface YawMeta {
  arch: string;
  task: string;
  in_shape: [number, number];
  feat_mean: number[];
  feat_std: number[];
  yaw_mean: number;
  yaw_std: number;
  features: string[];
}

interface DualWeightsStructure {
  _meta: {
    format: string;
    speed_model: SpeedMeta;
    yaw_model: YawMeta;
  };
  speed: Record<string, any>;
  yaw: Record<string, any>;
}

const data = dualWeightsData as unknown as DualWeightsStructure;
const metaSpeed = data._meta.speed_model;
const metaYaw = data._meta.yaw_model;
const speedWeights = data.speed;
const yawWeights = data.yaw;

// Numerical helpers
function sigmoid(x: number): number {
  if (x > 40) return 1.0;
  if (x < -40) return 0.0;
  return 1.0 / (1.0 + Math.exp(-x));
}

function tanh(x: number): number {
  if (x > 20) return 1.0;
  if (x < -20) return -1.0;
  const e2x = Math.exp(2 * x);
  return (e2x - 1) / (e2x + 1);
}

// Single step of LSTM cell (64 units)
function stepLstmCell(
  xt: Float32Array | number[],
  hPrev: Float32Array,
  cPrev: Float32Array,
  W_ih: number[][],
  W_hh: number[][],
  b_ih: number[],
  b_hh: number[]
): { hNext: Float32Array; cNext: Float32Array } {
  const hiddenSize = 64;
  const inSize = xt.length;
  const hNext = new Float32Array(hiddenSize);
  const cNext = new Float32Array(hiddenSize);

  for (let g = 0; g < 4; g++) {
    const gateOffset = g * hiddenSize;
    for (let i = 0; i < hiddenSize; i++) {
      const row = gateOffset + i;
      let val = b_ih[row] + b_hh[row];

      // W_ih * x
      const w_ih_row = W_ih[row];
      for (let j = 0; j < inSize; j++) {
        val += w_ih_row[j] * xt[j];
      }

      // W_hh * hPrev
      const w_hh_row = W_hh[row];
      for (let j = 0; j < hiddenSize; j++) {
        val += w_hh_row[j] * hPrev[j];
      }

      if (g === 0) {
        // i_gate
        hNext[i] = sigmoid(val);
      } else if (g === 1) {
        // f_gate
        cNext[i] = sigmoid(val);
      } else if (g === 2) {
        // g_gate (cell candidate)
        const gVal = tanh(val);
        // cNext = f * cPrev + i * g
        cNext[i] = cNext[i] * cPrev[i] + hNext[i] * gVal;
      } else if (g === 3) {
        // o_gate
        const oVal = sigmoid(val);
        hNext[i] = oVal * tanh(cNext[i]);
      }
    }
  }

  return { hNext, cNext };
}

// Full sequence Bidirectional LSTM
function runBiLstmSequence(
  inputSeq: Float32Array[],
  W_ih: number[][],
  W_hh: number[][],
  b_ih: number[],
  b_hh: number[],
  W_ih_rev: number[][],
  W_hh_rev: number[][],
  b_ih_rev: number[],
  b_hh_rev: number[]
): Float32Array[] {
  const seqLen = inputSeq.length;
  const hiddenSize = 64;

  // Forward pass
  let hFwd: any = new Float32Array(hiddenSize);
  let cFwd: any = new Float32Array(hiddenSize);
  const fwdOutputs: Float32Array[] = [];

  for (let t = 0; t < seqLen; t++) {
    const res = stepLstmCell(inputSeq[t], hFwd, cFwd, W_ih, W_hh, b_ih, b_hh);
    hFwd = res.hNext;
    cFwd = res.cNext;
    fwdOutputs.push(hFwd);
  }

  // Backward pass
  let hBwd: any = new Float32Array(hiddenSize);
  let cBwd: any = new Float32Array(hiddenSize);
  const bwdOutputs: Float32Array[] = new Array(seqLen);

  for (let t = seqLen - 1; t >= 0; t--) {
    const res = stepLstmCell(inputSeq[t], hBwd, cBwd, W_ih_rev, W_hh_rev, b_ih_rev, b_hh_rev);
    hBwd = res.hNext;
    cBwd = res.cNext;
    bwdOutputs[t] = hBwd;
  }

  // Concatenate forward + backward at each step -> (128 units)
  const combined: Float32Array[] = new Array(seqLen);
  for (let t = 0; t < seqLen; t++) {
    const fused = new Float32Array(128);
    fused.set(fwdOutputs[t], 0);
    fused.set(bwdOutputs[t], 64);
    combined[t] = fused;
  }

  return combined;
}

/**
 * Predict Speed (km/h) using TensorFlow Speed Regressor
 */
export function predictSpeed(rawWindow20x10: number[][]): number {
  const seqLen = 20;
  const inFeats = 10;

  // 1. Feature normalization
  const xNorm: number[][] = Array.from({ length: inFeats }, () => new Array(seqLen));
  for (let f = 0; f < inFeats; f++) {
    const mean = metaSpeed.feat_mean[f];
    const std = metaSpeed.feat_std[f];
    for (let t = 0; t < seqLen; t++) {
      xNorm[f][t] = (rawWindow20x10[t][f] - mean) / std;
    }
  }

  // 2. Conv1D 1: 10 in -> 32 out, kernel size 3, padding 1
  const wC1: number[][][] = speedWeights['cnn.0.weight'];
  const bC1: number[] = speedWeights['cnn.0.bias'];
  const c1Out: number[][] = Array.from({ length: 32 }, () => new Array(seqLen).fill(0));

  for (let oc = 0; oc < 32; oc++) {
    for (let ic = 0; ic < 10; ic++) {
      const w = wC1[oc][ic];
      const ch = xNorm[ic];
      for (let t = 0; t < seqLen; t++) {
        const v0 = t > 0 ? ch[t - 1] : 0;
        const v1 = ch[t];
        const v2 = t < seqLen - 1 ? ch[t + 1] : 0;
        c1Out[oc][t] += w[0] * v0 + w[1] * v1 + w[2] * v2;
      }
    }
    const b = bC1[oc];
    for (let t = 0; t < seqLen; t++) {
      c1Out[oc][t] += b;
    }
  }

  // 3. BatchNorm 1 + ReLU
  const gamma1: number[] = speedWeights['cnn.1.weight'];
  const beta1: number[] = speedWeights['cnn.1.bias'];
  const mean1: number[] = speedWeights['cnn.1.running_mean'];
  const var1: number[] = speedWeights['cnn.1.running_var'];
  const relu1: number[][] = Array.from({ length: 32 }, () => new Array(seqLen));

  for (let oc = 0; oc < 32; oc++) {
    const scale = gamma1[oc] / Math.sqrt(var1[oc] + 1e-5);
    const shift = beta1[oc] - mean1[oc] * scale;
    for (let t = 0; t < seqLen; t++) {
      const bn = c1Out[oc][t] * scale + shift;
      relu1[oc][t] = bn > 0 ? bn : 0;
    }
  }

  // 4. Conv1D 2: 32 in -> 64 out, kernel size 3, padding 1
  const wC2: number[][][] = speedWeights['cnn.3.weight'];
  const bC2: number[] = speedWeights['cnn.3.bias'];
  const c2Out: number[][] = Array.from({ length: 64 }, () => new Array(seqLen).fill(0));

  for (let oc = 0; oc < 64; oc++) {
    for (let ic = 0; ic < 32; ic++) {
      const w = wC2[oc][ic];
      const ch = relu1[ic];
      for (let t = 0; t < seqLen; t++) {
        const v0 = t > 0 ? ch[t - 1] : 0;
        const v1 = ch[t];
        const v2 = t < seqLen - 1 ? ch[t + 1] : 0;
        c2Out[oc][t] += w[0] * v0 + w[1] * v1 + w[2] * v2;
      }
    }
    const b = bC2[oc];
    for (let t = 0; t < seqLen; t++) {
      c2Out[oc][t] += b;
    }
  }

  // 5. BatchNorm 2 + ReLU
  const gamma2: number[] = speedWeights['cnn.4.weight'];
  const beta2: number[] = speedWeights['cnn.4.bias'];
  const mean2: number[] = speedWeights['cnn.4.running_mean'];
  const var2: number[] = speedWeights['cnn.4.running_var'];
  const lstmInputs: Float32Array[] = new Array(seqLen);

  for (let t = 0; t < seqLen; t++) {
    const row = new Float32Array(64);
    for (let oc = 0; oc < 64; oc++) {
      const scale = gamma2[oc] / Math.sqrt(var2[oc] + 1e-5);
      const shift = beta2[oc] - mean2[oc] * scale;
      const bn = c2Out[oc][t] * scale + shift;
      row[oc] = bn > 0 ? bn : 0;
    }
    lstmInputs[t] = row;
  }

  // 6. BiLSTM (64 units) -> (20, 128)
  const lstmOut = runBiLstmSequence(
    lstmInputs,
    speedWeights['lstm.weight_ih_l0'],
    speedWeights['lstm.weight_hh_l0'],
    speedWeights['lstm.bias_ih_l0'],
    speedWeights['lstm.bias_hh_l0'],
    speedWeights['lstm.weight_ih_l0_reverse'],
    speedWeights['lstm.weight_hh_l0_reverse'],
    speedWeights['lstm.bias_ih_l0_reverse'],
    speedWeights['lstm.bias_hh_l0_reverse']
  );

  // 7. Representation Pooling: [mean_pool (128), max_pool (128), last_step (128)] -> 384
  const rep = new Float32Array(384);
  const meanPool = new Float32Array(128);
  const maxPool = new Float32Array(128);
  maxPool.set(lstmOut[0]);

  for (let t = 0; t < seqLen; t++) {
    const row = lstmOut[t];
    for (let i = 0; i < 128; i++) {
      meanPool[i] += row[i];
      if (row[i] > maxPool[i]) maxPool[i] = row[i];
    }
  }
  for (let i = 0; i < 128; i++) {
    meanPool[i] /= seqLen;
  }

  rep.set(meanPool, 0);
  rep.set(maxPool, 128);
  rep.set(lstmOut[seqLen - 1], 256);

  // 8. Head: Linear 384 -> 64 + ReLU + Linear 64 -> 1
  const wH0: number[][] = speedWeights['head.0.weight'];
  const bH0: number[] = speedWeights['head.0.bias'];
  const h0 = new Float32Array(64);

  for (let i = 0; i < 64; i++) {
    let sum = bH0[i];
    const row = wH0[i];
    for (let j = 0; j < 384; j++) {
      sum += row[j] * rep[j];
    }
    h0[i] = sum > 0 ? sum : 0;
  }

  const wH3: number[][] = speedWeights['head.3.weight'];
  const bH3: number[] = speedWeights['head.3.bias'];
  let rawPred = bH3[0];
  const rowH3 = wH3[0];
  for (let j = 0; j < 64; j++) {
    rawPred += rowH3[j] * h0[j];
  }

  // 9. De-normalization & Non-negative clamping
  const speedKmh = rawPred * metaSpeed.label_std + metaSpeed.label_mean;
  return Math.max(0.0, speedKmh);
}

/**
 * Predict Yaw Rate (deg/s) using TensorFlow Yaw Regressor
 */
export function predictYawRate(rawWindow20x7: number[][]): number {
  const seqLen = 20;
  const inFeats = 7;

  // 1. Feature normalization
  const normInputs: Float32Array[] = new Array(seqLen);
  for (let t = 0; t < seqLen; t++) {
    const row = new Float32Array(inFeats);
    for (let f = 0; f < inFeats; f++) {
      row[f] = (rawWindow20x7[t][f] - metaYaw.feat_mean[f]) / metaYaw.feat_std[f];
    }
    normInputs[t] = row;
  }

  // 2. BiLSTM Layer 0: in 7, hidden 64 -> (20, 128)
  const l0Out = runBiLstmSequence(
    normInputs,
    yawWeights['lstm.weight_ih_l0'],
    yawWeights['lstm.weight_hh_l0'],
    yawWeights['lstm.bias_ih_l0'],
    yawWeights['lstm.bias_hh_l0'],
    yawWeights['lstm.weight_ih_l0_reverse'],
    yawWeights['lstm.weight_hh_l0_reverse'],
    yawWeights['lstm.bias_ih_l0_reverse'],
    yawWeights['lstm.bias_hh_l0_reverse']
  );

  // 3. BiLSTM Layer 1: in 128, hidden 64 -> (20, 128)
  const l1Out = runBiLstmSequence(
    l0Out,
    yawWeights['lstm.weight_ih_l1'],
    yawWeights['lstm.weight_hh_l1'],
    yawWeights['lstm.bias_ih_l1'],
    yawWeights['lstm.bias_hh_l1'],
    yawWeights['lstm.weight_ih_l1_reverse'],
    yawWeights['lstm.weight_hh_l1_reverse'],
    yawWeights['lstm.bias_ih_l1_reverse'],
    yawWeights['lstm.bias_hh_l1_reverse']
  );

  // 4. Last Step representation: l1Out[seqLen - 1] (128 units)
  const lastStep = l1Out[seqLen - 1];

  // 5. Head: Linear 128 -> 64 + ReLU + Linear 64 -> 1
  const wH0: number[][] = yawWeights['head.0.weight'];
  const bH0: number[] = yawWeights['head.0.bias'];
  const h0 = new Float32Array(64);

  for (let i = 0; i < 64; i++) {
    let sum = bH0[i];
    const row = wH0[i];
    for (let j = 0; j < 128; j++) {
      sum += row[j] * lastStep[j];
    }
    h0[i] = sum > 0 ? sum : 0;
  }

  const wH3: number[][] = yawWeights['head.3.weight'];
  const bH3: number[] = yawWeights['head.3.bias'];
  let rawPred = bH3[0];
  const rowH3 = wH3[0];
  for (let j = 0; j < 64; j++) {
    rawPred += rowH3[j] * h0[j];
  }

  // 6. De-normalization to deg/s
  const yawRateDps = rawPred * metaYaw.yaw_std + metaYaw.yaw_mean;
  return yawRateDps;
}

/**
 * Drop-in Dead Reckoning Predictor executing both TensorFlow models
 * Expects 20-sample rolling IMU window from sensor pipeline.
 */
export function predictDeadReckoning(rawWindow: number[][]): ModelPrediction {
  if (rawWindow.length !== 20 || rawWindow[0].length < 6) {
    throw new Error(`Invalid window shape [${rawWindow.length}, ${rawWindow[0]?.length}]. Expected [20, 10].`);
  }

  // 1. Predict Speed using full 10 features
  const speedKmh = predictSpeed(rawWindow);

  // 2. Build 7 features for Yaw model:
  // [accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z, gyro_z_integral]
  const yawWindow: number[][] = new Array(20);
  let cumIntegral = 0;
  for (let t = 0; t < 20; t++) {
    const gyroZ = rawWindow[t][5] || 0;
    cumIntegral += gyroZ / 20.0;
    yawWindow[t] = [
      rawWindow[t][0] || 0,
      rawWindow[t][1] || 0,
      rawWindow[t][2] || 9.81,
      rawWindow[t][3] || 0,
      rawWindow[t][4] || 0,
      gyroZ,
      cumIntegral,
    ];
  }

  const yawRateDps = predictYawRate(yawWindow);

  return {
    speedKmh: Number(speedKmh.toFixed(1)),
    yawRateDps: Number(yawRateDps.toFixed(2)),
  };
}
