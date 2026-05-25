import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Text } from '@react-three/drei';
import { useStore } from '../state/store';
import { presets, type PresetName } from '../configs/testConfigs';
import { deliveryMission } from '../mission/delivery';

function Drone() {
  const position = useStore((s) => s.state.position);
  return (
    <mesh position={position}>
      <boxGeometry args={[1.5, 0.5, 1.5]} />
      <meshStandardMaterial color="#ff8a3d" />
    </mesh>
  );
}

function MissionScene() {
  const waypoints = useStore((s) => s.mission.waypoints);
  const waypointIdx = useStore((s) => s.mission.waypointIdx);
  const status = useStore((s) => s.mission.status);

  const wd = deliveryMission.wind.direction;
  const ws = deliveryMission.wind.speed_ms;
  const [cx, , cz] = deliveryMission.customer;
  const obstacle = deliveryMission.obstacle;

  return (
    <>
      {/* Warehouse marker (green) */}
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[3, 3, 2, 24]} />
        <meshStandardMaterial color="#3dff8a" />
      </mesh>
      <Text position={[0, 6, 0]} fontSize={4} color="#3dff8a" anchorX="center">
        Warehouse
      </Text>

      {/* Customer marker (blue) */}
      <mesh position={[cx, 1, cz]}>
        <cylinderGeometry args={[5, 5, 2, 24]} />
        <meshStandardMaterial color="#3d8aff" />
      </mesh>
      <Text position={[cx, 8, cz]} fontSize={5} color="#3d8aff" anchorX="center">
        Customer
      </Text>

      {/* Building obstacle (gray) */}
      <mesh position={[obstacle.position[0], obstacle.height / 2, obstacle.position[2]]}>
        <boxGeometry args={[obstacle.width, obstacle.height, obstacle.width]} />
        <meshStandardMaterial color="#7a7d85" />
      </mesh>

      {/* Wind indicator */}
      <Text
        position={[500, 130, 0]}
        fontSize={8}
        color="#a0b8ff"
        anchorX="center"
      >
        {`Wind ${ws} m/s ${wd[0] < 0 ? '←' : '→'}`}
      </Text>

      {/* Waypoint markers */}
      {waypoints.map((wp, i) => {
        const isCurrent = i === waypointIdx && status === 'in_progress';
        const reached = i < waypointIdx || status === 'success';
        const color = isCurrent ? '#ffeb3b' : reached ? '#6ec077' : '#888';
        return (
          <mesh key={i} position={wp}>
            <sphereGeometry args={[isCurrent ? 4 : 2.5, 16, 16]} />
            <meshStandardMaterial
              color={color}
              emissive={isCurrent ? '#ffeb3b' : '#000'}
              emissiveIntensity={isCurrent ? 0.6 : 0}
              transparent
              opacity={0.75}
            />
          </mesh>
        );
      })}
    </>
  );
}

function SimLoop() {
  const stepSim = useStore((s) => s.stepSimulation);
  const stepMission = useStore((s) => s.stepMission);
  useFrame((_, delta) => {
    const status = useStore.getState().mission.status;
    if (status === 'in_progress') {
      stepMission(delta);
    } else if (status === 'idle') {
      stepSim(delta);
    }
    // status 'success' / 'crashed' => stop physics
  });
  return null;
}

function Scene({ missionActive }: { missionActive: boolean }) {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[200, 400, 200]} intensity={1} castShadow />
      <Grid
        args={missionActive ? [2400, 2400] : [30, 30]}
        cellColor="#555"
        sectionColor="#888"
        infiniteGrid={!missionActive}
      />
      <axesHelper args={[missionActive ? 50 : 2]} />
      <Drone />
      {missionActive && <MissionScene />}
      <OrbitControls
        target={missionActive ? [1000, 50, 0] : [0, 1, 0]}
      />
      <SimLoop />
    </>
  );
}

function StandaloneOverlay() {
  const config = useStore((s) => s.config);
  const state = useStore((s) => s.state);
  const throttle = useStore((s) => s.controls.throttle ?? 0);
  const setThrottle = useStore((s) => s.setThrottle);
  const setConfig = useStore((s) => s.setConfig);
  const reset = useStore((s) => s.reset);
  const setView = useStore((s) => s.setView);

  const twr =
    (config.motorCount * config.motorMaxThrust) /
    (config.totalMass + config.payloadMass);
  const altitude = state.position[1];
  const vy = state.velocity[1];
  const batteryPct = (state.batteryRemainingMah / config.batteryCapacityMah) * 100;
  const hoverThrottlePct = (1 / twr) * 100;

  return (
    <>
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
          <div>V up: {vy.toFixed(2)} m/s</div>
          <div>
            Battery: {state.batteryRemainingMah.toFixed(0)} / {config.batteryCapacityMah} mAh ({batteryPct.toFixed(1)}%)
          </div>
          <div>TWR: {twr.toFixed(2)}</div>
          <div>Hover throttle: {hoverThrottlePct.toFixed(1)}%</div>
        </div>
      </div>

      <div className="top-right">
        <button onClick={() => setView('assembly')}>Back to assembly</button>
      </div>
    </>
  );
}

function MissionOverlay() {
  const state = useStore((s) => s.state);
  const config = useStore((s) => s.config);
  const mission = useStore((s) => s.mission);
  const cancelMission = useStore((s) => s.cancelMission);

  const customer = deliveryMission.customer;
  const dx = state.position[0] - customer[0];
  const dy = state.position[1] - customer[1];
  const dz = state.position[2] - customer[2];
  const distToCustomer = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const batteryPct = (state.batteryRemainingMah / config.batteryCapacityMah) * 100;

  const finished = mission.status === 'success' || mission.status === 'crashed';

  return (
    <>
      <div className="overlay">
        <div className="panel">
          <div className="label">Mission</div>
          <div>Status: {mission.status}{mission.crashReason ? ` (${mission.crashReason})` : ''}</div>
          <div>Elapsed: {mission.elapsedSeconds.toFixed(1)}s / {deliveryMission.maxTimeSeconds}s</div>
          <div>
            Position: ({state.position[0].toFixed(1)}, {state.position[1].toFixed(1)}, {state.position[2].toFixed(1)}) m
          </div>
          <div>Waypoint: {Math.min(mission.waypointIdx + 1, mission.waypoints.length)} of {mission.waypoints.length}</div>
          <div>Altitude: {state.position[1].toFixed(1)} m</div>
          <div>Distance to customer: {distToCustomer.toFixed(1)} m</div>
          <div>Battery: {state.batteryRemainingMah.toFixed(0)} mAh ({batteryPct.toFixed(1)}%)</div>
        </div>
      </div>

      <div className="top-right">
        <button onClick={cancelMission}>Cancel mission</button>
      </div>

      {finished && (
        <div className="result-backdrop">
          <div className="result-panel">
            <div className={`result-outcome ${mission.status}`}>
              {mission.status === 'success' ? 'Delivery successful' : 'Mission failed'}
            </div>
            {mission.crashReason && (
              <div className="result-reason">Reason: {mission.crashReason}</div>
            )}
            <div className="result-stats">
              <div>Peak altitude: {mission.telemetry.peakAltitude.toFixed(1)} m</div>
              <div>
                Final position: {mission.telemetry.finalPosition
                  ? `(${mission.telemetry.finalPosition[0].toFixed(1)}, ${mission.telemetry.finalPosition[1].toFixed(1)}, ${mission.telemetry.finalPosition[2].toFixed(1)}) m`
                  : '—'}
              </div>
              <div>
                Battery remaining: {mission.telemetry.batteryRemainingMah.toFixed(0)} mAh ({((mission.telemetry.batteryRemainingMah / config.batteryCapacityMah) * 100).toFixed(1)}%)
              </div>
              <div>Peak current: {mission.telemetry.peakCurrentA.toFixed(1)} A</div>
              <div>Peak drift: {mission.telemetry.peakDrift.toFixed(1)} m</div>
              <div>Elapsed: {mission.elapsedSeconds.toFixed(1)} s</div>
            </div>
            <button onClick={cancelMission}>Back to assembly</button>
          </div>
        </div>
      )}
    </>
  );
}

export default function FlightView() {
  const missionStatus = useStore((s) => s.mission.status);
  const missionActive = missionStatus !== 'idle';
  const cameraProps = missionActive
    ? { position: [200, 200, 600] as [number, number, number], fov: 55, far: 5000 }
    : { position: [3, 3, 5] as [number, number, number], fov: 50, far: 1000 };

  return (
    <div className="root-wrap">
      <Canvas camera={cameraProps} shadows>
        <color attach="background" args={['#1a1d24']} />
        <Scene missionActive={missionActive} />
      </Canvas>
      {missionActive ? <MissionOverlay /> : <StandaloneOverlay />}
    </div>
  );
}
