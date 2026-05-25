import { create } from "zustand";
import {
  stepPhysics,
  type DroneConfig,
  type DroneState,
  type Controls,
} from "../physics/drone";
import { mediumConfig } from "../configs/testConfigs";

function freshState(config: DroneConfig): DroneState {
  return {
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    batteryRemainingMah: config.batteryCapacityMah,
  };
}

type Store = {
  config: DroneConfig;
  state: DroneState;
  controls: Controls;
  setConfig: (config: DroneConfig) => void;
  setThrottle: (throttle: number) => void;
  stepSimulation: (dt: number) => void;
  reset: () => void;
};

export const useStore = create<Store>((set, get) => ({
  config: mediumConfig,
  state: freshState(mediumConfig),
  controls: { throttle: 0 },
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
}));
