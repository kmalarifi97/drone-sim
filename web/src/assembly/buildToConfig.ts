import type { DroneConfig } from "../physics/drone";
import {
  getBattery,
  getEsc,
  getFrame,
  getMotor,
  getPropeller,
} from "../parts/catalog";
import type { Build } from "./types";

// FC + camera + receiver + miscellany. Grams.
export const ELECTRONICS_FUDGE = 25;

export function buildToConfig(build: Build): DroneConfig | null {
  const frame = getFrame(build.frameId);
  const motor = getMotor(build.motorId);
  const propeller = getPropeller(build.propellerId);
  const esc = getEsc(build.escId);
  const battery = getBattery(build.batteryId);

  if (!frame || !motor || !propeller || !esc || !battery) return null;

  const motorCount = frame.motorMountCount;
  const escMass = esc.is4in1 ? esc.mass_g : esc.mass_g * motorCount;
  const totalMass =
    frame.mass_g +
    motor.mass_g * motorCount +
    propeller.mass_g * motorCount +
    escMass +
    battery.mass_g +
    ELECTRONICS_FUDGE;

  return {
    totalMass,
    motorMaxThrust: motor.maxThrust_g,
    motorCount,
    propDiameter: propeller.diameter_in,
    // TODO refine per-frame
    dragCoefficient: 0.6,
    batteryCapacityMah: battery.capacity_mah,
    batteryVoltage: battery.voltage,
    payloadMass: build.payloadMass,
  };
}
