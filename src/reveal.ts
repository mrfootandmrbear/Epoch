export const REVEAL_TREATMENTS = {
  "witness-seasons": {
    philosophy: "Witness time",
    label: "Seasons accelerate",
    description: "Recognizable seasonal pulses compress into an unreadable rush before the landing.",
    duration: 4200,
    resolveAt: 2450,
  },
  "witness-glimpses": {
    philosophy: "Witness time",
    label: "Fragmented centuries",
    description: "Brief ecological glimpses become rarer as the jump leaves human time behind.",
    duration: 4700,
    resolveAt: 2850,
  },
  "feel-eclipse": {
    philosophy: "Feel time",
    label: "Deep-time eclipse",
    description: "The world is swallowed by a slow geological eclipse, then returned all at once.",
    duration: 4300,
    resolveAt: 2800,
  },
  "feel-silence": {
    philosophy: "Feel time",
    label: "Silent threshold",
    description: "A restrained fade holds in darkness long enough for the reveal to become ceremonial.",
    duration: 3600,
    resolveAt: 2300,
  },
  "transform-strata": {
    philosophy: "See transformation",
    label: "Geological strata",
    description: "Sedimentary bands measure the interval while the recognizable horizon remains anchored.",
    duration: 4500,
    resolveAt: 2700,
  },
  "transform-scan": {
    philosophy: "See transformation",
    label: "Temporal survey",
    description: "A cartographic scan reads the island as evidence, then exposes the resolved world.",
    duration: 4000,
    resolveAt: 2350,
  },
} as const;

export type RevealTreatmentName = keyof typeof REVEAL_TREATMENTS;

export function isRevealTreatmentName(value: string | null): value is RevealTreatmentName {
  return value !== null && value in REVEAL_TREATMENTS;
}

export function revealTreatmentOptions(): Array<{
  value: RevealTreatmentName;
  philosophy: string;
  label: string;
}> {
  return Object.entries(REVEAL_TREATMENTS).map(([value, treatment]) => ({
    value: value as RevealTreatmentName,
    philosophy: treatment.philosophy,
    label: treatment.label,
  }));
}

export interface RevealController {
  readonly active: boolean;
  captureBefore: (source: HTMLCanvasElement) => void;
  play: (
    treatment: RevealTreatmentName,
    years: number,
    resolve: () => void,
    complete: () => void,
  ) => void;
}

export function createRevealController(root: HTMLElement): RevealController {
  const title = root.querySelector<HTMLElement>("[data-reveal-title]")!;
  const yearsEl = root.querySelector<HTMLElement>("[data-reveal-years]")!;
  const phase = root.querySelector<HTMLElement>("[data-reveal-phase]")!;
  const beforeCanvas = root.querySelector<HTMLCanvasElement>("[data-reveal-before]")!;
  let active = false;
  let timers: number[] = [];

  function clearTimers(): void {
    timers.forEach(window.clearTimeout);
    timers = [];
  }

  function schedule(callback: () => void, delay: number): void {
    timers.push(window.setTimeout(callback, delay));
  }

  return {
    get active() { return active; },
    captureBefore(source) {
      beforeCanvas.width = source.width;
      beforeCanvas.height = source.height;
      const context = beforeCanvas.getContext("2d");
      context?.drawImage(source, 0, 0, beforeCanvas.width, beforeCanvas.height);
    },
    play(treatmentName, years, resolve, complete) {
      if (active) return;
      active = true;
      clearTimers();
      const treatment = REVEAL_TREATMENTS[treatmentName];
      root.dataset.treatment = treatmentName;
      root.style.setProperty("--reveal-duration", `${treatment.duration}ms`);
      title.textContent = treatment.philosophy;
      yearsEl.textContent = years >= 1_000_000
        ? `${years / 1_000_000} million years`
        : `${years.toLocaleString()} ${years === 1 ? "year" : "years"}`;
      phase.textContent = treatmentName === "witness-seasons" ? "rain · growth · frost · return"
        : treatmentName === "witness-glimpses" ? "pioneer · canopy · fracture · descendant"
          : treatmentName === "feel-eclipse" ? "beyond memory"
            : treatmentName === "feel-silence" ? "the world continues without you"
              : treatmentName === "transform-strata" ? "weathering · deposition · succession"
                : "surveying change across the island";
      root.classList.remove("active", "resolved");
      void root.offsetWidth;
      root.classList.add("active");
      root.ownerDocument.body.classList.add("reveal-active");
      schedule(() => {
        resolve();
        root.classList.add("resolved");
      }, treatment.resolveAt);
      schedule(() => {
        root.classList.remove("active", "resolved");
        root.ownerDocument.body.classList.remove("reveal-active");
        active = false;
        complete();
      }, treatment.duration);
    },
  };
}
