import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import { useStore } from "../state/store";
import {
  getBattery,
  getFrame,
  getMotor,
  getPropeller,
  partsInCategory,
} from "../parts/catalog";
import type {
  Battery,
  Frame,
  Motor,
  Part,
  PartCategory,
  Propeller,
} from "../parts/types";
import { buildToConfig } from "./buildToConfig";
import { validateBuild } from "./validate";

const CATEGORIES: { key: PartCategory; label: string }[] = [
  { key: "frame", label: "Frame" },
  { key: "motor", label: "Motor" },
  { key: "propeller", label: "Propeller" },
  { key: "esc", label: "ESC" },
  { key: "battery", label: "Battery" },
];

function partSpecSummary(part: Part): string {
  switch (part.category) {
    case "frame":
      return `${part.wheelbase_mm}mm wheelbase · ${part.motorMountCount} motors · ${part.mass_g}g`;
    case "motor":
      return `${part.kv}KV · ${part.maxThrust_g}g thrust · ${part.maxCurrent_a}A · ${part.mass_g}g`;
    case "propeller":
      return `${part.diameter_in}×${part.pitch_in} · ${part.blades} blades · ${part.mass_g}g`;
    case "esc":
      return `${part.currentRating_a}A${part.is4in1 ? " 4-in-1" : " single"} · ${part.voltage_max}V max · ${part.mass_g}g`;
    case "battery":
      return `${part.cells}S ${part.voltage}V · ${part.capacity_mah}mAh · ${part.mass_g}g`;
  }
}

function selectedIdFor(
  category: PartCategory,
  build: {
    frameId: string | null;
    motorId: string | null;
    propellerId: string | null;
    escId: string | null;
    batteryId: string | null;
  },
): string | null {
  switch (category) {
    case "frame":
      return build.frameId;
    case "motor":
      return build.motorId;
    case "propeller":
      return build.propellerId;
    case "esc":
      return build.escId;
    case "battery":
      return build.batteryId;
  }
}

function CatalogPanel() {
  const [active, setActive] = useState<PartCategory>("frame");
  const build = useStore((s) => s.build);
  const setBuildPart = useStore((s) => s.setBuildPart);
  const setPayload = useStore((s) => s.setPayload);
  const payload = build.payloadMass;

  const items = partsInCategory(active);
  const selectedId = selectedIdFor(active, build);

  return (
    <div className="catalog">
      <div className="catalog-tabs">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            className={`catalog-tab${active === c.key ? " active" : ""}`}
            onClick={() => setActive(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="catalog-list">
        {items.map((part) => {
          const isSelected = selectedId === part.id;
          return (
            <div
              key={part.id}
              className={`catalog-row part-row${isSelected ? " selected" : ""}`}
              onClick={() =>
                setBuildPart(active, isSelected ? null : part.id)
              }
            >
              <div className="part-name">
                {part.manufacturer} {part.model}
              </div>
              <div className="part-spec">{partSpecSummary(part)}</div>
            </div>
          );
        })}
      </div>

      <div className="catalog-payload">
        <label htmlFor="payload-input">Payload (g)</label>
        <input
          id="payload-input"
          type="number"
          min={0}
          max={2000}
          step={10}
          value={payload}
          onChange={(e) => setPayload(+e.target.value)}
        />
      </div>
    </div>
  );
}

type PreviewProps = {
  frame: Frame | undefined;
  motor: Motor | undefined;
  propeller: Propeller | undefined;
  battery: Battery | undefined;
};

function BuildPreview({ frame, motor, propeller, battery }: PreviewProps) {
  // Wheelbase in meters. Fall back to 0.22m for empty preview.
  const wheelbaseM = frame ? frame.wheelbase_mm / 1000 : 0.22;
  // Distance from center to a motor mount (diagonal/2 for X-quad).
  const armLen = wheelbaseM / 2;
  // Motor positions for a 4-mount X-quad.
  const motorOffset = armLen / Math.SQRT2;
  const motorPositions: [number, number, number][] = [
    [motorOffset, 0, motorOffset],
    [motorOffset, 0, -motorOffset],
    [-motorOffset, 0, motorOffset],
    [-motorOffset, 0, -motorOffset],
  ];
  const propRadius = propeller ? (propeller.diameter_in * 0.0254) / 2 : 0;

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 3]} intensity={0.9} />
      <Grid args={[2, 2]} cellColor="#444" sectionColor="#666" infiniteGrid />

      {frame && (
        <group>
          {/* X-frame: two thin slabs along diagonals */}
          <mesh rotation={[0, Math.PI / 4, 0]}>
            <boxGeometry args={[wheelbaseM, 0.01, 0.02]} />
            <meshStandardMaterial color="#444a55" />
          </mesh>
          <mesh rotation={[0, -Math.PI / 4, 0]}>
            <boxGeometry args={[wheelbaseM, 0.01, 0.02]} />
            <meshStandardMaterial color="#444a55" />
          </mesh>
        </group>
      )}

      {frame &&
        motor &&
        motorPositions.map((p, i) => (
          <mesh key={`m-${i}`} position={[p[0], 0.015, p[2]]}>
            <cylinderGeometry args={[0.012, 0.012, 0.02, 16]} />
            <meshStandardMaterial color="#c0c4cc" metalness={0.7} roughness={0.3} />
          </mesh>
        ))}

      {frame &&
        motor &&
        propeller &&
        motorPositions.map((p, i) => (
          <mesh key={`p-${i}`} position={[p[0], 0.03, p[2]]}>
            <cylinderGeometry args={[propRadius, propRadius, 0.003, 24]} />
            <meshStandardMaterial
              color="#ff8a3d"
              transparent
              opacity={0.55}
            />
          </mesh>
        ))}

      {frame && battery && (
        <mesh position={[0, 0.035, 0]}>
          <boxGeometry
            args={[wheelbaseM * 0.35, 0.025, wheelbaseM * 0.18]}
          />
          <meshStandardMaterial color="#3d6fff" />
        </mesh>
      )}

      <OrbitControls target={[0, 0, 0]} />
    </>
  );
}

function StatsPanel() {
  const build = useStore((s) => s.build);
  const setView = useStore((s) => s.setView);
  const flyBuild = useStore((s) => s.flyBuild);

  const config = useMemo(() => buildToConfig(build), [build]);
  const motor = getMotor(build.motorId);
  const battery = getBattery(build.batteryId);
  const warnings = useMemo(() => validateBuild(build), [build]);

  const stats = useMemo(() => {
    if (!config || !motor || !battery) return null;
    const totalWeight = config.totalMass + config.payloadMass;
    const maxThrust = config.motorCount * config.motorMaxThrust;
    const twr = maxThrust / totalWeight;
    const hoverThrottle = 1 / twr;
    const hoverThrottlePct = hoverThrottle * 100;

    let flightTimeText = "—";
    if (hoverThrottle <= 1) {
      const hoverCurrentPerMotor =
        motor.maxCurrent_a * Math.pow(hoverThrottle, 1.5);
      const totalCurrentA = hoverCurrentPerMotor * config.motorCount;
      if (totalCurrentA > 0) {
        const flightTimeMin =
          (battery.capacity_mah / 1000) / totalCurrentA * 60;
        flightTimeText = `${flightTimeMin.toFixed(1)} min`;
      }
    }

    return {
      totalWeight,
      maxThrust,
      twr,
      hoverThrottlePct,
      flightTimeText,
      canHover: hoverThrottle <= 1,
    };
  }, [config, motor, battery]);

  const hasHoverError = warnings.some(
    (w) => w.severity === "error" && w.message.includes("cannot hover"),
  );
  const exportDisabled = !config;
  const flyDisabled = !config || hasHoverError;

  const onExport = () => {
    if (!config) return;
    const json = JSON.stringify(config, null, 2);
    // eslint-disable-next-line no-console
    console.log("DroneConfig export:", config);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json).catch(() => {
        // clipboard may be unavailable in non-secure contexts; logged above
      });
    }
  };

  const onFly = () => {
    if (flyDisabled) return;
    flyBuild();
    // Defensive: flyBuild also flips view; setView covers any edge case.
    setView("flight");
  };

  return (
    <div className="stats-panel">
      <div className="panel">
        <div className="label">Live stats</div>
        {stats ? (
          <>
            <div>Total weight: {stats.totalWeight.toFixed(0)} g</div>
            <div>Max thrust: {stats.maxThrust.toFixed(0)} g</div>
            <div>TWR: {stats.twr.toFixed(1)}</div>
            <div>
              Hover throttle:{" "}
              {stats.canHover
                ? `${stats.hoverThrottlePct.toFixed(1)}%`
                : "—"}
            </div>
            <div>Flight time: {stats.flightTimeText}</div>
          </>
        ) : (
          <div className="muted">Pick a frame, motor, propeller, ESC and battery to see stats.</div>
        )}
      </div>

      <div className="panel">
        <div className="label">Validation</div>
        {warnings.length === 0 ? (
          <div className="muted">No issues detected.</div>
        ) : (
          <div className="warnings">
            {warnings.map((w, i) => (
              <div key={i} className={`warning ${w.severity}`}>
                {w.message}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="row">
          <button onClick={onExport} disabled={exportDisabled}>
            Export Config
          </button>
          <button onClick={onFly} disabled={flyDisabled}>
            Fly Mission
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AssemblyView() {
  const build = useStore((s) => s.build);
  const frame = getFrame(build.frameId);
  const motor = getMotor(build.motorId);
  const propeller = getPropeller(build.propellerId);
  const battery = getBattery(build.batteryId);

  return (
    <div className="assembly-grid">
      <CatalogPanel />
      <div className="preview-pane">
        <Canvas camera={{ position: [0.5, 0.4, 0.5], fov: 50 }}>
          <color attach="background" args={["#15171d"]} />
          <BuildPreview
            frame={frame}
            motor={motor}
            propeller={propeller}
            battery={battery}
          />
        </Canvas>
      </div>
      <StatsPanel />
    </div>
  );
}
