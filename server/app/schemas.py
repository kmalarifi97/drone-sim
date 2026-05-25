from datetime import datetime
from typing import Literal, Optional, List
from uuid import UUID
from pydantic import BaseModel, Field

EventType = Literal["part_selected", "flight_started", "flight_ended", "crash_diagnosed"]


class EventCreate(BaseModel):
    student_id: UUID
    session_id: UUID
    attempt_number: int = Field(ge=1)
    event_type: EventType
    payload: dict
    concept_tag: Optional[str] = None


class EventCreated(BaseModel):
    id: UUID
    created_at: datetime


class DroneConfigIn(BaseModel):
    totalMass: float
    motorMaxThrust: float
    motorCount: int
    propDiameter: float
    dragCoefficient: float
    batteryCapacityMah: float
    batteryVoltage: float
    payloadMass: float
    batteryCells: int


class TelemetryIn(BaseModel):
    outcome: Literal["success", "crashed"]
    crash_reason_from_sim: Optional[str] = None
    peak_altitude_m: float
    peak_current_a: float
    peak_drift_m: float
    final_position: List[float]
    battery_remaining_mah: float
    elapsed_seconds: float
    collided_with_obstacle: bool
    esc_current_rating_a: float


class FlightCompleteIn(BaseModel):
    student_id: UUID
    session_id: UUID
    attempt_number: int = Field(ge=1)
    config: DroneConfigIn
    telemetry: TelemetryIn


class Diagnosis(BaseModel):
    cause: str
    concept_tag: Optional[str]
    explanation: str


class FlightCompleteOut(BaseModel):
    diagnosis: Diagnosis
    events_logged: List[str]
