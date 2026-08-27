import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import type { AirStation } from './airQuality'
import 'leaflet/dist/leaflet.css'

type MapViewProps = { stations: AirStation[]; selectedId: string; onSelect: (id: string) => void }

export default function MapView({ stations, selectedId, onSelect }: MapViewProps) {
  return <MapContainer className="real-map" center={[40.4168, -3.7038]} zoom={11} scrollWheelZoom={false}>
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    {stations.filter((station) => station.latitude !== undefined && station.longitude !== undefined).map((station) => <CircleMarker key={station.id} center={[station.latitude!, station.longitude!]} radius={station.id === selectedId ? 12 : 9} pathOptions={{ color: '#fff', weight: 3, fillColor: station.color, fillOpacity: 1 }} eventHandlers={{ click: () => onSelect(station.id) }}>
      <Popup><strong>Estación {station.id}: {station.name}</strong><br />Índice: {station.index}<br />{station.address}</Popup>
    </CircleMarker>)}
  </MapContainer>
}
