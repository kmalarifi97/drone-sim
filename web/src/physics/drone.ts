// Pure physics step for the drone. v0: drone stays level, thrust is along world-up.
// Prompt 4 will add attitude.

export type DroneConfig = {
  totalMass: number;         // grams (frame + electronics + battery)
  motorMaxThrust: number;    // grams, per motor
  motorCount: number;
  propDiameter: number;      // inches
  dragCoefficient: number;   // dimensionless Cd for whole airframe
  batteryCapacityMah: number;
  batteryVoltage: number;    // nominal V
  payloadMass: number;       // grams
};

export type DroneState = {
  position: [number, number, number]; // x, y(up), z, meters
  velocity: [number, number, number];
  batteryRemainingMah: number;
};

export type Controls = {
  throttle: number; // 0..1
};

const G = 9.81;
const AIR_DENSITY = 1.225;        // kg/m^3
const MOTOR_EFFICIENCY = 0.7;     // electrical -> mechanical efficiency estimate
const INCH_TO_M = 0.0254;

export function stepPhysics(
  state: DroneState,
  config: DroneConfig,
  controls: Controls,
  dt: number,
): DroneState {
  const throttle = Math.max(0, Math.min(1, controls.throttle));

  // Masses in kg
  const totalMassKg = (config.totalMass + config.payloadMass) / 1000;

  // Weight (newtons), downward
  const weightY = -totalMassKg * G;

  // Thrust (newtons), along +Y (world up) for v0
  // motorMaxThrust is grams per motor; convert grams of force to newtons: grams/1000 * g
  const maxThrustN = (config.motorCount * config.motorMaxThrust / 1000) * G;
  const thrustY = throttle * maxThrustN;

  // Drag: -0.5 * Cd * rho * |v| * v (vector). Area approximated as propDiameter^2 (m^2).
  const propMeters = config.propDiameter * INCH_TO_M;
  const area = propMeters * propMeters;
  const [vx, vy, vz] = state.velocity;
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
  const dragCoef = -0.5 * config.dragCoefficient * AIR_DENSITY * area * speed;
  const dragX = dragCoef * vx;
  const dragY = dragCoef * vy;
  const dragZ = dragCoef * vz;

  // Net force (newtons) and acceleration (m/s^2)
  const fx = dragX;
  const fy = thrustY + weightY + dragY;
  const fz = dragZ;
  const ax = fx / totalMassKg;
  const ay = fy / totalMassKg;
  const az = fz / totalMassKg;

  // Euler integrate
  let nvx = vx + ax * dt;
  let nvy = vy + ay * dt;
  let nvz = vz + az * dt;

  let nx = state.position[0] + nvx * dt;
  let ny = state.position[1] + nvy * dt;
  let nz = state.position[2] + nvz * dt;

  // Ground clamp at y=0 so the drone doesn't sink through the floor.
  if (ny < 0) {
    ny = 0;
    if (nvy < 0) nvy = 0;
  }

  // Battery drain.
  // power_w = throttle * motorCount * motorMaxThrust_kg * g * batteryVoltage / efficiency (0.7)
  const motorMaxThrustKg = config.motorMaxThrust / 1000;
  const powerW =
    (throttle * config.motorCount * motorMaxThrustKg * G * config.batteryVoltage) /
    MOTOR_EFFICIENCY;
  const currentA = config.batteryVoltage > 0 ? powerW / config.batteryVoltage : 0;
  const mahUsed = (currentA * 1000 * dt) / 3600;
  const batteryRemainingMah = Math.max(0, state.batteryRemainingMah - mahUsed);

  return {
    position: [nx, ny, nz],
    velocity: [nvx, nvy, nvz],
    batteryRemainingMah,
  };
}
