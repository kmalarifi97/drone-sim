// Delivery mission v0: fly from warehouse to customer past a building, in wind.

export const deliveryMission = {
  id: "delivery_v0",
  warehouse: [0, 0, 0] as [number, number, number],
  customer: [2000, 0, 0] as [number, number, number],
  obstacle: {
    type: "building" as const,
    position: [1000, 0, 0] as [number, number, number], // ground footprint center
    height: 90,
    width: 40,
  },
  wind: {
    direction: [-1, 0, 0] as [number, number, number], // unit vector
    speed_ms: 4,
  },
  payloadGrams: 200,
  maxTimeSeconds: 300,
};

export type Mission = typeof deliveryMission;

// Building AABB derived from spec (square footprint centered on x=1000, z=0).
export function buildingAabb(m: Mission): {
  min: [number, number, number];
  max: [number, number, number];
} {
  const half = m.obstacle.width / 2;
  const [cx, , cz] = m.obstacle.position;
  return {
    min: [cx - half, 0, cz - half],
    max: [cx + half, m.obstacle.height, cz + half],
  };
}

// Pre-planned waypoints: climb above the building, cross to customer, descend.
export function planWaypoints(
  m: Mission,
): [number, number, number][] {
  const safeAlt = m.obstacle.height + 10;
  const [cx, , cz] = m.customer;
  return [
    [0, safeAlt, 0],
    [cx, safeAlt, cz],
    [cx, 5, cz],
  ];
}
