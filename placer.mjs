// placer.mjs — THE GOLDEN-ANGLE EVERYTHING-PLACER. One primitive: place the n-th thing at the golden angle from
// the last, and it lands — by construction — in the biggest remaining gap. No clustering, ever, for any count,
// online, parameter-free. The golden ratio is the "most irrational" number, so the sequence {n·φ mod 1} is the
// lowest-discrepancy sequence there is (Steinhaus three-gap theorem: at most 3 distinct gaps, always near-even).
//
// This is the estate's one provably-novel primitive (collision-free placement, from the-cam) taken OUT of memory
// and pointed at every problem where "things clustering" is the enemy and even spread is worth money:
//   · consistent hashing WITHOUT virtual nodes (even load, 1 point/server, not 100s)
//   · Fibonacci hashing (strided/clustered keys spread evenly where modulo clusters catastrophically)
//   · 2D / sphere placement (slotting, sensors, sampling — max the minimum distance, no collisions)
//   · temporal spreading (anti-thundering-herd)
// Honest scope: this is OPEN-LOOP even distribution — provably non-clustering, deterministic, incremental. It is
// NOT adaptive load feedback; for weighted/adversarial load you still put policy on top. Pure, zero-dep, offline.

export const PHI = (1 + Math.sqrt(5)) / 2;       // 1.6180339887…
export const G = PHI - 1;                          // 1/φ = 0.6180339887…  (the "most irrational" rotation)
export const GOLDEN_ANGLE_DEG = 360 * (1 - 1 / PHI); // 137.50776…°  (phyllotaxis)
export const frac = x => x - Math.floor(x);

// ── the primitive: the n-th point on the unit circle [0,1), and a whole sequence ──
export const place1D = (n, offset = 0) => frac((n + offset) * G);
export const sequence1D = (N, offset = 0) => Array.from({ length: N }, (_, i) => place1D(i, offset));

// gaps between sorted points on the circle (wrapping). Returns sorted gap lengths.
export function gaps1D(pts) {
  const s = [...pts].sort((a, b) => a - b), g = [];
  for (let i = 0; i < s.length; i++) g.push(i === 0 ? (s[0] + 1 - s[s.length - 1]) : s[i] - s[i - 1]);
  return g.sort((a, b) => a - b);
}
// three-gap theorem check: how many DISTINCT gap sizes (within tolerance), and the max/min ratio.
export function threeGap(pts, tol = 1e-9) {
  const g = gaps1D(pts), distinct = [];
  for (const x of g) if (!distinct.some(d => Math.abs(d - x) < tol)) distinct.push(x);
  return { distinct: distinct.length, maxOverMin: g[g.length - 1] / g[0], maxGap: g[g.length - 1], minGap: g[0] };
}
// star discrepancy D*_n = sup_x | #{pts ≤ x}/n − x |  (how far from perfectly-uniform; lower = better).
export function discrepancy(pts) {
  const s = [...pts].sort((a, b) => a - b), n = s.length; let d = 0;
  for (let i = 0; i < n; i++) { d = Math.max(d, Math.abs((i + 1) / n - s[i]), Math.abs(i / n - s[i])); }
  return d;
}

// ── deterministic PRNG (for honest random baselines) ──
export function rng(seed) { let s = (seed >>> 0) || 1; return () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ══ APPLICATION 1 · CONSISTENT HASHING WITHOUT VIRTUAL NODES ══
// Place k server-nodes on the hash ring. Each node owns the arc back to the previous node → its load ∝ arc length.
// Golden placement → three-gap → arcs near-even with ONE point per node. Random placement → wildly uneven arcs, so
// real systems bolt on 100s of virtual nodes per server. Adding a node splits the CURRENT LARGEST arc → minimal,
// even reshuffle.
export const ringGolden = k => Array.from({ length: k }, (_, j) => place1D(j)).sort((a, b) => a - b);
export function ringRandom(k, seed = 1) { const r = rng(seed); return Array.from({ length: k }, () => r()).sort((a, b) => a - b); }
export function arcs(positions) { const s = [...positions].sort((a, b) => a - b), out = []; for (let i = 0; i < s.length; i++) out.push(i === 0 ? s[0] + 1 - s[s.length - 1] : s[i] - s[i - 1]); return out; }
export function loadCV(positions) { const a = arcs(positions), m = a.reduce((x, y) => x + y, 0) / a.length; const v = a.reduce((s, x) => s + (x - m) * (x - m), 0) / a.length; return Math.sqrt(v) / m; }
// fraction of the keyspace that must move when growing from a k-node ring to (k+1) nodes.
export function reshuffleFrac(ringOf, k, seed) { const before = ringOf(k, seed), after = ringOf(k + 1, seed); return moved(before, after); }
function owner(pos, ring) { for (const p of ring) if (pos <= p) return p; return ring[0]; } // first node clockwise (wrap)
function moved(before, after, samples = 4000, seed = 7) { const r = rng(seed); let m = 0; for (let i = 0; i < samples; i++) { const x = r(); if (owner(x, before) !== owner(x, after)) m++; } return m / samples; }

// ══ APPLICATION 2 · FIBONACCI HASHING ══
// Knuth's multiplicative hash with 2^32/φ. Uses the WHOLE word and φ's irrationality → strided / clustered keys
// (sequential IDs, aligned pointers, timestamps) spread EVENLY, exactly where `key % k` collapses them onto a few
// bins. bin(key) ∈ [0,k).
const A32 = 2654435769;                                   // round(2^32 / φ)
export const fnv = s => { let h = 0x811c9dc5 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0; return h; };
export function fibHash(key, k) { const x = (typeof key === 'number' ? (key >>> 0) : fnv(key)); const h = (Math.imul(x, A32) >>> 0) / 4294967296; return Math.floor(h * k) % k; }
export const moduloHash = (key, k) => (typeof key === 'number' ? (key >>> 0) : fnv(key)) % k;
// coefficient of variation of bin loads for a key set under a hash fn (0 = perfectly even).
export function binCV(keys, k, hashFn) { const c = new Array(k).fill(0); for (const key of keys) c[hashFn(key, k)]++; const m = keys.length / k; const v = c.reduce((s, x) => s + (x - m) * (x - m), 0) / k; return Math.sqrt(v) / m; }

// ══ APPLICATION 3 · 2D & SPHERE PLACEMENT ══
// Fibonacci lattice (sunflower) — even coverage of the unit disk; and the golden spiral on the unit sphere.
export function place2D(N) { const out = []; for (let i = 0; i < N; i++) { const r = Math.sqrt((i + 0.5) / N), t = 2 * Math.PI * G * i; out.push([0.5 + 0.5 * r * Math.cos(t), 0.5 + 0.5 * r * Math.sin(t)]); } return out; }
export function random2D(N, seed = 1) { const r = rng(seed), out = []; for (let i = 0; i < N; i++) out.push([r(), r()]); return out; }
export function placeSphere(N) { const out = []; for (let i = 0; i < N; i++) { const z = 1 - (2 * i + 1) / N, rr = Math.sqrt(Math.max(0, 1 - z * z)), t = 2 * Math.PI * G * i; out.push([rr * Math.cos(t), rr * Math.sin(t), z]); } return out; }
export function minDist(pts) { let m = Infinity; for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { let d = 0; for (let c = 0; c < pts[i].length; c++) { const e = pts[i][c] - pts[j][c]; d += e * e; } m = Math.min(m, Math.sqrt(d)); } return m; }
// equal-AREA test on the sphere: bucket points into latitude bands of equal area, CV of counts (0 = perfectly even).
export function sphereBandCV(pts, bands = 12) { const c = new Array(bands).fill(0); for (const p of pts) { const b = Math.min(bands - 1, Math.floor((p[2] + 1) / 2 * bands)); c[b]++; } const m = pts.length / bands; const v = c.reduce((s, x) => s + (x - m) * (x - m), 0) / bands; return Math.sqrt(v) / m; }

// ══ APPLICATION 4 · TEMPORAL SPREADING (anti-thundering-herd) ══
// spread the n-th recurring task over [0, period) so bursts never line up. Returns the offset in the period.
export const spreadTime = (n, period = 1) => place1D(n) * period;
// max instantaneous concurrency if N tasks each occupy `width` of the period, placed by a scheme.
export function peakLoad(offsets, width, period = 1) { let peak = 0; const pts = offsets.map(o => o % period).sort((a, b) => a - b); for (const o of pts) { let c = 0; for (const p of pts) { let d = Math.abs(p - o); d = Math.min(d, period - d); if (d < width) c++; } peak = Math.max(peak, c); } return peak; }

export default {
  PHI, G, GOLDEN_ANGLE_DEG, frac, place1D, sequence1D, gaps1D, threeGap, discrepancy, rng,
  ringGolden, ringRandom, arcs, loadCV, reshuffleFrac, fibHash, moduloHash, fnv, binCV,
  place2D, random2D, placeSphere, minDist, sphereBandCV, spreadTime, peakLoad,
};
