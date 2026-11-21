import os
from contextlib import asynccontextmanager
from typing import Optional, Union

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from predecir import cargar_modelo, predecir


class Historial30d(BaseModel):
    citas_cerradas: int = Field(default=0, ge=0)
    no_shows: int = Field(default=0, ge=0)


class RegistroCita(BaseModel):
    id_cita: Optional[str] = None
    id_cliente: Optional[str] = None
    servicio: str
    sede: str
    fecha_hora_cita: str
    fecha_hora_registro: str
    recordatorio_enviado_en: Optional[str] = None
    confirmada_en: Optional[str] = None
    historial_30d: Optional[Historial30d] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    cargar_modelo()
    yield


app = FastAPI(
    title="API Predicción No-Show · LA CASCADA E.I.R.L.",
    version="1.0.0",
    lifespan=lifespan,
)

origenes_env = os.getenv("ALLOWED_ORIGINS", "")
origenes_extra = [o.strip() for o in origenes_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://lacascada-4k39.vercel.app",
        *origenes_extra,
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    bundle = cargar_modelo()
    return {
        "status": "ok",
        "version_modelo": bundle.get("version_modelo"),
        "nombre_modelo": bundle.get("nombre_modelo"),
        "umbral": bundle.get("umbral"),
        "sklearn": bundle.get("sklearn"),
    }


@app.post("/predecir")
def endpoint_predecir(payload: Union[RegistroCita, list[RegistroCita]]):
    try:
        if isinstance(payload, list):
            return [predecir(item.model_dump()) for item in payload]
        return predecir(payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error interno: {exc}") from exc