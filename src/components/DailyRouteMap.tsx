
import { useEffect, useMemo, useRef } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./daily-route-map.css";

type RouteStop = {
  id: string;
  time: string;
  name: string;
  mapLocation?: {
    lat: number;
    lng: number;
  };
};

type LocatedStop = RouteStop & {
  mapLocation: {
    lat: number;
    lng: number;
  };
};

type Props = {
  day: number;
  stops: RouteStop[];
  onClose: () => void;
};

export default function DailyRouteMap({
  day,
  stops,
  onClose,
}: Props) {
  const mapElement = useRef<HTMLDivElement>(null);

  // ===== 좌표가 등록된 일정만 추출 =====
  // 기존 일정 목록의 순서를 그대로 사용
  const locations = useMemo(
    () =>
      stops.filter(
        (stop): stop is LocatedStop =>
          !!stop.mapLocation &&
          Number.isFinite(stop.mapLocation.lat) &&
          Number.isFinite(stop.mapLocation.lng)
      ),
    [stops]
  );

  useEffect(() => {
    if (!mapElement.current || locations.length === 0) {
      return;
    }

    // ===== 지도 생성 =====
    const map = L.map(mapElement.current);

    L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }
    ).addTo(map);

    // ===== 일정의 실제 좌표 =====
    const coordinates: L.LatLngTuple[] = locations.map(
      (stop) => [
        stop.mapLocation.lat,
        stop.mapLocation.lng,
      ]
    );

    // ===== 실제 방문 순서대로 연결선 생성 =====
    const route =
      coordinates.length >= 2
        ? L.polyline(coordinates, {
            color: "#785640",
            opacity: 0.85,
            weight: 2.5,
            dashArray: "5 7",
            lineCap: "round",
          }).addTo(map)
        : null;

    // ===== 같은 위치에 등록된 일정 묶기 =====
    // 좌표 오차를 고려하여 3m 이내면 같은 위치로 처리
    const groups: number[][] = [];

    locations.forEach((stop, index) => {
      const currentPosition = L.latLng(
        stop.mapLocation.lat,
        stop.mapLocation.lng
      );

      const existingGroup = groups.find((group) => {
        const firstStop = locations[group[0]];

        const firstPosition = L.latLng(
          firstStop.mapLocation.lat,
          firstStop.mapLocation.lng
        );

        return (
          currentPosition.distanceTo(firstPosition) <= 3
        );
      });

      if (existingGroup) {
        existingGroup.push(index);
      } else {
        groups.push([index]);
      }
    });

    // ===== 같은 장소에는 번호를 합쳐서 핀 하나만 생성 =====
    groups.forEach((group) => {
      const firstStop = locations[group[0]];

      // 일정 순서 번호: 예) 1 또는 3,5 또는 2,4,8
      const numbers = group
        .map((index) => index + 1)
        .join(",");

      // ===== 글자 수에 따라 원 크기 자동 조절 =====
      // 번호가 여러 개여도 잘리지 않도록 처리
      const pinSize = Math.max(
        32,
        14 + numbers.length * 8
      );

      const fontSize =
        numbers.length >= 7
          ? 11
          : numbers.length >= 5
            ? 12
            : 14;

      // ===== 하나의 원 안에 여러 번호 표시 =====
      const pin = L.divIcon({
        className: "day-route-pin",
        html: `
          <span
            style="
              width: ${pinSize}px;
              height: ${pinSize}px;
              font-size: ${fontSize}px;
              white-space: nowrap;
            "
          >
            ${numbers}
          </span>
        `,
        iconSize: [pinSize, pinSize],
        iconAnchor: [pinSize / 2, pinSize / 2],
      });

      // ===== 실제 장소 좌표에 핀 배치 =====
      const marker = L.marker(
        [
          firstStop.mapLocation.lat,
          firstStop.mapLocation.lng,
        ],
        { icon: pin }
      ).addTo(map);

      // ===== 핀 클릭 시 포함된 일정 모두 표시 =====
      const popup = document.createElement("div");

      if (group.length > 1) {
        const heading = document.createElement("strong");
        heading.textContent = `일정 ${numbers}`;
        popup.appendChild(heading);
      }

      group.forEach((index) => {
        const stop = locations[index];

        const item = document.createElement("div");

        item.style.padding = "7px 0";
        item.style.borderBottom =
          "1px solid rgba(0, 0, 0, 0.08)";

        const time = document.createElement("div");
        time.textContent = stop.time;
        time.style.fontSize = "12px";
        time.style.opacity = "0.7";

        const name = document.createElement("strong");
        name.textContent = stop.name;

        item.append(time, name);
        popup.appendChild(item);
      });

      marker.bindPopup(popup);
    });

    // ===== 지도 확대에 따른 선 두께 변경 =====
    function updateLineWidth() {
      if (!route) return;

      const zoom = map.getZoom();

      route.setStyle({
        weight:
          zoom >= 15
            ? 1.1
            : zoom >= 13
              ? 1.7
              : 2.5,
      });
    }

    map.on("zoomend", updateLineWidth);

    // ===== 모든 장소가 보이도록 자동 범위 설정 =====
    if (coordinates.length === 1) {
      map.setView(coordinates[0], 14);
    } else {
      map.fitBounds(
        L.latLngBounds(coordinates).pad(0.15),
        { maxZoom: 14 }
      );
    }

    // ===== 최초 선 두께 적용 =====
    updateLineWidth();

    // ===== 지도 크기 갱신 =====
    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 0);

    // ===== 지도 닫을 때 정리 =====
    return () => {
      window.clearTimeout(timer);
      map.off("zoomend", updateLineWidth);
      map.remove();
    };
  }, [locations]);

  return (
    <div className="day-route-overlay">
      <section
        className="day-route-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`12월 ${day}일 동선 지도`}
      >
        <header className="day-route-header">
          <div>
            <small>DEC {day} · 2026</small>
            <h2>오늘의 동선</h2>
          </div>

          <button type="button" onClick={onClose}>
            닫기 ×
          </button>
        </header>

        {locations.length > 0 ? (
          <div
            ref={mapElement}
            className="day-route-canvas"
          />
        ) : (
          <p>지도 위치가 등록된 일정이 없어.</p>
        )}

        <footer className="day-route-footer">
          지도에 연결된 장소 {locations.length}곳
          / 전체 일정 {stops.length}곳
        </footer>
      </section>
    </div>
  );
}
