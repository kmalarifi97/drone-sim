from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_session
from ..models import StudentEvent
from ..schemas import EventCreate, EventCreated

router = APIRouter()


@router.post("/events", response_model=EventCreated)
def create_event(body: EventCreate, db: Session = Depends(get_session)) -> EventCreated:
    row = StudentEvent(
        student_id=body.student_id,
        session_id=body.session_id,
        attempt_number=body.attempt_number,
        event_type=body.event_type,
        payload=body.payload,
        concept_tag=body.concept_tag,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return EventCreated(id=row.id, created_at=row.created_at)
