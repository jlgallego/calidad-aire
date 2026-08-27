import { useEffect, useMemo, useState } from 'react'
import { caqiColor, fetchAirData, type AirQualitySnapshot } from './airQuality'
import MapView from './MapView'
import './App.css'

type Station = { id: string; name: string; area: string; x: number; y: number; index: number; status: string; color: string; values: [string, string, string][]; series: number[] }

const stations: Station[] = [
  { id: '56', name: 'Plaza Elíptica', area: 'Usera', x: 28, y: 70, index: 78, status: 'Malo', color: caqiColor(78), values: [['NO₂', '78', 'µg/m³'], ['PM₂.₅', '19', 'µg/m³'], ['PM₁₀', '34', 'µg/m³'], ['O₃', '41', 'µg/m³']], series: [35,42,40,48,52,47,55,59,62,57,65,71,76,73,78,74,69,72,77,80,76,78,78,78] },
  { id: '8', name: 'Escuelas Aguirre', area: 'Retiro', x: 67, y: 41, index: 36, status: 'Bueno', color: caqiColor(36), values: [['NO₂', '36', 'µg/m³'], ['PM₂.₅', '8', 'µg/m³'], ['PM₁₀', '16', 'µg/m³'], ['O₃', '73', 'µg/m³']], series: [25,29,27,31,30,33,37,34,38,36,33,35,39,42,40,37,35,32,34,36,38,36,35,36] },
  { id: '18', name: 'Farolillo', area: 'Carabanchel', x: 20, y: 45, index: 22, status: 'Muy bueno', color: caqiColor(22), values: [['NO₂', '22', 'µg/m³'], ['PM₂.₅', '6', 'µg/m³'], ['PM₁₀', '12', 'µg/m³'], ['O₃', '61', 'µg/m³']], series: [18,20,17,21,19,24,22,20,23,21,19,20,22,24,23,22,21,19,22,23,21,20,22,22] },
  { id: '24', name: 'Casa de Campo', area: 'Moncloa', x: 38, y: 27, index: 18, status: 'Muy bueno', color: caqiColor(18), values: [['NO₂', '18', 'µg/m³'], ['PM₂.₅', '5', 'µg/m³'], ['PM₁₀', '11', 'µg/m³'], ['O₃', '68', 'µg/m³']], series: [15,17,14,16,18,19,17,20,18,16,15,17,19,18,20,18,17,19,18,17,16,18,18,18] },
  { id: '35', name: 'Plaza Castilla', area: 'Chamartín', x: 74, y: 18, index: 28, status: 'Bueno', color: caqiColor(28), values: [['NO₂', '28', 'µg/m³'], ['PM₂.₅', '7', 'µg/m³'], ['PM₁₀', '14', 'µg/m³'], ['O₃', '58', 'µg/m³']], series: [22,24,23,25,26,28,27,25,27,29,28,26,27,30,29,28,27,29,28,27,28,28,28,28] },
]

const caqiLevels = [
  ['Muy bueno', '0–25', '#4d9700'],
  ['Bueno', '26–50', '#d4d000'],
  ['Regular', '51–75', '#ffc000'],
  ['Malo', '76–100', '#ff8a00'],
  ['Muy malo', '>100', '#9b3500'],
] as const

function TrendChart({ data }: { data: number[] }) {
  const points = data.map((value, index) => `${(index / (data.length - 1)) * 100},${100 - value}`).join(' ')
  return <div className="chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Lecturas de las últimas 24 horas"><path className="chart-area" d={`M 0,100 L ${points} L 100,100 Z`} /><polyline points={points} /></svg><div className="chart-labels">{['00','04','08','12','16','20','24'].map((hour) => <span key={hour}>{hour}h</span>)}</div></div>
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
  const missingSummary = snapshot ? `Faltan ${snapshot.missingStations.length} estaciones: ${snapshot.missingStations.join(', ') || 'ninguna'}. Magnitudes ausentes: ${snapshot.missingMagnitudes.join(', ') || 'ninguna'}.` : 'Esperando el snapshot real del Ayuntamiento.'
  return <main>
    <header className="topbar"><div className="brand"><span className="brand-mark">A</span><span>AIRE <b>MADRID</b></span></div><nav>{['Mapa', 'Indicadores', 'Umbrales'].map((tab) => <button className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)} key={tab}>{tab}</button>)}</nav><div className="live"><span /> ACTUALIZADO HACE 4 MIN</div></header>
    <section className="intro"><div><p className="eyebrow">RED DE VIGILANCIA · MADRID</p><h1>El aire que<br /><em>respiramos.</em></h1></div><p className="intro-copy">Una lectura clara y actualizada de la calidad del aire en la ciudad. Datos abiertos del Ayuntamiento de Madrid.</p></section>
    <section className="dashboard"><div className="map-panel"><div className="panel-heading"><div><p className="eyebrow">SITUACIÓN ACTUAL</p><h2>Mapa de estaciones</h2></div><span className="date-chip" title={`Última respuesta del portal: ${updatedAt}`}>DATOS CADA 20 MIN · {updatedAt}</span></div><div className="map"><MapView stations={stationData} selectedId={selectedId} onSelect={setSelectedId} /></div><div className="legend"><span><i className="level-very-good" />Muy bueno</span><span><i className="level-good" />Bueno</span><span><i className="level-regular" />Regular</span><span><i className="level-bad" />Malo</span><span><i className="level-very-bad" />Muy malo</span><span className="source" title={missingSummary}>● {stationData.length} / {snapshot?.expectedStations ?? 24} estaciones con datos</span></div></div>
      <aside className="detail-panel"><div className="detail-head"><div><p className="eyebrow">ESTACIÓN {selected.id}</p><h2>{selected.name}</h2><p className="muted">{selected.area} · Madrid</p></div><span className="status" style={{ '--station-color': selected.color } as React.CSSProperties}><i />{selected.status}</span></div><div className="score"><div className="score-copy"><strong>{selected.index}</strong><span className="score-label">Índice CAQI<br />0 - 125+</span><span className="score-status" style={{ color: selected.color }}>{selected.status}</span></div><div className="score-ring" style={{ '--station-color': selected.color, '--score-progress': `${Math.min(100, selected.index / 1.25)}%` } as React.CSSProperties} /></div><div className="measurements">{selected.values.map(([label, value, unit]) => <div key={label}><b>{label}</b><strong>{value}</strong><span>{unit}</span></div>)}</div><div className="detail-chart"><div className="chart-title"><span>LECTURAS · ÚLTIMAS 24 HORAS</span><b>NO₂</b></div><TrendChart data={selected.series} /></div><p className="alert"><span>!</span>{['Malo', 'Muy malo'].includes(selected.status) ? 'Superación de un umbral de calidad del aire' : 'Sin superaciones registradas hoy'}</p></aside>
    </section>
    <section className="indicators"><div className="section-heading"><div><p className="eyebrow">RESUMEN DE LA RED</p><h2>Indicadores principales</h2></div><button className="outline-button">Ver histórico <span>↗</span></button></div><div className="indicator-grid"><article title="Número de estaciones que han aportado al menos una magnitud válida en la última respuesta del portal."><span className="indicator-icon teal">◌</span><p>ESTACIONES ACTIVAS</p><strong>{stationData.length} <small>/ {snapshot?.expectedStations ?? 24}</small></strong><span className="trend up">Cobertura del snapshot</span></article><article title="Media aritmética del ICA calculado en las estaciones con lecturas válidas."><span className="indicator-icon orange">≈</span><p>ÍNDICE MEDIO</p><strong>{averageIndex} <small>CAQI</small></strong><span className="trend">Media de la red actual</span></article><article title="Estaciones cuyo ICA actual está en los niveles Malo o Muy malo (CAQI superior a 75)."><span className="indicator-icon red">!</span><p>ICA ELEVADO</p><strong>{poorStations} <small>estaciones</small></strong><span className="trend warning">CAQI &gt; 75</span></article><article title="Fecha y hora responseDate devueltas por la API del Ayuntamiento de Madrid."><span className="indicator-icon blue">◷</span><p>ÚLTIMA ACTUALIZACIÓN</p><strong>{updatedAt.split(',')[1]?.trim() ?? '--:--'} <small>h</small></strong><span className="trend up">● Datos del portal</span></article></div><div className="caqi-guide"><div><p className="eyebrow">ESCALA OFICIAL</p><h2>Niveles CAQI</h2></div><div className="caqi-levels">{caqiLevels.map(([label, range, color]) => <div key={label}><span className="level-bar" style={{ background: color }} /><strong>{label}</strong><small>CAQI {range}</small></div>)}</div></div></section>
    <footer><span>AIRE MADRID · DATOS ABIERTOS</span><span>Fuente: Ayuntamiento de Madrid <b>↗</b></span></footer>
  </main>
}

export default App
