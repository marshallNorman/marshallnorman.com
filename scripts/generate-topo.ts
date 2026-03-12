/**
 * generate-topo.ts
 * Generates a topographic contour map SVG using marching squares.
 *
 * Iso-curves of a continuous elevation function are mathematically guaranteed
 * never to cross — this is the only correct way to avoid crossing contour lines.
 *
 * Usage: bun scripts/generate-topo.ts > public/images/case-study-dialpad.svg
 */

// ── Terrain configuration ──────────────────────────────────────────────────

const W = 800;
const H = 500;
const RES = 4; // sample every RES pixels → grid is (W/RES + 1) × (H/RES + 1)

interface Peak {
  cx: number; cy: number;
  h: number;           // peak height (0–1)
  sx: number; sy: number; // Gaussian spread in x and y (controls width/shape)
  angle?: number;      // optional rotation of the Gaussian (radians)
}

const PEAKS: Peak[] = [
  // ── Main summits (narrower spreads so terrain drops off faster) ──
  { cx: 195, cy: 245, h: 1.00, sx: 108, sy:  86, angle:  0.14 }, // Major, left-center
  { cx: 620, cy: 175, h: 0.88, sx:  98, sy:  80, angle: -0.22 }, // Major, right
  { cx: 380, cy: 425, h: 0.72, sx:  82, sy:  66, angle:  0.26 }, // Medium, bottom
  { cx: 755, cy: 408, h: 0.65, sx:  72, sy:  59, angle: -0.35 }, // Medium, btm-right
  { cx:  68, cy:  82, h: 0.60, sx:  70, sy:  56, angle:  0.38 }, // Small, top-left
  { cx: 505, cy:  52, h: 0.68, sx:  78, sy:  62, angle: -0.14 }, // Medium, top-center
  { cx: 782, cy: 118, h: 0.55, sx:  65, sy:  52, angle: -0.52 }, // Small, top-right
  { cx: 282, cy: 122, h: 0.62, sx:  72, sy:  62, angle:  0.09 }, // Medium, upper-mid
  { cx:  50, cy: 458, h: 0.52, sx:  68, sy:  54, angle:  0.20 }, // Small, btm-left

  // ── Ridgelines (elongated Gaussians simulating connecting ridges) ──
  // These fill the terrain between summits, creating realistic saddle topology
  { cx: 408, cy: 202, h: 0.42, sx: 195, sy:  28, angle:  0.28 }, // Ridge: A ↔ B
  { cx: 222, cy: 338, h: 0.34, sx:  32, sy: 120, angle:  0.08 }, // Ridge: A ↔ C (N–S)
  { cx: 678, cy: 292, h: 0.36, sx:  38, sy: 132, angle:  0.12 }, // Ridge: B ↔ D (N–S)
  { cx: 138, cy: 172, h: 0.30, sx: 110, sy:  26, angle: -0.52 }, // Ridge: E ↔ A
  { cx: 395, cy:  88, h: 0.30, sx: 135, sy:  24, angle:  0.06 }, // Ridge: F ↔ H (top)
  { cx: 704, cy: 145, h: 0.28, sx:  88, sy:  22, angle: -0.38 }, // Ridge: G ↔ B
  { cx: 305, cy: 428, h: 0.26, sx: 240, sy:  28, angle:  0.10 }, // Ridge: C ↔ I (bottom)

];

// ── Height function ────────────────────────────────────────────────────────

function terrainHeight(x: number, y: number): number {
  const nx = x / W;
  const ny = y / H;

  // Harmonic background — DC tuned so terrain min ≈ 0.016 < first LEVEL (0.02)
  // All 40 contour levels produce visible paths. No clamping needed.
  const bg = 0.18
    + 0.16 * Math.cos(2 * Math.PI * (2.3 * nx + 1.1 * ny + 0.10))
    + 0.12 * Math.cos(2 * Math.PI * (1.2 * nx - 2.4 * ny + 0.62))
    + 0.09 * Math.cos(2 * Math.PI * (3.7 * nx + 0.6 * ny + 1.33))
    + 0.06 * Math.cos(2 * Math.PI * (0.9 * nx + 3.1 * ny + 0.88));
  // bg range in canvas: approx [-0.01, 0.76]

  // Gaussian peaks layered on top for mountain character
  let peaks = 0;
  for (const p of PEAKS) {
    const a = p.angle ?? 0;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const dx = x - p.cx;
    const dy = y - p.cy;
    const rx =  cos * dx + sin * dy;
    const ry = -sin * dx + cos * dy;
    peaks += p.h * Math.exp(-(rx * rx) / (2 * p.sx * p.sx) - (ry * ry) / (2 * p.sy * p.sy));
  }

  return Math.min(1, bg + peaks);
}

// ── Grid sampling ──────────────────────────────────────────────────────────

const cols = Math.floor(W / RES) + 1;
const rows = Math.floor(H / RES) + 1;

const grid: number[][] = [];
for (let j = 0; j < rows; j++) {
  grid[j] = [];
  for (let i = 0; i < cols; i++) {
    grid[j][i] = terrainHeight(i * RES, j * RES);
  }
}

// ── Marching squares ───────────────────────────────────────────────────────
//
// Cell corners (bit encoding):
//   bit 0 (1) = top-left     (i,   j  )
//   bit 1 (2) = top-right    (i+1, j  )
//   bit 2 (4) = bottom-right (i+1, j+1)
//   bit 3 (8) = bottom-left  (i,   j+1)
//
// Edges:
//   0 = top    (between top-left  and top-right)
//   1 = right  (between top-right and bottom-right)
//   2 = bottom (between btm-left  and bottom-right)
//   3 = left   (between top-left  and bottom-left)

// For each of the 16 cases, list the pairs of edges the contour crosses.
// Saddle cases (5 and 10) use the average of all four corners to pick the
// correct disambiguation branch (avoids "butterfly" artifacts).
const EDGE_PAIRS: number[][][] = [
  [],            // 0000
  [[3, 0]],      // 0001 TL above
  [[0, 1]],      // 0010 TR above
  [[3, 1]],      // 0011
  [[1, 2]],      // 0100 BR above
  [[3, 0], [1, 2]], // 0101 saddle (TL+BR)
  [[0, 2]],      // 0110
  [[3, 2]],      // 0111
  [[3, 2]],      // 1000 BL above
  [[0, 2]],      // 1001
  [[0, 1], [3, 2]], // 1010 saddle (TR+BL)
  [[1, 2]],      // 1011
  [[3, 1]],      // 1100
  [[0, 1]],      // 1101
  [[3, 0]],      // 1110
  [],            // 1111
];

type Point = [number, number];
type Segment = [Point, Point];

function lerp(va: number, vb: number, level: number): number {
  if (Math.abs(vb - va) < 1e-10) return 0.5;
  return (level - va) / (vb - va);
}

function cellEdgePoint(
  edge: number, i: number, j: number,
  v00: number, v10: number, v11: number, v01: number,
  level: number
): Point {
  // Returns the interpolated crossing point on the specified cell edge,
  // in PIXEL coordinates (not grid coords).
  const x0 = i * RES, y0 = j * RES;
  const x1 = (i + 1) * RES, y1 = (j + 1) * RES;
  let t: number;
  switch (edge) {
    case 0: // top: left→right at y=y0
      t = lerp(v00, v10, level);
      return [x0 + t * RES, y0];
    case 1: // right: top→bottom at x=x1
      t = lerp(v10, v11, level);
      return [x1, y0 + t * RES];
    case 2: // bottom: left→right at y=y1
      t = lerp(v01, v11, level);
      return [x0 + t * RES, y1];
    case 3: // left: top→bottom at x=x0
      t = lerp(v00, v01, level);
      return [x0, y0 + t * RES];
    default:
      return [x0, y0];
  }
}

function marchingSquares(level: number): Segment[] {
  const segments: Segment[] = [];

  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const v00 = grid[j][i];
      const v10 = grid[j][i + 1];
      const v11 = grid[j + 1][i + 1];
      const v01 = grid[j + 1][i];

      let idx =
        (v00 > level ? 1 : 0) |
        (v10 > level ? 2 : 0) |
        (v11 > level ? 4 : 0) |
        (v01 > level ? 8 : 0);

      // Saddle disambiguation: if mean > level, invert the ambiguous cases
      if (idx === 5 || idx === 10) {
        const mean = (v00 + v10 + v11 + v01) / 4;
        if (mean > level) idx = 15 - idx; // flip to the other saddle interpretation
      }

      const pairs = EDGE_PAIRS[idx];
      for (const [e0, e1] of pairs) {
        const p0 = cellEdgePoint(e0, i, j, v00, v10, v11, v01, level);
        const p1 = cellEdgePoint(e1, i, j, v00, v10, v11, v01, level);
        segments.push([p0, p1]);
      }
    }
  }
  return segments;
}

// ── Segment chaining → continuous paths ───────────────────────────────────
//
// Build a map from rounded endpoint coords to segment indices (both ends).
// Repeatedly pick an unvisited segment, follow its chain in both directions,
// and emit one polyline path per chain.

function ptKey(p: Point): string {
  // Round to 1 decimal to tolerate floating-point jitter at shared edges.
  return `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)}`;
}

function chainSegments(segments: Segment[]): Point[][] {
  if (segments.length === 0) return [];

  // adjacency: point key → [{seg index, which end of that segment touches this point}]
  const adj = new Map<string, Array<{ s: number; e: 0 | 1 }>>();
  for (let s = 0; s < segments.length; s++) {
    for (const e of [0, 1] as const) {
      const k = ptKey(segments[s][e]);
      if (!adj.has(k)) adj.set(k, []);
      adj.get(k)!.push({ s, e });
    }
  }

  const used = new Uint8Array(segments.length);
  const chains: Point[][] = [];

  // Trace a path starting from a given segment/end, following shared endpoints.
  function trace(startSeg: number, startEnd: 0 | 1): Point[] {
    const pts: Point[] = [segments[startSeg][startEnd]];
    let seg = startSeg, end = startEnd;
    while (true) {
      if (used[seg]) break;
      used[seg] = 1;
      const other: 0 | 1 = end === 0 ? 1 : 0;
      pts.push(segments[seg][other]);
      const k = ptKey(segments[seg][other]);
      let next: { s: number; e: 0 | 1 } | null = null;
      for (const nb of adj.get(k) ?? []) {
        if (!used[nb.s]) { next = nb; break; }
      }
      if (!next) break;
      seg = next.s;
      end = next.e;
    }
    return pts;
  }

  // First pass: start chains from "free ends" — points with only one connection.
  // This correctly handles open chains (lines that hit the canvas border).
  for (let s = 0; s < segments.length; s++) {
    if (used[s]) continue;
    let freeEnd: 0 | 1 | null = null;
    for (const e of [0, 1] as const) {
      const nbCount = (adj.get(ptKey(segments[s][e])) ?? [])
        .filter(nb => !used[nb.s]).length;
      if (nbCount === 1) { freeEnd = e; break; }
    }
    if (freeEnd !== null) chains.push(trace(s, freeEnd));
  }

  // Second pass: remaining segments are closed loops — start anywhere.
  for (let s = 0; s < segments.length; s++) {
    if (used[s]) continue;
    chains.push(trace(s, 0));
  }

  return chains;
}

function pointsToPath(pts: Point[]): string {
  if (pts.length < 2) return '';
  const r = (n: number) => Math.round(n);
  let d = `M ${r(pts[0][0])},${r(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${r(pts[i][0])},${r(pts[i][1])}`;
  }
  return d;
}

// ── Contour level styling ─────────────────────────────────────────────────

const LEVELS: number[] = [];
for (let l = 0.02; l <= 0.81; l += 0.02) {
  LEVELS.push(Math.round(l * 100) / 100);
}

function levelOpacity(level: number): number {
  // Low elevation (outer rings) = faint; high elevation (inner rings) = bold
  const minOp = 0.10, maxOp = 0.38;
  const t = Math.min(1, level / 0.80);
  return minOp + t * (maxOp - minOp);
}

function isIndex(level: number): boolean {
  // Every 5th contour: 0.20, 0.40, 0.60, 0.80
  return Math.abs(Math.round(level * 100) % 20) < 1;
}

// ── SVG output ────────────────────────────────────────────────────────────

const lines: string[] = [];

lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">`);
lines.push(`  <!-- Generated by scripts/generate-topo.ts (marching squares) -->`);
lines.push(`  <!-- Iso-curves of a sum-of-Gaussians terrain: mathematically non-crossing -->`);
lines.push(``);
lines.push(`  <defs>`);
lines.push(`    <mask id="lake-mask">`);
lines.push(`      <rect width="${W}" height="${H}" fill="white"/>`);
lines.push(`      <path d="M 303,153 L 308,149 L 314,149 L 320,153 L 322,157 L 318,162 L 312,163 L 305,161 L 301,157 Z" fill="black"/>`);
lines.push(`      <path d="M 663,289 L 667,287 L 674,288 L 678,292 L 676,296 L 671,298 L 665,296 L 662,293 Z" fill="black"/>`);
lines.push(`      <path d="M 440,278 L 444,276 L 450,277 L 453,280 L 450,284 L 444,285 L 440,282 Z" fill="black"/>`);
lines.push(`      <path d="M 688,317 L 692,315 L 696,317 L 696,320 L 692,322 L 688,320 Z" fill="black"/>`);
lines.push(`      <path d="M 702,326 L 706,325 L 709,327 L 708,329 L 704,329 L 702,328 Z" fill="black"/>`);
lines.push(`    </mask>`);
lines.push(`  </defs>`);
lines.push(``);
lines.push(`  <!-- Background -->`);
lines.push(`  <rect width="${W}" height="${H}" fill="#f1ede6"/>`);
lines.push(``);
lines.push(`  <g opacity="0.6">`);
lines.push(`  <g mask="url(#lake-mask)">`);
lines.push(`  <!-- Survey grid (faint, straight reference lines) -->`);
lines.push(`  <line x1="267" y1="0" x2="267" y2="500" stroke="rgba(80,70,55,0.07)" stroke-width="0.6"/>`);
lines.push(`  <line x1="534" y1="0" x2="534" y2="500" stroke="rgba(80,70,55,0.07)" stroke-width="0.6"/>`);
lines.push(`  <line x1="0" y1="167" x2="800" y2="167" stroke="rgba(80,70,55,0.07)" stroke-width="0.6"/>`);
lines.push(`  <line x1="0" y1="334" x2="800" y2="334" stroke="rgba(80,70,55,0.07)" stroke-width="0.6"/>`);
lines.push(``);
lines.push(`  <!-- Contour lines (marching squares, 20 levels) -->`);

for (const level of LEVELS) {
  const opacity = levelOpacity(level);
  const index = isIndex(level);
  const sw = index ? 1.0 : 0.7;
  const op = index ? Math.min(0.55, opacity * 1.4) : opacity;
  const color = `rgba(152,112,70,${op.toFixed(2)})`;

  const segments = marchingSquares(level);
  const chains = chainSegments(segments);

  const paths = chains
    .map(pts => pointsToPath(pts))
    .filter(d => d.length > 0);

  if (paths.length === 0) continue;

  const label = index ? `index contour` : `contour`;
  lines.push(`  <!-- Level ${level.toFixed(2)} — ${label} -->`);
  lines.push(`  <g fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">`);
  for (const d of paths) {
    lines.push(`    <path d="${d}"/>`);
  }
  lines.push(`  </g>`);
}

lines.push(`  </g>`);
lines.push(``);
lines.push(`  <!-- Lakes — desaturated slate blue, organic polygon outlines -->`);
// Lake 1 — near peak H/A-B ridge (was cx=312, cy=156, rx=10, ry=6)
lines.push(`  <path d="M 303,153 L 308,149 L 314,149 L 320,153 L 322,157 L 318,162 L 312,163 L 305,161 L 301,157 Z" fill="rgba(120,138,152,0.16)" stroke="rgba(120,138,152,0.30)" stroke-width="0.8" stroke-linejoin="round"/>`);
// Lake 2 — B↔D ridge (was cx=670, cy=292, rx=8, ry=5)
lines.push(`  <path d="M 663,289 L 667,287 L 674,288 L 678,292 L 676,296 L 671,298 L 665,296 L 662,293 Z" fill="rgba(120,138,152,0.14)" stroke="rgba(120,138,152,0.28)" stroke-width="0.7" stroke-linejoin="round"/>`);
// Lake 3 — A-B ridge area (was cx=446, cy=280, rx=6, ry=4)
lines.push(`  <path d="M 440,278 L 444,276 L 450,277 L 453,280 L 450,284 L 444,285 L 440,282 Z" fill="rgba(120,138,152,0.13)" stroke="rgba(120,138,152,0.25)" stroke-width="0.7" stroke-linejoin="round"/>`);
// Lake 4 — small, near D (was cx=692, cy=318, rx=4, ry=3)
lines.push(`  <path d="M 688,317 L 692,315 L 696,317 L 696,320 L 692,322 L 688,320 Z" fill="rgba(120,138,152,0.11)" stroke="rgba(120,138,152,0.22)" stroke-width="0.6" stroke-linejoin="round"/>`);
// Lake 5 — tiny, near D (was cx=705, cy=327, rx=3, ry=2)
lines.push(`  <path d="M 702,326 L 706,325 L 709,327 L 708,329 L 704,329 L 702,328 Z" fill="rgba(120,138,152,0.10)" stroke="rgba(120,138,152,0.20)" stroke-width="0.6" stroke-linejoin="round"/>`);
lines.push(``);
lines.push(`  <!-- Points of interest — muted rust/terracotta -->`);
// P_A summit
lines.push(`  <circle cx="174" cy="228" r="2.2" fill="rgba(148,108,98,0.36)"/>`);
lines.push(`  <circle cx="193" cy="222" r="1.8" fill="rgba(148,108,98,0.33)"/>`);
lines.push(`  <circle cx="172" cy="252" r="1.5" fill="rgba(148,108,98,0.28)"/>`);
// P_B summit
lines.push(`  <circle cx="607" cy="157" r="2.0" fill="rgba(148,108,98,0.35)"/>`);
lines.push(`  <circle cx="625" cy="162" r="1.6" fill="rgba(148,108,98,0.30)"/>`);
// P_H summit
lines.push(`  <circle cx="270" cy="108" r="1.8" fill="rgba(148,108,98,0.32)"/>`);
lines.push(`  <circle cx="288" cy="112" r="1.5" fill="rgba(148,108,98,0.28)"/>`);
// Scattered
lines.push(`  <circle cx="100" cy="295" r="1.5" fill="rgba(148,108,98,0.27)"/>`);
lines.push(`  <circle cx="44"  cy="170" r="1.4" fill="rgba(148,108,98,0.25)"/>`);
lines.push(`  <circle cx="720" cy="308" r="1.6" fill="rgba(148,108,98,0.28)"/>`);
lines.push(`  <circle cx="540" cy="358" r="1.5" fill="rgba(148,108,98,0.26)"/>`);
lines.push(`  <circle cx="420" cy="330" r="1.4" fill="rgba(148,108,98,0.25)"/>`);
lines.push(`  <circle cx="752" cy="200" r="1.5" fill="rgba(148,108,98,0.26)"/>`);
lines.push(`  <circle cx="148" cy="394" r="1.4" fill="rgba(148,108,98,0.24)"/>`);
lines.push(`  <circle cx="608" cy="388" r="1.6" fill="rgba(148,108,98,0.27)"/>`);
lines.push(`  <circle cx="478" cy="148" r="1.8" fill="rgba(148,108,98,0.30)"/>`);
// Lake shore dots
lines.push(`  <circle cx="304" cy="151" r="1.3" fill="rgba(120,138,152,0.28)"/>`);
lines.push(`  <circle cx="322" cy="161" r="1.2" fill="rgba(120,138,152,0.24)"/>`);
lines.push(`  <circle cx="663" cy="288" r="1.2" fill="rgba(120,138,152,0.24)"/>`);
lines.push(`  <circle cx="679" cy="298" r="1.1" fill="rgba(120,138,152,0.22)"/>`);
lines.push(`  </g>`);
lines.push(`</svg>`);

process.stdout.write(lines.join('\n') + '\n');
