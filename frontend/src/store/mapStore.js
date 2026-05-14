import { create } from 'zustand'

export const LAYERS = {
  tuberias: { id: 'tuberias', label: 'Tuberías',  color: '#38bdf8', icon: '〰️' },
  nodos:    { id: 'nodos',    label: 'Nodos',      color: '#34d399', icon: '⬤'  },
  valvulas: { id: 'valvulas', label: 'Válvulas',   color: '#fb923c', icon: '◆'  },
  tanques:  { id: 'tanques',  label: 'Tanques',    color: '#a78bfa', icon: '▣'  },
  fuentes:  { id: 'fuentes',  label: 'Fuentes',    color: '#f472b6', icon: '★'  },
  danos:    { id: 'danos',    label: 'Daños',      color: '#dc2626', icon: '⚠️'  },
}

export const useMapStore = create((set) => ({
  // Capas visibles
  visibleLayers: { tuberias: true, nodos: true, valvulas: true, tanques: true, fuentes: true, danos: true },
  toggleLayer: (id) =>
    set((s) => ({ visibleLayers: { ...s.visibleLayers, [id]: !s.visibleLayers[id] } })),

  // Feature seleccionado (clic en el mapa)
  selectedFeature: null,
  setSelectedFeature: (f) => set({ selectedFeature: f }),

  // Resultados de simulación activa (para colorear la red)
  simulationResults: null,
  setSimulationResults: (r) => set({ simulationResults: r }),

  // Estilo de coloración activo
  colorBy: 'none', // 'none' | 'presion' | 'velocidad' | 'estado' | 'material'
  setColorBy: (v) => set({ colorBy: v }),

  // Geometría dibujada recientemente (para modo edición/creación)
  drawnFeature: null,
  setDrawnFeature: (f) => set({ drawnFeature: f }),

  // Acciones de la herramienta de dibujo (disparadas desde Sidebar)
  drawAction: null,
  triggerDrawAction: (type, value) => set({ drawAction: { type, value, timestamp: Date.now() } }),
}))
