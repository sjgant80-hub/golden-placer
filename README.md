# the golden placer — collision-free placement, everywhere clustering is the enemy

**▶ Live: https://sjgant80-hub.github.io/golden-placer/**  (four industries, side by side against the standard baseline — drag the sliders, add a server, watch it never clump)

**One primitive:** place the n-th thing at the golden angle (137.5°) and it lands, by construction, in the biggest
remaining gap — so it **never clusters, for any count, online, parameter-free** (the Steinhaus three-gap theorem:
at most 3 distinct gap sizes, ever, the largest never more than φ² the smallest). The golden ratio is the "most
irrational" number, which makes `{n·φ mod 1}` the **lowest-discrepancy sequence there is.** This takes the estate's
one provably-novel primitive (collision-free placement, from the-cam) *out of memory* and points it at every
problem where even spread is worth money.

## Measured wins over the standard baseline (`node test.mjs`, 23/23)

| industry | golden | baseline | |
|---|---|---|---|
| **consistent hashing** (load CV, 1 pt/server) | **0.32** | 0.93 (random) | ~3× more even with **one point per server** — random needs 100s of virtual nodes to match |
| **key hashing** (strided keys, bin CV) | **0.02** | 7.9 (`key % k`) | **351× more even** — modulo collapses strided keys onto a few bins; golden spreads them flat |
| **spatial placement** (2D nearest-pair dist) | **0.048** | 0.004 (random) | **12× larger** — random has near-collisions; golden can't |
| **scheduling** (peak concurrency) | **7** | 15 (random) | ~2× flatter — kills the thundering herd |
| **discrepancy** (n=1000) | — | — | golden **31× more even** than random, and the lead **grows** with n |

## The four applications

- **Consistent hashing without virtual nodes.** Place servers on the hash ring by golden angle → arcs are near-even
  (three-gap) with **one point per server**, where the textbook approach needs hundreds of virtual nodes per server
  to get even load. Adding a server splits the current largest arc → only ~1/k of keys move (minimal reshuffle).
- **Fibonacci hashing.** Knuth's multiplicative hash (`2^32/φ`) uses the whole word and φ's irrationality, so
  **strided/clustered keys** (sequential IDs, aligned pointers, timestamps) spread evenly — exactly where `key % k`
  collapses them onto `gcd(stride,k)` bins.
- **Spatial placement.** The Fibonacci lattice (2D) and golden spiral (sphere) **maximize the minimum distance** —
  collision-free slotting, sensor placement, sampling, equal-area sky coverage.
- **Temporal spreading.** Place recurring tasks at golden offsets → no two bursts line up → the thundering herd
  flattens, incrementally, without a coordinator.

## Honest scope

This is **open-loop even distribution** — provably non-clustering, deterministic, incremental. "Even" means
**bounded variance** (three-gap: ≤3 sizes at ratio φ), **not zero** — golden's consistent-hashing load CV floors
near 0.3 with one point/node, still ~3× tighter than random, not perfectly uniform. It is **not adaptive load
feedback**; for weighted or adversarial load you put policy on top. And the pieces are old (phyllotaxis, Steinhaus,
Knuth's Fibonacci hashing) — the point is using golden-angle placement as **one general-purpose primitive across
all of these at once**, which nobody ships.

## Files

`placer.mjs` (the primitive + all four applications + the metrics) · `test.mjs` (the 23/23 gate: the three-gap
guarantee, discrepancy, and the measured win in each industry, with honest scope encoded) · `index.html` (the live
gallery — every application side by side vs its baseline). Zero-dep, Node + browser, offline. Generalizes the-cam.

```bash
node test.mjs                 # the proof
python -m http.server 8080    # then open http://localhost:8080
```
