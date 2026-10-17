"""
Criterios normativos de diseño y modelado hidráulico para redes de acueducto en Colombia.
Basado en la Resolución 0330 de 2017 (modificada por Resolución 0799 de 2021) - RAS.
Artículos 61 (Presión mínima dinámica) y 62 (Presión máxima estática).
"""
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field


class CriteriosRAS(BaseModel):
    fuente: str = "Res. 0330/2017 mod. Res. 0799/2021, arts. 61 y 62"
    
    # Artículo 61 - Presión mínima dinámica (m.c.a.)
    p_din_min: float = Field(10.0, description="Presión mínima requerida (m.c.a.)")
    p_din_tol10: float = Field(8.0, description="Tolerancia hasta 10% de nodos entre 8 y 10 m.c.a.")
    p_din_tol5: float = Field(5.0, description="Tolerancia hasta 5% de nodos entre 5 y 8 m.c.a.")
    
    # Artículo 62 - Presión máxima estática (m.c.a.)
    p_est_max: float = Field(50.0, description="Presión máxima estática permitida (m.c.a.)")
    p_est_tol10: float = Field(55.0, description="Tolerancia hasta 10% de nodos entre 50 y 55 m.c.a.")
    p_est_tol5: float = Field(60.0, description="Tolerancia hasta 5% de nodos entre 55 y 60 m.c.a.")


CRITERIOS_DEFAULT = CriteriosRAS()


def clasificar_presion_dinamica(p: float, c: CriteriosRAS = CRITERIOS_DEFAULT) -> str:
    """Clasifica la presión dinámica según el Artículo 61 del RAS."""
    if p < 0:
        return "negativa"
    if p < c.p_din_tol5:
        return "incumple"
    if p < c.p_din_tol10:
        return "tolerancia_5"
    if p < c.p_din_min:
        return "tolerancia_10"
    return "cumple"


def clasificar_presion_estatica(p: float, c: CriteriosRAS = CRITERIOS_DEFAULT) -> str:
    """Clasifica la presión estática según el Artículo 62 del RAS."""
    if p > c.p_est_tol5:
        return "incumple"
    if p > c.p_est_tol10:
        return "tolerancia_5"
    if p > c.p_est_max:
        return "tolerancia_10"
    return "cumple"


SEVERIDAD_CLASES = {
    "negativa": 0,
    "incumple": 1,
    "tolerancia_5": 2,
    "tolerancia_10": 3,
    "cumple": 4,
}


def evaluar_red_normativa(
    p_din: Dict[str, float],
    p_est: Optional[Dict[str, float]] = None,
    c: CriteriosRAS = CRITERIOS_DEFAULT
) -> Dict[str, Any]:
    """
    Evalúa integralmente la red frente a los artículos 61 y 62 del RAS.
    Retorna porcentaje de cumplimiento, estado por nodo y desglose estadístico.
    """
    if not p_din:
        return {
            "criterios": c.model_dump(),
            "pct_cumplimiento": 100.0,
            "cumple_art61": True,
            "cumple_art62": True,
            "clases_nodo": {},
            "resumen": {"cumple": 0, "tolerancia": 0, "incumple": 0, "negativa": 0}
        }

    n = len(p_din)
    clases_din = {k: clasificar_presion_dinamica(v, c) for k, v in p_din.items()}
    
    clases_est = {}
    if p_est:
        clases_est = {k: clasificar_presion_estatica(v, c) for k, v in p_est.items()}

    # Combinación de clase: peor de las dos para cada nodo
    clases_nodo = {}
    for k, cd in clases_din.items():
        ce = clases_est.get(k, "cumple")
        if SEVERIDAD_CLASES[cd] <= SEVERIDAD_CLASES[ce]:
            clases_nodo[k] = cd
        else:
            clases_nodo[k] = ce

    # Evaluación de tolerancias normativas
    frac = lambda d, cl: sum(1 for x in d.values() if x == cl) / n
    
    cumple_61 = (
        frac(clases_din, "incumple") == 0 and
        frac(clases_din, "negativa") == 0 and
        frac(clases_din, "tolerancia_10") <= 0.10 and
        frac(clases_din, "tolerancia_5") <= 0.05
    )

    cumple_62 = True
    if p_est:
        cumple_62 = (
            frac(clases_est, "incumple") == 0 and
            frac(clases_est, "tolerancia_10") <= 0.10 and
            frac(clases_est, "tolerancia_5") <= 0.05
        )

    # Porcentaje de nodos en cumplimiento pleno o aceptable (incluyendo tolerancias)
    nodos_aptos = sum(1 for c_node in clases_nodo.values() if c_node in ("cumple", "tolerancia_10", "tolerancia_5"))
    pct_cumplimiento = round((nodos_aptos / n) * 100, 1)

    conteo = {
        "cumple": sum(1 for x in clases_nodo.values() if x == "cumple"),
        "tolerancia_10": sum(1 for x in clases_nodo.values() if x == "tolerancia_10"),
        "tolerancia_5": sum(1 for x in clases_nodo.values() if x == "tolerancia_5"),
        "incumple": sum(1 for x in clases_nodo.values() if x == "incumple"),
        "negativa": sum(1 for x in clases_nodo.values() if x == "negativa"),
    }

    return {
        "criterios": c.model_dump(),
        "pct_cumplimiento": pct_cumplimiento,
        "cumple_art61": cumple_61,
        "cumple_art62": cumple_62,
        "clases_nodo": clases_nodo,
        "conteo": conteo,
    }
