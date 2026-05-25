import partsData from "./parts.json";
import type {
  Battery,
  Esc,
  Frame,
  Motor,
  Part,
  PartCategory,
  PartsCatalog,
  Propeller,
} from "./types";

export const catalog: PartsCatalog = partsData as PartsCatalog;

const byId = new Map<string, Part>();
for (const list of [
  catalog.frames,
  catalog.motors,
  catalog.propellers,
  catalog.escs,
  catalog.batteries,
]) {
  for (const p of list) byId.set(p.id, p);
}

export function getPart(id: string | null | undefined): Part | undefined {
  if (!id) return undefined;
  return byId.get(id);
}

export function getFrame(id: string | null | undefined): Frame | undefined {
  const p = getPart(id);
  return p && p.category === "frame" ? p : undefined;
}
export function getMotor(id: string | null | undefined): Motor | undefined {
  const p = getPart(id);
  return p && p.category === "motor" ? p : undefined;
}
export function getPropeller(
  id: string | null | undefined,
): Propeller | undefined {
  const p = getPart(id);
  return p && p.category === "propeller" ? p : undefined;
}
export function getEsc(id: string | null | undefined): Esc | undefined {
  const p = getPart(id);
  return p && p.category === "esc" ? p : undefined;
}
export function getBattery(
  id: string | null | undefined,
): Battery | undefined {
  const p = getPart(id);
  return p && p.category === "battery" ? p : undefined;
}

export function partsInCategory(category: PartCategory): Part[] {
  switch (category) {
    case "frame":
      return catalog.frames;
    case "motor":
      return catalog.motors;
    case "propeller":
      return catalog.propellers;
    case "esc":
      return catalog.escs;
    case "battery":
      return catalog.batteries;
  }
}
