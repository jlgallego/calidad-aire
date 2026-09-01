// Fuente única de verdad para magnitudes, unidades y estaciones de la Red de
// Vigilancia de Calidad del Aire de Madrid.
//
// La consultan TANTO el frontend (src/lib/airQuality.ts, vía re-export tipado)
// COMO los scripts de Node (scripts/fetch-air-quality.mjs, scripts/convert-tsv.mjs,
// cualquier otro que genere o lea public/data/*.json).
//
// Regla: nadie construye su propia tabla de símbolos/unidades/estaciones.
// Todo el mundo importa de aquí. Si falta una magnitud o estación, se añade
// aquí, en un único sitio.

/**
 * @typedef {Object} MagnitudeInfo
 * @property {string} symbol - símbolo corto para UI, p.ej. 'NO₂'
 * @property {string} name   - nombre largo, p.ej. 'Dióxido de nitrógeno'
 * @property {string} unit   - unidad de medida, p.ej. 'µg/m³'
 * @property {string} color  - color fijo para gráficos y etiquetas
 */

/** @type {Record<string, MagnitudeInfo>} */
export const MAGNITUDES = {
  '1':  { symbol: 'SO₂',   name: 'Dióxido de azufre',      unit: 'µg/m³', color: '#4B87C8' },
  '6':  { symbol: 'CO',    name: 'Monóxido de carbono',    unit: 'mg/m³', color: '#5EA36E' },
  '7':  { symbol: 'NO',    name: 'Óxido de nitrógeno',     unit: 'µg/m³', color: '#E67E22' },
  '8':  { symbol: 'NO₂',   name: 'Dióxido de nitrógeno',   unit: 'µg/m³', color: '#D84315' },
  '9':  { symbol: 'PM₂.₅', name: 'Partículas < 2.5 µm',    unit: 'µg/m³', color: '#8E44AD' },
  '10': { symbol: 'PM₁₀',  name: 'Partículas < 10 µm',     unit: 'µg/m³', color: '#E67E22' },
  '12': { symbol: 'NOx',   name: 'Óxidos de nitrógeno',    unit: 'µg/m³', color: '#7D3C98' },
  '14': { symbol: 'O₃',    name: 'Ozono',                  unit: 'µg/m³', color: '#1E8E82' },
}

/** ID de magnitud -> símbolo. Si no se reconoce, devuelve el propio id (nunca inventa). */
export function magnitudeSymbol(id) {
  return MAGNITUDES[id]?.symbol ?? String(id)
}

/** ID de magnitud -> unidad. Fallback razonable si algún día aparece una magnitud nueva sin catalogar. */
export function magnitudeUnit(id) {
  return MAGNITUDES[id]?.unit ?? 'µg/m³'
}

/** ID de magnitud -> color fijo para gráficos y etiquetas. */
export function magnitudeColor(id) {
  return MAGNITUDES[id]?.color ?? '#6B7280'
}

/**
 * Símbolo o ID -> ID de magnitud. Útil para volver a resolver datos históricos
 * que puedan haber guardado el símbolo en vez del id (compatibilidad hacia atrás).
 */
export function magnitudeIdFromLabel(label) {
  if (!label || typeof label !== 'string') return label
  const trimmed = label.trim()
  if (MAGNITUDES[trimmed]) return trimmed
  const compact = trimmed.replace(/\s+/g, '')
  const found = Object.entries(MAGNITUDES).find(([id, info]) => {
    return [id, info.symbol, info.name].some((candidate) => candidate === trimmed || candidate.replace(/\s+/g, '') === compact)
  })
  return found?.[0] ?? trimmed
}

/**
 * @typedef {Object} StationInfo
 * @property {string} name
 * @property {string} area
 * @property {string} address
 * @property {number} latitude
 * @property {number} longitude
 * @property {number} x - posición aproximada en el mapa esquemático de respaldo (0-100)
 * @property {number} y - posición aproximada en el mapa esquemático de respaldo (0-100)
 */

/** @type {Record<string, StationInfo>} */
export const STATIONS = {
  '4':  { name: 'Plaza de España',   area: 'Centro',                x: 18, y: 36, address: 'Plaza de España', latitude: 40.4238823, longitude: -3.7122567, magnitudes: ['6', '7', '8', '9', '10', '12'] },
  '8':  { name: 'Escuelas Aguirre',  area: 'Retiro',                x: 56, y: 42, address: 'Entre C/ Alcalá y C/ O’ Donell', latitude: 40.4215533, longitude: -3.6823158, magnitudes: ['1', '6', '7', '8', '9', '10', '12', '14', '20', '30', '35'] },
  '11': { name: 'Ramón y Cajal',     area: 'Chamartín',             x: 68, y: 25, address: 'Avda. Ramón y Cajal esq. C/ Príncipe de Vergara', latitude: 40.4514734, longitude: -3.6773491, magnitudes: ['7', '8', '12'] },
  '16': { name: 'Arturo Soria',      area: 'Ciudad Lineal',         x: 82, y: 32, address: 'C/ Arturo Soria esq. C/ Vizconde de los Asilos', latitude: 40.4400457, longitude: -3.6392422, magnitudes: ['7', '8', '12', '14'] },
  '17': { name: 'Villaverde',        area: 'Villaverde',            x: 24, y: 86, address: 'C/ Juan Peñalver', latitude: 40.347147, longitude: -3.7133167, magnitudes: ['7', '8', '12', '14'] },
  '18': { name: 'Farolillo',         area: 'Carabanchel',           x: 20, y: 68, address: 'C/ Farolillo - C/ Ervigio', latitude: 40.3947825, longitude: -3.7318356, magnitudes: ['7', '8', '10', '12', '14', '20', '30', '35'] },
  '24': { name: 'Casa de Campo',     area: 'Moncloa',               x: 8,  y: 38, address: 'Casa de Campo (Terminal del Teleférico)', latitude: 40.4193577, longitude: -3.7473445, magnitudes: ['7', '8', '9', '10', '12', '14'] },
  '27': { name: 'Barajas Pueblo',    area: 'Barajas',               x: 94, y: 17, address: 'C/ Júpiter, 21', latitude: 40.4769179, longitude: -3.5800258, magnitudes: ['7', '8', '12', '14'] },
  '35': { name: 'Plaza del Carmen',  area: 'Centro',                x: 35, y: 35, address: 'Plaza del Carmen esq. Tres Cruces', latitude: 40.4192091, longitude: -3.7031662, magnitudes: ['1', '6', '7', '8', '12', '14'] },
  '36': { name: 'Moratalaz',         area: 'Moratalaz',             x: 76, y: 63, address: 'Avda. Moratalaz esq. Camino de los Vinateros', latitude: 40.4079517, longitude: -3.6453104, magnitudes: ['1', '7', '8', '10', '12'] },
  '38': { name: 'Cuatro Caminos',    area: 'Tetuán',                x: 36, y: 23, address: 'Avda. Pablo Iglesias esq. C/ Marqués de Lema', latitude: 40.4455439, longitude: -3.7071303, magnitudes: ['7', '8', '9', '10', '12', '20', '30', '35'] },
  '39': { name: 'Barrio del Pilar',  area: 'Fuencarral-El Pardo',   x: 31, y: 13, address: 'Avda. Betanzos esq. C/ Monforte de Lemos', latitude: 40.4782322, longitude: -3.7115364, magnitudes: ['7', '8', '12', '14'] },
  '40': { name: 'Vallecas',          area: 'Puente de Vallecas',    x: 72, y: 75, address: 'C/ Arroyo del Olivar esq. C/ Río Grande', latitude: 40.3881478, longitude: -3.6515286, magnitudes: ['7', '8', '10', '12'] },
  '47': { name: 'Méndez Álvaro',     area: 'Arganzuela',            x: 44, y: 67, address: 'C/ Juan de Mariana / Plaza Amanecer Méndez Álvaro', latitude: 40.3980991, longitude: -3.6868138, magnitudes: ['7', '8', '9', '10', '12'] },
  '48': { name: 'Castellana',        area: 'Chamartín',             x: 45, y: 31, address: 'C/ José Gutiérrez Abascal', latitude: 40.4398904, longitude: -3.6903729, magnitudes: ['7', '8', '9', '10', '12'] },
  '49': { name: 'Parque del Retiro', area: 'Retiro',                x: 56, y: 53, address: 'Paseo Venezuela - Palacio de Velázquez', latitude: 40.4144444, longitude: -3.6824999, magnitudes: ['7', '8', '12', '14'] },
  '50': { name: 'Plaza Castilla',    area: 'Chamartín',             x: 48, y: 15, address: 'Plaza Castilla (Canal)', latitude: 40.4655841, longitude: -3.6887449, magnitudes: ['7', '8', '9', '10', '12'] },
  '54': { name: 'Ensanche de Vallecas', area: 'Villa de Vallecas',  x: 82, y: 80, address: 'Avda. La Gavia / Avda. Las Suertes', latitude: 40.3730118, longitude: -3.6121394, magnitudes: ['7', '8', '9', '10', '12', '14'] },
  '55': { name: 'Urb. Embajada',     area: 'Barajas',               x: 90, y: 23, address: 'C/ Riaño (Barajas)', latitude: 40.4623628, longitude: -3.5805649, magnitudes: ['8', '14'] }, 
  '56': { name: 'Plaza Elíptica',    area: 'Usera',                 x: 15, y: 73, address: 'Plaza Elíptica - Avda. Oporto', latitude: 40.3850336, longitude: -3.7187679, magnitudes: ['6', '7', '8', '9', '10', '12'] },
  '57': { name: 'Sanchinarro',       area: 'Hortaleza',             x: 77, y: 4,  address: 'C/ Princesa de Éboli esq. C/ María Tudor', latitude: 40.4942012, longitude: -3.6605173, magnitudes: ['7', '8', '9', '10', '12'] },
  '58': { name: 'El Pardo',          area: 'Fuencarral-El Pardo',   x: 3,  y: 2,  address: 'Avda. La Guardia', latitude: 40.5180701, longitude: -3.7746101, magnitudes: ['7', '8', '12', '14'] },
  '59': { name: 'Juan Carlos I',     area: 'Barajas',               x: 85, y: 19, address: 'Parque Juan Carlos I', latitude: 40.465144, longitude: -3.609031, magnitudes: ['7', '8', '12', '14'] },
  '60': { name: 'Tres Olivos',       area: 'Fuencarral-El Pardo',   x: 59, y: 1,  address: 'Plaza Tres Olivos', latitude: 40.5005477, longitude: -3.6897308, magnitudes: ['7', '8', '9', '10', '12', '14'] },
}
export function stationName(id) {
  return STATIONS[id]?.name ?? `Estación ${id}`
}
