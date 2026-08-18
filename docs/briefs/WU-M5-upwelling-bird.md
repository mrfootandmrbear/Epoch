# WU-M5 — One upwelling bird (penguin default)

> **Class:** Task. **Authority:** Below `docs/EXECUTION.md`. **Answers:** what this session implements. **Finish:** the Done when list, then stop.

**Model:** local Agent (pixels). Cloud/CI cannot pass the visual gate.
**Size:** large. **Depends on:** WU-M4. **Blocks:** nothing in this program.
**Owner visual verdict required.**

Parked water-life program: M1 crab → M2 marine iguana → M3 sea lion → M4 urchin → **M5 upwelling bird**. Do not start this brief in the same session as another family.

---

Work Unit: WU-M5 — One upwelling bird

**Read first:** `PRODUCT.md`, `docs/EXECUTION.md` item 6, `.agents/skills/generate-ecosystem-asset/SKILL.md` (bird: folded and extended wing, flight/swim readability), then these files only:

- `src/outcome-resolver.ts` (`aerial` occupancy — generic circling placeholders)
- `src/landing-state.ts` (`addAerialAnimals`)
- `src/marine-energy.test.ts` / `MarineEnergyExchange` (`primaryProductivity`, `preyAvailability`)
- Prior water-life packages (do not overwrite)

Do not explore beyond them. Do not ship penguin and flightless cormorant in the same unit.

## Why this exists

Splash, beach, and reef floor are filled by M1–M4. Cool productive upwelling — the reason this shore is not a tropical aquarium — still has no bird that reads “this water is cold and full of bait.” Generic aerial spheres in `addAerialAnimals` are not that. The program locks **one** upwelling bird.

## Design decision this unit implements

**Default family: Galápagos penguin** (`Spheniscus mendiculus`). Package id `epoch-galapagos-penguin`.

- Prefer penguin when this brief is about **regional climate identity** (equatorial penguin on west-style cold productive rock).
- Swap to **flightless cormorant** (`Nannopterum harrisi`, package `epoch-flightless-cormorant`) only if the owner names this brief as an **isolation → loss of flight** exam instead. Do not author both packages in this session.
- Penguin: ~0.5 m, countershaded torpedo, porpoising swim, rest on west rocky splash. Traits: fat/condition vs warmth, colony size vs upwelling. `idle` plus aquatic locomotion; flight is not the identity.
- Cormorant alternative: ~0.9–1.0 m, stubby wings, heavy body, wing-drying pose, long neck low in water. Traits: wing reduction, body mass, benthic dive. `idle` plus swim; do not fake penguin-fly.
- Do not replace all generic aerial occupancy with this family unless the placeholders would double-count the same shore. Overview may keep distant aerial marks; this family is the inspectable west-coast colony.
- One landing axis: cold-productive vs warm-starved. Warm-starved coasts thin or empty the colony.

## Goal

A reviewer looking at a cold productive rocky shore can read an equatorial penguin (or, if swapped, a flightless cormorant) as the upwelling tell, distinct from sea lions and marine iguanas.

## Tasks

1. Confirm penguin vs cormorant from the owner line above; author exactly one `assets/ecosystem/<id>/` package to `candidate`. Do not self-accept.
2. Seat a small colony on cool rocky shore plus in-water samples in the surface/nearshore column — not mid-island aerial circles, not Darwin/Wolf seamount spectacle.
3. Abundance tracks upwelling / `preyAvailability`. Deterministic test: warm-starved landing is thinner than cold-productive, same geometry.
4. Run `npm run asset:check -- assets/ecosystem/<id>`.

## Done when

- West-style productive rock shows the chosen bird at mid/near; warm-starved equivalent is visibly reduced.
- Orthographic previews include bird-required views (`front`, `side`, `top`, `game-distance`, plus `flight` only if the chosen family still flies — penguin showcase should include `swim` instead of a flying-dot).
- `npm test`, `npx tsc --noEmit`, and `npm run build` pass.
- Package stage is `candidate` with empty `acceptance.verdict`.

## Explicitly not the goal

Blue-footed booby, frigate, pelican, a second upwelling bird, hammerheads, turtles, or turning generic aerial into a fauna catalogue.

## Hard constraints

- Simulation must not import meshes.
- Do not edit existing `GOLDEN_SHOTS` or existing capture sets. Add an upwelling-bird shot if needed.
- Do not claim fps. Owner look on real WebGPU.
- A flying dot is not an accepted bird asset.

**End with:** test, typecheck, build, asset check, capture URLs, and an EXECUTION note that the upwelling bird is at candidate (not accepted).

**This unit needs an owner visual verdict.** Default question: "Does this read as a Galápagos penguin making cool productive water legible?" If the cormorant swap was chosen: "Does this read as a flightless cormorant — stubby wings, not a penguin?"
