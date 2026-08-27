export const AIR_QUALITY_URL = 'https://ciudadesabiertas.madrid.es/dynamicAPI/API/query/calair_tiemporeal.json?pageSize=5000'

export type AirStation = {
  id: string
  name: string
  area: string
  x: number
  y: number
  latitude?: number
  longitude?: number
  address?: string
  index: number
  status: string
  color: string
  values: [string, string, string][]
  series: number[]
}

export type AirQualitySnapshot = {
  stations: AirStation[]
  responseDate?: string
  expectedStations: number
  missingStations: string[]
  missingMagnitudes: string[]
}

type MadridRecord = Record<string, string>
type MadridResponse = { records?: MadridRecord[]; responseDate?: string }

const expectedMagnitudes = new Set(['1', '7', '8', '9', '10', '14'])

const pollutantNames: Record<string, [string, string]> = {
  '1': ['SO₂', 'µg/m³'], '6': ['CO', 'mg/m³'], '7': ['NO₂', 'µg/m³'],
  '8': ['PM₂.₅', 'µg/m³'], '9': ['PM₁₀', 'µg/m³'], '10': ['PM₁₀', 'µg/m³'],
  '12': ['NOx', 'µg/m³'], '14': ['O₃', 'µg/m³'],
}

const indexPollutants: Record<string, number[]> = {
  '8': [15, 30, 55, 110],
  '9': [25, 50, 90, 180],
  '10': [25, 50, 90, 180],
  '7': [50, 100, 200, 400],
  '14': [60, 120, 180, 240],
  '1': [50, 100, 350, 500],
}

export function caqiColor(index: number): string {
  if (index <= 25) return '#4d9700'
  if (index <= 50) return '#d4d000'
  if (index <= 75) return '#ffc000'
  if (index <= 100) return '#ff8a00'
  return '#9b3500'
}

function madridIndex(magnitude: string, concentration: number): number | undefined {
  const limits = indexPollutants[magnitude]
  if (!limits || !Number.isFinite(concentration)) return undefined
  const band = limits.findIndex((limit) => concentration <= limit)
  if (band === -1) return 100 + ((concentration - limits[3]) / limits[3]) * 25
  const lowerConcentration = band === 0 ? 0 : limits[band - 1]
  return band * 25 + ((concentration - lowerConcentration) / (limits[band] - lowerConcentration)) * 25
}

const stationLayout: Record<string, [string, string, number, number, string, number, number]> = {
  '4': ['Plaza de España', 'Centro', 18, 36, 'Plaza de España', 40.4238823, -3.7122567], '8': ['Escuelas Aguirre', 'Retiro', 56, 42, 'Entre C/ Alcalá y C/ O’ Donell', 40.4215533, -3.6823158],
  '11': ['Ramón y Cajal', 'Chamartín', 68, 25, 'Avda. Ramón y Cajal esq. C/ Príncipe de Vergara', 40.4514734, -3.6773491], '16': ['Arturo Soria', 'Ciudad Lineal', 82, 32, 'C/ Arturo Soria esq. C/ Vizconde de los Asilos', 40.4400457, -3.6392422],
  '17': ['Villaverde', 'Villaverde', 24, 86, 'C/ Juan Peñalver', 40.347147, -3.7133167], '18': ['Farolillo', 'Carabanchel', 20, 68, 'C/ Farolillo - C/ Ervigio', 40.3947825, -3.7318356],
  '24': ['Casa de Campo', 'Moncloa', 8, 38, 'Casa de Campo (Terminal del Teleférico)', 40.4193577, -3.7473445], '27': ['Barajas Pueblo', 'Barajas', 94, 17, 'C/ Júpiter, 21', 40.4769179, -3.5800258],
  '35': ['Plaza del Carmen', 'Centro', 35, 35, 'Plaza del Carmen esq. Tres Cruces', 40.4192091, -3.7031662], '36': ['Moratalaz', 'Moratalaz', 76, 63, 'Avda. Moratalaz esq. Camino de los Vinateros', 40.4079517, -3.6453104],
  '38': ['Cuatro Caminos', 'Tetuán', 36, 23, 'Avda. Pablo Iglesias esq. C/ Marqués de Lema', 40.4455439, -3.7071303], '39': ['Barrio del Pilar', 'Fuencarral-El Pardo', 31, 13, 'Avda. Betanzos esq. C/ Monforte de Lemos', 40.4782322, -3.7115364],
  '40': ['Vallecas', 'Puente de Vallecas', 72, 75, 'C/ Arroyo del Olivar esq. C/ Río Grande', 40.3881478, -3.6515286], '47': ['Méndez Álvaro', 'Arganzuela', 44, 67, 'C/ Juan de Mariana / Plaza Amanecer Méndez Álvaro', 40.3980991, -3.6868138],
  '48': ['Castellana', 'Chamartín', 45, 31, 'C/ José Gutiérrez Abascal', 40.4398904, -3.6903729], '49': ['Parque del Retiro', 'Retiro', 56, 53, 'Paseo Venezuela - Palacio de Velázquez', 40.4144444, -3.6824999],
  '50': ['Plaza Castilla', 'Chamartín', 48, 15, 'Plaza Castilla (Canal)', 40.4655841, -3.6887449], '54': ['Ensanche de Vallecas', 'Villa de Vallecas', 82, 80, 'Avda. La Gavia / Avda. Las Suertes', 40.3730118, -3.6121394],
  '55': ['Urb. Embajada', 'Barajas', 90, 23, 'C/ Riaño (Barajas)', 40.4623628, -3.5805649], '56': ['Plaza Elíptica', 'Usera', 15, 73, 'Plaza Elíptica - Avda. Oporto', 40.3850336, -3.7187679],
  '57': ['Sanchinarro', 'Hortaleza', 77, 4, 'C/ Princesa de Éboli esq. C/ María Tudor', 40.4942012, -3.6605173], '58': ['El Pardo', 'Fuencarral-El Pardo', 3, 2, 'Avda. La Guardia', 40.5180701, -3.7746101],
  '59': ['Juan Carlos I', 'Barajas', 85, 19, 'Parque Juan Carlos I', 40.465144, -3.609031], '60': ['Tres Olivos', 'Fuencarral-El Pardo', 59, 1, 'Plaza Tres Olivos', 40.5005477, -3.6897308],
}

export async function fetchAirData(url = AIR_QUALITY_URL): Promise<AirQualitySnapshot> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Madrid API respondió ${response.status}`)
  const payload = await response.json() as MadridResponse
  const grouped = new Map<string, MadridRecord[]>()
  for (const record of payload.records ?? []) {
    const list = grouped.get(record.ESTACION) ?? []
    list.push(record)
    grouped.set(record.ESTACION, list)
  }

  const stations = [...grouped.entries()].map(([id, records], stationIndex) => {
    const [fallbackName, area, fallbackX, fallbackY, address, latitude, longitude] = stationLayout[id] ?? [`Estación ${id}`, 'Madrid', 15 + (stationIndex * 17) % 75, 18 + (stationIndex * 23) % 65, 'Madrid', 40.4168, -3.7038]
    const values = records.map((record) => {
      const [label, unit] = pollutantNames[record.MAGNITUD] ?? [`Magnitud ${record.MAGNITUD}`, 'µg/m³']
      const readings = Array.from({ length: 24 }, (_, index) => {
        const hour = String(index + 1).padStart(2, '0')
        return record[`V${hour}`] === 'V' ? Number(record[`H${hour}`]) : Number.NaN
      }).filter(Number.isFinite)
      const latest = readings.at(-1) ?? 0
      return { label, value: latest.toFixed(label === 'CO' ? 1 : 0), unit, readings, level: madridIndex(record.MAGNITUD, latest) }
    }).filter((item, index, items) => items.findIndex((candidate) => candidate.label === item.label) === index)
    const indexValue = Math.round(Math.max(...values.map((item) => item.level ?? 0), 0))
    const status = indexValue <= 25 ? 'Muy bueno' : indexValue <= 50 ? 'Bueno' : indexValue <= 75 ? 'Regular' : indexValue <= 100 ? 'Malo' : 'Muy malo'
    const chart = values.find((item) => item.label === 'NO₂') ?? values[0] ?? { readings: [] }
    return { id, name: fallbackName, area, x: fallbackX, y: fallbackY, address, latitude, longitude, index: indexValue, status, color: caqiColor(indexValue), values: values.filter((item) => item.level !== undefined).slice(0, 4).map((item) => [item.label, item.value, item.unit] as [string, string, string]), series: chart.readings }
  })
  const missingStations = Object.keys(stationLayout).filter((id) => !grouped.has(id)).map((id) => `${id} · ${stationLayout[id][0]}`)
  const missingMagnitudes = [...grouped.entries()].flatMap(([id, records]) => [...expectedMagnitudes].filter((magnitude) => !records.some((record) => record.MAGNITUD === magnitude)).map((magnitude) => `Estación ${id}: ${pollutantNames[magnitude]?.[0] ?? magnitude}`))
  return { stations, responseDate: payload.responseDate, expectedStations: Object.keys(stationLayout).length, missingStations, missingMagnitudes }
}

export async function fetchAirStations(url = AIR_QUALITY_URL): Promise<AirStation[]> {
  return (await fetchAirData(url)).stations
}
