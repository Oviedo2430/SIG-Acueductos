"""
Helper para conversión entre GeoAlchemy2 y GeoJSON.
"""
from geoalchemy2.shape import to_shape, from_shape
from shapely.geometry import shape, mapping


def geom_to_geojson(geom) -> dict | None:
    """GeoAlchemy2 WKB → dict GeoJSON."""
    if geom is None:
        return None
    return mapping(to_shape(geom))


def geojson_to_geom(geojson: dict, srid: int = 4326):
    """dict GeoJSON → GeoAlchemy2 WKB para inserción."""
    return from_shape(shape(geojson), srid=srid)
