export interface Coords {
  latitude: number;
  longitude: number;
}

/** Pide la ubicación GPS del dispositivo (requiere HTTPS y permiso del usuario). */
export function getCurrentPosition(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Tu dispositivo no permite geolocalización'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: Math.round(pos.coords.latitude * 1e7) / 1e7,
          longitude: Math.round(pos.coords.longitude * 1e7) / 1e7,
        }),
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'Permiso de ubicación denegado. Actívalo en los ajustes del navegador.'
            : 'No se pudo obtener tu ubicación. Intenta de nuevo.';
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  });
}

/** Ver el punto en el mapa de Google. */
export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/** Ruta directa "cómo llegar" en Google Maps. */
export function googleDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function wazeUrl(lat: number, lng: number): string {
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}
