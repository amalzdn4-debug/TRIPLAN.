"use client";

import type * as L from "leaflet";

let promise: Promise<typeof L> | null = null;

/** Loads Leaflet only in the browser, once. */
export function loadLeaflet(): Promise<typeof L> {
  promise ??= import("leaflet").then((m) => (m.default ?? m) as typeof L);
  return promise;
}

export const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
