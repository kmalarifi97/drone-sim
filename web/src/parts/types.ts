// Shared part-catalog types.

export type PartCategory = "frame" | "motor" | "propeller" | "esc" | "battery";

type PartBase<C extends PartCategory> = {
  id: string;
  category: C;
  manufacturer: string;
  model: string;
};

export type Frame = PartBase<"frame"> & {
  mass_g: number;
  motorMountCount: number;
  wheelbase_mm: number;
};

export type Motor = PartBase<"motor"> & {
  mass_g: number;
  kv: number;
  maxThrust_g: number;
  maxCurrent_a: number;
  voltage_min: number;
  voltage_max: number;
};

export type Propeller = PartBase<"propeller"> & {
  mass_g: number;
  diameter_in: number;
  pitch_in: number;
  blades: number;
};

export type Esc = PartBase<"esc"> & {
  mass_g: number;
  is4in1: boolean;
  currentRating_a: number;
  voltage_max: number;
};

export type Battery = PartBase<"battery"> & {
  mass_g: number;
  capacity_mah: number;
  voltage: number;
  cells: number;
};

export type Part = Frame | Motor | Propeller | Esc | Battery;

export type PartsCatalog = {
  frames: Frame[];
  motors: Motor[];
  propellers: Propeller[];
  escs: Esc[];
  batteries: Battery[];
};
