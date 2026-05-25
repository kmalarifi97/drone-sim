// Thin fetch wrapper for the events API. Non-blocking by design — every caller
// wraps these in try/catch so an API failure never breaks the flight sim.

const BASE_URL = "http://localhost:8000";

export type EventType =
  | "part_selected"
  | "flight_started"
  | "flight_ended"
  | "crash_diagnosed";

export type EventPayload = {
  student_id: string;
  session_id: string;
  attempt_number: number;
  event_type: EventType;
  payload: Record<string, unknown>;
  concept_tag?: string | null;
};

export type FlightCompletePayload = {
  student_id: string;
  session_id: string;
  attempt_number: number;
  config: Record<string, unknown>;
  telemetry: Record<string, unknown>;
};

export type Diagnosis = {
  cause: string;
  concept_tag: string | null;
  explanation: string;
};

export type FlightCompleteResponse = {
  diagnosis: Diagnosis;
  events_logged: string[];
};

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST ${path} ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export function logEvent(payload: EventPayload): Promise<{ id: string; created_at: string }> {
  return postJson("/events", payload);
}

export function completeFlight(payload: FlightCompletePayload): Promise<FlightCompleteResponse> {
  return postJson("/flights/complete", payload);
}
