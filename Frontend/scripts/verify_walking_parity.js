const fs = require('fs');
const path = require('path');

const weightsPath = path.join(__dirname, '..', 'assets', 'models', 'walking_speed_weights.json');
const weightsData = JSON.parse(fs.readFileSync(weightsPath, 'utf8'));

const metaWalking = weightsData._meta.model;
const walkingWeights = weightsData.weights;

function sigmoid(x) {
  if (x > 40) return 1.0;
  if (x < -40) return 0.0;
  return 1.0 / (1.0 + Math.exp(-x));
}

function tanh(x) {
  if (x > 20) return 1.0;
  if (x < -20) return -1.0;
  const e2x = Math.exp(2 * x);
  return (e2x - 1) / (e2x + 1);
}

function stepGruCell(xt, hPrev, w_ih, w_hh, b_ih, b_hh) {
  const hiddenSize = 48;
  const inSize = xt.length;
  const gi = new Float32Array(144);
  const gh = new Float32Array(144);

  for (let i = 0; i < 144; i++) {
    let sum = b_ih[i];
    const wRow = w_ih[i];
    for (let j = 0; j < inSize; j++) {
      sum += wRow[j] * xt[j];
    }
    gi[i] = sum;
  }

  for (let i = 0; i < 144; i++) {
    let sum = b_hh[i];
    const wRow = w_hh[i];
    for (let j = 0; j < hiddenSize; j++) {
      sum += wRow[j] * hPrev[j];
    }
    gh[i] = sum;
  }

  const hNext = new Float32Array(hiddenSize);
  for (let i = 0; i < hiddenSize; i++) {
    const r = sigmoid(gi[i] + gh[i]);
    const z = sigmoid(gi[48 + i] + gh[48 + i]);
    const n = tanh(gi[96 + i] + r * gh[96 + i]);
    hNext[i] = (1 - z) * n + z * hPrev[i];
  }

  return hNext;
}

function predictWalkingSpeed(rawWindow) {
  const window10 = rawWindow.length >= 10 ? rawWindow.slice(-10) : rawWindow;
  const seqLen = 10;
  const inFeats = 9;

  const inputSeq = [];
  for (let t = 0; t < seqLen; t++) {
    const row = window10[t];
    const vec = new Float32Array(inFeats);
    const raw9 = [
      row[0], // ax
      row[1], // ay
      row[2], // az
      row[3], // gx
      row[4], // gy
      row[5], // gz
      row[6], // accelMag
      row[8], // gyroMag
      row[9], // jerk
    ];

    for (let f = 0; f < inFeats; f++) {
      const val = raw9[f] != null ? raw9[f] : 0;
      const m = metaWalking.mean[f];
      const s = metaWalking.std[f] || 1.0;
      vec[f] = (val - m) / s;
    }
    inputSeq.push(vec);
  }

  let h = new Float32Array(48);
  for (let t = 0; t < seqLen; t++) {
    h = stepGruCell(
      inputSeq[t],
      h,
      walkingWeights['rnn.weight_ih_l0'],
      walkingWeights['rnn.weight_hh_l0'],
      walkingWeights['rnn.bias_ih_l0'],
      walkingWeights['rnn.bias_hh_l0']
    );
  }

  const wH0 = walkingWeights['head.0.weight'];
  const bH0 = walkingWeights['head.0.bias'];
  const h0 = new Float32Array(24);
  for (let i = 0; i < 24; i++) {
    let sum = bH0[i];
    const row = wH0[i];
    for (let j = 0; j < 48; j++) {
      sum += row[j] * h[j];
    }
    h0[i] = sum > 0 ? sum : 0;
  }

  const wH2 = walkingWeights['head.2.weight'];
  const bH2 = walkingWeights['head.2.bias'];
  let predMs = bH2[0];
  const rowH2 = wH2[0];
  for (let j = 0; j < 24; j++) {
    predMs += rowH2[j] * h0[j];
  }

  const cleanMs = Math.max(0, predMs);
  const speedKmh = cleanMs * 3.6;
  return { speedMs: cleanMs, speedKmh };
}

// Test with synthetic raw window
const testWindow = [];
for (let t = 0; t < 20; t++) {
  // [ax, ay, az, gx, gy, gz, accMag, linAcc, gyroMag, jerk]
  testWindow.push([
    0.25 + 0.5 * Math.sin(t * 0.5),
    1.18 + 0.8 * Math.cos(t * 0.5),
    8.90 + 1.2 * Math.sin(t * 0.5),
    0.05 * Math.sin(t * 0.5),
    0.08 * Math.cos(t * 0.5),
    0.02 * Math.sin(t * 0.5),
    9.86 + 0.6 * Math.sin(t * 0.5),
    0.5,
    0.22,
    0.1
  ]);
}

const result = predictWalkingSpeed(testWindow);
console.log('Walking speed prediction JS result:');
console.log(`Speed in m/s: ${result.speedMs.toFixed(3)} m/s`);
console.log(`Speed in km/h: ${result.speedKmh.toFixed(2)} km/h`);

if (result.speedMs > 0.5 && result.speedMs < 2.5) {
  console.log('SUCCESS: Walking speed is within normal human walking range!');
} else {
  console.error('FAILURE: Unexpected walking speed range');
  process.exit(1);
}
