import {
  getBattery,
  getEsc,
  getFrame,
  getMotor,
  getPropeller,
} from "../parts/catalog";
import { buildToConfig } from "./buildToConfig";
import type { Build } from "./types";

export type Warning = {
  severity: "warn" | "error";
  message: string;
};

export function validateBuild(build: Build): Warning[] {
  const warnings: Warning[] = [];

  const frame = getFrame(build.frameId);
  const motor = getMotor(build.motorId);
  const propeller = getPropeller(build.propellerId);
  const esc = getEsc(build.escId);
  const battery = getBattery(build.batteryId);

  if (motor && esc && motor.maxCurrent_a > esc.currentRating_a) {
    warnings.push({
      severity: "error",
      message: `ESC rated ${esc.currentRating_a}A but motor draws up to ${motor.maxCurrent_a}A — likely overcurrent at full throttle`,
    });
  }

  if (motor && battery) {
    if (battery.voltage > motor.voltage_max) {
      warnings.push({
        severity: "error",
        message: `Battery ${battery.voltage}V exceeds motor max ${motor.voltage_max}V — motor will fail`,
      });
    } else if (battery.voltage < motor.voltage_min) {
      warnings.push({
        severity: "warn",
        message: `Battery ${battery.voltage}V below motor min ${motor.voltage_min}V — motor won't reach rated thrust`,
      });
    }
  }

  const config = buildToConfig(build);
  if (config && motor) {
    const maxThrust = config.motorCount * motor.maxThrust_g;
    const weight = config.totalMass + config.payloadMass;
    if (maxThrust < weight) {
      warnings.push({
        severity: "error",
        message: `Max thrust ${maxThrust}g cannot lift ${weight}g — cannot hover`,
      });
    } else {
      const twr = maxThrust / weight;
      if (twr < 1.5) {
        warnings.push({
          severity: "warn",
          message: `TWR ${twr.toFixed(2)} is low — sluggish, may struggle with wind`,
        });
      }
    }
  }

  if (frame && propeller) {
    const ideal = frame.wheelbase_mm / 50;
    if (Math.abs(propeller.diameter_in - ideal) > 1) {
      warnings.push({
        severity: "warn",
        message: `${propeller.diameter_in}" prop unusual for ${frame.wheelbase_mm}mm frame (expect ~${ideal.toFixed(1)}")`,
      });
    }
  }

  return warnings;
}
