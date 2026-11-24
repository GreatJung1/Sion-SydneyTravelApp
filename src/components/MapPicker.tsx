
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ===== 일정에 저장할 지도 위치 정보 =====
export type MapLocation = {
  name: string;
  lat: number;
  lng: number;
  address?: string;
};

// ===== Photon 장소 검색 응답 타입 =====
type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    state?: string;
    country?: string;
  };
};

type MapPickerProps = {
  initialQuery: string;
  initialLocation?: MapLocation | null;
  onSelect: (location: MapLocation) => void;
  onClose: () => void;
};

const SYDNEY: [number, number] = [-33.8688, 151.2093];


async function translateToEnglish(text: string): Promise<string> {
  // 한국어가 없으면 번역 없이 그대로 사용
  if (!/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(text)) {
    return text;
  }

  const params = new URLSearchParams({
    q: text,
    langpair: "ko|en",
  });

  const response = await fetch(
    `https://api.mymemory.translated.net/get?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error("번역 요청 실패");
  }

  const data = await response.json();

  const translated = data.responseData?.translatedText;

  if (
    data.responseStatus !== 200 ||
    typeof translated !== "string" ||
    !translated.trim()
  ) {
    throw new Error("번역 실패 또는 무료 한도 초과");
  }

  return translated.trim();
}


// ===== 지도에서 장소 검색 또는 직접 핀 선택 =====
export default function MapPicker({
  initialQuery,
  initialLocation,
  onSelect,
  onClose,
}: MapPickerProps) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pinRef = useRef<L.CircleMarker | null>(null);

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<MapLocation[]>([]);
  const [selected, setSelected] = useState<MapLocation | null>(
    initialLocation ?? null,
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const searchCache = useRef(
    new Map<string, MapLocation[]>()
  );

  const searchingRef = useRef(false);

  // ===== 지도 생성 및 터치한 좌표 선택 =====
  useEffect(() => {
    if (!mapElement.current) return;

    const center: [number, number] = initialLocation
      ? [initialLocation.lat, initialLocation.lng]
      : SYDNEY;

    const map = L.map(mapElement.current, {
      scrollWheelZoom: false,
    }).setView(center, initialLocation ? 16 : 12);

    mapRef.current = map;

    // ===== OpenStreetMap 지도 배경 =====
    L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }
    ).addTo(map);

    // ===== 지도를 직접 터치하면 핀 선택 =====
    map.on("click", (event: L.LeafletMouseEvent) => {
      setSelected({
        name:
          initialQuery.trim() ||
          "지도에서 선택한 위치",
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      });

      setResults([]);
    });

    // ===== 지도 종료 시 인스턴스 제거 =====
    return () => {
      map.remove();
      mapRef.current = null;
      pinRef.current = null;
    };
  }, []);

  // ===== 선택된 위치에 원형 핀 표시 =====
  useEffect(() => {
    if (!selected || !mapRef.current) return;

    const point: [number, number] = [
      selected.lat,
      selected.lng,
    ];

    if (!pinRef.current) {
      pinRef.current = L.circleMarker(point, {
        radius: 10,
        color: "#ffffff",
        weight: 3,
        fillColor: "#526448",
        fillOpacity: 1,
      }).addTo(mapRef.current);
    } else {
      pinRef.current.setLatLng(point);
    }
  }, [selected]);

  // ===== 장소 이름으로 지도 검색 =====
  async function searchPlaces(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const value = query.trim();

    if (value.length < 2 || searchingRef.current) {
      return;
    }

    // ===== 검색 결과 캐시 확인 =====
    const cacheKey = value.toLocaleLowerCase();
    const cached = searchCache.current.get(cacheKey);

    if (cached) {
      setResults(cached);
      setError(
        cached.length
          ? ""
          : "검색 결과가 없어. 지도에서 직접 핀을 찍어줘."
      );
      return;
    }

    searchingRef.current = true;
    setLoading(true);
    setError("");
    setResults([]);

    try {
      // ===== 시드니 중심으로 장소 검색 =====
      
      // ===== 한국어 입력 시 영어로 자동 번역 =====
      let searchText = value;

      if (/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(value)) {
        try {
          searchText = await translateToEnglish(value);
        } catch (error) {
          console.warn("영어 번역 실패:", error);
          searchText = value;
        }
      }

      // ===== 번역된 검색어로 시드니 주변 장소 검색 =====
      const params = new URLSearchParams({
        q: searchText,
        limit: "5",
        lat: String(SYDNEY[0]),
        lon: String(SYDNEY[1]),
      });


      const response = await fetch(
        `https://photon.komoot.io/api/?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("검색 서비스 응답 오류");
      }

      const data = (await response.json()) as {
        features?: PhotonFeature[];
      };

      // ===== 검색 결과를 위치 데이터로 변환 =====
      const places: MapLocation[] = (
        data.features ?? []
      )
        .map((item) => {
          const [lng, lat] =
            item.geometry.coordinates;

          const parts = [
            item.properties.street,
            item.properties.city,
            item.properties.state,
            item.properties.country,
          ].filter(Boolean);

          return {
            name:
              item.properties.name || value,
            lat,
            lng,
            address: parts.join(", "),
          };
        })
        .filter(
          (place) =>
            Number.isFinite(place.lat) &&
            Number.isFinite(place.lng)
        );

      searchCache.current.set(cacheKey, places);
      setResults(places);

      if (!places.length) {
        setError(
          "검색 결과가 없어. 지도에서 직접 핀을 찍어줘."
        );
      }
    } catch {
      setError(
        "장소 검색에 실패했어. 지도를 눌러서 위치를 지정할 수 있어."
      );
    } finally {
      searchingRef.current = false;
      setLoading(false);
    }
  }

  // ===== 검색 결과에서 장소를 선택 =====
  function choosePlace(place: MapLocation) {
    setSelected(place);
    setResults([]);

    mapRef.current?.setView(
      [place.lat, place.lng],
      17
    );
  }

  return (
    <div
      className="map-picker-backdrop"
      onClick={onClose}
    >
      <section
        className="map-picker-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="map-picker-title"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        {/* ===== 지도 선택창 제목 ===== */}
        <div className="map-picker-header">
          <h2 id="map-picker-title">
            지도에서 위치 선택
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="지도 닫기"
          >
            닫기
          </button>
        </div>

        {/* ===== 장소 검색 입력창 ===== */}
        <form
          className="map-picker-search"
          onSubmit={searchPlaces}
        >
          <input
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            placeholder="예: Sydney Opera House"
            aria-label="지도 장소 검색"
          />

          <button
            type="submit"
            disabled={
              loading ||
              query.trim().length < 2
            }
          >
            {loading ? "검색 중" : "검색"}
          </button>
        </form>

        {/* ===== 확대·이동·터치 가능한 지도 ===== */}
        <div
          ref={mapElement}
          className="map-picker-map"
        />

        {/* ===== 장소 검색 결과 ===== */}
        {results.length > 0 && (
          <div className="map-picker-results">
            {results.map((place, index) => (
              <button
                type="button"
                key={`${place.lat}-${place.lng}-${index}`}
                onClick={() =>
                  choosePlace(place)
                }
              >
                <strong>{place.name}</strong>

                <small>
                  {place.address ||
                    `${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`}
                </small>
              </button>
            ))}
          </div>
        )}

        {/* ===== 검색 오류 안내 ===== */}
        {error && (
          <p className="map-picker-error">
            {error}
          </p>
        )}

        {/* ===== 선택한 지도 위치 표시 ===== */}
        <div className="map-picker-selection">
          {selected ? (
            <>
              <strong>
                {selected.name}
              </strong>

              <small>
                {selected.address ||
                  `${selected.lat.toFixed(6)}, ${selected.lng.toFixed(6)}`}
              </small>
            </>
          ) : (
            <span>
              장소를 검색하거나 지도에서
              원하는 지점을 터치해.
            </span>
          )}
        </div>

        {/* ===== 선택한 위치를 일정에 연결 ===== */}
        <button
          type="button"
          className="map-picker-confirm"
          disabled={!selected}
          onClick={() =>
            selected && onSelect(selected)
          }
        >
          이 위치로 연결
        </button>
      </section>
    </div>
  );
}
