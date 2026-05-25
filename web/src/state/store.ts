import { create } from "zustand";
import {
  stepPhysics,
  maxThrustNewtons,
  type DroneConfig,
  type DroneState,
  type Controls,
  type Environment,
} from "../physics/drone";
import { mediumConfig } from "../configs/testConfigs";
import {
  emptyBuild,
  type Build,
} from "../assembly/types";
import { buildToConfig } from "../assembly/buildToConfig";
import type { PartCategory } from "../parts/types";
import {
  deliveryMission,
  planWaypoints,
  buildingAabb,
} from "../mission/delivery";
import {
  computeThrust,
  emptyPIDState,
  type PIDState,
} from "../mission/autopilot";
import { getEsc } from "../parts/catalog";
import { logEvent, completeFlight, type Diagnosis } from "../api/client";
import { STUDENT_ID, SESSION_ID, attemptCounter } from "../api/session";

function freshState(config: DroneConfig): DroneState {
  return {
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    batteryRemainingMah: config.batteryCapacityMah,
  };
}

export type AppView = "assembly" | "flight";

export type MissionStatus = "idle" | "in_progress" | "success" | "crashed";
export type CrashReason =
  | "collision_building"
  | "battery_depleted"
  | "timeout"
  | null;

export type MissionTelemetry = {
  peakAltitude: number;
  peakCurrentA: number;
  peakDrift: number;
  finalPosition: [number, number, number] | null;
  batteryRemainingMah: number;
};

export type MissionRuntime = {
  status: MissionStatus;
  crashReason: CrashReason;
  waypointIdx: number;
  waypoints: [number, number, number][];
  elapsedSeconds: number;
  pid: PIDState;
  telemetry: MissionTelemetry;
  diagnosis: Diagnosis | null;
};

function freshMission(config: DroneConfig): MissionRuntime {
  return {
    status: "idle",
    crashReason: null,
    waypointIdx: 0,
    waypoints: [],
    elapsedSeconds: 0,
    pid: emptyPIDState(),
    telemetry: {
      peakAltitude: 0,
      peakCurrentA: 0,
      peakDrift: 0,
      finalPosition: null,
      batteryRemainingMah: config.batteryCapacityMah,
    },
    diagnosis: null,
  };
}

// Straight-line drift from warehouse→customer at the drone's current x.
function lateralDrift(pos: [number, number, number]): number {
  // Line is along world +x at z=0, y arbitrary. Drift = sqrt(z^2 + (something for y)).
  // Mission cares about horizontal drift (z deviation from the x-axis path).
  return Math.abs(pos[2]);
}

function pointInAabb(
  p: [number, number, number],
  min: [number, number, number],
  max: [number, number, number],
): boolean {
  return (
    p[0] >= min[0] && p[0] <= max[0] &&
    p[1] >= min[1] && p[1] <= max[1] &&
    p[2] >= min[2] && p[2] <= max[2]
  );
}

function distance3(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

const WAYPOINT_TOL = 8; // meters

type Store = {
  view: AppView;
  config: DroneConfig;
  state: DroneState;
  controls: Controls;
  build: Build;
  mission: MissionRuntime;
  setConfig: (config: DroneConfig) => void;
  setThrottle: (throttle: number) => void;
  stepSimulation: (dt: number) => void;
  stepMission: (dt: number) => void;
  reset: () => void;
  setView: (view: AppView) => void;
  setBuildPart: (category: PartCategory, id: string | null) => void;
  setPayload: (mass: number) => void;
  flyBuild: () => void;
  cancelMission: () => void;
};

export const useStore = create<Store>((set, get) => ({
  view: "assembly",
  config: mediumConfig,
  state: freshState(mediumConfig),
  controls: { throttle: 0 },
  build: emptyBuild,
  mission: freshMission(mediumConfig),
  setConfig: (config) =>
    set({
      config,
      state: freshState(config),
      controls: { throttle: 0 },
      mission: freshMission(config),
    }),
  setThrottle: (throttle) =>
    set({ controls: { throttle: Math.max(0, Math.min(1, throttle)) } }),
  stepSimulation: (dt) => {
    const { state, config, controls } = get();
    const safeDt = Math.min(dt, 0.05);
    const env: Environment = { wind: [0, 0, 0] };
    const r = stepPhysics(state, config, controls, env, safeDt);
    set({ state: r.state });
  },
  stepMission: (dt) => {
    const { mission, state, config } = get();
    if (mission.status !== "in_progress") return;
    const safeDt = Math.min(dt, 0.05);

    // Wind vector (m/s) = direction * speed.
    const wd = deliveryMission.wind.direction;
    const ws = deliveryMission.wind.speed_ms;
    const env: Environment = { wind: [wd[0] * ws, wd[1] * ws, wd[2] * ws] };

    const target = mission.waypoints[mission.waypointIdx];
    const maxT = maxThrustNewtons(config);
    const { thrustVector, newPid } = computeThrust({
      position: state.position,
      velocity: state.velocity,
      targetWaypoint: target,
      totalMass_g: config.totalMass + config.payloadMass,
      maxThrustN: maxT,
      dt: safeDt,
      pid: mission.pid,
    });

    const controls: Controls = { thrustVector };
    const r = stepPhysics(state, config, controls, env, safeDt);
    const newState = r.state;

    // Telemetry updates.
    const peakAltitude = Math.max(mission.telemetry.peakAltitude, newState.position[1]);
    const peakCurrentA = Math.max(mission.telemetry.peakCurrentA, r.currentA);
    const peakDrift = Math.max(mission.telemetry.peakDrift, lateralDrift(newState.position));
    const elapsedSeconds = mission.elapsedSeconds + safeDt;

    let status: MissionStatus = "in_progress";
    let crashReason: CrashReason = null;
    let waypointIdx = mission.waypointIdx;
    let finalPosition: [number, number, number] | null = null;

    // Collision check vs building AABB.
    const aabb = buildingAabb(deliveryMission);
    if (pointInAabb(newState.position, aabb.min, aabb.max)) {
      status = "crashed";
      crashReason = "collision_building";
    } else if (
      newState.batteryRemainingMah <
      config.batteryCapacityMah * 0.05
    ) {
      status = "crashed";
      crashReason = "battery_depleted";
    } else if (elapsedSeconds > deliveryMission.maxTimeSeconds) {
      status = "crashed";
      crashReason = "timeout";
    } else {
      // Waypoint switching.
      if (distance3(newState.position, target) < WAYPOINT_TOL) {
        if (waypointIdx >= mission.waypoints.length - 1) {
          status = "success";
        } else {
          waypointIdx += 1;
        }
      }
    }

    if (status !== "in_progress") {
      finalPosition = newState.position;
    }

    set({
      state: newState,
      controls,
      mission: {
        ...mission,
        status,
        crashReason,
        waypointIdx,
        elapsedSeconds,
        pid: newPid,
        telemetry: {
          peakAltitude,
          peakCurrentA,
          peakDrift,
          finalPosition: finalPosition ?? mission.telemetry.finalPosition,
          batteryRemainingMah: newState.batteryRemainingMah,
        },
      },
    });

    // Detect transition from in_progress -> terminal: log completion to backend.
    if (status !== "in_progress" && mission.status === "in_progress") {
      const esc = getEsc(get().build.escId);
      const escRating = esc?.currentRating_a ?? 0;
      const outcome = status === "success" ? "success" : "crashed";
      completeFlight({
        student_id: STUDENT_ID,
        session_id: SESSION_ID,
        attempt_number: attemptCounter.current(),
        config: { ...config },
        telemetry: {
          outcome,
          crash_reason_from_sim: crashReason,
          peak_altitude_m: peakAltitude,
          peak_current_a: peakCurrentA,
          peak_drift_m: peakDrift,
          final_position: newState.position,
          battery_remaining_mah: newState.batteryRemainingMah,
          elapsed_seconds: elapsedSeconds,
          collided_with_obstacle: crashReason === "collision_building",
          esc_current_rating_a: escRating,
        },
      })
        .then((res) => {
          const cur = get().mission;
          set({ mission: { ...cur, diagnosis: res.diagnosis } });
        })
        .catch((e) => console.warn("completeFlight failed", e));
    }
  },
  reset: () => set({ state: freshState(get().config) }),
  setView: (view) => set({ view }),
  setBuildPart: (category, id) => {
    const build = get().build;
    const key = (
      {
        frame: "frameId",
        motor: "motorId",
        propeller: "propellerId",
        esc: "escId",
        battery: "batteryId",
      } as const
    )[category];
    set({ build: { ...build, [key]: id } });
    // Non-blocking event log; never break UX on API failure.
    logEvent({
      student_id: STUDENT_ID,
      session_id: SESSION_ID,
      attempt_number: Math.max(1, attemptCounter.current()),
      event_type: "part_selected",
      payload: { category, part_id: id },
    }).catch((e) => console.warn("logEvent(part_selected) failed", e));
  },
  setPayload: (mass) => {
    const clamped = Math.max(0, Math.min(2000, Number.isFinite(mass) ? mass : 0));
    set({ build: { ...get().build, payloadMass: clamped } });
  },
  flyBuild: () => {
    const built = buildToConfig(get().build);
    if (!built) return;
    // Mission spec dictates 200g payload regardless of what the user chose for assembly testing.
    const config: DroneConfig = { ...built, payloadMass: deliveryMission.payloadGrams };
    const waypoints = planWaypoints(deliveryMission);
    const mission: MissionRuntime = {
      status: "in_progress",
      crashReason: null,
      waypointIdx: 0,
      waypoints,
      elapsedSeconds: 0,
      pid: emptyPIDState(),
      telemetry: {
        peakAltitude: 0,
        peakCurrentA: 0,
        peakDrift: 0,
        finalPosition: null,
        batteryRemainingMah: config.batteryCapacityMah,
      },
      diagnosis: null,
    };
    set({
      config,
      state: freshState(config),
      controls: { thrustVector: [0, 0, 0] },
      mission,
      view: "flight",
    });
    const attempt = attemptCounter.nextAttempt();
    logEvent({
      student_id: STUDENT_ID,
      session_id: SESSION_ID,
      attempt_number: attempt,
      event_type: "flight_started",
      payload: { ...config },
    }).catch((e) => console.warn("logEvent(flight_started) failed", e));
  },
  cancelMission: () => {
    const config = get().config;
    set({
      view: "assembly",
      state: freshState(config),
      controls: { throttle: 0 },
      mission: freshMission(config),
    });
  },
}));
