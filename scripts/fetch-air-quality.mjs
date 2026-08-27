import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'

const source = 'https://ciudadesabiertas.madrid.es/dynamicAPI/API/query/calair_tiemporeal.json?pageSize=5000'
const response = await fetch(source)
if (!response.ok) throw new Error(`Madrid API respondió ${response.status}`)
const payload = await response.json()
const timestamp = payload.responseDate ?? new Date().toISOString()
const day = timestamp.slice(0, 10)
const directory = new URL('../public/data/', import.meta.url)
await mkdir(directory, { recursive: true })
await mkdir(new URL('./history/', directory), { recursive: true })
const content = JSON.stringify({ ...payload, source, capturedAt: timestamp }, null, 2) + '\n'
await writeFile(new URL(`./history/${day}.json`, directory), content)
const files = (await readdir(new URL('./history/', directory))).filter((file) => file.endsWith('.json')).sort().slice(-3)
const dayPayloads = await Promise.all(files.map(async (file) => JSON.parse(await readFile(new URL(`./history/${file}`, directory), 'utf8'))))
const dates = files.map((file) => file.slice(0, 10))
const chartStations = {}
for (const dayPayload of dayPayloads) {
	for (const record of dayPayload.records ?? []) {
		const station = chartStations[record.ESTACION] ?? []
		const existing = station.find((item) => item.magnitude === record.MAGNITUD)
		if (existing) existing.values.push(...Array.from({ length: 24 }, (_, index) => record[`V${String(index + 1).padStart(2, '0')}`] === 'V' && Number(record[`H${String(index + 1).padStart(2, '0')}`]) !== 0 ? Number(record[`H${String(index + 1).padStart(2, '0')}`]) : null))
		else station.push({ magnitude: record.MAGNITUD, label: record.MAGNITUD, unit: 'µg/m³', values: Array.from({ length: 24 }, (_, index) => record[`V${String(index + 1).padStart(2, '0')}`] === 'V' && Number(record[`H${String(index + 1).padStart(2, '0')}`]) !== 0 ? Number(record[`H${String(index + 1).padStart(2, '0')}`]) : null) })
		chartStations[record.ESTACION] = station
	}
}
const labels = { '1': 'SO₂', '7': 'NO₂', '8': 'PM₂.₅', '9': 'PM₁₀', '10': 'PM₁₀', '14': 'O₃' }
for (const station of Object.values(chartStations)) for (const item of station) item.label = labels[item.magnitude] ?? item.label
const chart = { dates, stations: Object.fromEntries(Object.entries(chartStations).map(([id, items]) => [id, items.map(({ label, unit, values }) => ({ label, unit, values }))])) }
await writeFile(new URL('./latest.json', directory), JSON.stringify({ ...payload, source, capturedAt: timestamp, chart }, null, 2) + '\n')
console.log(`Guardadas ${payload.records?.length ?? 0} lecturas de ${timestamp}`)
