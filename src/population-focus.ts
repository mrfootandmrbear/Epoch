/** Centroid of visible herd samples — the point the camera should bookmark. */
export function visibleHerdCentroid(
  members: readonly { visible: boolean; position: Readonly<{ x: number; y: number; z: number }> }[],
): { x: number; y: number; z: number } | undefined {
  let x = 0;
  let y = 0;
  let z = 0;
  let count = 0;
  for (const member of members) {
    if (!member.visible) continue;
    x += member.position.x;
    y += member.position.y;
    z += member.position.z;
    count++;
  }
  if (count === 0) return undefined;
  return { x: x / count, y: y / count, z: z / count };
}
