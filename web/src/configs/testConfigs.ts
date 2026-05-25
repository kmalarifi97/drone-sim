import type { DroneConfig } from "../physics/drone";

export const smallConfig: DroneConfig = {
  totalMass: 250,
  motorMaxThrust: 200,
  motorCount: 4,
  propDiameter: 3,
  dragCoefficient: 0.5,
  batteryCapacityMah: 850,
  batteryVoltage: 11.1,
  payloadMass: 0,
};

export const mediumConfig: DroneConfig = {
  totalMass: 800,
  motorMaxThrust: 700,
  motorCount: 4,
  propDiameter: 5,
  dragCoefficient: 0.6,
  batteryCapacityMah: 1500,
  batteryVoltage: 14.8,
  payloadMass: 200,
};

export const largeConfig: DroneConfig = {
  totalMass: 2000,
  motorMaxThrust: 1200,
  motorCount: 4,
  propDiameter: 8,
  dragCoefficient: 0.8,
  batteryCapacityMah: 5000,
  batteryVoltage: 22.2,
  payloadMass: 500,
};

export const presets = {
  Small: smallConfig,
  Medium: mediumConfig,
  Large: largeConfig,
} as const;

export type PresetName = keyof typeof presets;
