import { mkdir, writeFile } from 'node:fs/promises'

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
await writeFile(new URL('./latest.json', directory), content)
await writeFile(new URL(`./history/${day}.json`, directory), content)
console.log(`Guardadas ${payload.records?.length ?? 0} lecturas de ${timestamp}`)
