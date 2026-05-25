// Pure physics step for the drone.
// Point-mass model: thrust is applied as a 3D vector (either world-up via throttle,
// or an arbitrary vector commanded by the autopilot). No attitude / no rotational dynamics.

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
  // Manual mode: thrust is along +Y, magnitude = throttle * maxThrustN.
  throttle?: number;
  // Autopilot mode: thrust vector in newtons (world frame). Magnitude clamped to maxThrustN.
  thrustVector?: [number, number, number];
};

export type Environment = {
  wind: [number, number, number]; // wind velocity vector in m/s (world frame)
};

export type StepResult = {
  state: DroneState;
  currentA: number;        // electrical current drawn this step (rough estimate)
  thrustMagN: number;      // actual thrust magnitude applied this step (N)
};

const G = 9.81;
const AIR_DENSITY = 1.225;        // kg/m^3
const MOTOR_EFFICIENCY = 0.7;     // electrical -> mechanical efficiency estimate
const INCH_TO_M = 0.0254;

export function maxThrustNewtons(config: DroneConfig): number {
  return (config.motorCount * config.motorMaxThrust / 1000) * G;
}

export function stepPhysics(
  state: DroneState,
  config: DroneConfig,
  controls: Controls,
  env: Environment,
  dt: number,
): StepResult {
  // Masses in kg
  const totalMassKg = (config.totalMass + config.payloadMass) / 1000;

  // Weight (newtons), downward
  const weightY = -totalMassKg * G;

  // Resolve thrust vector.
  const maxThrustN = maxThrustNewtons(config);
  let tx = 0, ty = 0, tz = 0;
  if (controls.thrustVector) {
    tx = controls.thrustVector[0];
    ty = controls.thrustVector[1];
    tz = controls.thrustVector[2];
    const mag = Math.sqrt(tx * tx + ty * ty + tz * tz);
    if (mag > maxThrustN && mag > 0) {
      const s = maxThrustN / mag;
      tx *= s;
      ty *= s;
      tz *= s;
    }
  } else {
    const throttle = Math.max(0, Math.min(1, controls.throttle ?? 0));
    ty = throttle * maxThrustN;
  }
  const thrustMag = Math.sqrt(tx * tx + ty * ty + tz * tz);

  // Drag uses velocity relative to wind. F_drag = -0.5 * Cd * rho * area * |v_rel| * v_rel.
  const propMeters = config.propDiameter * INCH_TO_M;
  const area = propMeters * propMeters;
  const [vx, vy, vz] = state.velocity;
  const [wx, wy, wz] = env.wind;
  const rvx = vx - wx;
  const rvy = vy - wy;
  const rvz = vz - wz;
  const relSpeed = Math.sqrt(rvx * rvx + rvy * rvy + rvz * rvz);
  const dragCoef = -0.5 * config.dragCoefficient * AIR_DENSITY * area * relSpeed;
  const dragX = dragCoef * rvx;
  const dragY = dragCoef * rvy;
  const dragZ = dragCoef * rvz;

  // Net force (newtons) and acceleration (m/s^2)
  const fx = tx + dragX;
  const fy = ty + weightY + dragY;
  const fz = tz + dragZ;
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

  // Battery drain (rough estimate; real motor current is non-linear in thrust).
  // power_w = |thrust|_N * batteryVoltage / efficiency
  const powerW = (thrustMag * config.batteryVoltage) / MOTOR_EFFICIENCY;
  const currentA = config.batteryVoltage > 0 ? powerW / config.batteryVoltage : 0;
  const mahUsed = (currentA * 1000 * dt) / 3600;
  const batteryRemainingMah = Math.max(0, state.batteryRemainingMah - mahUsed);

  return {
    state: {
      position: [nx, ny, nz],
      velocity: [nvx, nvy, nvz],
      batteryRemainingMah,
    },
    currentA,
    thrustMagN: thrustMag,
  };
}
