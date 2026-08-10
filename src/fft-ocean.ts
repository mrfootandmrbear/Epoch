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
  time,
  uint,
  vec2,
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

// --- Tessendorf FFT ocean: JONSWAP spectrum -> per-frame dispersion ->
// radix-2 Cooley-Tukey 2D IFFT (rows, transpose, rows-again, transpose back).
// See THESIS.md §8 "How the landing state is actually computed" — this is
// the first real spectral synthesis piece (replacing the earlier
// sum-of-sines approximation in water.ts).

const WORKGROUP_SIZE = 64;
const GRAVITY = 9.81;

function bitReverse(x: number, bits: number): number {
  let result = 0;
  for (let i = 0; i < bits; i++) {
    result = (result << 1) | (x & 1);
    x >>= 1;
  }
  return result;
}

// Box-Muller: two independent standard normal samples per grid point.
function buildGaussianNoise(n: number): Float32Array {
  const data = new Float32Array(n * n * 2);
  for (let i = 0; i < n * n; i++) {
    let u1 = Math.random();
    while (u1 <= Number.EPSILON) u1 = Math.random();
    const u2 = Math.random();
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
// every column FFT, since N is the same in both dimensions of a square grid.
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

export interface FFTOceanOptions {
  size?: number; // grid resolution, power of 2
  patchSize?: number; // world-space meters the NxN patch tiles
  windSpeed?: number; // m/s
  windDirectionDeg?: number;
  windSharpness?: number; // directional-spreading exponent
  fetch?: number; // meters, JONSWAP fetch
  amplitudeScale?: number; // tunable overall wave-height multiplier
}

export class FFTOcean {
  readonly size: number;
  readonly patchSize: number;

  readonly heightBuffer: StorageBufferNode<"float">;
  readonly slopeXBuffer: StorageBufferNode<"float">;
  readonly slopeZBuffer: StorageBufferNode<"float">;

  private renderer: WebGPURenderer;
  private perFramePasses: ComputeNode[] = [];

  constructor(renderer: WebGPURenderer, options: FFTOceanOptions = {}) {
    this.renderer = renderer;
    const n = options.size ?? 128;
    this.size = n;
    this.patchSize = options.patchSize ?? 300;
    const windSpeed = options.windSpeed ?? 11;
    const windDirRad = ((options.windDirectionDeg ?? 35) * Math.PI) / 180;
    const windX = Math.cos(windDirRad);
    const windZ = Math.sin(windDirRad);
    const sharpness = options.windSharpness ?? 6;
    const fetch = options.fetch ?? 300000;
    const amplitudeScale = options.amplitudeScale ?? 1;

    const half = n / 2;
    const lut = buildButterflyLUT(n);
    const bitrev = new Uint32Array(n);
    for (let i = 0; i < n; i++) bitrev[i] = bitReverse(i, Math.log2(n));

    // --- buffers ---
    const noise = instancedArray(buildGaussianNoise(n), "vec2");
    const bitrevBuf = instancedArray(bitrev, "uint");
    const lutIdx = instancedArray(lut.indices, "uvec2");
    const lutTwid = instancedArray(lut.twiddles, "vec2");

    const h0 = instancedArray(n * n, "vec2");
    const h0conj = instancedArray(n * n, "vec2");

    const specHeight = instancedArray(n * n, "vec2");
    const specSlopeX = instancedArray(n * n, "vec2");
    const specSlopeZ = instancedArray(n * n, "vec2");

    const scratchA = instancedArray(n * n, "vec2");
    const scratchB = instancedArray(n * n, "vec2");
    const scratchT = instancedArray(n * n, "vec2");

    this.heightBuffer = instancedArray(n * n, "float");
    this.slopeXBuffer = instancedArray(n * n, "float");
    this.slopeZBuffer = instancedArray(n * n, "float");

    // --- JONSWAP initial spectrum h0(k), once ---
    const alpha = 0.076 * Math.pow((GRAVITY * fetch) / (windSpeed * windSpeed), -0.22);
    const peakFreq =
      22 * Math.pow((windSpeed * windSpeed * fetch) / (GRAVITY * GRAVITY), -0.33);
    const twoPiOverPatch = (2 * Math.PI) / this.patchSize;

    const signedIndex = (idx: Node<"uint">) =>
      select(idx.lessThan(uint(half)), int(idx), int(idx).sub(int(n)));

    const jonswapSpectrum = (k: Node<"float">) => {
      const f = sqrt(float(GRAVITY).mul(k)).mul(1 / (2 * Math.PI));
      const fp = float(peakFreq);
      const sigma = select(f.lessThanEqual(fp), float(0.07), float(0.09));
      const r = float(-1)
        .mul(f.sub(fp).mul(f.sub(fp)))
        .div(float(2).mul(sigma).mul(sigma).mul(fp).mul(fp))
        .exp();
      const gamma = float(3.3).pow(r);
      const s = alpha
        * (GRAVITY * GRAVITY)
        / (Math.pow(2 * Math.PI, 4));
      return float(s)
        .div(f.pow(5).max(1e-6))
        .mul(fp.div(f).pow(4).mul(-1.25).exp())
        .mul(gamma);
    };

    const initSpectrumPass = Fn(() => {
      const y = instanceIndex.div(uint(n));
      const x = instanceIndex.mod(uint(n));
      const kx = float(signedIndex(x)).mul(twoPiOverPatch);
      const kz = float(signedIndex(y)).mul(twoPiOverPatch);
      const k = vec2(kx, kz).length().max(1e-6);

      const khatDotWind = kx.div(k).mul(windX).add(kz.div(k).mul(windZ));
      const dir = khatDotWind.add(1).mul(0.5).max(0).pow(sharpness);

      const spec = jonswapSpectrum(k).mul(dir).mul(twoPiOverPatch * twoPiOverPatch);
      const amp = sqrt(spec.max(0)).mul(1 / Math.SQRT2);

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

    renderer.compute(initSpectrumPass);
    renderer.compute(conjSpectrumPass);

    // --- per-frame dispersion evolution: h(k,t) + derived slope fields ---
    const evolvePass = Fn(() => {
      const y = instanceIndex.div(uint(n));
      const x = instanceIndex.mod(uint(n));
      const kx = float(signedIndex(x)).mul(twoPiOverPatch);
      const kz = float(signedIndex(y)).mul(twoPiOverPatch);
      const k = vec2(kx, kz).length().max(1e-6);
      const omega = sqrt(float(GRAVITY).mul(k));
      const theta = omega.mul(time);
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

      specHeight.element(instanceIndex).assign(vec2(hRe, hIm));
      specSlopeX.element(instanceIndex).assign(vec2(kx.negate().mul(hIm), kx.mul(hRe)));
      specSlopeZ.element(instanceIndex).assign(vec2(kz.negate().mul(hIm), kz.mul(hRe)));
    })().compute(n * n, [WORKGROUP_SIZE]);

    // --- radix-2 2D IFFT pipeline, shared scratch buffers, run per field ---
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
    const extractRealPass = (
      complexBuf: StorageBufferNode<"vec2">,
      outBuf: StorageBufferNode<"float">,
    ) =>
      Fn(() => {
        outBuf
          .element(instanceIndex)
          .assign(complexBuf.element(instanceIndex).x.mul(amplitudeScale));
      })().compute(n * n, [WORKGROUP_SIZE]);

    const buildFieldPipeline = (
      specBuf: StorageBufferNode<"vec2">,
      outBuf: StorageBufferNode<"float">,
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
      passes.push(extractRealPass(scratchT, outBuf));
      return passes;
    };

    const heightPipeline = buildFieldPipeline(specHeight, this.heightBuffer);
    const slopeXPipeline = buildFieldPipeline(specSlopeX, this.slopeXBuffer);
    const slopeZPipeline = buildFieldPipeline(specSlopeZ, this.slopeZBuffer);

    this.perFramePasses = [evolvePass, ...heightPipeline, ...slopeXPipeline, ...slopeZPipeline];
  }

  update(): void {
    // One call with the whole array batches all passes into a single
    // command encoder/submit. Looping renderer.compute() per pass (the
    // original version of this) issued 58 separate submits every frame.
    this.renderer.compute(this.perFramePasses);
  }
}
