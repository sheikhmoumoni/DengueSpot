export interface Geocoder {
  reverse(point: {
    lat: number;
    lng: number;
  }): Promise<{ label: string; confidence: number } | null>;
}
export class ManualGeocoder implements Geocoder {
  async reverse() {
    return null;
  }
}
// A licensed provider can be injected without blocking coordinate-only submission.
