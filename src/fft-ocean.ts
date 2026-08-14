import type { ComputeNode, Node, StorageBufferNode, WebGPURenderer } from "three/webgpu";
import {
  Fn,
  cos,
  float,
  floor,
  instancedArray,
  instanceIndex,
  int,
  mix,
  select,
  sin,
  sqrt,
  uniform,
  uint,
  vec2,
  vec4,
} from "three/tsl";

// 4-tap bilinear lookup into a wrapped NxN float storage buffer, since
// storage buffers (unlike textures) have no built-in sampler/filtering.
export const sampleBilinearFloat = Fn(
  ([buf, n, u, v]: [StorageBufferNode<"float">, number, Node<"float">, Node<"float">]) => {
    const fx = u.mul(n);
    const fy = v.mul(n);
    const x0f = floor(fx).toVar();
    const y0f = floor(fy).toVar();
    const tx = fx.sub(x0f);
    const ty = fy.sub(y0f);
    // WGSL's % is truncating, not floor-mod — negative inputs (any point
    // with negative local x/z, i.e. about half the mesh since it's centered
    // on the origin) would otherwise index left of the buffer instead of
    // wrapping. +n before the second mod forces a non-negative result.
    const x0 = int(x0f).mod(int(n)).add(int(n)).mod(int(n));
    const y0 = int(y0f).mod(int(n)).add(int(n)).mod(int(n));
    const x1 = x0.add(1).mod(int(n));
    const y1 = y0.add(1).mod(int(n));

    const v00 = buf.element(y0.mul(int(n)).add(x0));
    const v10 = buf.element(y0.mul(int(n)).add(x1));
    const v01 = buf.element(y1.mul(int(n)).add(x0));
    const v11 = buf.element(y1.mul(int(n)).add(x1));

    return mix(mix(v00, v10, tx), mix(v01, v11, tx), ty);
  },
);

// Same wrapped bilinear tap, but for the packed vec4 cascade outputs. Each
// cascade output buffer carries four real fields (see the packing note
// below), so one sample retrieves all four.
//
// The width is not just convenience: WebGPU guarantees only 8 storage buffers
// per shader stage, and three cascades of four vec2 outputs each needed 12 in
// the vertex stage. Merging pairs into vec4s brings that to 6 and halves the
// tap count at the same time.
export const sampleBilinearVec4 = Fn(
  ([buf, n, u, v]: [StorageBufferNode<"vec4">, number, Node<"float">, Node<"float">]) => {
    const fx = u.mul(n);
    const fy = v.mul(n);
    const x0f = floor(fx).toVar();
    const y0f = floor(fy).toVar();
    const tx = fx.sub(x0f);
    const ty = fy.sub(y0f);
    const x0 = int(x0f).mod(int(n)).add(int(n)).mod(int(n));
    const y0 = int(y0f).mod(int(n)).add(int(n)).mod(int(n));
    const x1 = x0.add(1).mod(int(n));
    const y1 = y0.add(1).mod(int(n));

    const v00 = buf.element(y0.mul(int(n)).add(x0));
    const v10 = buf.element(y0.mul(int(n)).add(x1));
    const v01 = buf.element(y1.mul(int(n)).add(x0));
    const v11 = buf.element(y1.mul(int(n)).add(x1));

    return mix(mix(v00, v10, tx), mix(v01, v11, tx), ty);
  },
);

// --- Tessendorf FFT ocean: JONSWAP spectrum -> per-frame dispersion ->
// radix-2 Cooley-Tukey 2D IFFT (rows, transpose, rows-again, transpose back).
// See THESIS.md §8 "How the landing state is actually computed" — this is
// the first real spectral synthesis piece (replacing the earlier
// sum-of-sines approximation in water.ts).
//
// The surface is synthesized as several CASCADES: independent spectra over
// disjoint wavenumber bands, each with its own patch size. One patch cannot
// carry both 500 m swell and decimetre glitter — its resolution forces a
// choice between losing the fine detail and visibly tiling. Bands must not
// overlap or their shared wavenumbers are counted twice and the sea reads
// over-rough, so each cascade masks its spectrum to [kMin, kMax).
// See .agents/skills/design-webgpu-solutions/references/water.md §2.1.

const WORKGROUP_SIZE = 64;
const GRAVITY = 9.81;

// Where one cascade hands its band to the next. Expressed as a multiple of
// the finer cascade's fundamental wavenumber: below this the finer patch has
// too few samples per wave to represent the mode without aliasing.
const BAND_HANDOFF = 6;

function bitReverse(x: number, bits: number): number {
  let result = 0;
  for (let i = 0; i < bits; i++) {
    result = (result << 1) | (x & 1);
    x >>= 1;
  }
  return result;
}

// Mulberry32 is compact and stable across browsers; it is not for simulation identity.
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller: two independent standard normal samples per grid point.
function buildGaussianNoise(n: number, random: () => number): Float32Array {
  const data = new Float32Array(n * n * 2);
  for (let i = 0; i < n * n; i++) {
    let u1 = random();
    while (u1 <= Number.EPSILON) u1 = random();
    const u2 = random();
    const r = Math.sqrt(-2 * Math.log(u1));
    data[i * 2 + 0] = r * Math.cos(2 * Math.PI * u2);
    data[i * 2 + 1] = r * Math.sin(2 * Math.PI * u2);
  }
  return data;
}

interface ButterflyLUT {
  indices: Uint32Array; // [stage][tid] -> (i0, i1)
  twiddles: Float32Array; // [stage][tid] -> (re, im)
  stages: number;
}

// One LUT (indexed by [stage][thread-within-half]) drives every row and
// every column FFT, since N is the same in both dimensions of a square grid,
// and every cascade shares it since they all use the same N.
function buildButterflyLUT(n: number): ButterflyLUT {
  const stages = Math.log2(n);
  const half = n / 2;
  const indices = new Uint32Array(stages * half * 2);
  const twiddles = new Float32Array(stages * half * 2);

  for (let s = 0; s < stages; s++) {
    const halfM = 1 << s;
    const m = halfM * 2;
    for (let tid = 0; tid < half; tid++) {
      const groupIdx = Math.floor(tid / halfM);
      const j = tid % halfM;
      const i0 = groupIdx * m + j;
      const i1 = i0 + halfM;
      // Inverse transform: +angle. Normalization (1/N^2) happens once at extract.
      const angle = (2 * Math.PI * j) / m;
      const base = (s * half + tid) * 2;
      indices[base + 0] = i0;
      indices[base + 1] = i1;
      twiddles[base + 0] = Math.cos(angle);
      twiddles[base + 1] = Math.sin(angle);
    }
  }

  return { indices, twiddles, stages };
}

/**
 * One wavelength band. `patchSize` is the world-space tile of this band's
 * grid; `kMin`/`kMax` are its exclusive/inclusive wavenumber window in rad/m.
 */
export interface CascadeSpec {
  patchSize: number;
  kMin: number;
  kMax: number;
}

/**
 * GPU outputs for one cascade. Each buffer carries TWO real fields packed as
 * one complex field: a single inverse transform of `A + i*B` recovers real A
 * in `.x` and real B in `.y`, because both A and B are real in world space.
 * That halves the transform count against extracting each field separately.
 */
export interface CascadeBuffers {
  patchSize: number;
  /**
   * (Dx, Dz, Dy, dDy/dx) — horizontal displacement before the choppiness
   * gain, surface height, and the x slope. Everything the vertex stage needs
   * to place a point, in one tap.
   */
  geometry: StorageBufferNode<"vec4">;
  /**
   * (dDy/dz, dDx/dx, dDz/dz, dDx/dz) — the z slope plus the three terms of
   * the horizontal displacement Jacobian.
   */
  fold: StorageBufferNode<"vec4">;
}

export interface FFTOceanOptions {
  size?: number; // grid resolution, power of 2
  patchSize?: number; // world-space meters the longest cascade tiles
  windSpeed?: number; // m/s
  windDirectionDeg?: number;
  windSharpness?: number; // directional-spreading exponent
  fetch?: number; // meters, JONSWAP fetch
  amplitudeScale?: number; // tunable overall wave-height multiplier
  randomSeed?: number; // fixed initial spectrum for deterministic captures
  /**
   * Patch size per cascade, longest first. Wavenumber bands are derived from
   * these so the set always partitions the spectrum without gaps or overlap.
   * Trimming this list is the first lever if the ocean costs too much: each
   * cascade is four inverse transforms per frame.
   */
  cascadePatchSizes?: number[];
}

/**
 * Derive non-overlapping wavenumber bands from a descending list of patch
 * sizes. The longest cascade owns everything below the first handoff; the
 * shortest owns everything above the last.
 */
export function deriveCascades(patchSizes: number[]): CascadeSpec[] {
  return patchSizes.map((patchSize, i) => {
    const isLongest = i === 0;
    const isShortest = i === patchSizes.length - 1;
    return {
      patchSize,
      kMin: isLongest ? 0 : (2 * Math.PI * BAND_HANDOFF) / patchSizes[i],
      kMax: isShortest ? Number.POSITIVE_INFINITY : (2 * Math.PI * BAND_HANDOFF) / patchSizes[i + 1],
    };
  });
}

export class FFTOcean {
  readonly size: number;
  /** The longest cascade's patch, kept as the ocean's nominal tiling scale. */
  readonly patchSize: number;
  readonly cascades: CascadeBuffers[];
  readonly clock = uniform(0);

  private renderer: WebGPURenderer;
  private perFramePasses: ComputeNode[] = [];

  constructor(renderer: WebGPURenderer, options: FFTOceanOptions = {}) {
    this.renderer = renderer;
    const n = options.size ?? 128;
    this.size = n;
    const basePatch = options.patchSize ?? 300;
    this.patchSize = basePatch;
    const windSpeed = options.windSpeed ?? 11;
    const windDirRad = ((options.windDirectionDeg ?? 35) * Math.PI) / 180;
    const windX = Math.cos(windDirRad);
    const windZ = Math.sin(windDirRad);
    const sharpness = options.windSharpness ?? 6;
    const fetch = options.fetch ?? 300000;
    const amplitudeScale = options.amplitudeScale ?? 1;
    // Swell / wind sea / capillary-gravity. At the default 500 m base this
    // spans roughly 12 cm to 500 m of wavelength, which is the range a camera
    // sitting at wave height actually resolves across an island-sized view.
    const patchSizes = options.cascadePatchSizes ?? [basePatch, basePatch / 12.5, basePatch / 62.5];
    const specs = deriveCascades(patchSizes);

    const half = n / 2;
    const lut = buildButterflyLUT(n);
    const bitrev = new Uint32Array(n);
    for (let i = 0; i < n; i++) bitrev[i] = bitReverse(i, Math.log2(n));

    // --- shared, cascade-independent resources ---
    const bitrevBuf = instancedArray(bitrev, "uint");
    const lutIdx = instancedArray(lut.indices, "uvec2");
    const lutTwid = instancedArray(lut.twiddles, "vec2");

    // Scratch is shared by every pipeline: the passes run in sequence inside
    // one submit, so no two transforms are ever in flight over it at once.
    const scratchA = instancedArray(n * n, "vec2");
    const scratchB = instancedArray(n * n, "vec2");
    const scratchT = instancedArray(n * n, "vec2");

    const signedIndex = (idx: Node<"uint">) =>
      select(idx.lessThan(uint(half)), int(idx), int(idx).sub(int(n)));

    // --- transform stages, reused by every cascade and every packed field ---
    const bitReversalPass = (
      readBuf: StorageBufferNode<"vec2">,
      writeBuf: StorageBufferNode<"vec2">,
    ) =>
      Fn(() => {
        const row = instanceIndex.div(uint(n));
        const x = instanceIndex.mod(uint(n));
        const rx = bitrevBuf.element(x);
        const dst = row.mul(uint(n)).add(rx);
        writeBuf.element(dst).assign(readBuf.element(instanceIndex));
      })().compute(n * n, [WORKGROUP_SIZE]);

    const butterflyStagePass = (
      readBuf: StorageBufferNode<"vec2">,
      writeBuf: StorageBufferNode<"vec2">,
      stage: number,
    ) =>
      Fn(() => {
        const row = instanceIndex.div(uint(half));
        const tid = instanceIndex.mod(uint(half));
        const lutOffset = uint(stage * half).add(tid);
        const idx = lutIdx.element(lutOffset);
        const tw = lutTwid.element(lutOffset);
        const base = row.mul(uint(n));
        const i0 = base.add(idx.x);
        const i1 = base.add(idx.y);
        const a = readBuf.element(i0);
        const b = readBuf.element(i1);
        const tRe = tw.x.mul(b.x).sub(tw.y.mul(b.y));
        const tIm = tw.x.mul(b.y).add(tw.y.mul(b.x));
        writeBuf.element(i0).assign(vec2(a.x.add(tRe), a.y.add(tIm)));
        writeBuf.element(i1).assign(vec2(a.x.sub(tRe), a.y.sub(tIm)));
      })().compute(n * half, [WORKGROUP_SIZE]);

    const transposePass = (
      readBuf: StorageBufferNode<"vec2">,
      writeBuf: StorageBufferNode<"vec2">,
    ) =>
      Fn(() => {
        const y = instanceIndex.div(uint(n));
        const x = instanceIndex.mod(uint(n));
        writeBuf.element(x.mul(uint(n)).add(y)).assign(readBuf.element(instanceIndex));
      })().compute(n * n, [WORKGROUP_SIZE]);

    // No 1/N^2 here: Tessendorf's h(x,t) = sum_k h0(k,t) exp(ik.x) is an
    // unnormalized reconstruction sum by convention (the amplitude lives in
    // h0 itself, via its dkx*dkz factor) - dividing by N^2 on top of that
    // was double-normalizing and crushed an already-narrowband spectrum to
    // nothing. amplitudeScale is the tunable in its place.
    //
    // Both packed halves carry the same scale: the derivative fields are
    // derivatives OF the scaled height, so they have to move with it or the
    // normals and the Jacobian stop describing the surface being drawn.
    const extractPass = (
      complexBuf: StorageBufferNode<"vec2">,
      outBuf: StorageBufferNode<"vec2">,
    ) =>
      Fn(() => {
        outBuf.element(instanceIndex).assign(complexBuf.element(instanceIndex).mul(amplitudeScale));
      })().compute(n * n, [WORKGROUP_SIZE]);

    // Fuse two transform results into one vec4 so the vertex stage binds two
    // buffers per cascade instead of four. WebGPU's per-stage storage-buffer
    // guarantee is 8; three cascades of four would need 12 and the pipeline
    // fails to build on real hardware.
    const combinePass = (
      lo: StorageBufferNode<"vec2">,
      hi: StorageBufferNode<"vec2">,
      outBuf: StorageBufferNode<"vec4">,
    ) =>
      Fn(() => {
        const a = lo.element(instanceIndex);
        const b = hi.element(instanceIndex);
        outBuf.element(instanceIndex).assign(vec4(a.x, a.y, b.x, b.y));
      })().compute(n * n, [WORKGROUP_SIZE]);

    const buildFieldPipeline = (
      specBuf: StorageBufferNode<"vec2">,
      outBuf: StorageBufferNode<"vec2">,
    ): ComputeNode[] => {
      const passes: ComputeNode[] = [];
      // bitrev1: spec -> B (data in B)
      passes.push(bitReversalPass(specBuf, scratchB));
      // row stages (start B, 7 stages, odd count -> ends in A)
      let src = scratchB;
      let dst = scratchA;
      for (let s = 0; s < lut.stages; s++) {
        passes.push(butterflyStagePass(src, dst, s));
        [src, dst] = [dst, src];
      }
      // data now in `src`
      passes.push(transposePass(src, scratchT)); // A -> T
      passes.push(bitReversalPass(scratchT, scratchA)); // T -> A (reuse A)
      src = scratchA;
      dst = scratchB;
      for (let s = 0; s < lut.stages; s++) {
        passes.push(butterflyStagePass(src, dst, s));
        [src, dst] = [dst, src];
      }
      passes.push(transposePass(src, scratchT)); // -> T (untransposed complex result)
      passes.push(extractPass(scratchT, outBuf));
      return passes;
    };

    // --- per-cascade construction ---
    const random =
      options.randomSeed === undefined ? Math.random : createSeededRandom(options.randomSeed);
    const alpha = 0.076 * Math.pow((GRAVITY * fetch) / (windSpeed * windSpeed), -0.22);
    const peakFreq = 22 * Math.pow((windSpeed * windSpeed * fetch) / (GRAVITY * GRAVITY), -0.33);

    const jonswapSpectrum = (k: Node<"float">) => {
      const f = sqrt(float(GRAVITY).mul(k)).mul(1 / (2 * Math.PI));
      const fp = float(peakFreq);
      const sigma = select(f.lessThanEqual(fp), float(0.07), float(0.09));
      const r = float(-1)
        .mul(f.sub(fp).mul(f.sub(fp)))
        .div(float(2).mul(sigma).mul(sigma).mul(fp).mul(fp))
        .exp();
      const gamma = float(3.3).pow(r);
      const s = (alpha * (GRAVITY * GRAVITY)) / Math.pow(2 * Math.PI, 4);
      return float(s)
        .div(f.pow(5).max(1e-6))
        .mul(fp.div(f).pow(4).mul(-1.25).exp())
        .mul(gamma);
    };

    // Pack two real fields into one complex spectrum: IFFT(A + i*B) yields
    // real A in .x and real B in .y. `i*(a+bi) = -b + ai`.
    const packPair = (a: Node<"vec2">, b: Node<"vec2">) => vec2(a.x.sub(b.y), a.y.add(b.x));

    const cascades: CascadeBuffers[] = [];
    const setupPasses: ComputeNode[] = [];
    const framePasses: ComputeNode[] = [];

    for (const spec of specs) {
      const patch = spec.patchSize;
      const twoPiOverPatch = (2 * Math.PI) / patch;
      // Each band gets its own noise draw, so the cascades are statistically
      // independent rather than three filtered copies of one random sea.
      const noise = instancedArray(buildGaussianNoise(n, random), "vec2");

      const h0 = instancedArray(n * n, "vec2");
      const h0conj = instancedArray(n * n, "vec2");

      const specDisp = instancedArray(n * n, "vec2");
      const specHeightSlopeX = instancedArray(n * n, "vec2");
      const specSlopeZDxx = instancedArray(n * n, "vec2");
      const specDzzDxz = instancedArray(n * n, "vec2");

      const outDisp = instancedArray(n * n, "vec2");
      const outHeightSlopeX = instancedArray(n * n, "vec2");
      const outSlopeZDxx = instancedArray(n * n, "vec2");
      const outDzzDxz = instancedArray(n * n, "vec2");

      const outGeometry = instancedArray(n * n, "vec4");
      const outFold = instancedArray(n * n, "vec4");

      const initSpectrumPass = Fn(() => {
        const y = instanceIndex.div(uint(n));
        const x = instanceIndex.mod(uint(n));
        const kx = float(signedIndex(x)).mul(twoPiOverPatch);
        const kz = float(signedIndex(y)).mul(twoPiOverPatch);
        const k = vec2(kx, kz).length().max(1e-6);

        const khatDotWind = kx.div(k).mul(windX).add(kz.div(k).mul(windZ));
        const dir = khatDotWind.add(1).mul(0.5).max(0).pow(sharpness);

        const density = jonswapSpectrum(k).mul(dir).mul(twoPiOverPatch * twoPiOverPatch);
        // Band mask: this is what keeps the cascades from double-counting the
        // wavenumbers they can both represent. Nyquist for this grid is a
        // finite stand-in for the shortest cascade's open-ended upper bound.
        const kMax = Number.isFinite(spec.kMax) ? spec.kMax : (Math.PI * n) / patch;
        const inBand = select(
          k.greaterThanEqual(float(spec.kMin)).and(k.lessThan(float(kMax))),
          float(1),
          float(0),
        );
        const amp = sqrt(density.max(0))
          .mul(1 / Math.SQRT2)
          .mul(inBand);

        const xi = noise.element(instanceIndex);
        h0.element(instanceIndex).assign(vec2(xi.x.mul(amp), xi.y.mul(amp)));
      })().compute(n * n, [WORKGROUP_SIZE]);

      const conjSpectrumPass = Fn(() => {
        const y = instanceIndex.div(uint(n));
        const x = instanceIndex.mod(uint(n));
        const mx = uint(n).sub(x).mod(uint(n));
        const my = uint(n).sub(y).mod(uint(n));
        const mirrored = h0.element(my.mul(uint(n)).add(mx));
        h0conj.element(instanceIndex).assign(vec2(mirrored.x, mirrored.y.negate()));
      })().compute(n * n, [WORKGROUP_SIZE]);

      setupPasses.push(initSpectrumPass, conjSpectrumPass);

      // --- per-frame dispersion evolution + the four packed spectra ---
      const evolvePass = Fn(() => {
        const y = instanceIndex.div(uint(n));
        const x = instanceIndex.mod(uint(n));
        const kx = float(signedIndex(x)).mul(twoPiOverPatch);
        const kz = float(signedIndex(y)).mul(twoPiOverPatch);
        const k = vec2(kx, kz).length().max(1e-6);
        const omega = sqrt(float(GRAVITY).mul(k));
        const theta = omega.mul(this.clock);
        const cosT = cos(theta);
        const sinT = sin(theta);

        const a = h0.element(instanceIndex);
        const b = h0conj.element(instanceIndex);

        const t1re = a.x.mul(cosT).add(a.y.mul(sinT));
        const t1im = a.y.mul(cosT).sub(a.x.mul(sinT));
        const t2re = b.x.mul(cosT).sub(b.y.mul(sinT));
        const t2im = b.x.mul(sinT).add(b.y.mul(cosT));

        const hRe = t1re.add(t2re);
        const hIm = t1im.add(t2im);
        const h = vec2(hRe, hIm);

        // Every field below is a wavenumber-domain operator applied to h.
        // Vertical slope: i*k*h. Horizontal displacement: -i*(k/|k|)*h.
        // Displacement derivatives: (k_a*k_b/|k|)*h — a real factor, so the
        // complex value passes through unchanged.
        const slopeX = vec2(kx.negate().mul(hIm), kx.mul(hRe));
        const slopeZ = vec2(kz.negate().mul(hIm), kz.mul(hRe));
        const dispX = vec2(kx.div(k).mul(hIm), kx.div(k).mul(hRe).negate());
        const dispZ = vec2(kz.div(k).mul(hIm), kz.div(k).mul(hRe).negate());
        const dxx = h.mul(kx.mul(kx).div(k));
        const dzz = h.mul(kz.mul(kz).div(k));
        const dxz = h.mul(kx.mul(kz).div(k));

        specDisp.element(instanceIndex).assign(packPair(dispX, dispZ));
        specHeightSlopeX.element(instanceIndex).assign(packPair(h, slopeX));
        specSlopeZDxx.element(instanceIndex).assign(packPair(slopeZ, dxx));
        specDzzDxz.element(instanceIndex).assign(packPair(dzz, dxz));
      })().compute(n * n, [WORKGROUP_SIZE]);

      framePasses.push(
        evolvePass,
        ...buildFieldPipeline(specDisp, outDisp),
        ...buildFieldPipeline(specHeightSlopeX, outHeightSlopeX),
        ...buildFieldPipeline(specSlopeZDxx, outSlopeZDxx),
        ...buildFieldPipeline(specDzzDxz, outDzzDxz),
        combinePass(outDisp, outHeightSlopeX, outGeometry),
        combinePass(outSlopeZDxx, outDzzDxz, outFold),
      );

      cascades.push({
        patchSize: patch,
        geometry: outGeometry,
        fold: outFold,
      });
    }

    this.cascades = cascades;
    for (const pass of setupPasses) renderer.compute(pass);
    this.perFramePasses = framePasses;
  }

  update(elapsed?: number): void {
    // One call with the whole array batches all passes into a single
    // command encoder/submit. Looping renderer.compute() per pass (the
    // original version of this) issued 58 separate submits every frame.
    if (elapsed !== undefined) this.clock.value = elapsed;
    this.renderer.compute(this.perFramePasses);
  }
}
