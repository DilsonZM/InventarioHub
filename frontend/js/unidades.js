window.PRESENTACIONES_POR_UNIDAD = {
  'L': [
    { value: 'L', label: 'Litro', factor: 1, icon: 'L' },
    { value: 'ml', label: 'Mililitro (ml)', factor: 0.001, icon: 'ml' },
    { value: 'galon', label: 'Galon (3.785 L)', factor: 3.785, icon: 'gal' },
    { value: 'botella', label: 'Botella estandar (0.75 L)', factor: 0.75, icon: 'bot' },
    { value: 'caja_12_bot', label: 'Caja x 12 botellas', factor: 9, icon: 'cj12' }
  ],
  'litro': [
    { value: 'litro', label: 'Litro', factor: 1, icon: 'L' },
    { value: 'mililitro', label: 'Mililitro (ml)', factor: 0.001, icon: 'ml' },
    { value: 'galon', label: 'Galon (3.785 L)', factor: 3.785, icon: 'gal' },
    { value: 'botella', label: 'Botella estandar (0.75 L)', factor: 0.75, icon: 'bot' }
  ],
  'kg': [
    { value: 'kg', label: 'Kilogramo (kg)', factor: 1, icon: 'kg' },
    { value: 'g', label: 'Gramo (g)', factor: 0.001, icon: 'g' },
    { value: 'lb', label: 'Libra (0.454 kg)', factor: 0.454, icon: 'lb' },
    { value: 'bulto_25', label: 'Bulto x 25 kg', factor: 25, icon: 'b25' },
    { value: 'bulto_50', label: 'Bulto x 50 kg', factor: 50, icon: 'b50' }
  ],
  'kilogramo': [
    { value: 'kilogramo', label: 'Kilogramo (kg)', factor: 1, icon: 'kg' },
    { value: 'gramo', label: 'Gramo (g)', factor: 0.001, icon: 'g' },
    { value: 'libra', label: 'Libra (0.454 kg)', factor: 0.454, icon: 'lb' }
  ],
  'lb': [
    { value: 'lb', label: 'Libra', factor: 1, icon: 'lb' },
    { value: 'kg', label: 'Kilogramo (2.205 lb)', factor: 2.205, icon: 'kg' }
  ],
  'unidad': [
    { value: 'unidad', label: 'Unidad', factor: 1, icon: 'u' },
    { value: 'docena', label: 'Docena (12 u)', factor: 12, icon: 'dz' },
    { value: 'caja_24', label: 'Caja x 24', factor: 24, icon: 'cj24' },
    { value: 'caja_30', label: 'Caja x 30', factor: 30, icon: 'cj30' }
  ],
  'paquete': [
    { value: 'paquete', label: 'Paquete', factor: 1, icon: 'pq' },
    { value: 'unidad', label: 'Unidad (1 pq = 1 u)', factor: 1, icon: 'u' },
    { value: 'caja_10pq', label: 'Caja x 10 paquetes', factor: 10, icon: 'cj10' }
  ],
  'docena': [
    { value: 'docena', label: 'Docena (12 u)', factor: 12, icon: 'dz' },
    { value: 'unidad', label: 'Unidad', factor: 1, icon: 'u' },
    { value: 'caja_30', label: 'Cubeta x 30 docenas (360 u)', factor: 360, icon: 'c30' }
  ],
  'metro': [
    { value: 'metro', label: 'Metro (m)', factor: 1, icon: 'm' },
    { value: 'centimetro', label: 'Centimetro (cm)', factor: 0.01, icon: 'cm' },
    { value: 'rollo_50', label: 'Rollo x 50 m', factor: 50, icon: 'r50' }
  ]
};

window.PRESENTACION_DEFAULT = [
  { value: '', label: 'Misma unidad base', factor: 1 }
];

window.getPresentaciones = function (unidadBase) {
  var u = (unidadBase || '').toString().trim();
  var list = window.PRESENTACIONES_POR_UNIDAD[u] || window.PRESENTACIONES_POR_UNIDAD[u.toLowerCase()] || null;
  if (!list) {
    return [{ value: u || 'unidad', label: unidadBase || 'Unidad', factor: 1, icon: 'u' }];
  }
  return window.PRESENTACION_DEFAULT.concat(list);
};

window.formatPresentacion = function (qty, presentacion, unidadBase) {
  if (!presentacion || !presentacion.value) return qty + ' ' + (unidadBase || 'u');
  if (presentacion.factor === 1) return qty + ' ' + presentacion.label.split(' (')[0].toLowerCase();
  var base = (qty * presentacion.factor).toFixed(presentacion.factor < 0.01 ? 3 : (presentacion.factor < 1 ? 3 : 1));
  return qty + ' ' + presentacion.label.split(' (')[0].toLowerCase() + ' = ' + base + ' ' + (unidadBase || 'u');
};
