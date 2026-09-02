import { MAGNITUDES, magnitudeColor, magnitudeSymbol, magnitudeUnit, magnitudeIdFromLabel, STATIONS, stationName } from './config/catalog.mjs'

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
  values: [string, string, string, string?][]
  series: number[]
  chartSeries: { magnitudeId?: string; label: string; unit: string; values: (number | null)[]; color: string }[]
  chartDates?: string[]
  exceedances: string[]
}

export type AirQualitySnapshot = {
  stations: AirStation[]
  responseDate?: string
  expectedStations: number
  missingStations: string[]
  missingMagnitudes: string[]
}

type MadridRecord = Record<string, string>
type MadridResponse = { records?: MadridRecord[]; responseDate?: string; chart?: { dates: string[]; stations: Record<string, { magnitude?: string; label: string; unit: string; values: (number | null)[] }[]> } }

const chartColors = ['#d66c3e', '#3b7f9b', '#c39420', '#6b6fa8', '#3b9c78', '#9b5c38', '#718078', '#bf6d91']

function latestValueForHour(readings: Array<number | null>, referenceDate?: string): number {
  const date = referenceDate ? new Date(referenceDate) : new Date()
  const currentHour = Number.isNaN(date.getTime()) ? 24 : date.getHours()

  for (let index = readings.length - 1; index >= 0; index -= 1) {
    const hourNumber = index + 1
    const value = readings[index]
    if (value === null || hourNumber > currentHour) continue
    return value
  }

  return 0
}

const indexPollutants: Record<string, number[]> = {
  '1': [50, 100, 350, 500],
  '8': [50, 100, 200, 400],
  '9': [15, 30, 55, 110],
  '10': [25, 50, 90, 180],
  '14': [60, 120, 180, 240],
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

function exceedances(records: MadridRecord[]): string[] {
  
  const hourlyLimits: Record<string, number> = { '1': 350, '7': 200, '8': 200, '9': 55, '10': 90, '14': 180 }
  const messages: string[] = []
  for (const record of records) {
    if(!MAGNITUDES[record.MAGNITUD]) continue
    const label = magnitudeSymbol(record.MAGNITUD)

    for (let index = 0; index < 24; index += 1) {
      const hour = String(index + 1).padStart(2, '0')
      const value = Number(record[`H${hour}`])
      if (record[`V${hour}`] === 'V' && Number.isFinite(value) && value > (hourlyLimits[record.MAGNITUD] ?? Number.POSITIVE_INFINITY)) messages.push(`${label} supera el umbral horario a las ${hour}:00 (${value} µg/m³)`)
    }
    if (record.MAGNITUD === '14') {
      const valid = Array.from({ length: 24 }, (_, index) => Number(record[`H${String(index + 1).padStart(2, '0')}`])).map((value, index) => record[`V${String(index + 1).padStart(2, '0')}`] === 'V' && value > 0 ? value : null)
      for (let index = 7; index < valid.length; index += 1) {
        const window = valid.slice(index - 7, index + 1)
        if (window.every((value) => value !== null) && window.reduce((sum, value) => sum + value, 0) / 8 > 120) messages.push(`O₃ supera el umbral octohorario a las ${String(index + 1).padStart(2, '0')}:00`)
      }
    }
  }
  return [...new Set(messages)]
}

function recordDate(payload: MadridResponse, records: MadridRecord[]): string {
  if (payload.responseDate) return payload.responseDate.slice(0, 10)
  const record = records[0]
  return `${record?.ANO ?? '0000'}-${record?.MES ?? '00'}-${record?.DIA ?? '00'}`
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
    const info = STATIONS[id]
    const fallbackName = info?.name ?? `Estación ${id}`
    const area = info?.area ?? 'Madrid'
    const fallbackX = info?.x ?? 15 + (stationIndex * 17) % 75
    const fallbackY = info?.y ?? 18 + (stationIndex * 23) % 65
    const address = info?.address ?? 'Madrid'
    const latitude = info?.latitude ?? 40.4168
    const longitude = info?.longitude ?? -3.7038
    
    const values = records.map((record, recordIndex) => {
      const magnitudeId = record.MAGNITUD
      const label = magnitudeSymbol(magnitudeId)
      const unit = magnitudeUnit(magnitudeId)
      const readings = Array.from({ length: 24 }, (_, index) => {
        const hour = String(index + 1).padStart(2, '0')
        const value = Number(record[`H${hour}`])
        return record[`V${hour}`] === 'V' && Number.isFinite(value) && value !== 0 ? value : null
      })
      const latest = latestValueForHour(readings, payload.responseDate)
      return {
        magnitudeId,
        label,
        value: latest.toFixed(label === 'CO' ? 1 : 0),
        unit,
        readings,
        level: madridIndex(magnitudeId, latest),
        color: magnitudeColor(magnitudeId) ?? chartColors[recordIndex % chartColors.length],
      }
    })
      .filter((item, index, items) => items.findIndex((candidate) => candidate.label === item.label) === index)
      .sort((left, right) => Number(left.magnitudeId) - Number(right.magnitudeId))
      
    const indexValue = Math.round(Math.max(...values.map((item) => item.level ?? 0), 0))
    const status = indexValue <= 25 ? 'Muy bueno' : indexValue <= 50 ? 'Bueno' : indexValue <= 75 ? 'Regular' : indexValue <= 100 ? 'Malo' : 'Muy malo'
    const savedSeries = payload.chart?.stations[id]
    
    const chartSeriesByMagnitude = new Map(values.map((item) => [String(item.magnitudeId), item]))
    const chartSeries = savedSeries
      ? [...savedSeries]
          .map((item, itemIndex) => {
            const magnitudeId = magnitudeIdFromLabel(item.label ?? item.magnitude ?? '')
            const normalizedMagnitude = String(magnitudeId)
            const label = magnitudeSymbol(normalizedMagnitude) || item.label || normalizedMagnitude
            const unit = magnitudeUnit(normalizedMagnitude) || item.unit || 'µg/m³'
            const liveMatch = chartSeriesByMagnitude.get(normalizedMagnitude)
            const color = liveMatch?.color ?? magnitudeColor(normalizedMagnitude) ?? chartColors[itemIndex % chartColors.length]
            return {
              magnitudeId: normalizedMagnitude,
              label,
              unit,
              values: Array.isArray(item.values) ? item.values : [],
              color,
            }
          })
          .filter((item) => item.label && item.values.length > 0)
          .sort((left, right) => Number(left.magnitudeId || 0) - Number(right.magnitudeId || 0))
          .map(({ magnitudeId, label, unit, values, color }) => ({ magnitudeId, label, unit, values, color }))
      : values.map((item) => ({
          magnitudeId: item.magnitudeId,
          label: item.label,
          unit: item.unit,
          values: item.readings,
          color: item.color,
        }))
    
    const chart = values.find((item) => item.label === 'NO₂') ?? values[0] ?? { readings: [] }
    return { 
      id, 
      name: fallbackName, 
      area, 
      x: fallbackX, 
      y: fallbackY, 
      address, 
      latitude, 
      longitude, 
      index: indexValue, 
      status, 
      color: caqiColor(indexValue), 
      values: values.filter((item) => item.level !== undefined).slice(0, 4).map((item) => [item.label, item.value, item.unit, item.magnitudeId] as [string, string, string, string]), 
      series: chart.readings.filter((value): value is number => value !== null), 
      chartSeries, 
      chartDates: payload.chart?.dates ?? [recordDate(payload, records)], 
      exceedances: exceedances(records),
    }
  })
  const missingStations = Object.keys(STATIONS)
    .filter((id) => !grouped.has(id))
    .map((id) => `Estación ${id} · ${stationName(id)}`)

  const missingMagnitudes = [...grouped.entries()]
    .flatMap(([id, records]) => {
      const expected = STATIONS[id]?.magnitudes ?? []
      const missing = expected.filter((magnitude) => !records.some((record) => record.MAGNITUD === magnitude))
      if (!missing.length) return []
      return [`Estación ${id} · ${stationName(id)}: ${missing.map((magnitude) => magnitudeSymbol(magnitude)).join(', ')}`]
    })

  return { stations, responseDate: payload.responseDate, expectedStations: Object.keys(STATIONS).length, missingStations, missingMagnitudes }
}

export async function fetchAirStations(url = AIR_QUALITY_URL): Promise<AirStation[]> {
  return (await fetchAirData(url)).stations
}
