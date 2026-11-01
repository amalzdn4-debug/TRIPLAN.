"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { loadLeaflet, TILE_ATTRIBUTION, TILE_URL } from "./leaflet";

/** Click/tap on the map to set a point (e.g. the accommodation). Keyboard users can type coordinates instead. */
export function LocationPicker({ center, value, onChange }: { center: { lat: number; lng: number }; value: { lat: number; lng: number } | null; onChange: (p: { lat: number; lng: number }) => void }) {
  const t = useTranslations("planner");
  const el = useRef<HTMLDivElement>(null);
  const marker = useRef<import("leaflet").Marker | null>(null);
  const map = useRef<import("leaflet").Map | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    let disposed = false;
    loadLeaflet().then((L) => {
      if (disposed || !el.current || map.current) return;
      const m = L.map(el.current, { scrollWheelZoom: false }).setView([value?.lat ?? center.lat, value?.lng ?? center.lng], 13);
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(m);
      const icon = L.divIcon({ className: "", html: '<div class="tp-marker tp-marker--home"><span>★</span></div>', iconSize: [30, 30], iconAnchor: [15, 30] });
      if (value) marker.current = L.marker([value.lat, value.lng], { icon }).addTo(m);
      m.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        const p = { lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) };
        if (marker.current) marker.current.setLatLng(e.latlng);
        else marker.current = L.marker(e.latlng, { icon }).addTo(m);
        cb.current(p);
      });
      map.current = m;
    });
    return () => {
      disposed = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng]);

  return (
    <div>
      <div ref={el} style={{ blockSize: 260, borderRadius: 12, overflow: "hidden", border: "1px solid var(--color-border)" }} role="application" aria-label={t("pickOnMap")} />
      <p className="field-hint" style={{ marginBlockStart: 6 }}>
        {t("pickOnMapHint")}
      </p>
    </div>
  );
}
