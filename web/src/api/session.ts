// Session + student identifiers for event logging.
// v0: STUDENT_ID is a hardcoded constant; SESSION_ID is generated once per app load.

export const STUDENT_ID = "00000000-0000-0000-0000-000000000001";

export const SESSION_ID =
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "00000000-0000-0000-0000-000000000002";

let _attempt = 0;

export const attemptCounter = {
  current(): number {
    return _attempt;
  },
  nextAttempt(): number {
    _attempt += 1;
    return _attempt;
  },
};
