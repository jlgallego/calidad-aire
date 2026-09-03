import { useEffect, useMemo, useState } from 'react'
import { caqiColor, fetchAirData, type AirQualitySnapshot, type AirStation } from './airQuality'
import MapView from './MapView'
import './App.css'

type Station = AirStation

const stations: Station[] = [
  { id: '56', name: 'Plaza Elíptica', area: 'Usera', address: 'Plaza Elíptica - Avda. Oporto', latitude: 40.385, longitude: -3.718, x: 28, y: 70, index: 78, status: 'Malo', color: caqiColor(78), values: [['NO₂', '78', 'µg/m³'], ['PM₂.₅', '19', 'µg/m³'], ['PM₁₀', '34', 'µg/m³'], ['O₃', '41', 'µg/m³']], series: [35,42,40,48,52,47,55,59,62,57,65,71,76,73,78,74,69,72,77,80,76,78,78,78], chartSeries: [{ label: 'NO₂', unit: 'µg/m³', values: [35,42,40,48,52,47,55,59,62,57,65,71,76,73,78,74,69,72,77,80,76,78,78,78], color: '#d66c3e' }], exceedances: [] },
  { id: '8', name: 'Escuelas Aguirre', area: 'Retiro', address: 'Entre C/ Alcalá y C/ O’ Donell', latitude: 40.421, longitude: -3.682, x: 67, y: 41, index: 36, status: 'Bueno', color: caqiColor(36), values: [['NO₂', '36', 'µg/m³'], ['PM₂.₅', '8', 'µg/m³'], ['PM₁₀', '16', 'µg/m³'], ['O₃', '73', 'µg/m³']], series: [25,29,27,31,30,33,37,34,38,36,33,35,39,42,40,37,35,32,34,36,38,36,35,36], chartSeries: [{ label: 'NO₂', unit: 'µg/m³', values: [25,29,27,31,30,33,37,34,38,36,33,35,39,42,40,37,35,32,34,36,38,36,35,36], color: '#d66c3e' }], exceedances: [] },
  { id: '18', name: 'Farolillo', area: 'Carabanchel', x: 20, y: 45, index: 22, status: 'Muy bueno', color: caqiColor(22), values: [['NO₂', '22', 'µg/m³'], ['PM₂.₅', '6', 'µg/m³'], ['PM₁₀', '12', 'µg/m³'], ['O₃', '61', 'µg/m³']], series: [18,20,17,21,19,24,22,20,23,21,19,20,22,24,23,22,21,19,22,23,21,20,22,22], chartSeries: [{ label: 'NO₂', unit: 'µg/m³', values: [18,20,17,21,19,24,22,20,23,21,19,20,22,24,23,22,21,19,22,23,21,20,22,22], color: '#d66c3e' }], exceedances: [] },
  { id: '24', name: 'Casa de Campo', area: 'Moncloa', x: 38, y: 27, index: 18, status: 'Muy bueno', color: caqiColor(18), values: [['NO₂', '18', 'µg/m³'], ['PM₂.₅', '5', 'µg/m³'], ['PM₁₀', '11', 'µg/m³'], ['O₃', '68', 'µg/m³']], series: [15,17,14,16,18,19,17,20,18,16,15,17,19,18,20,18,17,19,18,17,16,18,18,18], chartSeries: [{ label: 'NO₂', unit: 'µg/m³', values: [15,17,14,16,18,19,17,20,18,16,15,17,19,18,20,18,17,19,18,17,16,18,18,18], color: '#d66c3e' }], exceedances: [] },
  { id: '35', name: 'Plaza Castilla', area: 'Chamartín', x: 74, y: 18, index: 28, status: 'Bueno', color: caqiColor(28), values: [['NO₂', '28', 'µg/m³'], ['PM₂.₅', '7', 'µg/m³'], ['PM₁₀', '14', 'µg/m³'], ['O₃', '58', 'µg/m³']], series: [22,24,23,25,26,28,27,25,27,29,28,26,27,30,29,28,27,29,28,27,28,28,28,28], chartSeries: [{ label: 'NO₂', unit: 'µg/m³', values: [22,24,23,25,26,28,27,25,27,29,28,26,27,30,29,28,27,29,28,27,28,28,28,28], color: '#d66c3e' }], exceedances: [] },
]

const caqiLevels = [
  ['Muy bueno', '0–25', '#4d9700'],
  ['Bueno', '26–50', '#d4d000'],
  ['Regular', '51–75', '#ffc000'],
  ['Malo', '76–100', '#ff8a00'],
  ['Muy malo', '>100', '#9b3500'],
] as const

const coveragePalette = {
  valid: '#2bb673',
  partial: '#9ca3a0',
  missing: '#111111',
} as const

function formatShortDate(date: string): string {
  if (!date) return '—'
  const [year, month, day] = date.split('-')
  if (!year || !month || !day) return date
  return `${day}/${month}/${year}`
}

function CoverageMatrix({ rows, labels, title }: { rows: Array<{ stationId: string; stationName: string; values: Array<'valid' | 'partial' | 'missing'> }>; labels: string[]; title: string }) {
  const labelWidth = title === 'Horas' ? 120 : 150
  return <div className="coverage-matrix-wrap"><div className="coverage-matrix" style={{ gridTemplateColumns: `${labelWidth}px repeat(${labels.length}, minmax(5px, 1fr))` }}>
    <span className="coverage-axis-title">{title}</span>
    {labels.map((label) => <span key={label} className="coverage-label">{label}</span>)}
    {rows.map((row) => <div key={row.stationId} className="coverage-row">
      <span className="coverage-station">{row.stationId} · {row.stationName}</span>
      {row.values.map((state, index) => <span key={`${row.stationId}-${index}`} className="coverage-cell" title={`${row.stationName} · ${labels[index]}`} style={{ background: coveragePalette[state] }} />)}
    </div>)}
  </div></div>
}

function TrendChart({ series, dates }: { series: Station['chartSeries']; dates: string[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const values = series.flatMap((item) => item.values.filter((value): value is number => value !== null))
  const max = Math.max(...values, 1) + 50
  const length = Math.max(...series.map((item) => item.values.length), 1)
  const xForIndex = (index: number) => (index / Math.max(length - 1, 1)) * 100
  const yForValue = (value: number) => 100 - (value / max) * 100
  const pointsFor = (valuesList: (number | null)[]) => valuesList.reduce<Array<Array<string>>>((segments, value, index) => {
    if (value === null) return [...segments, []]
    const point = `${xForIndex(index)},${yForValue(value)}`
    const current = segments.at(-1) ?? []
    return [...segments.slice(0, -1), [...current, point]]
  }, [[]]).filter((segment) => segment.length > 1).map((segment) => segment.join(' '))
  const index = hoverIndex ?? 0
  const yTicks = Array.from({ length: 5 }, (_, position) => {
    const tickValue = Math.round((max * position) / 4)
    return { value: tickValue, top: yForValue(tickValue) }
  })
  const hourTicks = dates.flatMap((date, dayIndex) => [0, 6, 12, 18].map((hour) => {
    const pointIndex = dayIndex * 24 + hour
    if (pointIndex >= length) return null
    return { key: `${date}-${hour}`, hour, x: xForIndex(pointIndex), label: `${String(hour).padStart(2, '0')}h` }
  }).filter((tick): tick is { key: string; hour: number; x: number; label: string } => tick !== null))

  const dateTimeFor = (pointIndex: number) => {
    const dayIndex = Math.floor(pointIndex / 24)
    const hour = pointIndex % 24
    const day = dates[dayIndex] ?? dates[dates.length - 1] ?? 'Sin fecha'
    if (!day) return 'Sin fecha'
    const formatted = formatShortDate(day)
    return `${formatted} ${String(hour).padStart(2, '0')}:00`
  }

  const tooltipItems = [...series]
    .map((item) => ({ ...item, value: item.values[index] }))
    .filter((item) => item.value !== null && Number.isFinite(item.value))
    .sort((left, right) => Number(right.value) - Number(left.value))

  return <div className="chart" onMouseLeave={() => setHoverIndex(null)}>
    <div className="chart-shell">
      <div className="chart-scale">
        {yTicks.map((tick) => <span key={tick.value} style={{ top: `${tick.top}%` }}>{tick.value}</span>)}
      </div>
      <div className="chart-area-wrap">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Lecturas de todas las magnitudes de los últimos tres días" onMouseMove={(event) => setHoverIndex(Math.max(0, Math.min(length - 1, Math.round((event.nativeEvent.offsetX / event.currentTarget.clientWidth) * (length - 1)))))}>
          {dates.map((date, dayIndex) => <rect className="day-shade" key={date} x={(dayIndex * 24 / Math.max(length, 1)) * 100} y="0" width={(24 / Math.max(length, 1)) * 100} height="100" style={{ opacity: dayIndex % 2 ? .06 : .015 }} />)}
          {hoverIndex !== null && <line className="chart-guide" x1={xForIndex(index)} x2={xForIndex(index)} y1="0" y2="100" />}
          {series.flatMap((item) => pointsFor(item.values).map((points, pathIndex) => <polyline key={`${item.label}-${pathIndex}`} points={points} style={{ stroke: item.color }} />))}
          <rect className="chart-hit-area" x="0" y="0" width="100" height="100" />
        </svg>
        <div className="chart-x-axis">
          {hourTicks.map((tick) => <span key={tick.key} style={{ left: `${tick.x}%` }}>{tick.label}</span>)}
        </div>
      </div>
    </div>
    <div className="chart-dates">{dates.map((date) => <span key={date}>{formatShortDate(date)}</span>)}</div>
    {hoverIndex !== null && <div className="chart-tooltip" style={{ left: `${Math.max(12, Math.min(88, xForIndex(index)))}%` }}><b>{dateTimeFor(index)}</b>{tooltipItems.length ? tooltipItems.map((item) => <span key={`${item.label}-${item.magnitudeId ?? 'unknown'}`} style={{ color: item.color }}><i />{item.label}: {item.value} {item.unit}</span>) : <span><i />Sin dato</span>}</div>}
  </div>
}

function App() {
  const [stationData, setStationData] = useState(stations)
  const [snapshot, setSnapshot] = useState<AirQualitySnapshot | null>(null)
  const [selectedId, setSelectedId] = useState('56')
  const [activeTab, setActiveTab] = useState('Mapa')
  useEffect(() => {
    let active = true
    const refresh = () => fetchAirData('./data/latest.json').catch(() => fetchAirData()).then((freshSnapshot) => { if (active && freshSnapshot.stations.length) { setSnapshot(freshSnapshot); setStationData(freshSnapshot.stations); setSelectedId(freshSnapshot.stations[0].id) } }).catch(() => undefined)
    refresh()
    const interval = window.setInterval(refresh, 20 * 60 * 1000)
    return () => { active = false; window.clearInterval(interval) }
  }, [])
  const selected = useMemo(() => stationData.find((station) => station.id === selectedId) ?? stationData[0], [selectedId, stationData])
  const averageIndex = stationData.length ? Math.round(stationData.reduce((total, station) => total + station.index, 0) / stationData.length) : 0
  const poorStations = stationData.filter((station) => station.index > 75).length
  const updatedAt = snapshot?.responseDate ? new Date(snapshot.responseDate).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sin fecha'
  const missingGroups = snapshot ? [
    snapshot.missingStations.length ? { title: 'Estaciones sin datos', items: snapshot.missingStations } : null,
    snapshot.missingMagnitudes.length ? { title: 'Magnitudes pendientes', items: snapshot.missingMagnitudes } : null,
  ].filter(Boolean) as Array<{ title: string; items: string[] }> : []
  const missingSummary = snapshot ? missingGroups.length ? missingGroups.map(({ title, items }) => `${title}: ${items.join('; ')}`).join(' · ') : 'Sin incidencias de cobertura' : 'Esperando el snapshot real del Ayuntamiento.'
  const hourlyCoverage = snapshot?.coverage.hourly ?? []
  const dailyCoverage = snapshot?.coverage.daily ?? []
  const dailyLabels = (snapshot?.coverage.dailyDates ?? []).map((date) => formatShortDate(date).slice(0, 5))

  return <main>
    <header className="topbar"><div className="brand"><span className="brand-mark">A</span><span>AIRE <b>MADRID</b></span></div><nav>{['Mapa', 'Indicadores', 'Umbrales'].map((tab) => <button className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)} key={tab}>{tab}</button>)}</nav><div className="live"><span /> ACTUALIZADO HACE 4 MIN</div></header>
    <section className="intro"><div><p className="eyebrow">RED DE VIGILANCIA · MADRID</p><h1>El aire que<br /><em>respiramos.</em></h1></div><p className="intro-copy">Una lectura clara y actualizada de la calidad del aire en la ciudad. Datos abiertos del Ayuntamiento de Madrid.</p></section>
    <section className="dashboard"><div className="map-panel"><div className="panel-heading"><div><p className="eyebrow">SITUACIÓN ACTUAL</p><h2>Mapa de estaciones</h2></div><span className="date-chip" title={`Última respuesta del portal: ${updatedAt}`}>DATOS CADA 20 MIN · {updatedAt}</span></div><div className="map"><MapView stations={stationData} selectedId={selectedId} onSelect={setSelectedId} /></div><div className="legend">{caqiLevels.map(([label, range, color]) => <div key={label} className="legend-level"><span className="legend-swatch" style={{ background: color }} /><div className="legend-text"><span>{label}</span><small>{range}</small></div></div>)}<span className="source" aria-label={missingSummary}><span className="source-indicator">●</span>{stationData.length} / {snapshot?.expectedStations ?? 24} estaciones con datos{missingGroups.length ? <span className="source-tooltip"><strong>Datos pendientes</strong>{missingGroups.map(({ title, items }) => <div key={title} className="source-tooltip-group"><span>{title}</span><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></div> )}</span> : null}</span></div></div>
      <aside className="detail-panel"><div className="detail-head"><div><p className="eyebrow">ESTACIÓN {selected.id}</p><h2>{selected.name}</h2><p className="muted">{selected.area} · Madrid</p></div><span className="status" style={{ '--station-color': selected.color } as React.CSSProperties}><i />{selected.status}</span></div><div className="score"><div className="score-copy"><strong>{selected.index}</strong><span className="score-label">Índice CAQI<br />0 - 125+</span><span className="score-status" style={{ color: selected.color }}>{selected.status}</span></div><div className="score-ring" style={{ '--station-color': selected.color, '--score-progress': `${Math.min(100, selected.index / 1.25)}%` } as React.CSSProperties} /></div><div className="measurements">{selected.values.map(([label, value, unit, magnitudeId]) => { const color = selected.chartSeries.find((item) => item.magnitudeId === magnitudeId)?.color ?? selected.chartSeries.find((item) => item.label === label)?.color ?? '#173b3b'; return <div key={`${label}-${magnitudeId ?? 'unknown'}`}><b style={{ color }}>{label}</b><strong>{value}</strong><span>{unit}</span></div> })}</div><div className="detail-chart"><div className="chart-title"><span>LECTURAS · ÚLTIMOS 3 DÍAS</span><b>TODAS</b></div><TrendChart series={selected.chartSeries} dates={selected.chartDates ?? [snapshot?.responseDate?.slice(0, 10) ?? 'Sin fecha']} /></div><p className="alert"><span>!</span>{selected.exceedances.length ? selected.exceedances.join(' · ') : 'Sin superaciones registradas hoy'}</p></aside>
    </section>
    <section className="indicators"><div className="section-heading"><div><p className="eyebrow">RESUMEN DE LA RED</p><h2>Indicadores principales</h2></div><button className="outline-button">Ver histórico <span>↗</span></button></div><div className="indicator-grid"><article title="Número de estaciones que han aportado al menos una magnitud válida en la última respuesta del portal."><span className="indicator-icon teal">◌</span><p>ESTACIONES ACTIVAS</p><strong>{stationData.length} <small>/ {snapshot?.expectedStations ?? 24}</small></strong><span className="trend up">Cobertura del snapshot</span></article><article title="Media aritmética del ICA calculado en las estaciones con lecturas válidas."><span className="indicator-icon orange">≈</span><p>ÍNDICE MEDIO</p><strong>{averageIndex} <small>CAQI</small></strong><span className="trend">Media de la red actual</span></article><article title="Estaciones cuyo ICA actual está en los niveles Malo o Muy malo (CAQI superior a 75)."><span className="indicator-icon red">!</span><p>ICA ELEVADO</p><strong>{poorStations} <small>estaciones</small></strong><span className="trend warning">CAQI &gt; 75</span></article><article title="Fecha y hora responseDate devueltas por la API del Ayuntamiento de Madrid."><span className="indicator-icon blue">◷</span><p>ÚLTIMA ACTUALIZACIÓN</p><strong>{updatedAt.split(',')[1]?.trim() ?? '--:--'} <small>h</small></strong><span className="trend up">● Datos del portal</span></article></div></section>
    <section className="coverage-section">
      <div className="section-heading"><div><p className="eyebrow">COBERTURA DE LA RED</p><h2>Datos faltantes por estación</h2></div></div>
      <div className="coverage-legend"><span><i style={{ background: coveragePalette.valid }} />Sin faltas</span><span><i style={{ background: coveragePalette.partial }} />Faltan algunas</span><span><i style={{ background: coveragePalette.missing }} />Sin datos</span></div>
      <div className="coverage-panels">
        <div className="coverage-card"><h3>Horas del día actual</h3><CoverageMatrix rows={hourlyCoverage} labels={Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'))} title="Horas" /></div>
        <div className="coverage-card"><h3>Últimos 30 días</h3><CoverageMatrix rows={dailyCoverage} labels={dailyLabels} title="Días" /></div>
      </div>
    </section>
    <footer><span>AIRE MADRID · DATOS ABIERTOS</span><span>Fuente: Ayuntamiento de Madrid <b>↗</b></span></footer>
  </main>
}

export default App
