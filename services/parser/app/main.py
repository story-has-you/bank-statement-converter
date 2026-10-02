"""HTTP entry point for the parser service."""

from fastapi import FastAPI

app = FastAPI(title="Bank Statement Parser")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
