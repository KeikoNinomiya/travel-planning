"use client";

import { useEffect, useRef } from "react";
import type { Map as MLMap, Marker, GeoJSONSource } from "maplibre-gl";
import type { Stop } from "@/lib/types";
import { dayColor } from "@/lib/trip-utils";

/** OpenStreetMap データの無料ベクタータイル（APIキー不要） */
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

interface Props {
  /** 表示する日ごとのスポット（並び順どおり） */
  days: { dayIndex: number; stops: Stop[] }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  picking: boolean;
  onPick: (lat: number, lng: number) => void;
  /** この値が変わったときに表示範囲を合わせ直す */
  fitKey: string;
}

export default function MapView({ days, selectedId, onSelect, picking, onPick, fitKey }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const ready = useRef(false);
  const lib = useRef<typeof import("maplibre-gl") | null>(null);
  const latest = useRef({ days, selectedId, onSelect, picking, onPick });
  latest.current = { days, selectedId, onSelect, picking, onPick };

  // 地図の初期化（一度だけ）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ml = await import("maplibre-gl");
      if (cancelled || !box.current) return;
      lib.current = ml;
      const m = new ml.Map({
        container: box.current,
        style: STYLE_URL,
        center: [135.6, 34.85],
        zoom: 9,
        attributionControl: { compact: true },
      });
      m.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
      m.on("load", () => {
        m.addSource("routes", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        m.addLayer({
          id: "routes",
          type: "line",
          source: "routes",
          paint: { "line-color": ["get", "color"], "line-width": 3, "line-dasharray": [2, 1.6], "line-opacity": 0.85 },
          layout: { "line-cap": "round", "line-join": "round" },
        });
        ready.current = true;
        draw();
        fit();
      });
      m.on("click", (e) => {
        if (latest.current.picking) latest.current.onPick(+e.lngLat.lat.toFixed(6), +e.lngLat.lng.toFixed(6));
      });
      map.current = m;
    })();
    return () => {
      cancelled = true;
      markers.current.forEach((mk) => mk.remove());
      markers.current = [];
      map.current?.remove();
      map.current = null;
      ready.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw() {
    const m = map.current;
    const ml = lib.current;
    if (!m || !ml || !ready.current) return;
    const { days: ds, selectedId: sel } = latest.current;

    markers.current.forEach((mk) => mk.remove());
    markers.current = [];

    const features: GeoJSON.Feature[] = [];
    for (const d of ds) {
      const color = dayColor(d.dayIndex);
      const coords: [number, number][] = [];
      d.stops.forEach((s, i) => {
        if (s.lat == null || s.lng == null) return;
        coords.push([s.lng, s.lat]);
        const el = document.createElement("button");
        el.type = "button";
        el.className = "marker" + (s.id === sel ? " sel" : "");
        el.style.background = color;
        el.textContent = String(i + 1);
        el.title = s.name;
        el.setAttribute("aria-label", `${i + 1}. ${s.name}`);
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          latest.current.onSelect(s.id);
        });
        const mk = new ml.Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(m);
        markers.current.push(mk);
      });
      if (coords.length > 1) {
        features.push({ type: "Feature", properties: { color }, geometry: { type: "LineString", coordinates: coords } });
      }
    }
    (m.getSource("routes") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features });
  }

  function fit() {
    const m = map.current;
    const ml = lib.current;
    if (!m || !ml) return;
    const pts = latest.current.days.flatMap((d) => d.stops).filter((s) => s.lat != null && s.lng != null);
    if (!pts.length) return;
    const b = new ml.LngLatBounds();
    pts.forEach((s) => b.extend([s.lng as number, s.lat as number]));
    m.fitBounds(b, { padding: 60, maxZoom: 15, duration: 600 });
  }

  // データや選択が変わったら描き直す
  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, selectedId]);

  // 表示する日が変わったら範囲を合わせる
  useEffect(() => {
    if (ready.current) fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  // 選択したスポットへ移動
  useEffect(() => {
    const m = map.current;
    if (!m || !selectedId) return;
    const s = days.flatMap((d) => d.stops).find((x) => x.id === selectedId);
    if (s?.lat != null && s.lng != null) m.easeTo({ center: [s.lng, s.lat], duration: 500 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    const c = map.current?.getCanvas();
    if (c) c.style.cursor = picking ? "crosshair" : "";
  }, [picking]);

  return <div ref={box} className="map" />;
}
