import { useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'
import { useMapStore, LAYERS } from '../../store/mapStore'

// Coordenadas del casco urbano de Labateca
const LABATECA_CENTER = [-72.4845, 7.3375]
const LABATECA_ZOOM   = 15

// Datos de demostración (se reemplazan al importar el shapefile real)
const DEMO_DATA = {
  tuberias: {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { codigo: 'TUB-001', diametro_mm: 75, material: 'PVC', estado: 'Bueno'   }, geometry: { type: 'LineString', coordinates: [[-72.4870,7.3385],[-72.4840,7.3385]] }},
      { type: 'Feature', properties: { codigo: 'TUB-002', diametro_mm: 50, material: 'PVC', estado: 'Regular' }, geometry: { type: 'LineString', coordinates: [[-72.4840,7.3385],[-72.4820,7.3380]] }},
      { type: 'Feature', properties: { codigo: 'TUB-003', diametro_mm: 100,material: 'AC',  estado: 'Malo'    }, geometry: { type: 'LineString', coordinates: [[-72.4870,7.3385],[-72.4870,7.3360]] }},
      { type: 'Feature', properties: { codigo: 'TUB-004', diametro_mm: 75, material: 'PVC', estado: 'Bueno'   }, geometry: { type: 'LineString', coordinates: [[-72.4870,7.3360],[-72.4840,7.3360]] }},
      { type: 'Feature', properties: { codigo: 'TUB-005', diametro_mm: 50, material: 'HF',  estado: 'Bueno'   }, geometry: { type: 'LineString', coordinates: [[-72.4840,7.3385],[-72.4840,7.3360]] }},
      { type: 'Feature', properties: { codigo: 'TUB-006', diametro_mm: 50, material: 'PVC', estado: 'Regular' }, geometry: { type: 'LineString', coordinates: [[-72.4840,7.3360],[-72.4820,7.3360]] }},
    ],
  },
  nodos: {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { codigo: 'NOD-001', tipo: 'Union',    cota_msnm: 1450, demanda_base_lps: 0.5 }, geometry: { type: 'Point', coordinates: [-72.4870,7.3385] }},
      { type: 'Feature', properties: { codigo: 'NOD-002', tipo: 'Tee',      cota_msnm: 1448, demanda_base_lps: 0.3 }, geometry: { type: 'Point', coordinates: [-72.4840,7.3385] }},
      { type: 'Feature', properties: { codigo: 'NOD-003', tipo: 'Conexion', cota_msnm: 1445, demanda_base_lps: 0.8 }, geometry: { type: 'Point', coordinates: [-72.4820,7.3380] }},
      { type: 'Feature', properties: { codigo: 'NOD-004', tipo: 'Union',    cota_msnm: 1440, demanda_base_lps: 0.2 }, geometry: { type: 'Point', coordinates: [-72.4870,7.3360] }},
      { type: 'Feature', properties: { codigo: 'NOD-005', tipo: 'Tee',      cota_msnm: 1438, demanda_base_lps: 0.6 }, geometry: { type: 'Point', coordinates: [-72.4840,7.3360] }},
      { type: 'Feature', properties: { codigo: 'NOD-006', tipo: 'Conexion', cota_msnm: 1435, demanda_base_lps: 0.4 }, geometry: { type: 'Point', coordinates: [-72.4820,7.3360] }},
    ],
  },
  valvulas: {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { codigo: 'VAL-001', tipo: 'PRV', estado: 'Abierta', diametro_mm: 75 }, geometry: { type: 'Point', coordinates: [-72.4855,7.3385] }},
      { type: 'Feature', properties: { codigo: 'VAL-002', tipo: 'TCV', estado: 'Abierta', diametro_mm: 50 }, geometry: { type: 'Point', coordinates: [-72.4855,7.3360] }},
    ],
  },
  tanques: {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { codigo: 'TAN-001', nombre: 'Tanque Principal', capacidad_m3: 150, estado: 'Operativo' }, geometry: { type: 'Point', coordinates: [-72.4875,7.3393] }},
    ],
  },
  fuentes: {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { codigo: 'FUE-001', nombre: 'Bocatoma Labateca', tipo: 'Bocatoma', caudal_disponible_lps: 8 }, geometry: { type: 'Point', coordinates: [-72.4880,7.3400] }},
    ],
  },
}

const ESTADO_COLORS = { Bueno: '#22c55e', Regular: '#f59e0b', Malo: '#ef4444', Critico: '#dc2626', Desconocido: '#94a3b8' }

export default function MapViewer({ onFeatureClick }) {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const draw = useRef(null)
  const popup = useRef(null)
  const { visibleLayers, setSelectedFeature, setDrawnFeature } = useMapStore()

  // Inicializar mapa
  useEffect(() => {
    if (map.current) return

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: LABATECA_CENTER,
      zoom: LABATECA_ZOOM,
    })

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.current.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right')
    map.current.addControl(new maplibregl.GeolocateControl(), 'top-right')

    popup.current = new maplibregl.Popup({ closeButton: true, maxWidth: '280px' })

    // Inicializar MapboxDraw
    draw.current = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        point: true,
        line_string: true,
        polygon: true,
        trash: true
      }
    })
    // Colocarlo a la derecha donde están los otros controles (así heredan mejor los estilos por defecto de Mapbox si hay conflicto de CSS)
    map.current.addControl(draw.current, 'top-right')

    map.current.on('load', () => {
      addSources()
      addLayers()
      addClickHandlers()
      addDrawHandlers()
    })

    return () => { map.current?.remove(); map.current = null; draw.current = null }
  }, [])

  const addDrawHandlers = () => {
    const updateDraw = (e) => {
      const data = draw.current.getAll()
      if (data.features.length > 0) {
        // Enviar la última geometría dibujada/modificada al store
        setDrawnFeature(data.features[data.features.length - 1])
      } else {
        setDrawnFeature(null)
      }
    }
    map.current.on('draw.create', updateDraw)
    map.current.on('draw.update', updateDraw)
    map.current.on('draw.delete', updateDraw)
  }

  const addSources = () => {
    const m = map.current
    Object.keys(DEMO_DATA).forEach((key) => {
      if (!m.getSource(key)) {
        m.addSource(key, { type: 'geojson', data: DEMO_DATA[key] })
      }
    })
  }

  const addLayers = () => {
    const m = map.current

    // Tuberías — líneas coloreadas por estado
    m.addLayer({
      id: 'tuberias-layer',
      type: 'line',
      source: 'tuberias',
      paint: {
        'line-color': ['match', ['get', 'estado'],
          'Bueno', ESTADO_COLORS.Bueno, 'Regular', ESTADO_COLORS.Regular,
          'Malo', ESTADO_COLORS.Malo, 'Critico', ESTADO_COLORS.Critico,
          ESTADO_COLORS.Desconocido,
        ],
        'line-width': ['interpolate', ['linear'], ['zoom'], 12, 2, 16, 5],
        'line-opacity': .9,
      },
    })

    // Halo de selección
    m.addLayer({
      id: 'tuberias-highlight',
      type: 'line',
      source: 'tuberias',
      filter: ['==', 'codigo', ''],
      paint: { 'line-color': '#fff', 'line-width': 8, 'line-opacity': .4 },
    })

    // Nodos — círculos
    m.addLayer({
      id: 'nodos-layer',
      type: 'circle',
      source: 'nodos',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 4, 16, 8],
        'circle-color': LAYERS.nodos.color,
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 1.5,
      },
    })

    // Válvulas
    m.addLayer({
      id: 'valvulas-layer',
      type: 'circle',
      source: 'valvulas',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 5, 16, 10],
        'circle-color': LAYERS.valvulas.color,
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 2,
      },
    })

    // Tanques
    m.addLayer({
      id: 'tanques-layer',
      type: 'circle',
      source: 'tanques',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 7, 16, 14],
        'circle-color': LAYERS.tanques.color,
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 2,
      },
    })

    // Fuentes
    m.addLayer({
      id: 'fuentes-layer',
      type: 'circle',
      source: 'fuentes',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 8, 16, 16],
        'circle-color': LAYERS.fuentes.color,
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 2.5,
      },
    })
  }

  const buildPopupHTML = (layerKey, props) => {
    const rows = Object.entries(props)
      .filter(([k]) => !['id'].includes(k))
      .map(([k, v]) => `<div class="map-popup-row"><span class="map-popup-key">${k}</span><span class="map-popup-val">${v ?? '—'}</span></div>`)
      .join('')
    return `<div class="map-popup"><div class="map-popup-title">${LAYERS[layerKey]?.icon} ${props.codigo || props.nombre || layerKey}</div>${rows}</div>`
  }

  const addClickHandlers = () => {
    const m = map.current
    const clickableLayers = [
      ['tuberias-layer', 'tuberias'],
      ['nodos-layer', 'nodos'],
      ['valvulas-layer', 'valvulas'],
      ['tanques-layer', 'tanques'],
      ['fuentes-layer', 'fuentes'],
    ]

    clickableLayers.forEach(([layerId, sourceKey]) => {
      m.on('click', layerId, (e) => {
        const feat = e.features[0]
        setSelectedFeature({ ...feat.properties, _layer: sourceKey })
        onFeatureClick?.({ ...feat.properties, _layer: sourceKey })
        popup.current
          .setLngLat(e.lngLat)
          .setHTML(buildPopupHTML(sourceKey, feat.properties))
          .addTo(m)
      })
      m.on('mouseenter', layerId, () => { m.getCanvas().style.cursor = 'pointer' })
      m.on('mouseleave', layerId, () => { m.getCanvas().style.cursor = '' })
    })
  }

  // Sincronizar visibilidad de capas
  useEffect(() => {
    if (!map.current?.isStyleLoaded()) return
    const layerMap = {
      tuberias: 'tuberias-layer', nodos: 'nodos-layer',
      valvulas: 'valvulas-layer', tanques: 'tanques-layer', fuentes: 'fuentes-layer',
    }
    Object.entries(visibleLayers).forEach(([key, visible]) => {
      const lid = layerMap[key]
      if (map.current.getLayer(lid)) {
        map.current.setLayoutProperty(lid, 'visibility', visible ? 'visible' : 'none')
      }
    })
  }, [visibleLayers])

  return (
    <div ref={mapContainer} style={{ width: '100%', height: '100%' }}>
      {/* Badge de demo */}
      <div style={{
        position: 'absolute', bottom: 30, left: 20, zIndex: 5,
        background: 'rgba(245,158,11,.15)', border: '1px solid rgba(245,158,11,.4)',
        color: '#fcd34d', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600,
      }}>
        ⚠ Datos de demostración — importe el shapefile para ver la red real
      </div>
    </div>
  )
}
