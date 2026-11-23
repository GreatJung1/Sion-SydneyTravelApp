import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapLocation } from "./MapPicker";

type CollectionPlace = {
  id: string;
  day: number;
  name: string;
  mapLocation?: MapLocation;
};
type Mode = "walking" | "transit" | "driving";

/* ===== 방문 여부가 지도에 표시되는 공동 장소 지도 ===== */
export default function MapCollection({
  places, visited, routeMode,
}: { places: CollectionPlace[]; visited: string[]; routeMode: Mode }) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!mapElement.current) return;
    const map = L.map(mapElement.current, {scrollWheelZoom: false})
      .setView([-33.8688, 151.2093], 11);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);
    const bounds: L.LatLngExpression[] = [];
    for (const place of places) {
      const loc = place.mapLocation;
      if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) continue;
      const done = visited.includes(place.id);
      const point: L.LatLngExpression = [loc.lat, loc.lng];
      bounds.push(point);
      // ===== 완료=체크 핀, 미완료=일반 핀 =====
      const pin = L.divIcon({
        className: "trip-collection-icon",
        html: `<span class="${done ? "completed" : "pending"}">${done ? "✓" : "•"}</span>`,
        iconSize: [28, 28], iconAnchor: [14, 14],
      });
      const marker = L.marker(point, {icon: pin}).addTo(map);
      const tooltip = document.createElement("span");
      tooltip.textContent = `12월 ${place.day}일 · ${place.name} · ${done ? "방문 완료" : "미방문"}`;
      marker.bindTooltip(tooltip);
      marker.on("click", () => {
        const dest = encodeURIComponent(`${loc.lat},${loc.lng}`);
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=${routeMode}`,
          "_blank", "noopener,noreferrer");
      });
    }
    if (bounds.length === 1) map.setView(bounds[0], 15);
    if (bounds.length > 1) map.fitBounds(L.latLngBounds(bounds), {padding:[25,25], maxZoom:15});
    const timer = window.setTimeout(() => map.invalidateSize(), 0);
    return () => {window.clearTimeout(timer); map.remove();};
  }, [places, visited, routeMode]);
  return <div className="map-collection-map" ref={mapElement} aria-label="방문 완료 여부가 표시된 여행 장소 지도" />;
}
