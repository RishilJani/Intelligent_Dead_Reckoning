/**
 * ONNX & Fast Tensor Inference Engine for Dead Reckoning MultiTask Model
 * Input: Rolling 2-second IMU window [20, 10] at 10Hz
 * Outputs:
 *  1. predictedSpeedKmh (km/h)
 *  2. predictedYawRateDps (deg/s)
 */

import weightsData from '@/../assets/models/model_weights.json';

interface ModelMeta {
  feat_mean: number[];
  feat_std: number[];
  speed_mean: number;
  speed_std: number;
  yaw_mean: number;
  yaw_std: number;
  features: string[];
}

const weights: Record<string, any> = weightsData;
const meta: ModelMeta = weights._meta;

// Helper: Vector dot product
function dot(a: Float32Array | number[], b: Float32Array | number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

// 1D Convolution with stride 1, padding 1
function conv1d(
  input: number[][], // [channels_in, length]
  weight: number[][][], // [out_channels, in_channels, kernel_size]
  bias: number[] // [out_channels]
): number[][] {
  const inChannels = input.length;
  const inLength = input[0].length;
  const outChannels = weight.length;
  const kernelSize = weight[0][0].length;
  const pad = Math.floor(kernelSize / 2);

  const output: number[][] = Array.from({ length: outChannels }, () =>
    new Array(inLength).fill(0)
  );

  for (let oc = 0; oc < outChannels; oc++) {
    for (let t = 0; t < inLength; t++) {
      let sum = bias[oc];
      for (let ic = 0; ic < inChannels; ic++) {
        for (let k = 0; k < kernelSize; k++) {
          const inIdx = t + k - pad;
          if (inIdx >= 0 && inIdx < inLength) {
            sum += input[ic][inIdx] * weight[oc][ic][k];
          }
        }
      }
      output[oc][t] = sum;
    }
  }
  return output;
}

// 1D Batch Normalization + ReLU
function batchNormRelu(
  input: number[][], // [channels, length]
  gamma: number[],
  beta: number[],
  mean: number[],
  variance: number[],
  epsilon: number = 1e-5
): number[][] {
  const channels = input.length;
  const length = input[0].length;
  const output: number[][] = Array.from({ length: channels }, () =>
    new Array(length).fill(0)
  );

  for (let c = 0; c < channels; c++) {
    const scale = gamma[c] / Math.sqrt(variance[c] + epsilon);
    const shift = beta[c] - mean[c] * scale;
    for (let t = 0; t < length; t++) {
      const normalized = input[c][t] * scale + shift;
      output[c][t] = Math.max(0, normalized); // ReLU
    }
  }
  return output;
}

// Sigmoid activation
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, x))));
}

// LSTM Single Step
function lstmStep(
  x: number[], // [input_dim]
  hPrev: number[], // [hidden_dim]
  cPrev: number[], // [hidden_dim]
  w_ih: number[][], // [4 * hidden_dim, input_dim]
  w_hh: number[][], // [4 * hidden_dim, hidden_dim]
  b_ih: number[], // [4 * hidden_dim]
  b_hh: number[] // [4 * hidden_dim]
): { h: number[]; c: number[] } {
  const hiddenDim = hPrev.length;
  const gates = new Float32Array(4 * hiddenDim);

  for (let i = 0; i < 4 * hiddenDim; i++) {
    let sum = b_ih[i] + b_hh[i] + dot(w_ih[i], x) + dot(w_hh[i], hPrev);
    gates[i] = sum;
  }

  const hNext = new Array(hiddenDim);
  const cNext = new Array(hiddenDim);

  for (let d = 0; d < hiddenDim; d++) {
    const iGate = sigmoid(gates[d]);
    const fGate = sigmoid(gates[hiddenDim + d]);
    const gGate = Math.tanh(gates[2 * hiddenDim + d]);
    const oGate = sigmoid(gates[3 * hiddenDim + d]);

    cNext[d] = fGate * cPrev[d] + iGate * gGate;
    hNext[d] = oGate * Math.tanh(cNext[d]);
  }

  return { h: hNext, c: cNext };
}

// Bidirectional 2-Layer LSTM
function runBiLSTM(input: number[][]): number[][] {
  const seqLen = input.length; // 20
  const hiddenDim = 96;

  // Layer 0 Forward & Reverse
  const l0Fwd = new Array(seqLen);
  let hFwd = new Array(hiddenDim).fill(0);
  let cFwd = new Array(hiddenDim).fill(0);
  for (let t = 0; t < seqLen; t++) {
    const res = lstmStep(
      input[t],
      hFwd,
      cFwd,
      weights['lstm.weight_ih_l0'],
      weights['lstm.weight_hh_l0'],
      weights['lstm.bias_ih_l0'],
      weights['lstm.bias_hh_l0']
    );
    hFwd = res.h;
    cFwd = res.c;
    l0Fwd[t] = res.h;
  }

  const l0Rev = new Array(seqLen);
  let hRev = new Array(hiddenDim).fill(0);
  let cRev = new Array(hiddenDim).fill(0);
  for (let t = seqLen - 1; t >= 0; t--) {
    const res = lstmStep(
      input[t],
      hRev,
      cRev,
      weights['lstm.weight_ih_l0_reverse'],
      weights['lstm.weight_hh_l0_reverse'],
      weights['lstm.bias_ih_l0_reverse'],
      weights['lstm.bias_hh_l0_reverse']
    );
    hRev = res.h;
    cRev = res.c;
    l0Rev[t] = res.h;
  }

  // Combine layer 0: [seqLen, 192]
  const l0Out: number[][] = Array.from({ length: seqLen }, (_, t) => [
    ...l0Fwd[t],
    ...l0Rev[t],
  ]);

  // Layer 1 Forward & Reverse
  const l1Fwd = new Array(seqLen);
  let hFwd1 = new Array(hiddenDim).fill(0);
  let cFwd1 = new Array(hiddenDim).fill(0);
  for (let t = 0; t < seqLen; t++) {
    const res = lstmStep(
      l0Out[t],
      hFwd1,
      cFwd1,
      weights['lstm.weight_ih_l1'],
      weights['lstm.weight_hh_l1'],
      weights['lstm.bias_ih_l1'],
      weights['lstm.bias_hh_l1']
    );
    hFwd1 = res.h;
    cFwd1 = res.c;
    l1Fwd[t] = res.h;
  }

  const l1Rev = new Array(seqLen);
  let hRev1 = new Array(hiddenDim).fill(0);
  let cRev1 = new Array(hiddenDim).fill(0);
  for (let t = seqLen - 1; t >= 0; t--) {
    const res = lstmStep(
      l0Out[t],
      hRev1,
      cRev1,
      weights['lstm.weight_ih_l1_reverse'],
      weights['lstm.weight_hh_l1_reverse'],
      weights['lstm.bias_ih_l1_reverse'],
      weights['lstm.bias_hh_l1_reverse']
    );
    hRev1 = res.h;
    cRev1 = res.c;
    l1Rev[t] = res.h;
  }

  // Combine layer 1: [seqLen, 192]
  return Array.from({ length: seqLen }, (_, t) => [...l1Fwd[t], ...l1Rev[t]]);
}

// Multihead Self-Attention
function multiheadAttention(x: number[][]): number[][] {
  const seqLen = x.length; // 20
  const embedDim = 192;
  const numHeads = 4;
  const headDim = embedDim / numHeads; // 48
  const scale = 1 / Math.sqrt(headDim);

  const inProjW = weights['attn.in_proj_weight']; // [576, 192]
  const inProjB = weights['attn.in_proj_bias']; // [576]
  const outProjW = weights['attn.out_proj.weight']; // [192, 192]
  const outProjB = weights['attn.out_proj.bias']; // [192]

  // Compute Q, K, V
  const Q: number[][][] = Array.from({ length: numHeads }, () =>
    Array.from({ length: seqLen }, () => new Array(headDim).fill(0))
  );
  const K: number[][][] = Array.from({ length: numHeads }, () =>
    Array.from({ length: seqLen }, () => new Array(headDim).fill(0))
  );
  const V: number[][][] = Array.from({ length: numHeads }, () =>
    Array.from({ length: seqLen }, () => new Array(headDim).fill(0))
  );

  for (let t = 0; t < seqLen; t++) {
    const proj = new Float32Array(3 * embedDim);
    for (let i = 0; i < 3 * embedDim; i++) {
      proj[i] = inProjB[i] + dot(inProjW[i], x[t]);
    }
    for (let h = 0; h < numHeads; h++) {
      for (let d = 0; d < headDim; d++) {
        Q[h][t][d] = proj[h * headDim + d];
        K[h][t][d] = proj[embedDim + h * headDim + d];
        V[h][t][d] = proj[2 * embedDim + h * headDim + d];
      }
    }
  }

  // Scaled Dot-Product Attention per head
  const headOutputs: number[][][] = Array.from({ length: numHeads }, () =>
    Array.from({ length: seqLen }, () => new Array(headDim).fill(0))
  );

  for (let h = 0; h < numHeads; h++) {
    for (let t1 = 0; t1 < seqLen; t1++) {
      const scores = new Float32Array(seqLen);
      let maxScore = -Infinity;
      for (let t2 = 0; t2 < seqLen; t2++) {
        const s = dot(Q[h][t1], K[h][t2]) * scale;
        scores[t2] = s;
        if (s > maxScore) maxScore = s;
      }
      // Softmax
      let sumExp = 0;
      for (let t2 = 0; t2 < seqLen; t2++) {
        scores[t2] = Math.exp(scores[t2] - maxScore);
        sumExp += scores[t2];
      }
      for (let t2 = 0; t2 < seqLen; t2++) {
        scores[t2] /= sumExp;
      }
      // Weight values
      for (let d = 0; d < headDim; d++) {
        let vSum = 0;
        for (let t2 = 0; t2 < seqLen; t2++) {
          vSum += scores[t2] * V[h][t2][d];
        }
        headOutputs[h][t1][d] = vSum;
      }
    }
  }

  // Concat heads & Output projection
  const out: number[][] = Array.from({ length: seqLen }, () =>
    new Array(embedDim).fill(0)
  );

  for (let t = 0; t < seqLen; t++) {
    const concatHeads = new Array(embedDim);
    for (let h = 0; h < numHeads; h++) {
      for (let d = 0; d < headDim; d++) {
        concatHeads[h * headDim + d] = headOutputs[h][t][d];
      }
    }
    for (let d = 0; d < embedDim; d++) {
      out[t][d] = outProjB[d] + dot(outProjW[d], concatHeads);
    }
  }

  return out;
}

// Linear Layer + ReLU
function linearRelu(
  input: number[],
  weight: number[][],
  bias: number[]
): number[] {
  const outDim = weight.length;
  const out = new Array(outDim);
  for (let i = 0; i < outDim; i++) {
    const val = bias[i] + dot(weight[i], input);
    out[i] = Math.max(0, val);
  }
  return out;
}

// Linear Layer (No Activation)
function linear(input: number[], weight: number[][], bias: number[]): number[] {
  const outDim = weight.length;
  const out = new Array(outDim);
  for (let i = 0; i < outDim; i++) {
    out[i] = bias[i] + dot(weight[i], input);
  }
  return out;
}

export interface ModelPrediction {
  speedKmh: number;
  yawRateDps: number;
}

/**
 * Execute on-device forward inference with the ONNX-equivalent model
 * @param rawWindow 20 samples of 10 features [[feat0..feat9], ... 20 times]
 */
export function predictDeadReckoning(rawWindow: number[][]): ModelPrediction {
  if (rawWindow.length !== 20 || rawWindow[0].length !== 10) {
    throw new Error(
      `Invalid input shape [${rawWindow.length}, ${rawWindow[0]?.length}]. Expected [20, 10].`
    );
  }

  // 1. Feature normalization (z-score with train feat_mean & feat_std)
  const normWindow: number[][] = Array.from({ length: 20 }, (_, t) =>
    Array.from({ length: 10 }, (_, f) => {
      return (rawWindow[t][f] - meta.feat_mean[f]) / meta.feat_std[f];
    })
  );

  // Mean gyro_z across window (channel 5)
  let gyroZMean = 0;
  for (let t = 0; t < 20; t++) {
    gyroZMean += normWindow[t][5];
  }
  gyroZMean /= 20;

  // 2. CNN: [10, 20] -> [48, 20] -> [96, 20]
  const cnnIn: number[][] = Array.from({ length: 10 }, (_, f) =>
    Array.from({ length: 20 }, (_, t) => normWindow[t][f])
  );

  const cnn0 = conv1d(
    cnnIn,
    weights['cnn.0.weight'],
    weights['cnn.0.bias']
  );
  const cnn1 = batchNormRelu(
    cnn0,
    weights['cnn.1.weight'],
    weights['cnn.1.bias'],
    weights['cnn.1.running_mean'],
    weights['cnn.1.running_var']
  );

  const cnn3 = conv1d(
    cnn1,
    weights['cnn.3.weight'],
    weights['cnn.3.bias']
  );
  const cnn4 = batchNormRelu(
    cnn3,
    weights['cnn.4.weight'],
    weights['cnn.4.bias'],
    weights['cnn.4.running_mean'],
    weights['cnn.4.running_var']
  );

  // 3. BiLSTM: [20, 96] -> [20, 192]
  const lstmIn: number[][] = Array.from({ length: 20 }, (_, t) =>
    Array.from({ length: 96 }, (_, c) => cnn4[c][t])
  );
  const lstmOut = runBiLSTM(lstmIn);

  // 4. Multihead Attention: [20, 192] -> [20, 192]
  const attnOut = multiheadAttention(lstmOut);

  // 5. Multi-Pooling Representation: 4 x 192 = 768
  const meanPool = new Array(192).fill(0);
  const maxPool = new Array(192).fill(-Infinity);
  for (let t = 0; t < 20; t++) {
    for (let d = 0; d < 192; d++) {
      meanPool[d] += attnOut[t][d] / 20;
      if (attnOut[t][d] > maxPool[d]) maxPool[d] = attnOut[t][d];
    }
  }
  const lastStep = attnOut[19];
  const firstStep = attnOut[0];

  const rep = [...meanPool, ...maxPool, ...lastStep, ...firstStep]; // 768

  // 6. Speed Head
  const speedH0 = linearRelu(
    rep,
    weights['speed_head.0.weight'],
    weights['speed_head.0.bias']
  );
  const speedNorm = linear(
    speedH0,
    weights['speed_head.3.weight'],
    weights['speed_head.3.bias']
  )[0];

  // Denormalize speed: speed_kmh = speed_norm * speed_std + speed_mean
  const speedKmh = Math.max(0, speedNorm * meta.speed_std + meta.speed_mean);

  // 7. Yaw Rate Head (Residual + Direct Gyro Skip)
  const yawH0 = linearRelu(
    rep,
    weights['yaw_residual.0.weight'],
    weights['yaw_residual.0.bias']
  );
  const yawRes = linear(
    yawH0,
    weights['yaw_residual.3.weight'],
    weights['yaw_residual.3.bias']
  )[0];
  const yawDirect =
    weights['yaw_skip.bias'][0] + weights['yaw_skip.weight'][0][0] * gyroZMean;

  const yawRateDps = yawDirect + yawRes;

  return {
    speedKmh: Number(speedKmh.toFixed(2)),
    yawRateDps: Number(yawRateDps.toFixed(2)),
  };
}
