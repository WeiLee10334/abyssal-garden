// ============================================================================
// world layout + procedural content generation (load-time only)
// ============================================================================
// The world is a forest floor about 45 m below a ceiling of mist (y = 0): y runs from the ground (about -45) up.

// designed rock masses: ax, az, bx, bz, radius, top, overhang, waist
const MESAS = [
  [48, -48, 54, -6, 8, -15, 3, 2], [84, -50, 90, -8, 9, -11, 4, 2],   // the two walls of the ravine
  [-44, 30, -44, 30, 12, -39.5, 0, 0],      // shrine knoll
  [-86, -22, -88, 12, 12, -20, 3, 2],       // west bluff with the tunnel
  [34, 52, 34, 52, 5.5, 3, 2.5, 1.5],       // spire that reaches into the mist
  [-20, 70, -22, 96, 9, -10, 8, 3], [-14, 122, 36, 124, 10, -22, 4, 2],   // overhanging cliff and back wall of the blue glade
  [30, -72, 44, -86, 9, -14, 3, 2], [-34, -98, -10, -106, 9, -18, 4, 2], [96, 40, 104, 60, 10, -12, 5, 2],
];
// vertical ring arches: cx, cy, cz, yaw, major radius, minor radius, y squash
const ARCHES = [
  [-14, -45.5, -56, 0.3, 12, 2.4, 1.15],    // moss arch
  [68.5, -45.5, -26, 0, 10.5, 2, 1.05],       // rock bridge across the ravine
];
// carved tunnels: ax, ay, az, radius, bx, by, bz
const HOLES = [
  [-72, -42, -4, 3.4, -102, -41, -6],
];
// regions kept free of random bluffs: ax, az, bx, bz, radius, softness
const CLEARS = [
  [0, 0, 0, 0, 34, 12], [-10, 10, -44, 30, 14, 8], [-6, -20, -14, -60, 14, 8], [-20, -56, -62, -48, 13, 8],
  [-62, -48, -70, -6, 11, 8], [16, 14, 67, 10, 12, 8], [69, 8, 66, -50, 8, 4], [10, 20, 2, 56, 13, 8],
  [10, 88, 10, 88, 30, 10], [-44, 30, -44, 30, 18, 8], [-50, -66, 50, -62, 10, 8], [62, -56, 50, -62, 10, 6],
];
// the blue glade: cooler light and mist, blue-leaved trees
const PURPLE = [10, 88];
const zoneP = (x, z) => sstep(44, 26, hypot(x - PURPLE[0], z - PURPLE[1]));
// flower meadows: x, z, radius
const MAGENTA = [[8, 6, 13], [-44, 30, 11], [10, 88, 28], [-62, -48, 10], [2, 40, 9], [-14, -40, 8], [40, 12, 9], [69, -2, 6], [-24, 6, 8], [20, -64, 8], [-30, -60, 8]];
const magAt = (x, z) => {
  let m = sstep(0.54, 0.66, fbm(x * 0.03, 7, z * 0.03, 3)) * 0.9;
  for (const p of MAGENTA) m = max(m, sstep(p[2], p[2] * 0.45, hypot(x - p[0], z - p[1])));
  return m * sstep(0.3, 0.55, fbm(x * 0.17, 1, z * 0.17, 2) + m * 0.25);
};
// the elder tree in the central glade: chains of tapered capsules (x, y, z, radius) in metres from its base, and
// where its foliage hangs (x, y, z, radius)
const ELDERP = [-4, -8];
const ELDER = (() => {
  const C = [], tips = [];
  const chain = (pts) => { for (let i = 0; i < pts.length - 1; i++) C.push([...pts[i], ...pts[i + 1]]); };
  chain([[0, -3, 0, 5.2], [0.5, 5, 0.3, 4.1], [0.2, 14, -0.5, 3.4], [-0.6, 26, 0, 2.8], [0.3, 38, 0.5, 2.3], [0, 51, 0, 1.8]]);
  for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + 0.3, c = cos(a), s = sin(a); chain([[c * 2, 6.5, s * 2, 2.2], [c * 6.5, 1.8, s * 6.5, 1.4], [c * 11.5, -1.8, s * 11.5, 0.7]]); }
  for (let i = 0; i < 6; i++) {
    const a = i * 2.4 + 0.8, c = cos(a), s = sin(a), h = 16 + i * 3.6, L = 15 - i * 1.3, up = 11 - i * 1.4;
    const p = [0.33, 0.66, 1].map((u) => [c * L * u, h + up * u * (0.5 + 0.5 * u), s * L * u, mix(1.6, 0.3, u)]);
    chain([[0, h - 1, 0, 1.8], ...p]);
    tips.push([p[0][0], p[0][1] + 1, p[0][2], 2.6], [p[1][0], p[1][1], p[1][2], 3.6], [p[2][0], p[2][1] + 1, p[2][2], 4.6]);
  }
  return { C, tips };
})();

function primBuffer() {
  const a = [];
  for (const m of MESAS) a.push(m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7]);
  for (const m of ARCHES) a.push(m[0], m[1], m[2], m[3], m[4], m[5], m[6], 0);
  for (const m of HOLES) a.push(m[0], m[1], m[2], m[3], m[4], m[5], m[6], 0);
  for (const m of CLEARS) a.push(m[0], m[1], m[2], m[3], m[4], m[5], 0, 0);
  return new Float32Array(a);
}

// ---------------------------------------------------------------- terrain mesh from the density grid
function buildTerrain(D) {
  const sn = surfaceNets(D, NX, NY, NZ), nv = sn.nv, gp = sn.pos;
  const smp = sampler3(D, NX, NY, NZ);
  const vb = new ArrayBuffer(nv * 16), vf = new Float32Array(vb), v8 = new Int8Array(vb);
  const wp = new Float32Array(nv * 3), wn = new Float32Array(nv * 3);
  for (let k = 0; k < nv; k++) {
    const x = gp[k * 3], y = gp[k * 3 + 1], z = gp[k * 3 + 2], e = 0.8;
    let nx = smp(x - e, y, z) - smp(x + e, y, z), ny = smp(x, y - e, z) - smp(x, y + e, z), nz = smp(x, y, z - e) - smp(x, y, z + e);
    const l = hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const X = OX + x * VS, Y = OY + y * VS, Z = OZ + z * VS;
    wp[k * 3] = vf[k * 4] = X; wp[k * 3 + 1] = vf[k * 4 + 1] = Y; wp[k * 3 + 2] = vf[k * 4 + 2] = Z;
    wn[k * 3] = nx; wn[k * 3 + 1] = ny; wn[k * 3 + 2] = nz;
    v8[k * 16 + 12] = round(nx * 127); v8[k * 16 + 13] = round(ny * 127); v8[k * 16 + 14] = round(nz * 127); v8[k * 16 + 15] = 127;
  }
  // bucket quads into the XZ culling grid
  const nq = sn.ni / 6, key = new Uint8Array(nq), cnt = new Uint32Array(CELLS * CELLS + 1);
  const lo = new Float32Array(CELLS * CELLS).fill(1e9), hi = new Float32Array(CELLS * CELLS).fill(-1e9);
  for (let q = 0; q < nq; q++) {
    const a = sn.idx[q * 6] * 3;
    const c = clamp(floor((wp[a] - OX) / CELLW), 0, CELLS - 1) + CELLS * clamp(floor((wp[a + 2] - OZ) / CELLW), 0, CELLS - 1);
    key[q] = c; cnt[c + 1]++;
    for (let j = 0; j < 6; j++) { const y = wp[sn.idx[q * 6 + j] * 3 + 1]; if (y < lo[c]) lo[c] = y; if (y > hi[c]) hi[c] = y; }
  }
  for (let c = 0; c < CELLS * CELLS; c++) cnt[c + 1] += cnt[c];
  const ib = new Uint32Array(sn.ni), fill = cnt.slice();
  for (let q = 0; q < nq; q++) { const o = fill[key[q]]++ * 6; for (let j = 0; j < 6; j++) ib[o + j] = sn.idx[q * 6 + j]; }
  return { vb, ib, nv, wp, wn, smp, start: cnt, lo, hi };
}

// ---------------------------------------------------------------- instance stores
function makeWorld(D, T, flyPts, POSES) {
  const gi = (x, y, z) => x + NX * (y + NY * z);
  const smp = T.smp;
  const Dw = (x, y, z) => smp((x - OX) / VS, (y - OY) / VS, (z - OZ) / VS);
  const nCells = CELLS * CELLS;
  const cellOf = (x, z) => clamp(floor((x - OX) / CELLW), 0, CELLS - 1) + CELLS * clamp(floor((z - OZ) / CELLW), 0, CELLS - 1);
  const big = Array.from({ length: nCells }, () => []), small = Array.from({ length: nCells }, () => []);
  // Medium and Low keep every 2nd / 4th leaf (but every vine), made wider; the random stream is the same
  let nth = 0;
  const leaf = (L, x, y, z, len, yaw, tilt, wid, hA, type, s1, s2, bend) => { if (type === 1 || !(nth++ % THIN)) L[cellOf(x, z)].push(x, y, z, len, yaw, tilt, type === 1 ? wid : wid * (1 + LV / 2), hA, type, s1, s2, bend); };
  const glint = (...a) => { nth++ % THIN || glints.push(...a); };
  const solids = []; // per mesh id: arrays of 12 floats
  const props = Array.from({ length: 6 }, () => Array.from({ length: nCells }, () => []));
  const solid = (mesh, x, y, z, sc, q, mat, seed, ts = 1, bob = 0) => { (mesh > 3 && mesh < 10 ? props[mesh - 4][cellOf(x, z)] : (solids[mesh] ||= [])).push(x, y, z, sc, q[0], q[1], q[2], q[3], mat, seed, ts, bob); };
  const chunks = Array.from({ length: NCHUNK }, () => Array.from({ length: nCells }, () => []));
  const trees = Array.from({ length: 3 }, () => Array.from({ length: nCells }, () => []));
  const glints = [];
  const rel = (i, f, r) => { const p = POSES[i]; let fx = p[3] - p[0], fz = p[5] - p[2]; const l = hypot(fx, fz); fx /= l; fz /= l; return [p[0] + fx * f - fz * r, p[2] + fz * f + fx * r]; };
  const bubbles = [], kelpAbs = new Float32Array((NX / 2) * (NY / 2) * (NZ / 2));

  // --- surface queries
  const fl = [];
  const floorsAt = (x, z) => {
    const ix = clamp(round((x - OX) / VS), 1, NX - 2), iz = clamp(round((z - OZ) / VS), 1, NZ - 2);
    fl.length = 0; let ceil = 3;
    for (let gy = NY - 2; gy >= 0; gy--) {
      const d = D[gi(ix, gy, iz)], da = D[gi(ix, gy + 1, iz)];
      if (da <= 0 && d > 0) { const y = OY + (gy + d / (d - da)) * VS; fl.push(y, min(ceil, 0) - y); } else if (da > 0 && d <= 0) ceil = OY + (gy + 0.5) * VS;
    }
    return fl;
  };
  const grad = (x, y, z) => {
    const e = 0.6; let nx = Dw(x - e, y, z) - Dw(x + e, y, z), ny = Dw(x, y - e, z) - Dw(x, y + e, z), nz = Dw(x, y, z - e) - Dw(x, y, z + e);
    const l = hypot(nx, ny, nz) || 1; return [nx / l, ny / l, nz / l];
  };
  // march from outside along -n to the surface
  const snap = (x, y, z, n) => {
    let px = x + n[0] * 2.5, py = y + n[1] * 2.5, pz = z + n[2] * 2.5, prev = Dw(px, py, pz);
    if (prev > 0) return null;
    for (let i = 0; i < 24; i++) {
      const qx = px - n[0] * 0.25, qy = py - n[1] * 0.25, qz = pz - n[2] * 0.25, d = Dw(qx, qy, qz);
      if (d > 0) { const t = prev / (prev - d); const p = [mix(px, qx, t), mix(py, qy, t), mix(pz, qz, t)]; return p.concat(grad(p[0], p[1], p[2])); }
      px = qx; py = qy; pz = qz; prev = d;
    }
    return null;
  };
  const pickV = () => ((rnd() * T.nv) | 0) * 3;
  const tangent = (n) => { let t = abs(n[1]) < 0.9 ? [n[2], 0, -n[0]] : [1, 0, 0]; const l = hypot(...t); t = t.map((v) => v / l); return [t, [n[1] * t[2] - n[2] * t[1], n[2] * t[0] - n[0] * t[2], n[0] * t[1] - n[1] * t[0]]]; };
  const nearFly = (x, y, z, r) => { for (const p of flyPts) if (hypot(x - p[0], z - p[2]) < r && y < p[1] + 3 && y > p[1] - 13) return true; return false; };
  const nearPose = (x, z, r = 3) => { for (const p of POSES) if (hypot(x - p[0], z - p[2]) < r) return true; return false; };
  const gy = (x, z) => { const f = floorsAt(x, z); return f.length ? f[f.length - 2] : -45; };

  // --- trees: a trunk mesh (meshTree) with leaves gathered around its branch tips
  // one mass of foliage: leaves in a ball of radius R, some with moss hanging under it, and a few glints
  const crown = (px, py, pz, R, hA, kind, full) => {
    for (let i = floor(10 * pow(R, 1.5) * full); i > 0; i--) {
      const a = rnd() * TAU, e = rr(-1, 1), r = R * pow(rnd(), 0.4), q = sqrt(1 - e * e), L = rr(0.9, 1.9) * (0.55 + R * 0.14);
      const type = kind === 1 ? (rnd() < 0.8 ? 3 : 4) : kind === 2 ? (rnd() < 0.6 ? 4 : 0) : 0;
      leaf(big, px + cos(a) * q * r, py + e * r * 0.7, pz + sin(a) * q * r, L, rnd() * TAU, rr(0.9, 2.1), L * rr(0.3, 0.42) + 0.04, hA, type, rnd(), rnd(), rr(0.35, 0.8));
    }
    if (rnd() < 0.35) for (let i = 3 + rnd() * 6 | 0; i > 0; i--) leaf(big, px + rr(-0.5, 0.5) * R, py - R * 0.3, pz + rr(-0.5, 0.5) * R, rr(2, 5.5), rnd() * TAU, PI - rr(0, 0.25), rr(0.1, 0.2), hA, 6, rnd(), rnd(), rr(0.3, 0.5));
    for (let i = floor(R * 1.6); i > 0; i--) glint(px + rr(-1, 1) * R, py + rr(-1.2, 0.6) * R, pz + rr(-1, 1) * R, hA, rnd(), kind === 1 ? rnd() : rnd() * 0.6, rr(0.018, 0.05), 0);
  };
  // what a crown takes out of the skylight under it (for the skylight bake)
  const shade = (x, y0, y1, z, rad) => {
    const hx = round((x - OX) / VS / 2), hz = round((z - OZ) / VS / 2), r = max(1, round(rad / VS / 2));
    for (let hy = floor((y0 - OY) / VS / 2); hy <= floor((y1 - OY) / VS / 2); hy++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const ax = hx + dx, az = hz + dz;
      if (dx * dx + dz * dz <= r * r && hy >= 0 && hy < NY / 2 && ax > 0 && ax < NX / 2 - 1 && az > 0 && az < NZ / 2 - 1) kelpAbs[ax + NX / 2 * (hy + NY / 2 * az)] += 0.035;
    }
  };
  // kind: 0 green, 1 blue (the glade), 2 golden
  const column = (x, y, z, H, kind, dens = 1) => {
    const v = rnd() * 3 | 0, yaw = rnd() * TAU, cy = cos(yaw), sy = sin(yaw), full = rr(0.75, 1.25) * dens;
    trees[v][cellOf(x, z)].push(x, y - 0.6, z, H, 0, sin(yaw / 2), 0, cos(yaw / 2), 6, rnd(), 1, 0);
    for (const t of TREES[v].tips) crown(x + (cy * t[0] + sy * t[2]) * H, y - 0.6 + t[1] * H, z + (cy * t[2] - sy * t[0]) * H, t[3] * H, t[1] * H, kind, full);
    shade(x, y + H * 0.45, y + H, z, H * 0.2);
  };
  // woods: x, z, radius, density; clearings: x, z, radius
  const KELPZ = [[-30, -20, 22, 0.9], [36, -30, 24, 0.9], [40, 44, 26, 0.85], [-70, 60, 30, 0.8], [90, -70, 32, 0.8], [-100, -80, 32, 0.8], [0, 130, 26, 0.7], [110, 60, 30, 0.8], [-110, 10, 24, 0.8]];
  const NOKELP = [[4, 2, 15], [-44, 30, 10], [-14, -56, 9], [-62, -48, 8], [10, 88, 12], [20, 18, 5], [-30, 23, 5], [-10, -30, 5], [-44, -38, 5], [2, 56, 5], [71, 12, 5], [ELDERP[0], ELDERP[1], 17]];
  const kelpDens = (x, z) => {
    for (const p of NOKELP) if (hypot(x - p[0], z - p[1]) < p[2]) return 0;
    let d = 0.28 + sstep(0.45, 0.62, fbm(x * 0.022, 4, z * 0.022, 3)) * 0.45;
    for (const p of KELPZ) d = max(d, p[3] * sstep(p[2], p[2] * 0.75, hypot(x - p[0], z - p[1])));
    return d;
  };
  const occ = new Set();
  rseed(1);
  const tryColumn = (x, z, kind, force, dens = 1) => {
    const key = floor(x / 6) * 4096 + floor(z / 6);
    if (occ.has(key)) return;
    const f = floorsAt(x, z); const c = [];
    for (let i = 0; i < f.length; i += 2) if (f[i + 1] > 9) c.push(i);
    if (!c.length) return;
    const i = c[(rnd() * c.length) | 0], y = f[i];
    if (grad(x, y, z)[1] < 0.55) return;
    if (!force && flyPts.some((p) => hypot(x - p[0], z - p[2]) < 5)) return;
    occ.add(key);
    column(x, y - 0.3, z, min(f[i + 1] - rr(0.8, 5), force ? rr(30, 42) : rr(15, 40)), kind, dens);
  };
  // hand-placed trees framing the viewpoints: x, z, kind, density
  for (const p of [[...rel(0, 13, -11), 0], [...rel(0, 22, -15), 0], [...rel(0, 12, 10), 0], [...rel(0, 21, 15), 0], [...rel(0, 44, -19), 0], [...rel(0, 46, 17), 2],
    [...rel(1, 5, -9), 0], [...rel(1, 6, 10), 0], [...rel(1, 27, -12), 0], [...rel(1, 29, 11), 2],
    [...rel(2, 8, -8), 0], [...rel(2, 10, 9), 0], [...rel(2, 38, -11), 0], [...rel(2, 40, 9), 0],
    [...rel(3, 7, -7), 0], [...rel(3, 9, 8), 0], [...rel(3, 30, -11), 0], [...rel(3, 32, 10), 2],
    [...rel(4, 10, -8), 1, 1.2], [...rel(4, 14, 9), 1, 1.2], [...rel(4, 24, -13), 1, 1.2], [...rel(4, 28, 12), 1, 1.2], [...rel(4, 42, -7), 1, 1.3], [...rel(4, 46, 8), 1, 1.3], [...rel(4, 20, 2), 1, 1.1],
    [...rel(5, -7, -8), 0], [...rel(5, -9, 7), 0]]) tryColumn(p[0], p[1], p[2], true, p[3]);
  // random trees across the world
  rseed(2);
  for (let i = 0; i < 15000; i++) {
    const a = rnd() * TAU, r = sqrt(rnd()) * 170, x = cos(a) * r, z = sin(a) * r;
    if (rnd() < kelpDens(x, z)) tryColumn(x, z, zoneP(x, z) > 0.5 && rnd() < 0.7 ? 1 : rnd() < 0.08 ? 2 : 0);
  }
  // the elder's foliage
  {
    const ey = gy(ELDERP[0], ELDERP[1]) - 1.2, c = cos(0.7), s = sin(0.7);
    for (const t of ELDER.tips) { const x = ELDERP[0] + c * t[0] + s * t[2], z = ELDERP[1] + c * t[2] - s * t[0]; if (ey + t[1] < 1) { crown(x, ey + t[1], z, t[3], t[1], rnd() < 0.3 ? 2 : 0, 1.5); shade(x, ey + t[1] - 3, ey + t[1] + 3, z, t[3]); } }
  }

  // --- clusters of ferns on the ground
  const cluster = (x, y, z, n, type, lmin, lmax, wmin, wmax, tmax, sway) => {
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, r = rnd() * 0.5, L = rr(lmin, lmax);
      leaf(big, x + cos(a) * r, y - 0.15, z + sin(a) * r, L, a, rr(0.05, tmax), rr(wmin, wmax), sway, type, rnd(), rnd(), rr(0.3, 0.8));
    }
  };
  const HOT = [[0, 2, 30], [-44, 30, 22], [10, 86, 34], [-62, -48, 24], [-14, -52, 22], [66, -10, 20], [30, 40, 18]];
  const hot = (x, z) => { let h = 0.55; for (const p of HOT) h = max(h, sstep(p[2], p[2] * 0.4, hypot(x - p[0], z - p[1]))); return h; };
  rseed(3);
  for (let i = 0; i < 40000; i++) {
    const k = pickV(), x = T.wp[k], y = T.wp[k + 1], z = T.wp[k + 2], ny = T.wn[k + 1];
    if (hypot(x, z) > 172 || y > -6) continue;
    const h = hot(x, z), zp = zoneP(x, z), u = rnd();
    if (nearFly(x, y, z, 4) || hypot(x - ELDERP[0], z - ELDERP[1]) < 5 || nearPose(x, z, 8)) continue;
    if (ny > 0.75 && u < 0.14 * h) cluster(x, y, z, 8 + rnd() * 14 | 0, 2, 1.0, 3.0, 0.16, 0.3, 0.9, 0.5);
    else if (ny > 0.6 && u < 0.14 * h + 0.07 * max(zp, h * 0.4)) cluster(x, y, z, 10 + rnd() * 18 | 0, zp > 0.3 ? (rnd() < 0.8 ? 3 : 4) : rnd() < 0.7 ? 2 : 4, 0.9, 2.6, 0.14, 0.28, 0.9, 0.4);
    else if (ny < -0.35 && u < 0.5 * max(zp, 0.35)) { // moss hanging under overhangs
      const n = 12 + rnd() * 20 | 0;
      for (let j = 0; j < n; j++) leaf(big, x + rr(-0.6, 0.6), y + 0.2, z + rr(-0.6, 0.6), rr(0.8, 3.2), rnd() * TAU, PI - rr(0, 0.4), rr(0.08, 0.18), 0, 6, rnd(), rnd(), rr(0.3, 0.6));
    } else if (ny > -0.2 && ny < 0.8 && u < 0.07) { // tufts on the rock faces
      const yaw = atan2(T.wn[k + 2], T.wn[k]), n = 5 + rnd() * 7 | 0;
      for (let j = 0; j < n; j++) leaf(big, x, y, z, rr(0.5, 1.4), yaw + rr(-0.9, 0.9), rr(0.3, 1.1), rr(0.08, 0.14), 0.5, zp > 0.4 && rnd() < 0.6 ? 3 : 2, rnd(), rnd(), rr(0.2, 0.6));
    }
  }
  // --- ground cover: carpets of flowers in the meadows, grass elsewhere
  rseed(4);
  for (const p of MAGENTA) for (let i = p[2] * p[2] * PI * 45; i > 0; i--) {
    const a = rnd() * TAU, r = sqrt(rnd()) * p[2], x = p[0] + cos(a) * r, z = p[1] + sin(a) * r;
    if (rnd() > magAt(x, z) + 0.12 || nearPose(x, z)) continue;
    const f = floorsAt(x, z); if (!f.length) continue;
    const y = f[f.length - 2]; if (grad(x, y, z)[1] < 0.7) continue;
    const nl = 2 + (rnd() * 3 | 0), yw = rnd() * TAU;
    for (let j = 0; j < nl; j++) leaf(small, x, y - 0.03, z, rr(0.08, 0.26), yw + j * TAU / nl + rr(-0.4, 0.4), rr(0.15, 0.85), rr(0.035, 0.07), 0, 5, rnd(), rnd(), rr(0.3, 0.7));
    if (rnd() < 0.3) for (let j = 0; j < 2; j++) leaf(small, x + rr(-0.2, 0.2), y - 0.04, z + rr(-0.2, 0.2), rr(0.2, 0.55), rnd() * TAU, rr(0.05, 0.6), rr(0.03, 0.06), 0, 7, rnd(), rnd(), rr(0.3, 0.8));
    if (rnd() < 0.3) glint(x, y + rr(0.08, 0.22), z, 0, rnd(), 0.82 + rnd() * 0.18, rr(0.01, 0.02), 0);
  }
  rseed(5);
  for (let i = 0; i < 620000; i++) {
    const k = pickV(), ny = T.wn[k + 1];
    if (ny < 0.72) continue;
    const x = T.wp[k] + rr(-0.45, 0.45), z = T.wp[k + 2] + rr(-0.45, 0.45), y = T.wp[k + 1];
    if (hypot(x, z) > 170 || nearPose(x, z)) continue;
    const m = magAt(x, z), zp = zoneP(x, z), u = rnd();
    if (m > 0.3 && u < m * 0.9) for (let j = 0; j < 4; j++) leaf(small, x + rr(-0.1, 0.1), y - 0.05, z + rr(-0.1, 0.1), rr(0.12, 0.34), rnd() * TAU, rr(0.05, 0.75), rr(0.04, 0.08), 0, 5, rnd(), rnd(), rr(0.3, 0.7));
    else if (u < m * 0.9 + (0.22 + 0.4 * max(zp, hot(x, z))) * sstep(0.36, 0.56, fbm(x * 0.09, 9, z * 0.09, 2))) for (let j = 0; j < 3; j++) leaf(small, x + rr(-0.1, 0.1), y - 0.05, z + rr(-0.1, 0.1), rr(0.25, 0.7), rnd() * TAU, rr(0.1, 0.8), rr(0.05, 0.1), 0, 7, rnd(), rnd(), rr(0.3, 0.8));
  }

  // --- mushrooms and coral fungus (clustered on rock and ground)
  const spots = [];
  const ZS = [[-62, -48, 32, 1], [0, 0, 30, 0.5], [10, 86, 36, 0.8], [66, -20, 24, 0.6], [-44, 30, 22, 0.4]];
  const zw = (x, z) => { let h = 0.25; for (const p of ZS) h = max(h, p[3] * sstep(p[2], p[2] * 0.4, hypot(x - p[0], z - p[1]))); return h; };
  rseed(6);
  for (let i = 0; i < 13000; i++) {
    const k = pickV(), x = T.wp[k], y = T.wp[k + 1], z = T.wp[k + 2];
    if (hypot(x, z) > 170 || y > -8 || T.wn[k + 1] < -0.15 || rnd() > zw(x, z) || nearFly(x, y, z, 3)) continue;
    const n0 = [T.wn[k], T.wn[k + 1], T.wn[k + 2]], [t1, t2] = tangent(n0), coral = rnd() < 0.3, cnt = coral ? 2 + rnd() * 5 | 0 : 3 + rnd() * 9 | 0, sd = rnd();
    for (let j = 0; j < cnt; j++) {
      const a = rr(-1, 1) * (0.5 + cnt * 0.13), b = rr(-1, 1) * (0.5 + cnt * 0.13);
      const s = snap(x + t1[0] * a + t2[0] * b, y + t1[1] * a + t2[1] * b, z + t1[2] * a + t2[2] * b, n0);
      if (!s) continue;
      let ux = s[3], uy = s[4] + (coral ? 0.9 : 1.6), uz = s[5]; const l = hypot(ux, uy, uz); ux /= l; uy /= l; uz /= l;
      const q = qMul(qFromY(ux, uy, uz), qAxis(0, 1, 0, rnd() * TAU)), sc = coral ? rr(0.5, 1.5) : rr(0.35, 0.9) * (rnd() < 0.1 ? 1.6 : 1);
      solid(coral ? 7 + (rnd() * 3 | 0) : 4 + (rnd() * 3 | 0), s[0] - ux * 0.12 * sc, s[1] - uy * 0.12 * sc, s[2] - uz * 0.12 * sc, sc, q, coral ? 5 : 4, fract(sd + rr(-0.03, 0.03)), 1, 0);
    }
    if (!coral && rnd() < 0.3) spots.push([x + n0[0], y + n0[1] + 0.5, z + n0[2]]);
  }

  // mushroom groves: x, z, radius, count
  rseed(7);
  for (const g of [[-62, -48, 9, 240], [-56, -58, 7, 160], [-70, -40, 7, 140], [12, 80, 7, 160], [0, 92, 6, 120], [-10, -12, 5, 60], [66, -36, 6, 100], [70, -12, 5, 80], [-54, 40, 5, 80], [20, 30, 6, 100], [-20, -48, 6, 110], [30, -12, 5, 80]]) {
    let made = 0;
    for (let i = 0; i < 400000 && made < g[3]; i++) {
      const k = pickV(), x = T.wp[k], y = T.wp[k + 1], z = T.wp[k + 2];
      if (hypot(x - g[0], z - g[1]) > g[2] || y > -14 || T.wn[k + 1] < -0.1 || nearFly(x, y, z, 2.2)) continue;
      made++;
      const coral = rnd() < 0.25, nx = T.wn[k], ny = T.wn[k + 1] + (coral ? 0.9 : 1.6), nz = T.wn[k + 2], l = hypot(nx, ny, nz);
      const sc = coral ? rr(0.5, 1.4) : rr(0.4, 1.3) * (rnd() < 0.15 ? 2.2 : 1);
      solid(coral ? 7 + (rnd() * 3 | 0) : 4 + (rnd() * 3 | 0), x - nx / l * 0.1 * sc, y - ny / l * 0.1 * sc, z - nz / l * 0.1 * sc, sc, qMul(qFromY(nx / l, ny / l, nz / l), qAxis(0, 1, 0, rnd() * TAU)), coral ? 5 : 4, rnd(), 1, 0);
    }
  }
  // --- rocks scattered on the ground and set into the rock faces
  rseed(9);
  for (let i = 0; i < 2600; i++) {
    const k = pickV(); if (T.wn[k + 1] < 0.7 || hypot(T.wp[k], T.wp[k + 2]) > 170 || nearFly(T.wp[k], T.wp[k + 1], T.wp[k + 2], 6)) continue;
    const sc = rr(0.25, 1.3) * (rnd() < 0.1 ? 2 : 1);
    solid(rnd() * 4 | 0, T.wp[k], T.wp[k + 1] + sc * 0.2, T.wp[k + 2], sc, qRand(), 1, rnd(), 1, 0);
  }

  rseed(10);
  for (let i = 0; i < 60000; i++) {
    const k = pickV(), x = T.wp[k], y = T.wp[k + 1], z = T.wp[k + 2], ny = T.wn[k + 1];
    if (hypot(x, z) > 172 || y > -3 || (ny > 0.8 && rnd() < 0.6) || nearFly(x, y, z, 3.5)) continue;
    const sc = (0.35 + 2.1 * pow(rnd(), 2.6)) * (ny > 0.8 ? 0.5 : 1), q = qRand();
    chunks[(sc > 1.15 ? 3 : 0) + (rnd() * 3 | 0)][cellOf(x, z)].push(x - T.wn[k] * sc * 0.3, y - ny * sc * 0.3, z - T.wn[k + 2] * sc * 0.3, sc, q[0], q[1], q[2], q[3], 1, rnd(), sc > 1.15 ? 0 : 96, 0);
  }
  rseed(11);
  for (let i = 0; i < 170000; i++) { // stones on the forest floor
    const k = pickV(), x = T.wp[k] + rr(-0.4, 0.4), z = T.wp[k + 2] + rr(-0.4, 0.4), y = T.wp[k + 1];
    if (T.wn[k + 1] < 0.8 || hypot(x, z) > 170 || nearFly(x, y, z, 1.3)) continue;
    const sc = 0.05 + 0.3 * pow(rnd(), 2), q = qRand();
    nth++ % THIN || chunks[6][cellOf(x, z)].push(x, y - sc * 0.25, z, sc, q[0], q[1], q[2], q[3], 1, rnd(), 44, 0);
  }
  // --- set pieces
  solid(10, ELDERP[0], gy(ELDERP[0], ELDERP[1]) - 1.2, ELDERP[1], 1, qAxis(0, 1, 0, 0.7), 6, 0.3, 1, 0);   // elder tree
  solid(11, -44, gy(-44, 30) - 0.3, 30, 1, qAxis(0, 1, 0, 0.464), 3, 0.5, 1, 0);                          // shrine gate, facing viewpoint 2
  // giant mushrooms in front of viewpoint 4, small ones around the elder's roots
  rseed(12);
  for (const b of [[9, 3.5, 2.6, 4], [11, -4.5, 3.4, 5], [13, 6.5, 2.0, 6], [15, -1, 3.0, 4], [17, 4, 3.8, 5], [12, 0.5, 1.4, 6], [19, -6, 2.4, 4], [8, -2.2, 1.2, 5], [22, 1, 4.4, 4]]) { const p = rel(3, b[0], b[1]), c = POSES[3]; let ux = (c[0] - p[0]) * 0.012, uz = (c[2] - p[1]) * 0.012; const l = hypot(ux, 1, uz); solid(b[3], p[0], gy(p[0], p[1]) - 0.1, p[1], b[2], qMul(qFromY(ux / l, 1 / l, uz / l), qAxis(0, 1, 0, rnd() * TAU)), 4, rnd(), 1, 0); }
  for (let i = 0; i < 14; i++) { const a = rnd() * TAU, r = rr(5, 10); const x = ELDERP[0] + cos(a) * r, z = ELDERP[1] + sin(a) * r; solid(4 + (rnd() * 3 | 0), x, gy(x, z) - 0.05, z, rr(0.5, 1.5), qAxis(0, 1, 0, rnd() * 6), 4, rnd(), 1, 0); }

  // --- spores drifting up from the mushroom groves and glades
  const VENTS = [[-62, -44, -48], [-58, -44, -54], [-66, -44, -44], [-56, -44, -44], [10, -44, 86], [4, -44, 92], [16, -44, 82], [12, -44, 96], [0, -44, 84], [-2, -44, -4], [-8, -44, -12], [2, -44, -10], [6, -44, 4], [-44, -44, 34], [-40, -44, 26], [68, -44, -20], [67, -44, -34], [20, -44, 30], [-14, -44, -50], [-20, -44, -48], [2, -44, 40], [30, -44, -12], [40, -44, 12], [-24, -44, 6], [12, -44, 10], [-50, -44, -40]];
  rseed(13);
  for (const s of spots) if (rnd() < 0.28) VENTS.push(s);
  for (const v of VENTS) {
    const n = 70 + rnd() * 60 | 0, y0 = v[1] === -44 ? gy(v[0], v[2]) : v[1];
    for (let i = 0; i < n; i++) {
      const sz = rnd() < 0.24 ? rr(0.12, 0.26) : rr(0.04, 0.1);
      bubbles.push(v[0] + rr(-2.5, 2.5), y0, v[2] + rr(-2.5, 2.5), sz, rnd(), rr(0.25, 0.6), -y0 - 0.2, rr(0.3, 0.9));
    }
  }

  // --- pack leaves (36 bytes: 8 floats + 4 unorm8), sorted by culling cell
  const pack = (L, step = 1, wm = 1) => {
    let n = 0; const start = new Uint32Array(nCells + 1);
    for (let c = 0; c < nCells; c++) { start[c] = n; n += Math.ceil(L[c].length / 12 / step); }
    start[nCells] = n;
    const buf = new ArrayBuffer(n * 36), f = new Float32Array(buf), u8 = new Uint8Array(buf), lo = new Float32Array(nCells).fill(1e9), hi = new Float32Array(nCells).fill(-1e9);
    let k = 0;
    for (let c = 0; c < nCells; c++) { const a = L[c]; for (let i = 0; i < a.length; i += 12 * step, k++) {
      for (let j = 0; j < 8; j++) f[k * 9 + j] = a[i + j];
      f[k * 9 + 6] *= wm;
      u8[k * 36 + 32] = a[i + 8]; u8[k * 36 + 33] = a[i + 9] * 255; u8[k * 36 + 34] = a[i + 10] * 255; u8[k * 36 + 35] = a[i + 11] * 255;
      const y = a[i + 1], l = a[i + 3]; if (y - l < lo[c]) lo[c] = y - l; if (y + l > hi[c]) hi[c] = y + l;
    } }
    return { buf, n, start, lo, hi };
  };

  // --- half-res volume: r = openness, g = skylight
  const hx = NX / 2, hy = NY / 2, hz = NZ / 2, volD = new Uint8Array(hx * hy * hz * 2);
  let Lp = new Float32Array(hx * hz).fill(1), Ln = new Float32Array(hx * hz), tmp = new Float32Array(hx * hz);
  for (let y = hy - 1; y >= 0; y--) {
    for (let z = 0; z < hz; z++) for (let x = 0; x < hx; x++) { const i = x + hx * z; tmp[i] = (Lp[x > 0 ? i - 1 : i] + 2 * Lp[i] + Lp[x < hx - 1 ? i + 1 : i]) * 0.25; }
    for (let z = 0; z < hz; z++) for (let x = 0; x < hx; x++) {
      const i = x + hx * z, b = (tmp[z > 0 ? i - hx : i] + 2 * tmp[i] + tmp[z < hz - 1 ? i + hx : i]) * 0.25;
      const g0 = gi(x * 2, y * 2, z * 2);
      const d = (D[g0] + D[g0 + 1] + D[g0 + NX] + D[g0 + NX + 1] + D[g0 + NX * NY] + D[g0 + NX * NY + 1] + D[g0 + NX * NY + NX] + D[g0 + NX * NY + NX + 1]) * 0.125;
      const o = x + hx * (y + hy * z);
      const l = b * clamp(0.5 - d / 1.5, 0, 1) * (1 - min(kelpAbs[o], 0.5));
      Ln[i] = l;
      volD[o * 2] = clamp(0.5 - d / 12, 0, 1) * 255; volD[o * 2 + 1] = min(1, b) * 255;
    }
    const t = Lp; Lp = Ln; Ln = t;
  }

  // --- ground map: r flower cover, b blue glade, a bare soil
  const gm = new Uint8Array(512 * 512 * 4);
  for (let j = 0; j < 512; j++) for (let i = 0; i < 512; i++) {
    const x = (i + 0.5) / 512 * 384 - 192, z = (j + 0.5) / 512 * 384 - 192, o = (i + 512 * j) * 4;
    gm[o] = magAt(x, z) * 255; gm[o + 2] = zoneP(x, z) * 255; gm[o + 3] = sstep(0.42, 0.6, fbm(x * 0.04, 3, z * 0.04, 3)) * 255;
  }

  // --- butterfly swarms (x, y, z, radius, count, size, direction, seed) + birds
  const fish = [];
  rseed(14);
  const SCH = [[2, -41, 2, 12, 300, 0.6, 1, 0.945], [10, -40, 88, 16, 480, 0.62, -1, 0.5], [-62, -41, -48, 10, 300, 0.55, 1], [-44, -35.5, 30, 9, 220, 0.55, -1, 0.3], [68, -38, -14, 7, 200, 0.55, 1],
    [2, -41, 44, 9, 220, 0.55, 1], [36, -40, 36, 14, 260, 0.6, 1], [-30, -41, -16, 12, 220, 0.55, -1], [90, -40, 40, 20, 260, 0.6, 1], [-90, -40, -60, 20, 260, 0.6, -1], [0, -38, -90, 18, 240, 0.6, 1]];
  for (const s of SCH) { const ss = s[7] === undefined ? rnd() : s[7]; for (let i = 0; i < s[4]; i++) fish.push(s[0], s[1], s[2], s[3], rnd(), s[6] * 1.3 / s[3], s[5] * 0.55, ss); }
  const mantas = [];
  for (const m of [[0, -20, 0, 30, 1.0, 0.13, 1.6, 0.1], [10, -16, 80, 26, 2.2, -0.15, 1.8, 0.85], [-40, -14, 20, 34, 5, 0.11, 2.0, 0.55], [50, -18, -20, 28, 0.3, -0.14, 1.5, 0.4], [0, -12, -60, 40, 4.2, 0.09, 2.2, 0.25], [-60, -22, -40, 22, 3, 0.16, 1.4, 0.7], [20, -24, 30, 18, 0.5, -0.2, 1.3, 0.3], [-10, -10, 10, 60, 2.6, 0.07, 2.4, 0.6]]) mantas.push(...m);

  // --- drifting motes
  const snow = new Float32Array(9000 * 4);
  for (let i = 0; i < snow.length; i++) snow[i] = rnd();

  const sol = { data: [], ranges: [] }; let si = 0;
  for (let m = 0; m < 12; m++) { const a = solids[m] || []; sol.ranges.push([si, a.length / 12]); si += a.length / 12; for (let i = 0; i < a.length; i++) sol.data.push(a[i]); }
  // up: how far above its base an instance reaches, as a multiple of its scale (trees)
  const packC = (L, up = 0) => {
    let n = 0; const start = new Uint32Array(nCells + 1);
    for (let c = 0; c < nCells; c++) { start[c] = n; n += L[c].length / 12; }
    start[nCells] = n;
    const data = new Float32Array(n * 12), lo = new Float32Array(nCells).fill(1e9), hi = new Float32Array(nCells).fill(-1e9);
    let k = 0;
    for (let c = 0; c < nCells; c++) { const a = L[c]; for (let i = 0; i < a.length; i += 12) { for (let j = 0; j < 12; j++) data[k++] = a[i + j]; lo[c] = min(lo[c], a[i + 1] - 3); hi[c] = max(hi[c], a[i + 1] + 3 + up * a[i + 3]); } }
    return { data, n, start, lo, hi };
  };
  return { gy, glints: new Float32Array(glints), chunks: chunks.map((c) => packC(c)), props: props.map((c) => packC(c)), trees: trees.map((c) => packC(c, 1)), big: pack(big), bigF: pack(big, 2, 1.5), small: pack(small), solids: { data: new Float32Array(sol.data), ranges: sol.ranges }, bubbles: new Float32Array(bubbles), volD, gm, fish: new Float32Array(fish), mantas: new Float32Array(mantas), snow };
}
const fract = (x) => x - floor(x);

// ---------------------------------------------------------------- procedural meshes
function meshChunk(sd, sub = 2, det = sub > 2) {
  if (LV > 1 && sub > 1) sub--; // Low: a quarter of the triangles
  rseed(100 + sd);
  const pl = []; for (let i = 0; i < 4; i++) { const q = qRand(); pl.push([q[0], q[1], q[2], rr(0.8, 0.98)]); const l = hypot(q[0], q[1], q[2]) || 1; pl[i][0] /= l; pl[i][1] /= l; pl[i][2] /= l; }
  return icosphere(sub, (x, y, z) => {
    let r = 1 + (fbm(x * 1.6 + sd, y * 1.6, z * 1.6, 2) - 0.5) * 0.9 + (det ? (fbm(x * 4 + sd, y * 4, z * 4, 2) - 0.5) * 0.25 : 0);
    let px = x * r, py = y * r * 0.8, pz = z * r;
    for (const p of pl) { const d = px * p[0] + py * p[1] + pz * p[2] - p[3]; if (d > 0) { px -= p[0] * d; py -= p[1] * d; pz -= p[2] * d; } }
    return [px, py, pz];
  });
}
// solid of revolution from a profile of [radius, height, aux]; mushrooms: aux is low on the stem and gills, 1 on the cap
function meshLathe(prof, seg, lump, ribs = 0) {
  const m = new Mesh(), rings = [];
  for (const [r, h, ao] of prof) { const ring = []; for (let s = 0; s < seg; s++) { const a = s / seg * TAU, rl = r * (1 + lump * (fbm(cos(a) * 1.5 + h * 2, h * 3, sin(a) * 1.5, 2) - 0.5) + 0.07 * cos(ribs * a + h * 1.5)); ring.push(m.v(cos(a) * rl, h, sin(a) * rl, ao)); } rings.push(ring); }
  for (let k = 0; k < rings.length - 1; k++) for (let s = 0; s < seg; s++) { const s2 = (s + 1) % seg; m.quad(rings[k][s], rings[k + 1][s], rings[k + 1][s2], rings[k][s2]); }
  return m;
}
function meshCoral(fan, lo = LV > 1) {
  rseed(200 + fan);
  const m = new Mesh();
  const nrm = (v) => { const l = hypot(...v) || 1; return v.map((c) => c / l); };
  const br = (p, d, r, len, depth) => {
    const pts = [p]; let q = p;
    for (let i = 0; i < 3; i++) { d = nrm([d[0] + rr(-0.3, 0.3), d[1] + rr(-0.1, 0.3), d[2] + (fan ? rr(-0.05, 0.05) : rr(-0.3, 0.3))]); q = [q[0] + d[0] * len / 3, q[1] + d[1] * len / 3, q[2] + d[2] * len / 3]; pts.push(q); }
    if (!depth) pts.push([q[0] + d[0] * r * 1.6, q[1] + d[1] * r * 1.6, q[2] + d[2] * r * 1.6]);
    if (lo) m.tube(depth ? [pts[0], pts[3]] : [pts[0], pts[3], pts[4]], (k) => (k > 1 ? r * 0.36 : r * (1 - 0.22 * k)) * 1.25, 3, true, (k) => clamp(1 - (depth + 1 - k) / 5, 0, 1));
    else m.tube(pts, (k) => k > 3 ? r * 0.36 : r * (1 - 0.22 * k / 3), fan ? 5 : 6, true, (k) => clamp(1 - (depth + 1 - k / 3) / 5, 0, 1));
    if (depth > 0) { const n = 2 + (rnd() < 0.5); for (let i = 0; i < n; i++) br(q, nrm([d[0] + rr(-0.8, 0.8), d[1] + rr(-0.1, 0.5), d[2] + (fan ? rr(-0.08, 0.08) : rr(-0.8, 0.8))]), r * 0.78, len * 0.8, depth - 1); }
  };
  const n0 = fan ? 1 : 2 + (rnd() * 2 | 0);
  for (let i = 0; i < n0; i++) br([rr(-0.08, 0.08), 0, rr(-0.08, 0.08)], nrm([rr(-0.5, 0.5), 1, fan ? 0 : rr(-0.5, 0.5)]), fan ? 0.06 : 0.08, fan ? 0.5 : 0.45, 3);
  return m;
}
function meshTubes() {
  rseed(210);
  const m = new Mesh();
  for (let i = 0; i < 9; i++) {
    const a = rnd() * TAU, r0 = rr(0, 0.28), h = rr(0.45, 1.1), rad = rr(0.07, 0.12), lean = rr(0.05, 0.3), pts = [];
    for (let k = 0; k <= 4; k++) pts.push([cos(a) * (r0 + lean * k / 4 * h), h * k / 4, sin(a) * (r0 + lean * k / 4 * h)]);
    m.tube(pts, (k) => rad * (0.8 + 0.25 * k / 4), 12, false, (k) => 0.35 + 0.65 * k / 4);
    // rim + dark throat
    const e = pts[4], n = m.p.length / 3, c = m.v(e[0], e[1] - rad * 1.2, e[2], 0.05);
    for (let s2 = 0; s2 < 12; s2++) m.tri(n - 12 + s2, n - 12 + (s2 + 1) % 12, c);
  }
  return m;
}
// tree of height 1 (three shapes): a tapering trunk with a root flare, eight boughs with two side branches each.
// tips: where the foliage sits (x, y, z, radius), in the same units
function meshTree(v) {
  rseed(300 + v);
  const m = new Mesh(), tips = [], lx = rr(-0.05, 0.05), lz = rr(-0.05, 0.05), ph = rnd() * TAU;
  const axis = (t) => [lx * t * t + 0.012 * sin(t * 7 + ph), t, lz * t * t + 0.012 * cos(t * 6 + ph)];
  const tr = []; for (let k = 0; k <= 10; k++) tr.push(axis(k / 10 * 0.97));
  m.tube(tr, (k) => 0.022 * (1 - 0.08 * k) + 0.026 * exp(-k * 1.6), 9, true);
  for (let b = 0; b < 8; b++) {
    const t0 = 0.42 + 0.5 * (b + rnd() * 0.6) / 8, a = b * 2.4 + rr(-0.4, 0.4), L = (0.27 - 0.17 * (t0 - 0.42) / 0.5) * rr(0.85, 1.15), up = rr(0.25, 0.6);
    const o = axis(t0), r0 = 0.012 * (1 - 0.8 * t0) + 0.003, wob = rr(-0.3, 0.3);
    const at = (u, an = a, len = L, from = o) => [from[0] + cos(an + wob * u) * len * u, from[1] + len * up * u * (0.6 + 0.4 * u), from[2] + sin(an + wob * u) * len * u];
    const pts = []; for (let k = 0; k <= 4; k++) pts.push(at(k / 4));
    m.tube(pts, (k) => r0 * (1 - 0.2 * k), 5, true);
    tips.push([...at(1), L * 0.42], [...at(0.6), L * 0.36]);
    for (const [u, sg] of [[0.5, 1], [0.78, -1]]) {
      const f = at(u), an = a + sg * rr(0.6, 1.1), len = L * rr(0.4, 0.6);
      m.tube([f, at(0.5, an, len, f), at(1, an, len, f)], (k) => r0 * (0.5 - 0.17 * k), 4, true);
      tips.push([...at(1, an, len, f), L * 0.3]);
    }
  }
  tips.push([...axis(0.97), 0.09], [...axis(0.84), 0.08]);
  return { m, tips };
}
// the elder tree: SDF of tapered capsules -> surface nets
function meshElder() {
  const C = ELDER.C;
  const sdf = (x, y, z) => {
    let d = 1e9;
    for (const c of C) {
      const bax = c[4] - c[0], bay = c[5] - c[1], baz = c[6] - c[2], pax = x - c[0], pay = y - c[1], paz = z - c[2];
      const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1);
      const ex = pax - bax * h, ey = pay - bay * h, ez = paz - baz * h, e = sqrt(ex * ex + ey * ey + ez * ez) - mix(c[3], c[7], h);
      const k = 1.1, hh = max(k - abs(d - e), 0) / k;
      d = min(d, e) - hh * hh * k * 0.25;
    }
    // ridges running up the bark
    return d < 2 ? d + (fbm(x * 0.8, y * 0.11, z * 0.8, 2) - 0.5) * 0.9 : d;
  };
  const vs = 0.34, ox = -16, oy = -4.5, oz = -16, nx = 95, ny = 166, nz = 95, D = new Float32Array(nx * ny * nz);
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) D[x + nx * (y + ny * z)] = -sdf(ox + x * vs, oy + y * vs, oz + z * vs);
  const sn = surfaceNets(D, nx, ny, nz), smp = sampler3(D, nx, ny, nz);
  const vb = new ArrayBuffer(sn.nv * 16), f = new Float32Array(vb), s = new Int8Array(vb);
  for (let k = 0; k < sn.nv; k++) {
    const x = sn.pos[k * 3], y = sn.pos[k * 3 + 1], z = sn.pos[k * 3 + 2], e = 0.7;
    let ax = smp(x - e, y, z) - smp(x + e, y, z), ay = smp(x, y - e, z) - smp(x, y + e, z), az = smp(x, y, z - e) - smp(x, y, z + e);
    const l = hypot(ax, ay, az) || 1;
    f[k * 4] = ox + x * vs; f[k * 4 + 1] = oy + y * vs; f[k * 4 + 2] = oz + z * vs;
    s[k * 16 + 12] = round(ax / l * 127); s[k * 16 + 13] = round(ay / l * 127); s[k * 16 + 14] = round(az / l * 127); s[k * 16 + 15] = 127;
  }
  return { vb, ib: new Uint32Array(sn.idx), nv: sn.nv };
}
// shrine gate (you walk through along x): two leaning posts on footings, a curved double top beam, a tie beam
function meshGate() {
  const m = new Mesh(), up = () => [0, 1, 0], ax = () => [1, 0, 0], top = [];
  for (const s of [-1, 1]) {
    m.sweep([[0, -1, s * 3.5], [0, 3.5, s * 3.35], [0, 7.7, s * 3.2]], 0.62, 0.62, ax);
    m.sweep([[0, -0.6, s * 3.52], [0, 0.55, s * 3.5]], 1.05, 1.05, ax);
  }
  for (let i = 0; i <= 12; i++) { const u = i / 12 * 2 - 1; top.push([0, 8.1 + 0.6 * u * u, u * 5.5]); }
  m.sweep(top, 0.95, 0.5, up);
  m.sweep(top.map((p) => [0, p[1] - 0.52, p[2] * 0.95]), 0.7, 0.44, up);
  m.sweep([[0, 6.3, -4.4], [0, 6.3, 4.4]], 0.36, 0.62, up);
  m.sweep([[0, 6.6, 0], [0, 7.7, 0]], 0.5, 0.3, ax);
  return m;
}
// bird: span along x (half span = 1), head +z; aux = span coordinate for the wing beat
function meshManta() {
  const m = new Mesh(), NU = 48, M = 10, rings = [];
  for (let j = 0; j <= NU; j++) {
    const u = j / NU * 2 - 1, au = abs(u), body = exp(-pow(u / 0.07, 2)), tp = 1 - pow(au, 6);
    const zl = mix(0.05, 0.16 - 0.06 * pow(au, 1.4) + 0.34 * body, tp), zt = mix(0.03, -0.10 + 0.07 * au - 0.40 * body, tp);
    const th = 0.014 * pow(1 - au, 0.6) + 0.004 + 0.075 * body, ring = [];
    for (let k = 0; k < M; k++) { const a = k / M * TAU; ring.push(m.v(u, th * sin(a) * (0.62 + 0.38 * cos(a)), mix(zt, zl, 0.5 + 0.5 * cos(a)), u)); }
    rings.push(ring);
  }
  for (let j = 0; j < NU; j++) for (let k = 0; k < M; k++) { const k2 = (k + 1) % M; m.quad(rings[j][k], rings[j + 1][k], rings[j + 1][k2], rings[j][k2]); }
  return m;
}
// butterfly: body along x, flat wings out along z (the vertex shader beats them)
function meshFish() {
  const m = new Mesh();
  m.tube([[0.14, 0, 0], [0.05, 0, 0], [-0.06, 0, 0], [-0.16, 0, 0]], (k) => [0.012, 0.022, 0.018, 0.006][k], 4, true);
  for (const s of [-1, 1]) {
    m.quad(m.v(0.06, 0, s * 0.015), m.v(0.24, 0, s * 0.30), m.v(0.04, 0, s * 0.38), m.v(-0.03, 0, s * 0.015));
    m.quad(m.v(-0.03, 0, s * 0.015), m.v(0.0, 0, s * 0.30), m.v(-0.24, 0, s * 0.24), m.v(-0.13, 0, s * 0.015));
  }
  return m;
}
