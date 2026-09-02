import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { MAGNITUDES } from '../src/config/catalog.mjs'

const source = 'https://ciudadesabiertas.madrid.es/dynamicAPI/API/query/calair_tiemporeal.json?pageSize=5000'
const directory = new URL('../public/data/', import.meta.url)
const historyDirectory = new URL('./history/', directory)
const hourKeys = Array.from({ length: 24 }, (_, index) => String(index + 1).padStart(2, '0'))
const labels = Object.fromEntries(Object.entries(MAGNITUDES).map(([id, info]) => [id, info.symbol]))

function readHourValue(record, hour) {
  const rawValue = Number(record[`H${hour}`])
  return record[`V${hour}`] === 'V' && Number.isFinite(rawValue) && rawValue !== 0 ? rawValue : null
}

function buildHourValues(record, maxHour = 24) {
  return hourKeys.slice(0, maxHour).map((hour) => readHourValue(record, hour))
}

function lastAvailableHour(record) {
  for (let index = 24; index >= 1; index -= 1) {
    const hour = String(index).padStart(2, '0')
    const value = Number(record[`H${hour}`])
    if (record[`V${hour}`] === 'V' && Number.isFinite(value) && value !== 0) return index
  }
  return 0
}

function mergePendingHours(record, previousRecord, responseDate) {
  if (!previousRecord) return record
  const merged = { ...record }
  const referenceDate = responseDate ? new Date(responseDate) : new Date()
  const currentHour = Number.isNaN(referenceDate.getTime()) ? 24 : referenceDate.getHours()

  for (const hour of hourKeys) {
    const hourNumber = Number(hour)
    if (hourNumber > currentHour) continue

    const currentValue = Number(record[`H${hour}`])
    const currentIsValid = record[`V${hour}`] === 'V' && Number.isFinite(currentValue) && currentValue !== 0
    if (currentIsValid) continue
    const previousValue = Number(previousRecord[`H${hour}`])
    const previousIsValid = previousRecord[`V${hour}`] === 'V' && Number.isFinite(previousValue) && previousValue !== 0
    if (previousIsValid) {
      merged[`H${hour}`] = previousRecord[`H${hour}`]
      merged[`V${hour}`] = 'V'
    }
  }
  return merged
}

async function loadExistingDayRecords(date) {
  const filePath = new URL(`./${date}.json`, historyDirectory)
  try {
    const payload = JSON.parse(await readFile(filePath, 'utf8'))
    return payload.records ?? []
  } catch {
    return []
  }
}

async function loadRecentRecords() {
  const files = (await readdir(historyDirectory)).filter((file) => file.endsWith('.json')).sort().slice(-3)
  const records = new Map()
  for (const file of files) {
    const payload = JSON.parse(await readFile(new URL(`./${file}`, historyDirectory), 'utf8'))
    for (const record of payload.records ?? []) {
      const key = `${record.ESTACION}|${record.MAGNITUD}`
      records.set(key, record)
    }
  }
  return records
}

async function buildChartPayload() {
  const files = (await readdir(historyDirectory)).filter((file) => file.endsWith('.json')).sort().slice(-3)
  const dayPayloads = await Promise.all(files.map(async (file) => JSON.parse(await readFile(new URL(`./${file}`, historyDirectory), 'utf8'))))
  const dates = files.map((file) => file.slice(0, 10))
  const chartStations = new Map()
  const currentDate = dates.at(-1)

  for (const dayPayload of dayPayloads) {
    const dayDate = dayPayload.responseDate ? dayPayload.responseDate.slice(0, 10) : dayPayload.records?.[0]?.ANO ? `${dayPayload.records[0].ANO}-${dayPayload.records[0].MES}-${dayPayload.records[0].DIA}` : undefined
    const maxHour = dayDate === currentDate ? Math.max(1, ...((dayPayload.records ?? []).flatMap((record) => [lastAvailableHour(record)])).filter((hour) => Number.isFinite(hour))) : 24

    for (const record of dayPayload.records ?? []) {
      const station = chartStations.get(record.ESTACION) ?? new Map()
      const magnitude = String(record.MAGNITUD)
      const existing = station.get(magnitude) ?? { magnitude, label: labels[magnitude] ?? magnitude, unit: MAGNITUDES[magnitude]?.unit ?? 'µg/m³', values: [] }
      existing.values.push(...buildHourValues(record, maxHour))
      station.set(magnitude, existing)
      chartStations.set(record.ESTACION, station)
    }
  }

  return {
    dates,
    stations: Object.fromEntries([...chartStations.entries()].map(([id, stationMap]) => [
      id,
      [...stationMap.values()]
        .sort((left, right) => Number(left.magnitude) - Number(right.magnitude))
        .map((item) => ({
          magnitude: item.magnitude,
          label: labels[item.magnitude] ?? item.label,
          unit: item.unit,
          values: item.values,
        })),
    ])),
  }
}

await mkdir(directory, { recursive: true })
await mkdir(historyDirectory, { recursive: true })
const response = await fetch(source)
if (!response.ok) throw new Error(`Madrid API respondió ${response.status}`)
const payload = await response.json()
const timestamp = payload.responseDate ?? new Date().toISOString()
const day = timestamp.slice(0, 10)
const sameDayRecords = await loadExistingDayRecords(day)
const sameDayMap = new Map(sameDayRecords.map((record) => [`${record.ESTACION}|${record.MAGNITUD}`, record]))
const previousRecords = await loadRecentRecords()

payload.records = [...new Map((payload.records ?? []).map((record) => {
  const key = `${record.ESTACION}|${record.MAGNITUD}`
  const currentRecord = sameDayMap.get(key)
  const mergedRecord = mergePendingHours(record, currentRecord ?? previousRecords.get(key), timestamp)
  sameDayMap.set(key, mergedRecord)
  return [key, mergedRecord]
})).values()]

const content = JSON.stringify({ ...payload, source, capturedAt: timestamp }, null, 2) + '\n'
await writeFile(new URL(`./history/${day}.json`, directory), content)
const chart = await buildChartPayload()
const historicalDays = (await Promise.all((await readdir(historyDirectory)).filter((file) => file.endsWith('.json')).sort().slice(-3).map(async (file) => {
  const dayPayload = JSON.parse(await readFile(new URL(`./${file}`, historyDirectory), 'utf8'))
  return {
    date: file.slice(0, 10),
    responseDate: dayPayload.responseDate,
    records: dayPayload.records ?? [],
  }
})))

await writeFile(new URL('./latest.json', directory), JSON.stringify({
  ...payload,
  source,
  capturedAt: timestamp,
  records: payload.records ?? [],
  history: historicalDays,
  chart,
}, null, 2) + '\n')
console.log(`Guardadas ${payload.records?.length ?? 0} lecturas de ${timestamp}`)
