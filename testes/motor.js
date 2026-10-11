
const PC_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const PC_FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const SOL_SHARP = ['Dó','Dó#','Ré','Ré#','Mi','Fá','Fá#','Sol','Sol#','Lá','Lá#','Si'];
const SOL_FLAT  = ['Dó','Réb','Ré','Mib','Mi','Fá','Solb','Sol','Láb','Lá','Sib','Si'];
const KS_MAJ = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
const KS_MIN = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
const MAJOR = [0,2,4,5,7,9,11], MINOR = [0,2,3,5,7,8,10];
const mod = (n, m) => ((n % m) + m) % m;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

function pearson(a, b) {
  let ma = 0, mb = 0; for (let i = 0; i < 12; i++) { ma += a[i]; mb += b[i]; } ma /= 12; mb /= 12;
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < 12; i++) { const x = a[i] - ma, y = b[i] - mb; n += x * y; da += x * x; db += y * y; }
  return da > 1e-12 && db > 1e-12 ? n / Math.sqrt(da * db) : 0;
}
const KEY_PROFILES = [];
for (let k = 0; k < 24; k++) {
  const tonic = k % 12, base = k >= 12 ? KS_MIN : KS_MAJ, p = new Array(12);
  for (let pc = 0; pc < 12; pc++) p[pc] = base[mod(pc - tonic, 12)];
  KEY_PROFILES.push(p);
}
const relativeOf = k => k < 12 ? 12 + mod(k + 9, 12) : mod(k - 12 + 3, 12);
const FLAT_MAJ = [5,10,3,8,1], FLAT_MIN = [2,7,0,5,10,3];
const useFlats = k => (k >= 12 ? FLAT_MIN : FLAT_MAJ).includes(k % 12);
const noteNames = k => useFlats(k) ? PC_FLAT : PC_SHARP;
const solNames = k => useFlats(k) ? SOL_FLAT : SOL_SHARP;
const keyName = k => solNames(k)[k % 12] + (k >= 12 ? ' menor' : ' maior');
const keyCifra = k => noteNames(k)[k % 12] + (k >= 12 ? 'm' : '');

/* YIN: altura de uma janela de 2048 amostras */
const _d = new Float32Array(1100), _cm = new Float32Array(1100);
function yin(buf, sr, gate) {
  const W = 1024, tauMax = Math.min(1000, Math.floor(sr / 70)), tauMin = Math.max(2, Math.floor(sr / 1000));
  const N = W + tauMax; let e = 0;
  for (let i = 0; i < N; i++) e += buf[i] * buf[i];
  const rms = Math.sqrt(e / N);
  if (rms < gate) return null;
  let run = 0; _cm[0] = 1;
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0;
    for (let i = 0; i < W; i++) { const x = buf[i] - buf[i + tau]; s += x * x; }
    _d[tau] = s; run += s; _cm[tau] = run > 0 ? s * tau / run : 1;
  }
  let tau = tauMin;
  while (tau < tauMax) {
    if (_cm[tau] < 0.15) { while (tau + 1 < tauMax && _cm[tau + 1] < _cm[tau]) tau++; break; }
    tau++;
  }
  if (tau >= tauMax) return null;
  const a = _cm[tau - 1], b = _cm[tau], c = _cm[tau + 1], den = a - 2 * b + c;
  const t = den !== 0 ? tau + (a - c) / (2 * den) : tau;
  return { f: sr / t, clarity: 1 - b, rms };
}

/* Acumula o que foi cantado e estima o tom */
class Tracker {
  constructor() { this.reset(); }
  reset() {
    this.hist = new Float64Array(12); this.fast = new Float64Array(12);
    this.sS = 0; this.sC = 0; this.prev = null; this.silence = 0;
    this.noteDur = 0; this.notePc = -1; this.lastNotePc = -1; this.endDone = true;
    this.voiced = 0; this.key = -1; this.cand = -1; this.candT = 0; this.fresh = 0;
    this.r = new Float64Array(24); this.conf = 0; this.ev = 0; this.total = 0; this.best = 0; this.boundary = false;
  }
  get offset() { return Math.atan2(this.sS, this.sC) / (2 * Math.PI); } /* em semitons, -0.5..0.5 */
  push(midi, clarity, dt) {
    const kH = Math.pow(0.5, dt / 14), kF = Math.pow(0.5, dt / 1.3), kT = Math.pow(0.5, dt / 40);
    for (let i = 0; i < 12; i++) { this.hist[i] *= kH; this.fast[i] *= kF; }
    this.sS *= kT; this.sC *= kT;
    if (midi == null) {
      this.silence += dt; this.prev = null; this.noteDur = 0; this.notePc = -1;
      if (!this.endDone && this.silence > 0.25 && this.lastNotePc >= 0) { this.hist[this.lastNotePc] += 0.7; this.endDone = true; }
      if (this.silence > 3.5 && !this.boundary) {
        for (let i = 0; i < 12; i++) this.hist[i] *= 0.3;
        this.boundary = true; this.fresh = 5;
      }
      return -1;
    }
    this.silence = 0; this.boundary = false;
    const stable = this.prev != null && Math.abs(midi - this.prev) < 0.3;
    this.prev = midi;
    const w = dt * clarity * clarity;
    if (stable) { this.sS += w * Math.sin(2 * Math.PI * midi); this.sC += w * Math.cos(2 * Math.PI * midi); }
    const pc = mod(Math.round(midi - this.offset), 12), wh = stable ? w : w * 0.25;
    this.hist[pc] += wh; this.fast[pc] += wh;
    if (pc === this.notePc) this.noteDur += dt; else { this.notePc = pc; this.noteDur = dt; }
    if (this.noteDur > 0.15) { this.lastNotePc = pc; this.endDone = false; }
    this.voiced += dt;
    return pc;
  }
  update(dt) {
    const h = this.hist; let total = 0; for (let i = 0; i < 12; i++) total += h[i];
    this.total = total; const ev = Math.min(1, total / 2.2), r = this.r;
    if (total < 0.05) r.fill(0); else for (let k = 0; k < 24; k++) r[k] = pearson(h, KEY_PROFILES[k]);
    let best = 0; for (let k = 1; k < 24; k++) if (r[k] > r[best]) best = k;
    this.best = best; this.fresh = Math.max(0, this.fresh - dt);
    const second = k => { const rel = relativeOf(k); let s = -1; for (let j = 0; j < 24; j++) { if (j === k || j === rel) continue; if (r[j] > s) s = r[j]; } return s; };
    if (this.key < 0) { if (total > 0.4) this.key = best; }
    else if (best !== this.key) {
      const need = this.fresh > 0 ? 0.4 : 1.2;
      if (best === this.cand) this.candT += dt; else { this.cand = best; this.candT = 0; }
      if (this.candT > need && r[best] > r[this.key] + 0.03) { this.key = best; this.cand = -1; this.candT = 0; }
    } else { this.cand = -1; this.candT = 0; }
    let mx = 0; for (let i = 0; i < 12; i++) mx = Math.max(mx, h[i]);
    let distinct = 0; for (let i = 0; i < 12; i++) if (h[i] >= 0.12 * mx && mx > 0) distinct++;
    this.distinct = distinct;
    const variety = clamp((distinct - 1.5) / 3, 0.3, 1); /* poucas notas diferentes = tom ambíguo */
    const target = this.key >= 0 ? ev * variety * clamp((r[this.key] - second(this.key)) / 0.10, 0, 1) : 0;
    this.conf += (target - this.conf) * Math.min(1, dt * 3);
    this.ev = ev;
  }
}

/* Acordes do tom: graus 0..6 (triades da escala) */
function chordInfo(key, deg) {
  const tonic = key % 12, sc = (key >= 12 ? MINOR : MAJOR).map(x => mod(x + tonic, 12));
  const root = sc[deg], third = sc[(deg + 2) % 7], fifth = sc[(deg + 4) % 7];
  const t = mod(third - root, 12), f = mod(fifth - root, 12);
  const q = t === 3 ? (f === 6 ? 'dim' : 'm') : '';
  return { root, third, fifth, name: noteNames(key)[root] + q };
}
function pickChord(key, fast, prev) {
  const sc = (key >= 12 ? MINOR : MAJOR);
  let best = 0, bs = -1; const scores = [];
  for (let d = 0; d < 7; d++) {
    const c = chordInfo(key, d);
    let s = fast[c.root] + 0.8 * fast[c.third] + 0.7 * fast[c.fifth];
    s *= d === 0 ? 1.15 : (d === 3 || d === 4) ? 1.0 : 0.9;
    scores.push(s); if (s > bs) { bs = s; best = d; }
  }
  if (bs < 0.05) return prev == null ? 0 : prev;
  if (prev != null && scores[prev] * 1.25 >= bs) return prev;
  return best;
}

module.exports={yin,Tracker,pickChord,chordInfo,relativeOf,keyName,MAJOR,MINOR,mod};