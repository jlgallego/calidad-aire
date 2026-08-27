export const AIR_QUALITY_URL = 'https://ciudadesabiertas.madrid.es/dynamicAPI/API/query/calair_tiemporeal.json?pageSize=5000'

export type AirStation = {
  id: string
  name: string
  area: string
  x: number
  y: number
  index: number
  status: string
  color: string
  values: [string, string, string][]
  series: number[]
}

type MadridRecord = Record<string, string>
type MadridResponse = { records?: MadridRecord[]; responseDate?: string }

const pollutantNames: Record<string, [string, string]> = {
  '1': ['SO₂', 'µg/m³'], '6': ['CO', 'mg/m³'], '7': ['NO₂', 'µg/m³'],
  '8': ['PM₂.₅', 'µg/m³'], '9': ['PM₁₀', 'µg/m³'], '10': ['PM₁₀', 'µg/m³'],
  '12': ['NOx', 'µg/m³'], '14': ['O₃', 'µg/m³'],
}

const stationLayout: Record<string, [string, string, number, number]> = {
  '4': ['Plaza Elíptica', 'Usera', 28, 70], '8': ['Escuelas Aguirre', 'Retiro', 67, 41],
  '11': ['Ramón y Cajal', 'Chamartín', 74, 18], '18': ['Farolillo', 'Carabanchel', 20, 45],
  '24': ['Casa de Campo', 'Moncloa', 38, 27], '35': ['Plaza Castilla', 'Chamartín', 74, 18],
}

export async function fetchAirStations(url = AIR_QUALITY_URL): Promise<AirStation[]> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Madrid API respondió ${response.status}`)
  const payload = await response.json() as MadridResponse
  const grouped = new Map<string, MadridRecord[]>()
  for (const record of payload.records ?? []) {
    const list = grouped.get(record.ESTACION) ?? []
    list.push(record)
    grouped.set(record.ESTACION, list)
  }

  return [...grouped.entries()].map(([id, records], stationIndex) => {
    const [fallbackName, area, fallbackX, fallbackY] = stationLayout[id] ?? [`Estación ${id}`, 'Madrid', 15 + (stationIndex * 17) % 75, 18 + (stationIndex * 23) % 65]
    const values = records.map((record) => {
      const [label, unit] = pollutantNames[record.MAGNITUD] ?? [`Magnitud ${record.MAGNITUD}`, 'µg/m³']
      const readings = Array.from({ length: 24 }, (_, index) => Number(record[`H${String(index + 1).padStart(2, '0')}`])).filter(Number.isFinite)
      const latest = readings.at(-1) ?? 0
      return { label, value: latest.toFixed(label === 'CO' ? 1 : 0), unit, readings }
    }).filter((item, index, items) => items.findIndex((candidate) => candidate.label === item.label) === index)
    const indexValue = Math.min(100, Math.round(Math.max(...values.map((item) => Number(item.value)), 0)))
    const status = indexValue > 75 ? 'Desfavorable' : indexValue > 40 ? 'Moderada' : 'Buena'
    const chart = values.find((item) => item.label === 'NO₂') ?? values[0] ?? { readings: [] }
    return { id, name: fallbackName, area, x: fallbackX, y: fallbackY, index: indexValue, status, color: status === 'Desfavorable' ? '#d86c3d' : status === 'Moderada' ? '#e1a238' : '#3b9c78', values: values.slice(0, 4).map((item) => [item.label, item.value, item.unit] as [string, string, string]), series: chart.readings }
  })
}
