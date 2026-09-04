import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/** Centro por defecto cuando aún no hay coordenadas: Santo Domingo. */
const DEFAULT_CENTER: [number, number] = [18.4861, -69.9312];

/** Pin dorado propio (emoji + sombra) — evita el bug conocido de rutas de imagen
 * del ícono por defecto de Leaflet con bundlers como Vite. */
const goldPin = L.divIcon({
  className: '',
  html: '<div style="font-size:28px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.55))">📍</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 26],
});

function ClickToMove({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Recentra el mapa cuando lat/lng cambian desde afuera (ej. al capturar GPS). */
function RecenterOnChange({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);
  return null;
}

export default function LocationPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const hasLocation = latitude != null && longitude != null;
  const center: [number, number] = hasLocation ? [latitude!, longitude!] : DEFAULT_CENTER;

  return (
    <div className="mt-2 h-56 overflow-hidden rounded-xl border border-white/10">
      <MapContainer center={center} zoom={hasLocation ? 16 : 12} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker
          position={center}
          draggable
          icon={goldPin}
          eventHandlers={{
            dragend: (e) => {
              const { lat, lng } = (e.target as L.Marker).getLatLng();
              onChange(lat, lng);
            },
          }}
        />
        <ClickToMove onChange={onChange} />
        {hasLocation && <RecenterOnChange lat={latitude!} lng={longitude!} />}
      </MapContainer>
    </div>
  );
}
