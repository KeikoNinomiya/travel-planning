/**
 * スポット検索（OpenStreetMap のデータを使う Photon API）
 * https://photon.komoot.io — 無料・APIキー不要。大量アクセスは避けてください。
 */
export interface PlaceResult {
  id: string;
  name: string;
  detail: string;
  lat: number;
  lng: number;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    osm_type?: string;
    name?: string;
    street?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
  };
}

export async function searchPlaces(
  query: string,
  near?: { lat: number; lng: number },
  signal?: AbortSignal,
): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({ q, limit: "7", lang: "default" });
  if (near) {
    params.set("lat", String(near.lat));
    params.set("lon", String(near.lng));
  }
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, { signal });
  if (!res.ok) throw new Error("スポット検索に失敗しました。時間をおいて再度お試しください。");
  const json = (await res.json()) as { features: PhotonFeature[] };
  return json.features
    .filter((f) => f.properties.name)
    .map((f, i) => {
      const p = f.properties;
      const detail = [p.state, p.city ?? p.county, p.district, p.street].filter(Boolean).join(" ");
      return {
        id: `${p.osm_type ?? "x"}${p.osm_id ?? i}`,
        name: p.name as string,
        detail: detail || (p.country ?? ""),
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
      };
    });
}
