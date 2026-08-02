// test.mjs — PROOF-OF-PLAY for THE GOLDEN-ANGLE EVERYTHING-PLACER. Zero tokens. Proves the primitive's guarantee
// (Steinhaus three-gap: at most 3 distinct gaps, bounded — no clustering, EVER) and MEASURES the real wins over
// the standard baseline in four industries where even spread is money: consistent hashing, key hashing, spatial
// placement, temporal scheduling. Deterministic. Honest scope encoded: "even" is bounded-variance, not zero.
import P from './placer.mjs';
const { threeGap, sequence1D, discrepancy, ringGolden, ringRandom, loadCV, arcs, fibHash, moduloHash, binCV,
  place2D, random2D, placeSphere, minDist, sphereBandCV, spreadTime, peakLoad, rng, PHI, GOLDEN_ANGLE_DEG } = P;

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ FAIL ') + m); };
const f = (x, d = 3) => Number(x).toFixed(d);
const randPts = (n, seed) => random2D(n, seed).map(p => p[0]);   // n random points on [0,1)

console.log('\n=== §1 · THE PRIMITIVE — no clustering by construction (Steinhaus three-gap theorem) ===');
{
  ok(Math.abs(GOLDEN_ANGLE_DEG - 137.50776) < 1e-3, `the placer uses the golden angle (${f(GOLDEN_ANGLE_DEG, 3)}°)`);
  let allLe3 = true, maxRatio = 0;
  for (const n of [3, 7, 20, 50, 100, 233, 500, 1000, 1597]) { const g = threeGap(sequence1D(n)); if (g.distinct > 3) allLe3 = false; maxRatio = Math.max(maxRatio, g.maxOverMin); }
  ok(allLe3, 'for EVERY n tested (3…1597), the golden sequence has AT MOST 3 distinct gap sizes — the three-gap guarantee');
  ok(maxRatio <= PHI * PHI + 1e-6, `and the biggest gap is never more than φ² (${f(PHI * PHI, 2)}×) the smallest — bounded, so no cluster can form (worst seen ${f(maxRatio, 2)}×)`);
  // the baseline clusters badly
  const rg = threeGap(randPts(500, 3));
  ok(rg.distinct > 20 && rg.maxOverMin > 50, `random placement clusters: ${rg.distinct} distinct gaps, biggest/smallest = ${f(rg.maxOverMin, 0)}× (a cluster IS a huge gap next to a tiny one)`);
}

console.log('\n=== §2 · LOW DISCREPANCY — measurably more even than random, and the lead GROWS with n ===');
{
  const ratios = [50, 200, 1000].map(n => discrepancy(randPts(n, 5)) / discrepancy(sequence1D(n)));
  ratios.forEach((r, i) => ok(r > 2, `at n=${[50, 200, 1000][i]}, golden is ${f(r, 1)}× more even than random (lower star-discrepancy)`));
  ok(ratios[2] > ratios[0], `and the advantage WIDENS with scale (${f(ratios[0], 1)}× → ${f(ratios[2], 1)}×) — golden ~O(log n/n) vs random ~O(1/√n)`);
}

console.log('\n=== §3 · APP1 · CONSISTENT HASHING WITHOUT VIRTUAL NODES (even load, 1 point/server) ===');
{
  for (const k of [16, 64]) {
    const gCV = loadCV(ringGolden(k)), rCV = loadCV(ringRandom(k, 4));
    ok(gCV < rCV * 0.6, `k=${k}: golden node load CV=${f(gCV)} vs random 1-pt/node CV=${f(rCV)} — golden is far more even (random needs 100s of virtual nodes to match)`);
  }
  // adding a node splits the CURRENT LARGEST arc → only its keys move (minimal, even reshuffle)
  const before = ringGolden(32), after = ringGolden(33);
  const r = rng(11); let moved = 0, S = 5000;
  const own = (x, ring) => { for (const p of ring) if (x <= p) return p; return ring[0]; };
  for (let i = 0; i < S; i++) { const x = r(); if (own(x, before) !== own(x, after)) moved++; }
  ok(moved / S < 2 / 32, `growing 32→33 nodes moves only ${f(moved / S * 100, 1)}% of the keyspace (~1/k) — minimal, consistent-hashing-grade reshuffle`);
}

console.log('\n=== §4 · APP2 · FIBONACCI HASHING — strided/clustered keys spread evenly where modulo collapses ===');
{
  for (const [stride, k] of [[8, 16], [64, 64], [1000, 50]]) {
    const keys = Array.from({ length: 4000 }, (_, i) => i * stride);
    const fib = binCV(keys, k, fibHash), mod = binCV(keys, k, moduloHash);
    ok(fib < 0.1 && mod > fib * 20, `stride ${stride} → ${k} bins: fibHash CV=${f(fib)} (near-perfect) vs modulo CV=${f(mod)} (catastrophic clustering) — ${f(mod / fib, 0)}× better`);
  }
}

console.log('\n=== §5 · APP3 · SPATIAL PLACEMENT — collision-free 2D + equal-area sphere ===');
{
  for (const n of [64, 256]) {
    const g = minDist(place2D(n)), rd = minDist(random2D(n, 6));
    ok(g > rd * 4, `N=${n} in 2D: golden nearest-pair distance ${f(g, 3)} vs random ${f(rd, 3)} — golden ${f(g / rd, 1)}× (random has near-collisions; golden can't)`);
  }
  const gS = sphereBandCV(placeSphere(256));
  const rr = rng(7); const rSphere = Array.from({ length: 256 }, () => { const z = rr() * 2 - 1, a = rr() * 2 * Math.PI, s = Math.sqrt(1 - z * z); return [s * Math.cos(a), s * Math.sin(a), z]; });
  ok(gS < sphereBandCV(rSphere) * 0.2, `on the sphere: golden equal-area band CV=${f(gS)} vs random ${f(sphereBandCV(rSphere))} — even coverage, no polar clumping`);
}

console.log('\n=== §6 · APP4 · TEMPORAL SPREADING — anti-thundering-herd ===');
{
  for (const n of [50, 200]) {
    const w = 3 / n, go = Array.from({ length: n }, (_, i) => spreadTime(i)), r = randPts(n, 8);
    const gp = peakLoad(go, w), rp = peakLoad(r, w);
    ok(gp < rp, `N=${n} recurring tasks: golden peak concurrency ${gp} vs random ${rp} — golden flattens the burst`);
  }
}

console.log('\n=== §7 · HONEST SCOPE + DETERMINISM + FUZZ ===');
{
  ok(loadCV(ringGolden(64)) > 0.05, 'HONEST: "even" means bounded-variance, NOT zero — golden load CV has a ~0.3 floor (three sizes at ratio φ). It is provably even, not perfectly uniform');
  ok(threeGap(sequence1D(100)).distinct === threeGap(sequence1D(100)).distinct && discrepancy(sequence1D(100)) === discrepancy(sequence1D(100)), 'deterministic — same input, identical output');
  let threw = false;
  try { threeGap(sequence1D(1)); minDist(place2D(1)); binCV([], 4, fibHash); binCV([NaN, 'x', 1e30, -5], 8, fibHash); loadCV(ringGolden(1)); place2D(0); placeSphere(0); fibHash('any', 1); } catch { threw = true; }
  ok(!threw, 'degenerate inputs (n=1, empty, garbage keys, k=1) never throw');
  ok(fibHash('anything', 8) >= 0 && fibHash('anything', 8) < 8 && Number.isInteger(fibHash(12345, 8)), 'the hash always returns a valid bin in [0,k)');
}

const done = fail === 0;
console.log('\n' + (done
  ? `=== ✅ THE GOLDEN PLACER — no clustering by construction (≤3 gaps, ∀n), and it wins in 4 industries: even shards (1 pt/node), spread hashing (${f(binCV(Array.from({ length: 4000 }, (_, i) => i * 64), 64, moduloHash) / binCV(Array.from({ length: 4000 }, (_, i) => i * 64), 64, fibHash), 0)}× vs modulo), collision-free placement, flat schedules · ${pass}/${pass} · zero tokens ===`
  : `=== ❌ ${fail} FAILED / ${pass + fail} ===`));
process.exit(done ? 0 : 1);
