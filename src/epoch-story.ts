import type { ClimateForces } from "./climate";
import type { LineageChange } from "./lineage-history";
import type { MarineLineageChange } from "./marine-lineage";

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function climatePressure(forces: ClimateForces): string {
  const temperature = forces.temperature === "warm" ? "heat" : forces.temperature === "cold" ? "cold" : "mild temperatures";
  const rainfall = forces.rainfall === "arid" ? "aridity" : forces.rainfall === "wet" ? "heavy rain" : "seasonal rain";
  return `${temperature} and ${rainfall}`;
}

export function buildEpochStory(
  previousAge: number,
  changes: readonly LineageChange[],
  forces: ClimateForces,
  marineChanges: readonly MarineLineageChange[] = [],
): string {
  const established = changes.filter((change) => change.event === "established").length;
  const pendingFounders = changes.filter((change) => change.status === "not-established").length;
  const failedFounders = changes.filter((change) => change.previousStatus === "not-established" && change.status === "extinct").length;
  const relocated = changes.filter((change) => change.event === "migrated" || change.event === "reanchored").length;
  const branches = changes.filter((change) => change.event === "speciated").length;
  const extinct = changes.filter((change) => change.event === "extinct").length;
  const marineEstablished = marineChanges.filter((change) => change.event === "established").length;
  const marineRelocated = marineChanges.filter((change) => change.event === "migrated" || change.event === "reanchored").length;
  const marineExtinct = marineChanges.filter((change) => change.event === "extinct").length;

  if (previousAge === 0) {
    if (marineEstablished > 0) {
      const arrivals = [
        established > 0 ? countLabel(established, "land lineage") : undefined,
        marineEstablished > 0 ? countLabel(marineEstablished, "marine lineage") : undefined,
      ].filter(Boolean).join(" and ");
      const failure = failedFounders > 0 ? ` ${countLabel(failedFounders, "founder cohort")} failed to establish.` : "";
      return `Life took hold: ${arrivals} established across the young island.${failure}`;
    }
    return established > 0
      ? `Life took hold: ${countLabel(established, "lineage")} established across the young island.`
      : pendingFounders > 0
        ? `Founders reached the island, but ${countLabel(pendingFounders, "cohort")} has not established.`
        : failedFounders > 0
          ? `${countLabel(failedFounders, "founder cohort")} reached the island but failed to establish.`
      : "The first epoch brought no terrestrial founders; the coast and sky remained open to arrivals.";
  }

  const events: string[] = [];
  if (relocated > 0) events.push(`${countLabel(relocated, "lineage")} found new ground`);
  if (branches > 0) events.push(`${countLabel(branches, "new branch")} emerged`);
  if (extinct > 0) events.push(`${countLabel(extinct, "lineage")} vanished`);
  if (marineRelocated > 0) events.push(`${countLabel(marineRelocated, "marine lineage")} shifted along the coast`);
  if (marineExtinct > 0) events.push(`${countLabel(marineExtinct, "marine lineage")} vanished`);
  if (pendingFounders > 0) events.push(`${countLabel(pendingFounders, "founder cohort")} remained vulnerable`);
  if (events.length === 0) events.push("the surviving lineages held their ground");

  return `Since Year ${previousAge.toLocaleString()}, ${climatePressure(forces)} reshaped the coast; ${events.join(", ")}.`;
}
