import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'

const source = 'https://ciudadesabiertas.madrid.es/dynamicAPI/API/query/calair_tiemporeal.json?pageSize=5000'
const directory = new URL('../public/data/', import.meta.url)
const historyDirectory = new URL('./history/', directory)
const hourKeys = Array.from({ length: 24 }, (_, index) => String(index + 1).padStart(2, '0'))

function readHourValue(record, hour) {
  const rawValue = Number(record[`H${hour}`])
  return record[`V${hour}`] === 'V' && Number.isFinite(rawValue) && rawValue !== 0 ? rawValue : null
}

function buildHourValues(record) {
  return hourKeys.map((hour) => readHourValue(record, hour))
}

function mergePendingHours(record, previousRecord) {
  if (!previousRecord) return record
  const merged = { ...record }
  for (const hour of hourKeys) {
    const currentIsValid = record[`V${hour}`] === 'V' && Number(record[`H${hour}`]) !== 0
    const previousIsValid = previousRecord[`V${hour}`] === 'V' && Number(previousRecord[`H${hour}`]) !== 0
    if (!currentIsValid && previousIsValid) {
      merged[`H${hour}`] = previousRecord[`H${hour}`]
      merged[`V${hour}`] = 'V'
    }
  }
  return merged
}

async function loadRecentRecords() {
  const files = (await readdir(historyDirectory)).filter((file) => file.endsWith('.json')).sort().slice(-2)
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

await mkdir(directory, { recursive: true })
await mkdir(historyDirectory, { recursive: true })
const response = await fetch(source)
if (!response.ok) throw new Error(`Madrid API respondió ${response.status}`)
const payload = await response.json()
const timestamp = payload.responseDate ?? new Date().toISOString()
const day = timestamp.slice(0, 10)
const previousRecords = await loadRecentRecords()
payload.records = (payload.records ?? []).map((record) => {
  const previous = previousRecords.get(`${record.ESTACION}|${record.MAGNITUD}`)
  return mergePendingHours(record, previous)
})
const content = JSON.stringify({ ...payload, source, capturedAt: timestamp }, null, 2) + '\n'
await writeFile(new URL(`./history/${day}.json`, directory), content)
const files = (await readdir(historyDirectory)).filter((file) => file.endsWith('.json')).sort().slice(-3)
const dayPayloads = await Promise.all(files.map(async (file) => JSON.parse(await readFile(new URL(`./${file}`, historyDirectory), 'utf8'))))
const dates = files.map((file) => file.slice(0, 10))
const chartStations = new Map()
for (const dayPayload of dayPayloads) {
  for (const record of dayPayload.records ?? []) {
    const station = chartStations.get(record.ESTACION) ?? new Map()
    const magnitude = String(record.MAGNITUD)
    const existing = station.get(magnitude) ?? { magnitude, label: magnitude, unit: 'µg/m³', values: [] }
    existing.values.push(...buildHourValues(record))
    station.set(magnitude, existing)
    chartStations.set(record.ESTACION, station)
  }
}
const labels = { '1': 'SO₂', '6': 'CO', '7': 'NO', '8': 'NO₂', '9': 'PM₂.₅', '10': 'PM₁₀', '12': 'NOx', '14': 'O₃' }
const chart = {
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
await writeFile(new URL('./latest.json', directory), JSON.stringify({ ...payload, source, capturedAt: timestamp, chart }, null, 2) + '\n')
console.log(`Guardadas ${payload.records?.length ?? 0} lecturas de ${timestamp}`)
