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

export type CoverageState = 'valid' | 'partial' | 'missing'

export type CoverageRow = {
  stationId: string
  stationName: string
  values: CoverageState[]
}

export type AirQualitySnapshot = {
  stations: AirStation[]
  responseDate?: string
  expectedStations: number
  missingStations: string[]
  missingMagnitudes: string[]
  coverage: {
    hourly: CoverageRow[]
    daily: CoverageRow[]
    dailyDates: string[]
  }
}

type MadridRecord = Record<string, string>
type MadridResponse = { records?: MadridRecord[]; responseDate?: string; history?: Array<{ date: string; responseDate?: string; records?: MadridRecord[] }>; chart?: { dates: string[]; stations: Record<string, { magnitude?: string; label: string; unit: string; values: (number | null)[] }[]> } }

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

function coverageStatus(expected: string[], valid: string[]): CoverageState {
  if (!expected.length) return 'missing'
  if (!valid.length) return 'missing'
  if (valid.length === expected.length) return 'valid'
  return 'partial'
}

function buildCoverageMatrix(payload: MadridResponse): { hourly: CoverageRow[]; daily: CoverageRow[]; dailyDates: string[] } {
  const records = payload.records ?? []
  const currentDate = payload.responseDate ? payload.responseDate.slice(0, 10) : recordDate(payload, records)
  const historyDates = (payload.history ?? [])
    .map((entry) => entry.date)
    .filter((date) => typeof date === 'string' && date.length >= 8)
    .slice(-30)

  const dailyDates = Array.from(new Set([currentDate, ...historyDates])).sort((left, right) => left.localeCompare(right)).slice(-30)
  const stationIds = Object.keys(STATIONS)

  const hourly = stationIds.map((stationId) => {
    const expected = STATIONS[stationId]?.magnitudes ?? []
    const values = Array.from({ length: 24 }, (_, hourIndex) => {
      const hour = String(hourIndex + 1).padStart(2, '0')
      const valid = expected.filter((magnitude) => records.some((record) => {
        if (record.ESTACION !== stationId || record.MAGNITUD !== magnitude) return false
        return record[`V${hour}`] === 'V' && Number.isFinite(Number(record[`H${hour}`])) && Number(record[`H${hour}`]) !== 0
      }))
      return coverageStatus(expected, valid)
    })
    return { stationId, stationName: stationName(stationId), values }
  })

  const daily = stationIds.map((stationId) => {
    const expected = STATIONS[stationId]?.magnitudes ?? []
    const values = dailyDates.map((date) => {
      const valid = expected.filter((magnitude) => {
        const dayRecords = (payload.history ?? []).find((entry) => entry.date === date)?.records ?? []
        const currentDayRecords = date === currentDate ? records : dayRecords
        return currentDayRecords.some((record) => {
          if (record.ESTACION !== stationId || record.MAGNITUD !== magnitude) return false
          return Array.from({ length: 24 }, (_, index) => String(index + 1).padStart(2, '0')).some((hour) => {
            return record[`V${hour}`] === 'V' && Number.isFinite(Number(record[`H${hour}`])) && Number(record[`H${hour}`]) !== 0
          })
        })
      })
      return coverageStatus(expected, valid)
    })
    return { stationId, stationName: stationName(stationId), values }
  })
  return { hourly, daily, dailyDates }
}

function chartFromHistory(payload: MadridResponse) {
  const history = payload.history ?? []
  if (!history.length) return payload.chart

  const dates = history.map((entry) => entry.date).filter((date) => date.length >= 8).sort().slice(-3)
  const byStation = new Map<string, Map<string, { magnitude: string; values: (number | null)[] }>>()
  const currentDate = payload.responseDate?.slice(0, 10)

  for (const date of dates) {
    const entry = history.find((candidate) => candidate.date === date)
    const maxHour = date === currentDate && payload.responseDate
      ? Math.min(24, Math.max(0, Number(payload.responseDate.slice(11, 13)) || 0))
      : 24
    for (const record of entry?.records ?? []) {
      const magnitude = String(record.MAGNITUD)
      const station = byStation.get(record.ESTACION) ?? new Map()
      const item = station.get(magnitude) ?? { magnitude, values: [] }
      item.values.push(...buildReadings(record, maxHour))
      station.set(magnitude, item)
      byStation.set(record.ESTACION, station)
    }
  }

  return {
    dates,
    stations: Object.fromEntries([...byStation.entries()].map(([stationId, magnitudes]) => [
      stationId,
      [...magnitudes.values()]
        .sort((left, right) => Number(left.magnitude) - Number(right.magnitude))
        .map((item) => ({
          magnitude: item.magnitude,
          label: magnitudeSymbol(item.magnitude),
          unit: magnitudeUnit(item.magnitude),
          values: item.values,
        })),
    ])),
  }
}

function buildReadings(record: MadridRecord, maxHour: number): (number | null)[] {
  return Array.from({ length: maxHour }, (_, index) => {
    const hour = String(index + 1).padStart(2, '0')
    const value = Number(record[`H${hour}`])
    return record[`V${hour}`] === 'V' && Number.isFinite(value) && value !== 0 ? value : null
  })
}

async function refreshStaticHistory(url: string, payload: MadridResponse): Promise<MadridResponse> {
  if (!url.endsWith('latest.json') || !payload.history?.length) return payload

  const historyUrl = (date: string) => url.replace(/latest\.json$/, `history/${date}.json`)
  const results = await Promise.allSettled(payload.history.map(async (entry) => {
    const response = await fetch(historyUrl(entry.date))
    if (!response.ok) throw new Error(`No se pudo cargar el histórico de ${entry.date}`)
    return { date: entry.date, payload: await response.json() as { responseDate?: string; records?: MadridRecord[] } }
  }))
  const refreshedHistory = results
    .filter((result): result is PromiseFulfilledResult<{ date: string; payload: { responseDate?: string; records?: MadridRecord[] } }> => result.status === 'fulfilled')
    .map((result) => ({ date: result.value.date, ...result.value.payload }))

  return refreshedHistory.length ? { ...payload, history: refreshedHistory } : payload
}

export async function fetchAirData(url = AIR_QUALITY_URL): Promise<AirQualitySnapshot> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Madrid API respondió ${response.status}`)
  const payload = await refreshStaticHistory(url, await response.json() as MadridResponse)
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
    const derivedChart = chartFromHistory(payload)
    const savedSeries = derivedChart?.stations[id]
    
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
      chartDates: derivedChart?.dates ?? [recordDate(payload, records)],
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

  const coverage = buildCoverageMatrix(payload)

  return { stations, responseDate: payload.responseDate, expectedStations: Object.keys(STATIONS).length, missingStations, missingMagnitudes, coverage }
}

export async function fetchAirStations(url = AIR_QUALITY_URL): Promise<AirStation[]> {
  return (await fetchAirData(url)).stations
}
