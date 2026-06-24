// services/units.js
// Capa de servicio para conversiones de unidades y factores.
// Reexporta las unidades basicas de window.PRESENTACIONES_POR_UNIDAD
// (definidas en units.js antiguo) y agrega helpers de conversion.

// Unidades de medida permitidas
export const UNITS = ['unidad','kg','g','lb','L','mL','porcion','paquete','docena','caja'];

// Sugeridas por categoria
export const UNIDADES_POR_CATEGORIA = {
  'Carnes y Aves': ['kg', 'lb', 'g', 'porcion'],
  'Verduras y Tuberculos': ['kg', 'lb', 'g', 'unidad'],
  'Lacteos y Huevos': ['kg', 'L', 'paquete', 'docena', 'g', 'mL'],
  'Salsas y Aderezos': ['L', 'mL', 'g', 'unidad', 'paquete'],
  'Harinas y Panes': ['kg', 'g', 'unidad', 'paquete', 'lb'],
  'Bebidas': ['L', 'mL', 'unidad', 'paquete', 'caja'],
  'Empaques y Desechables': ['paquete', 'unidad', 'caja']
};

export const UNIDAD_LABELS = {
  unidad: 'Unidad', kg: 'Kilogramo (kg)', g: 'Gramo (g)', lb: 'Libra (lb)',
  L: 'Litro (L)', mL: 'Mililitro (mL)', porcion: 'Porción',
  paquete: 'Paquete', docena: 'Docena', caja: 'Caja'
};

// Devuelve las presentaciones disponibles para una unidad base.
// Usa window.PRESENTACIONES_POR_UNIDAD si esta disponible; si no, retorna
// un set por defecto.
export function getPresentaciones(unidad) {
  if (typeof window !== 'undefined' && window.PRESENTACIONES_POR_UNIDAD) {
    return window.PRESENTACIONES_POR_UNIDAD[unidad] ||
           window.PRESENTACIONES_POR_UNIDAD[unidad.toLowerCase()] || [];
  }
  // Fallback razonable
  if (unidad === 'L' || unidad === 'litro') {
    return [
      { value: 'L', label: 'Litro', factor: 1, icon: 'L' },
      { value: 'ml', label: 'Mililitro (ml)', factor: 0.001, icon: 'ml' }
    ];
  }
  if (unidad === 'kg' || unidad === 'kilogramo') {
    return [
      { value: 'kg', label: 'Kilogramo (kg)', factor: 1, icon: 'kg' },
      { value: 'g', label: 'Gramo (g)', factor: 0.001, icon: 'g' },
      { value: 'lb', label: 'Libra (lb)', factor: 0.453, icon: 'lb' }
    ];
  }
  return [{ value: unidad, label: UNIDAD_LABELS[unidad] || unidad, factor: 1, icon: unidad }];
}

// Convierte una cantidad de una unidad a la unidad base.
// Ej: 2 cajas_12_bot con factor 9 = 18 unidades base.
export function convertToBase(cantidad, presentacion) {
  if (!presentacion) return cantidad;
  var factor = presentacion.factor || 1;
  return cantidad * factor;
}

export function convertFromBase(cantidadBase, presentacion) {
  if (!presentacion) return cantidadBase;
  var factor = presentacion.factor || 1;
  return cantidadBase / factor;
}

// Devuelve la lista de unidades sugeridas para una categoria dada.
export function getSuggestedUnits(categoryName) {
  return UNIDADES_POR_CATEGORIA[categoryName] || ['unidad'];
}

export function getUnitLabel(unit) {
  return UNIDAD_LABELS[unit] || unit;
}

if (typeof window !== 'undefined') {
  window.ServicesUnits = {
    list: UNITS,
    UNIDADES_POR_CATEGORIA: UNIDADES_POR_CATEGORIA,
    UNIDAD_LABELS: UNIDAD_LABELS,
    getPresentaciones: getPresentaciones,
    convertToBase: convertToBase,
    convertFromBase: convertFromBase,
    getSuggestedUnits: getSuggestedUnits,
    getUnitLabel: getUnitLabel
  };
}
