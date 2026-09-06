export interface Coords {
  latitude: number;
  longitude: number;
}

export type GeoErrorCode = 'denied' | 'unavailable' | 'timeout' | 'unsupported';

export interface GeoError extends Error {
  code: GeoErrorCode;
}

const DEFAULT_OPTS: PositionOptions = { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 };

/**
 * Pide la ubicación GPS del dispositivo (requiere HTTPS y permiso del usuario).
 * Solo debe llamarse tras una acción explícita del usuario, nunca al cargar.
 * El `Error` que rechaza lleva `.code` para distinguir el estado en la UI.
 */
export function getCurrentPosition(opts: PositionOptions = {}): Promise<Coords> {
  const options = { ...DEFAULT_OPTS, ...opts };
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      reject(fail('unsupported', 'Tu dispositivo no permite geolocalización'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: Math.round(pos.coords.latitude * 1e7) / 1e7,
          longitude: Math.round(pos.coords.longitude * 1e7) / 1e7,
        }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(
            fail(
              'denied',
              'Permiso de ubicación denegado. Actívalo en los ajustes del navegador.',
            ),
          );
        } else if (err.code === err.TIMEOUT) {
          reject(fail('timeout', 'La ubicación tardó demasiado. Intenta de nuevo.'));
        } else {
          reject(fail('unavailable', 'No se pudo obtener tu ubicación. Intenta de nuevo.'));
        }
      },
      options,
    );
  });
}

function fail(code: GeoErrorCode, message: string): GeoError {
  return Object.assign(new Error(message), { code });
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
