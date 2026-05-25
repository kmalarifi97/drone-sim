from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import events, flights

app = FastAPI(title="drone-events-api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(events.router)
app.include_router(flights.router)


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}
