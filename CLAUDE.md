# drone-sim

Educational drone-building app. Students pick real parts → assemble a drone → run a delivery mission with a PID autopilot → see crash diagnoses tied to engineering concepts. Every action logs to Postgres for teacher review.

## Current state (as of 2026-05-25)

- **Prompt 1: ✅ Done.** Evaluated three candidate flight sims. None had real drone physics — all were arcade flyers with magic-number tuning constants. See *Eval summary* below.
- **Prompt 2: ✅ Done.** `web/` builds clean (`tsc --noEmit` + `npm run build`), dev server serves at http://127.0.0.1:5173/. Flight scene with throttle slider, Small/Medium/Large config picker, telemetry overlay (altitude, vertical velocity, battery %, TWR, hover throttle %). Switching configs changes hover throttle from 31% (Small) → 36% (Medium) → 52% (Large), and acceleration scales accordingly.
- **Prompt 3: ✅ Done.** Parts assembly playground at `src/assembly/`. 18 real parts (3 frames, 4 motors, 4 props, 3 ESCs, 4 batteries) in `src/parts/parts.json`. Three-panel UI: catalog tabs / 3D drone preview / live stats + validation + export. `buildToConfig()` produces `DroneConfig`; `validateBuild()` flags ESC overcurrent, voltage min/max, can't-hover, low TWR, prop-size mismatch. View toggle assembly↔flight via store. Smoke test: QAV-S 5" + F40 PRO IV 2400KV + HQProp 5x4.3x3 + BLHeli32 50A 4-in-1 + Tattu 4S 1300 + 0g payload → totalMass=460g, TWR=11.48.
- **Prompts 4–5: ⬜ Pending.** Briefs below.

## Architectural decisions

### Path B chosen (no fork)

All three candidate sims (`droneWorld`, `drone-simulator`, `quadwebgl`) lack real drone physics — no per-motor thrust, no mass, no aerodynamic drag, no battery. Forking any of them would require writing a flight model from scratch **anyway**, while also maintaining a vanilla-Three codebase separate from the React+R3F assembly UI that Prompt 3 mandates. Prompt 4 would then need cross-app plumbing (postMessage / shared state across an iframe or route).

**Path B:** one R3F app under `web/` that hosts both the assembly playground (Prompt 3) and the flight scene (Prompt 4). Prompt 4 becomes a route change instead of cross-app messaging. Scene visuals (terrain bumps, building boxes) get written directly in R3F — replicating what the candidates render is ~1 hour of R3F vs days of integration headache.

### Eval summary (Prompt 1 deliverable)

| Repo | Runs? | Stack | Physics | License | Last commit | Why rejected |
|---|---|---|---|---|---|---|
| `droneWorld` | ❌ build failed | CRA + webpack 4 + Rust/WASM, Node ≤14 | None (drone glued to camera, enemies on `Math.sin` curves) | MIT | 2020-06-27 (~5y dormant) | Dead toolchain; Rust dep; no physics |
| `drone-simulator` | ✅ ran on :5174 | Vite + ES modules + vanilla Three.js | None (`THRUST=0.015, DRAG=0.90` arcade constants, `main.js:276-279`) | None (README claims MIT, no LICENSE file) | 2025-05-29 (single-commit drop) | No model to extend; legally ambiguous; no iteration history |
| `quadwebgl` | ✅ ran on :5175 | No build, vendored old Three.js, global vars | None (no gravity at all; `vy=(vy+(-mouseZ)/6000)*0.95`, `3dgame.js:140`) | LGPL (4-char `LICENSE` file) | 2016-02-26 (~10y abandoned) | Decade dead; needs gamepad; ancient Three.js; un-extendable |

Source is vendored under `candidates/` for reference (their original `.git/` removed; re-clone from upstream URLs in `git log` if needed). **Servers are NOT running** — start with `cd candidates/drone-simulator && npx vite --port 5174` or `python3 -m http.server 5175` in `candidates/quadwebgl`.

### Stack (hard contract — do not substitute)

- **Web:** React 18 + TypeScript + Vite, `three` + `@react-three/fiber` + `@react-three/drei`, `zustand`
- **Backend (Prompt 5):** FastAPI + SQLAlchemy + Alembic, PostgreSQL
- **Dev:** Native Node 23 / npm 10 for Prompts 2–4. Docker Compose enters in Prompt 5 (Postgres + FastAPI). Vite HMR runs native, not in Docker.

### DroneConfig schema (cross-prompt contract — units matter)

```ts
type DroneConfig = {
  totalMass: number;         // grams (frame+electronics+battery, NOT incl. payload)
  motorMaxThrust: number;    // grams, PER MOTOR
  motorCount: number;
  propDiameter: number;      // inches
  dragCoefficient: number;   // dimensionless Cd
  batteryCapacityMah: number;
  batteryVoltage: number;    // nominal V
  payloadMass: number;       // grams
}
```

This object is what the assembly UI exports and what the flight sim consumes. Don't change field names or units without a deliberate refactor across prompts.

## Resume on another machine

```bash
git clone git@github.com:kmalarifi97/drone-sim.git
cd drone-sim/web
npm install
npm run dev   # http://localhost:5173
```

**First action:** verify the unverified Prompt 2 scaffold. If `npx tsc --noEmit` errors or the dev server shows a broken page, fix before moving to Prompt 3.

## Build sequence (the 5 prompts)

### Prompt 1 — Evaluate candidates ✅ done
Clone droneWorld / drone-simulator / quadwebgl, run each, produce comparison summary. Outcome: path B chosen (no fork). See *Eval summary* above.

### Prompt 2 — DroneConfig + physics ✅ done
Vite+TS+R3F+Zustand app at `web/`. `DroneConfig` defined. `stepPhysics(state, config, controls, dt)` integrates gravity + thrust + quadratic drag + battery drain (with ground clamp at y=0). Flight test page has throttle slider, Small/Medium/Large config picker, telemetry (altitude, vertical velocity, battery %, TWR, hover throttle %).

### Prompt 3 — Parts assembly playground ✅ done
React UI on top of Prompt 2. `parts.json` with real specs (T-Motor / Lumenier / Tattu, 18 parts). Three-panel layout: catalog tabs (left) / 3D drone preview (center) / live stats + validation + export (right). `buildToConfig()` → `DroneConfig`; `validateBuild()` returns non-blocking warn/error list. "Fly Mission" button calls `flyBuild()` → sets config and switches `view` to `'flight'`.

### Prompt 4 — Delivery mission + autopilot ⬜
Render mission in flight scene: warehouse `[0,0,0]`, customer `[2000,0,0]`, building obstacle `{position:[1000,0,0], height:90, width:40}`, wind `{direction:[-1,0,0], speed_ms:4}`, payload 200g, max 300s. PID waypoint-following autopilot (student doesn't fly manually). "Fly mission" button launches the sim with exported config + mission. Surface outcome (`success` or `crashed`) + telemetry (peak altitude, final position, battery state, peak current, peak drift). **Done when:** build → click fly → watch autopilot → see outcome with telemetry.

### Prompt 5 — Diagnosis + event logging ⬜
Add `server/` with FastAPI + SQLAlchemy + Alembic + Postgres + Docker Compose. Implement diagnosis ruleset against flight telemetry from Prompt 4:

| Cause | Detection rule | Concept tag |
|---|---|---|
| `insufficient_climb_rate` | hit obstacle while climbing AND TWR < 1.5 | `thrust_to_weight` |
| `battery_depleted` | cell voltage < 3.3V before reaching customer | `energy_budget` |
| `esc_overcurrent` | peak current > ESC rating at any point | `esc_sizing` |
| `wind_drift` | drifted > 10m off path AND lateral TWR < 2.0 | `control_authority` |
| `payload_too_heavy` | hover throttle > 75% with payload | `payload_capacity` |
| `prop_mismatch` | static thrust insufficient at chosen KV/voltage | `prop_selection` |
| `success` | reached customer within time limit | — |

Event log schema:
```sql
CREATE TABLE student_events (
  id UUID PRIMARY KEY,
  student_id UUID NOT NULL,
  session_id UUID NOT NULL,
  attempt_number INT NOT NULL,
  event_type TEXT NOT NULL,   -- 'part_selected' | 'flight_started' | 'flight_ended' | 'crash_diagnosed'
  payload JSONB NOT NULL,
  concept_tag TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Log every part selection, flight attempt, and diagnosis. Show student a human-readable crash explanation. **Done when:** `SELECT * FROM student_events WHERE student_id = '...'` returns every attempt and where the student got stuck.

## Repository layout

- `web/` — React+TS+Vite+R3F app
  - `src/App.tsx` — thin view router (assembly ↔ flight)
  - `src/physics/drone.ts` — `DroneConfig` + `stepPhysics()`
  - `src/state/store.ts` — Zustand store (view, build, config, state, controls)
  - `src/configs/testConfigs.ts` — Small/Medium/Large `DroneConfig` presets (used by FlightView)
  - `src/parts/parts.json` + `src/parts/types.ts` + `src/parts/catalog.ts` — parts data
  - `src/assembly/` — `AssemblyView`, `buildToConfig`, `validate`, `Build` type
  - `src/flight/FlightView.tsx` — flight scene + telemetry overlay (Prompt 2 UI)
- `candidates/` — vendored eval source (read-only reference)
- `server/` — does not exist yet; appears in Prompt 5 alongside `docker-compose.yml`

## Conventions

- **No commits to `main`** for code work. Bootstrap commits (initial scaffold, this CLAUDE.md, vendor housekeeping) are exempted as housekeeping. Code work goes on `prompt-N-<slug>` branches.
- **`node_modules/` is ignored everywhere** (`**/node_modules/`). Never check in.
- **Generic names in code** — don't bake `drone-sim` into identifiers; use `physics`, `store`, `web` etc. (Brand names belong only in `<title>`, README, marketing copy.)
- **Functional changes only.** No drive-by renames, no speculative abstractions.
- **Verify before claiming done.** "It should work" doesn't count — actually start the dev server, hit the endpoint, watch the drone fly.
