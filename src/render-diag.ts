/**
 * Near-camera fps isolation flags (WU-D1). Default play is unchanged: omitting
 * `diag` leaves every toggle off. Combinable via repeated `diag=` or commas.
 * Do not add flags here without a new brief.
 */

export const RENDER_DIAG_FLAGS = [
  "no-herd",
  "flat-hide",
  "freeze-pose",
  "far-lod",
  "no-fft",
  "no-shadow",
] as const;

export type RenderDiagFlag = (typeof RENDER_DIAG_FLAGS)[number];

export interface RenderDiagOptions {
  readonly noHerd: boolean;
  readonly flatHide: boolean;
  readonly freezePose: boolean;
  readonly farLod: boolean;
  readonly noFft: boolean;
  readonly noShadow: boolean;
}

const FLAG_SET = new Set<string>(RENDER_DIAG_FLAGS);

export const DEFAULT_RENDER_DIAG: RenderDiagOptions = Object.freeze({
  noHerd: false,
  flatHide: false,
  freezePose: false,
  farLod: false,
  noFft: false,
  noShadow: false,
});

export function readRenderDiagOptions(params: URLSearchParams): RenderDiagOptions {
  const enabled = new Set<string>();
  for (const raw of params.getAll("diag")) {
    for (const token of raw.split(",")) {
      const flag = token.trim();
      if (FLAG_SET.has(flag)) enabled.add(flag);
    }
  }
  return {
    noHerd: enabled.has("no-herd"),
    flatHide: enabled.has("flat-hide"),
    freezePose: enabled.has("freeze-pose"),
    farLod: enabled.has("far-lod"),
    noFft: enabled.has("no-fft"),
    noShadow: enabled.has("no-shadow"),
  };
}

export function formatRenderHud(
  backend: "WebGPU" | "WebGL2",
  fps: number,
  draws: number,
  distanceMeters: number,
): string {
  return `backend: ${backend} · ${fps} fps · ${draws} draws · ${Math.round(distanceMeters)} m`;
}

/**
 * Offset used by `diag=far-lod` so tree / seagrass / coral near bands never
 * trigger. Larger than the 2 km world plus the widest near LOD (92 m).
 */
export const FAR_LOD_VIEW_OFFSET = 100_000;
