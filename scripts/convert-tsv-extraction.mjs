import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'

const input = process.argv[2]
if (!input) throw new Error('Uso: node scripts/convert-tsv-extraction.mjs <extraccion.tsv>')

const outputDirectory = new URL('../public/data/', import.meta.url)
await mkdir(new URL('./history/', outputDirectory), { recursive: true })
const text = await readFile(input, 'utf8')
const rows = parseTsv(text)
const days = new Map()

for (const row of rows) {
  const timestamp = row.lect_dt_timestamp
  const match = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):\d{2}:\d{2}$/)
  if (!match) continue
  const [, year, month, day, hour] = match
  const date = `${year}-${month}-${day}`
  const records = days.get(date) ?? new Map()
  const key = `${row.lect_nr_estacion}|${row.lect_nr_magnitud}`
  const record = records.get(key) ?? {
    PROVINCIA: row.lect_nr_provincia,
    MUNICIPIO: row.lect_nr_municipio,
    ESTACION: row.lect_nr_estacion,
    MAGNITUD: row.lect_nr_magnitud,
    PUNTO_MUESTREO: row.lect_tx_punto_muestreo,
    ANO: year,
    MES: month,
    DIA: day,
  }
  const hourNumber = Number(hour)
  const value = Number(row.lect_nr_lectura)
  record[`H${String(hourNumber).padStart(2, '0')}`] = Number.isFinite(value) ? String(value) : '0'
  record[`V${String(hourNumber).padStart(2, '0')}`] = row.lect_cd_verificada || 'N'
  records.set(key, record)
  days.set(date, records)
}

for (const [date, records] of days) {
  const payload = { page: 1, pageSize: records.size, totalRecords: records.size, pageRecords: records.size, responseDate: `${date}T23:59:59`, records: [...records.values()], source: 'Extracción TSV de la base de datos' }
  await writeFile(new URL(`./history/${date}.json`, outputDirectory), JSON.stringify(payload, null, 2) + '\n')
}
const existingFiles = (await readdir(new URL('./history/', outputDirectory))).filter((file) => file.endsWith('.json'))
for (const file of existingFiles) {
  const date = file.slice(0, 10)
  if (!days.has(date)) {
    const payload = JSON.parse(await readFile(new URL(`./history/${file}`, outputDirectory), 'utf8'))
    days.set(date, new Map((payload.records ?? []).map((record) => [`${record.ESTACION}|${record.MAGNITUD}`, record])))
  }
}
const latestDate = [...days.keys()].sort().at(-1)
if (latestDate) {
  const latest = JSON.parse(await readFile(new URL(`./history/${latestDate}.json`, outputDirectory), 'utf8'))
  const dates = [...days.keys()].sort().slice(-3)
  const chart = { dates, stations: {} }
  for (const date of dates) {
    for (const record of days.get(date).values()) {
      const items = chart.stations[record.ESTACION] ?? []
      const item = items.find((candidate) => candidate.magnitude === record.MAGNITUD)
      const values = Array.from({ length: 24 }, (_, index) => record[`V${String(index + 1).padStart(2, '0')}`] === 'V' && Number(record[`H${String(index + 1).padStart(2, '0')}`]) !== 0 ? Number(record[`H${String(index + 1).padStart(2, '0')}`]) : null)
      if (item) item.values.push(...values)
      else items.push({ magnitude: record.MAGNITUD, label: record.MAGNITUD, unit: 'µg/m³', values })
      chart.stations[record.ESTACION] = items
    }
  }
  await writeFile(new URL('./latest.json', outputDirectory), JSON.stringify({ ...latest, chart }, null, 2) + '\n')
}
console.log(`Convertidas ${rows.length} filas en ${days.size} días: ${[...days.keys()].sort().join(', ')}`)

function parseTsv(source) {
  const lines = source.split(/\r?\n/).filter((line) => line.trim())
  const headers = splitTsvLine(lines.shift()).map((header) => header.replace(/^"|"$/g, ''))
  return lines.map((line) => Object.fromEntries(splitTsvLine(line).map((value, index) => [headers[index], value.replace(/^"|"$/g, '')])))
}

function splitTsvLine(line) {
  const cells = []
  let cell = ''
  let quoted = false
  for (const character of line) {
    if (character === '"') quoted = !quoted
    else if (character === '\t' && !quoted) { cells.push(cell); cell = '' }
    else cell += character
  }
  cells.push(cell)
  return cells
}
