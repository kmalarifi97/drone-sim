export type Build = {
  frameId: string | null;
  motorId: string | null;
  propellerId: string | null;
  escId: string | null;
  batteryId: string | null;
  payloadMass: number; // grams
};

export const emptyBuild: Build = {
  frameId: null,
  motorId: null,
  propellerId: null,
  escId: null,
  batteryId: null,
  payloadMass: 0,
};
