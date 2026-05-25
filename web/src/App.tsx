import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { useStore } from './state/store';
import { presets, type PresetName } from './configs/testConfigs';

function Drone() {
  const position = useStore((s) => s.state.position);
  return (
    <mesh position={position}>
      <boxGeometry args={[0.3, 0.1, 0.3]} />
      <meshStandardMaterial color="#ff8a3d" />
    </mesh>
  );
}

function PhysicsLoop() {
  const step = useStore((s) => s.stepSimulation);
  useFrame((_, delta) => step(delta));
  return null;
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
      <Grid args={[30, 30]} cellColor="#555" sectionColor="#888" infiniteGrid />
      <axesHelper args={[2]} />
      <Drone />
      <OrbitControls target={[0, 1, 0]} />
      <PhysicsLoop />
    </>
  );
}

function Overlay() {
  const config = useStore((s) => s.config);
  const state = useStore((s) => s.state);
  const throttle = useStore((s) => s.controls.throttle);
  const setThrottle = useStore((s) => s.setThrottle);
  const setConfig = useStore((s) => s.setConfig);
  const reset = useStore((s) => s.reset);

  const twr =
    (config.motorCount * config.motorMaxThrust) /
    (config.totalMass + config.payloadMass);
  const altitude = state.position[1];
  const vy = state.velocity[1];
  const batteryPct = (state.batteryRemainingMah / config.batteryCapacityMah) * 100;
  const hoverThrottlePct = (1 / twr) * 100;

  return (
    <div className="overlay">
      <div className="panel">
        <div className="label">Config</div>
        <div className="row">
          {(['Small', 'Medium', 'Large'] as PresetName[]).map((name) => (
            <button key={name} onClick={() => setConfig(presets[name])}>
              {name}
            </button>
          ))}
          <button onClick={reset}>Reset</button>
        </div>
      </div>

      <div className="panel">
        <div className="label">Throttle: {throttle.toFixed(2)}</div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={throttle}
          onChange={(e) => setThrottle(+e.target.value)}
        />
      </div>

      <div className="panel">
        <div>Altitude: {altitude.toFixed(2)} m</div>
        <div>V↑: {vy.toFixed(2)} m/s</div>
        <div>
          Battery: {state.batteryRemainingMah.toFixed(0)} / {config.batteryCapacityMah} mAh ({batteryPct.toFixed(1)}%)
        </div>
        <div>TWR: {twr.toFixed(2)}</div>
        <div>Hover throttle: {hoverThrottlePct.toFixed(1)}%</div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div className="root-wrap">
      <Canvas camera={{ position: [3, 3, 5], fov: 50 }} shadows>
        <color attach="background" args={['#1a1d24']} />
        <Scene />
      </Canvas>
      <Overlay />
    </div>
  );
}
