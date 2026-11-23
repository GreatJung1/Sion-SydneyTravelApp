
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapLocation } from "./MapPicker";

// ===== 일정에서 수집된 지도 위치 데이터 =====
type CollectionPlace = {
  id: string;
  day: number;
  name: string;
  mapLocation?: MapLocation;
};

// ===== 지도 컬렉션: 저장된 위치를 모두 표시 =====
export default function MapCollection({
  places,
}: {
  places: CollectionPlace[];
}) {
  const mapElement = useRef<HTMLDivElement | null>(
    null
  );

  // ===== 저장된 장소가 변경되면 지도 갱신 =====
  useEffect(() => {
    if (!mapElement.current) return;

    const map = L.map(mapElement.current, {
      scrollWheelZoom: false,
    }).setView(
      [-33.8688, 151.2093],
      11
    );

    // ===== OpenStreetMap 지도 배경 =====
    L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }
    ).addTo(map);

    // ===== 저장된 좌표 모음 =====
    const bounds: L.LatLngExpression[] = [];

    for (const place of places) {
      const location = place.mapLocation;

      // ===== 좌표가 없는 기존 링크 일정은 지도 핀 제외 =====
      if (!location) continue;

      const point: L.LatLngExpression = [
        location.lat,
        location.lng,
      ];

      bounds.push(point);

      // ===== 장소마다 지도 핀 추가 =====
      const pin = L.circleMarker(point, {
        radius: 8,
        color: "#fff",
        weight: 2,
        fillColor: "#526448",
        fillOpacity: 1,
      }).addTo(map);

      // ===== 핀에 날짜와 장소명 표시 =====
      const label = document.createElement(
        "span"
      );

      label.textContent =
        `12월 ${place.day}일 · ${place.name}`;

      pin.bindTooltip(label);

      // ===== 핀을 누르면 Google Maps 열기 =====
      pin.on("click", () => {
        const coordinates =
          `${location.lat},${location.lng}`;

        const url =
          "https://www.google.com/maps/search/?api=1&query=" +
          encodeURIComponent(coordinates);

        window.open(
          url,
          "_blank",
          "noopener,noreferrer"
        );
      });
    }

    // ===== 등록된 장소가 한 개일 때 =====
    if (bounds.length === 1) {
      map.setView(bounds[0], 15);
    }

    // ===== 등록된 장소가 여러 개일 때 =====
    else if (bounds.length > 1) {
      map.fitBounds(
        L.latLngBounds(bounds),
        {
          padding: [25, 25],
          maxZoom: 15,
        }
      );
    }

    // ===== 기존 지도 제거 및 리소스 정리 =====
    return () => {
      map.remove();
    };
  }, [places]);

  return (
    <div
      className="map-collection-map"
      ref={mapElement}
      aria-label="여행 장소 지도"
    />
  );
}
