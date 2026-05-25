import { create } from "zustand";
import {
  stepPhysics,
  type DroneConfig,
  type DroneState,
  type Controls,
} from "../physics/drone";
import { mediumConfig } from "../configs/testConfigs";
import {
  emptyBuild,
  type Build,
} from "../assembly/types";
import { buildToConfig } from "../assembly/buildToConfig";
import type { PartCategory } from "../parts/types";

function freshState(config: DroneConfig): DroneState {
  return {
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    batteryRemainingMah: config.batteryCapacityMah,
  };
}

export type AppView = "assembly" | "flight";

type Store = {
  view: AppView;
  config: DroneConfig;
  state: DroneState;
  controls: Controls;
  build: Build;
  setConfig: (config: DroneConfig) => void;
  setThrottle: (throttle: number) => void;
  stepSimulation: (dt: number) => void;
  reset: () => void;
  setView: (view: AppView) => void;
  setBuildPart: (category: PartCategory, id: string | null) => void;
  setPayload: (mass: number) => void;
  flyBuild: () => void;
};

export const useStore = create<Store>((set, get) => ({
  view: "assembly",
  config: mediumConfig,
  state: freshState(mediumConfig),
  controls: { throttle: 0 },
  build: emptyBuild,
  setConfig: (config) =>
    set({
      config,
      state: freshState(config),
      controls: { throttle: 0 },
    }),
  setThrottle: (throttle) =>
    set({ controls: { throttle: Math.max(0, Math.min(1, throttle)) } }),
  stepSimulation: (dt) => {
    const { state, config, controls } = get();
    // Clamp dt to keep things sane if the tab was backgrounded.
    const safeDt = Math.min(dt, 0.05);
    set({ state: stepPhysics(state, config, controls, safeDt) });
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
  },
  setPayload: (mass) => {
    const clamped = Math.max(0, Math.min(2000, Number.isFinite(mass) ? mass : 0));
    set({ build: { ...get().build, payloadMass: clamped } });
  },
  flyBuild: () => {
    const config = buildToConfig(get().build);
    if (!config) return;
    set({
      config,
      state: freshState(config),
      controls: { throttle: 0 },
      view: "flight",
    });
  },
}));
