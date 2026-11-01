"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { loadLeaflet, TILE_ATTRIBUTION, TILE_URL } from "./leaflet";

export interface MapStop {
  id: string;
  n: number;
  lat: number;
  lng: number;
  title: string;
  kind: string;
  time?: string | null;
}

/**
 * Interactive itinerary map (Leaflet). Numbered markers match the itinerary list; selecting a
 * marker selects the stop and vice-versa. Lines connect stops in visiting order — they are not
 * turn-by-turn routes, which is stated in the on-map note and handed off to Google Maps.
 */
export function TripMap({ stops, selectedId, onSelect, home, center, active = true }: { stops: MapStop[]; selectedId: string | null; onSelect: (id: string) => void; home?: { lat: number; lng: number; label: string } | null; center: { lat: number; lng: number }; active?: boolean }) {
  const t = useTranslations("map");
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const markers = useRef(new Map<string, import("leaflet").Marker>());
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    loadLeaflet()
      .then((L) => {
        if (disposed || !el.current || mapRef.current) return;
        LRef.current = L;
        const map = L.map(el.current, { zoomControl: true, attributionControl: true }).setView([center.lat, center.lng], 13);
        L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
        layerRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;
        setReady(true);
      })
      .catch(() => setFailed(true));
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The map container may be hidden on mobile; recompute size when it becomes visible.
  useEffect(() => {
    if (active && mapRef.current) setTimeout(() => mapRef.current?.invalidateSize(), 50);
  }, [active]);

  // Redraw markers & path when the stops change.
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !L || !map || !layer) return;
    layer.clearLayers();
    markers.current.clear();
    const pts: [number, number][] = [];
    // Stops at the same spot (e.g. "lunch near X" right after X) are fanned out sideways so every
    // marker stays visible and clickable; the route line still uses the true coordinates.
    const seen = new Map<string, number>();
    const fan = (lat: number, lng: number): [number, number] => {
      const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
      const k = seen.get(key) ?? 0;
      seen.set(key, k + 1);
      const shift = k === 0 ? 0 : Math.ceil(k / 2) * 24 * (k % 2 ? 1 : -1);
      return [15 - shift, 30];
    };
    if (home) {
      const icon = L.divIcon({ className: "", html: `<div class="tp-marker tp-marker--home"><span>★</span></div>`, iconSize: [30, 30], iconAnchor: fan(home.lat, home.lng) });
      L.marker([home.lat, home.lng], { icon, title: home.label, keyboard: true }).bindTooltip(home.label).addTo(layer);
      pts.push([home.lat, home.lng]);
    }
    const path: [number, number][] = home ? [[home.lat, home.lng]] : [];
    for (const s of stops) {
      const cls = s.kind === "meal" ? "tp-marker--meal" : s.kind === "break" ? "tp-marker--break" : "";
      const anchor = fan(s.lat, s.lng);
      const icon = L.divIcon({ className: "", html: `<div class="tp-marker ${cls}" data-id="${s.id}"><span>${s.n}</span></div>`, iconSize: [30, 30], iconAnchor: anchor });
      const m = L.marker([s.lat, s.lng], { icon, title: `${s.n}. ${s.title}`, keyboard: true, riseOnHover: true, alt: `${s.n}. ${s.title}` });
      m.bindTooltip(`${s.n}. ${escapeHtml(s.title)}${s.time ? ` · ${s.time}` : ""}`, { direction: "top", offset: [15 - anchor[0], -28] });
      m.on("click", () => onSelectRef.current(s.id));
      m.on("keypress", (e: { originalEvent: KeyboardEvent }) => e.originalEvent.key === "Enter" && onSelectRef.current(s.id));
      m.addTo(layer);
      markers.current.set(s.id, m);
      pts.push([s.lat, s.lng]);
      const last = path[path.length - 1];
      if (!last || last[0] !== s.lat || last[1] !== s.lng) path.push([s.lat, s.lng]);
    }
    if (path.length > 1) L.polyline(path, { color: "#173B67", weight: 3, opacity: 0.6, dashArray: "6 8" }).addTo(layer);
    if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.2), { maxZoom: 15, animate: false });
    else map.setView([center.lat, center.lng], 12);
  }, [stops, home, ready, center.lat, center.lng]);

  // Highlight selection.
  useEffect(() => {
    if (!ready) return;
    markers.current.forEach((m, id) => {
      const node = m.getElement()?.querySelector(".tp-marker");
      node?.classList.toggle("is-selected", id === selectedId);
      if (id === selectedId) {
        m.setZIndexOffset(1000);
        mapRef.current?.panTo(m.getLatLng(), { animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches });
      } else m.setZIndexOffset(0);
    });
  }, [selectedId, ready, stops]);

  if (failed) return <div className="map-fallback">{t("unavailable")}</div>;
  return (
    <>
      <div ref={el} className="map-canvas" role="region" aria-label={t("label")} />
      <p className="map-note">{t("note")}</p>
    </>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
