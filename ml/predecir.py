'''predecir.py · APF3 Grupo 04 · LA CASCADA E.I.R.L.
Carga el modelo exportado y devuelve la probabilidad de no-show de una cita con el esquema del MVP.
Uso:   python predecir.py ejemplo_entrada.json        (acepta un objeto o una lista de objetos)
Import: from predecir import predecir
'''
import os, sys, json, warnings
import joblib
import sklearn
import numpy as np
import pandas as pd

RUTA_MODELO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "modelo_no_show.joblib")
TZ = "America/Lima"
DIAS = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"]
SERVICIOS, SEDES = {"sauna", "gimnasio"}, {"Túpac Amaru", "Santa Rosa", "Año Nuevo"}
_BUNDLE = None


def cargar_modelo(ruta=RUTA_MODELO):
    global _BUNDLE
    if _BUNDLE is None:
        _BUNDLE = joblib.load(ruta)
        if _BUNDLE.get("sklearn") != sklearn.__version__:
            warnings.warn(f"El modelo se entrenó con scikit-learn {_BUNDLE.get('sklearn')} y se carga con {sklearn.__version__}; "
                          "instala la misma versión (ver requirements.txt).")
    return _BUNDLE


def _ts(valor):
    return None if valor in (None, "") else pd.Timestamp(valor).tz_convert(TZ) if pd.Timestamp(valor).tzinfo else pd.Timestamp(valor).tz_localize(TZ)


def construir_features(r):
    # Misma lógica que la preparación del notebook (evita desfase entre entrenamiento y producción).
    faltan = [k for k in ("servicio", "sede", "fecha_hora_cita", "fecha_hora_registro") if not r.get(k)]
    if faltan:
        raise ValueError(f"Faltan campos obligatorios: {faltan}")
    if r["servicio"] not in SERVICIOS or r["sede"] not in SEDES:
        raise ValueError("servicio o sede fuera de los valores permitidos")
    cita, reg = _ts(r["fecha_hora_cita"]), _ts(r["fecha_hora_registro"])
    if cita < reg:
        raise ValueError("fecha_hora_cita no puede ser anterior a fecha_hora_registro")
    h = r.get("historial_30d") or {}
    n = int(h.get("citas_cerradas", 0)); ns = int(h.get("no_shows", 0))
    if ns > n:
        raise ValueError("historial_30d: no_shows no puede superar citas_cerradas")
    fila = {
        "antelacion_h": float(np.clip((cita - reg).total_seconds() / 3600, 0, 720)),
        "hora_cita": cita.hour + cita.minute / 60,
        "tasa_previa_no_show": ns / n if n > 0 else np.nan,
        "n_citas_previas": n,
        "servicio": r["servicio"],
        "sede": "Túpac Amaru" if r["sede"] == "Año Nuevo" else r["sede"],
        "dia_semana": DIAS[cita.dayofweek],
        "recordatorio_enviado": int(bool(r.get("recordatorio_enviado_en"))),
        "confirmada": int(bool(r.get("confirmada_en"))),
        "fin_de_semana": int(cita.dayofweek >= 5),
    }
    return pd.DataFrame([fila])


def predecir(registro):
    b = cargar_modelo()
    X = construir_features(registro)[b["features"]]
    p = float(b["pipeline"].predict_proba(X)[:, 1][0])
    alto = p >= b["umbral"]
    return {
        "id_cita": registro.get("id_cita"),
        "prob_no_show": round(p, 4),
        "umbral": b["umbral"],
        "pred_no_show": int(alto),
        "nivel_riesgo": "alto" if alto else "bajo",
        "accion_sugerida": ("Enviar recordatorio por WhatsApp (wa.me) y pedir confirmación; priorizar en «Citas por recordar»"
                            if alto else "Sin acción adicional"),
        "version_modelo": b["version_modelo"],
    }


if __name__ == "__main__":
    ruta = sys.argv[1] if len(sys.argv) > 1 else "ejemplo_entrada.json"
    with open(ruta, encoding="utf-8") as f:
        datos = json.load(f)
    salida = [predecir(x) for x in datos] if isinstance(datos, list) else predecir(datos)
    print(json.dumps(salida, ensure_ascii=False, indent=2))
