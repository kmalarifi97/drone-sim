from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_session
from ..models import StudentEvent
from ..schemas import FlightCompleteIn, FlightCompleteOut, Diagnosis
from ..diagnosis import diagnose

router = APIRouter()


@router.post("/flights/complete", response_model=FlightCompleteOut)
def complete_flight(
    body: FlightCompleteIn, db: Session = Depends(get_session)
) -> FlightCompleteOut:
    cause, concept_tag, explanation, derived = diagnose(body.config, body.telemetry)

    flight_ended_payload = {
        "config": body.config.model_dump(),
        "telemetry": body.telemetry.model_dump(),
    }
    crash_payload = {
        "cause": cause,
        "concept_tag": concept_tag,
        "explanation": explanation,
        "derived": derived,
    }

    db.add(
        StudentEvent(
            student_id=body.student_id,
            session_id=body.session_id,
            attempt_number=body.attempt_number,
            event_type="flight_ended",
            payload=flight_ended_payload,
            concept_tag=None,
        )
    )
    db.add(
        StudentEvent(
            student_id=body.student_id,
            session_id=body.session_id,
            attempt_number=body.attempt_number,
            event_type="crash_diagnosed",
            payload=crash_payload,
            concept_tag=concept_tag,
        )
    )
    db.commit()

    return FlightCompleteOut(
        diagnosis=Diagnosis(cause=cause, concept_tag=concept_tag, explanation=explanation),
        events_logged=["flight_ended", "crash_diagnosed"],
    )
