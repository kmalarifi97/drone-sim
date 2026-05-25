// 3D PID waypoint follower.
// Point-mass model; ignores attitude. Adequate for v0 educational sim.

const G = 9.81;

const KP = 4.0;
const KI = 0.5;
const KD = 6.0;
const I_CLAMP = 50;        // anti-windup bound per axis
const MAX_CMD_ACCEL = 8;   // m/s^2 per axis — bounds maneuvering accel so gravity ff isn't crowded out

export type PIDState = {
  intX: number; intY: number; intZ: number;
  prevX: number; prevY: number; prevZ: number;
};

export function emptyPIDState(): PIDState {
  return { intX: 0, intY: 0, intZ: 0, prevX: 0, prevY: 0, prevZ: 0 };
}

export type AutopilotInput = {
  position: [number, number, number];
  velocity: [number, number, number];
  targetWaypoint: [number, number, number];
  totalMass_g: number;   // for gravity feed-forward
  maxThrustN: number;    // for output clamp
  dt: number;
  pid: PIDState;
};

export type AutopilotOutput = {
  thrustVector: [number, number, number];
  newPid: PIDState;
};

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function computeThrust(input: AutopilotInput): AutopilotOutput {
  const {
    position,
    velocity,
    targetWaypoint,
    totalMass_g,
    maxThrustN,
    dt,
    pid,
  } = input;

  const ex = targetWaypoint[0] - position[0];
  const ey = targetWaypoint[1] - position[1];
  const ez = targetWaypoint[2] - position[2];

  // Integral with anti-windup clamp.
  const intX = clamp(pid.intX + ex * dt, -I_CLAMP, I_CLAMP);
  const intY = clamp(pid.intY + ey * dt, -I_CLAMP, I_CLAMP);
  const intZ = clamp(pid.intZ + ez * dt, -I_CLAMP, I_CLAMP);

  // Derivative on measurement: d(error)/dt = -velocity since target is (near-)constant per step.
  const dEx = -velocity[0];
  const dEy = -velocity[1];
  const dEz = -velocity[2];

  // PID acceleration commands (m/s^2 desired). Clamp per axis so any single axis can't
  // monopolize the thrust budget and starve gravity compensation on Y.
  const cmdAx = clamp(KP * ex + KI * intX + KD * dEx, -MAX_CMD_ACCEL, MAX_CMD_ACCEL);
  const cmdAy = clamp(KP * ey + KI * intY + KD * dEy, -MAX_CMD_ACCEL, MAX_CMD_ACCEL);
  const cmdAz = clamp(KP * ez + KI * intZ + KD * dEz, -MAX_CMD_ACCEL, MAX_CMD_ACCEL);

  // Convert to forces (F = m * a), plus gravity feed-forward on Y.
  const massKg = totalMass_g / 1000;
  let tx = massKg * cmdAx;
  let ty = massKg * cmdAy + massKg * G;
  let tz = massKg * cmdAz;

  // Uniform-scale clamp so direction is preserved.
  const mag = Math.sqrt(tx * tx + ty * ty + tz * tz);
  if (mag > maxThrustN && mag > 0) {
    const s = maxThrustN / mag;
    tx *= s;
    ty *= s;
    tz *= s;
  }

  return {
    thrustVector: [tx, ty, tz],
    newPid: {
      intX, intY, intZ,
      prevX: ex, prevY: ey, prevZ: ez,
    },
  };
}
