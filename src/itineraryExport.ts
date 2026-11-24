
import type { SharedDay } from "./tripCloud";

const WEEKDAYS: Record<string, string> = {
  MON: "월",
  TUE: "화",
  WED: "수",
  THU: "목",
  FRI: "금",
  SAT: "토",
  SUN: "일",
};

const CATEGORY_NAMES: Record<string, string> = {
  food: "식사",
  cafe: "카페",
  travel: "이동",
  store: "쇼핑",
  spot: "관광",
  stay: "숙박",
};

type ZipFile = {
  name: string;
  contents: string;
};

// 날짜별 일정표를 일반 텍스트로 변환
function makeReadableItinerary(
  days: SharedDay[],
  visited: string[],
  createdAt: string
): string {
  const visitedIds = new Set(visited);

  const numberOfStops = days.reduce(
    (total, day) => total + day.stops.length,
    0
  );

  const lines: string[] = [
    "시드니 여행 전체 일정 — 2026년 12월",
    `내보낸 시각(UTC): ${createdAt}`,
    `일정 ${days.length}일 · 등록된 장소 ${numberOfStops}곳`,
    "",
  ];

  for (const day of days) {
    const weekday =
      WEEKDAYS[day.weekday] ?? day.weekday;

    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    lines.push(
      `2026년 12월 ${day.day}일 (${weekday}) — ${day.title}`
    );

    if (day.subtitle.trim()) {
      lines.push(day.subtitle);
    }

    lines.push("");

    if (day.stops.length === 0) {
      lines.push("  등록된 일정 없음");
    }

    for (const stop of day.stops) {
      const category =
        CATEGORY_NAMES[stop.category] ?? stop.category;

      const checked = visitedIds.has(stop.id)
        ? " [방문 완료]"
        : "";

      lines.push(
        `${stop.time || "미정"}  ${stop.name}${checked}`
      );

      if (stop.detail?.trim()) {
        lines.push(
          `  설명: ${stop.detail
            .trim()
            .replace(/\r?\n/g, "\n  ")}`
        );
      }

      lines.push(`  분류: ${category}`);

      if (stop.mapLocation?.address) {
        lines.push(
          `  주소: ${stop.mapLocation.address}`
        );
      }

      if (stop.mapLocation && !stop.mapUrl) {
        lines.push(
          `  좌표: ${stop.mapLocation.lat}, ${stop.mapLocation.lng}`
        );
      }

      if (stop.mapUrl) {
        lines.push(`  지도: ${stop.mapUrl}`);
      }

      lines.push("");
    }
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  return lines.join("\n");
}

// ZIP 파일에 필요한 CRC-32 체크섬 계산
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;

  for (const byte of data) {
    crc ^= byte;

    for (let i = 0; i < 8; i += 1) {
      crc =
        (crc >>> 1) ^
        ((crc & 1) ? 0xedb88320 : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

// 외부 라이브러리 없이 ZIP 파일 생성
function makeZip(files: ZipFile[]): Blob {
  const encoder = new TextEncoder();
  const now = new Date();

  const dosDate =
    ((Math.max(1980, now.getFullYear()) - 1980) << 9) |
    ((now.getMonth() + 1) << 5) |
    now.getDate();

  const dosTime =
    (now.getHours() << 11) |
    (now.getMinutes() << 5) |
    Math.floor(now.getSeconds() / 2);

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];

  let localOffset = 0;
  let centralSize = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const contents = encoder.encode(file.contents);
    const checksum = crc32(contents);

    // 로컬 ZIP 헤더
    const localHeader = new Uint8Array(
      30 + name.length
    );

    const local = new DataView(
      localHeader.buffer
    );

    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true);
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, checksum, true);
    local.setUint32(18, contents.length, true);
    local.setUint32(22, contents.length, true);
    local.setUint16(26, name.length, true);

    localHeader.set(name, 30);

    localParts.push(localHeader, contents);

    // 중앙 ZIP 디렉터리
    const centralHeader = new Uint8Array(
      46 + name.length
    );

    const central = new DataView(
      centralHeader.buffer
    );

    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, 0x0800, true);
    central.setUint16(10, 0, true);
    central.setUint16(12, dosTime, true);
    central.setUint16(14, dosDate, true);
    central.setUint32(16, checksum, true);
    central.setUint32(20, contents.length, true);
    central.setUint32(24, contents.length, true);
    central.setUint16(28, name.length, true);
    central.setUint32(42, localOffset, true);

    centralHeader.set(name, 46);

    centralParts.push(centralHeader);

    localOffset +=
      localHeader.length + contents.length;

    centralSize += centralHeader.length;
  }

  // ZIP 종료 레코드
  const endRecord = new Uint8Array(22);
  const end = new DataView(endRecord.buffer);

  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, localOffset, true);

  // 모든 ZIP 데이터 결합
  const output = new Uint8Array(
    localOffset + centralSize + endRecord.length
  );

  let cursor = 0;

  for (const part of [
    ...localParts,
    ...centralParts,
    endRecord,
  ]) {
    output.set(part, cursor);
    cursor += part.length;
  }

  return new Blob([output.buffer], {
    type: "application/zip",
  });
}

// 앱에서 호출하는 최종 다운로드 함수
export function downloadFullItinerary(
  days: SharedDay[],
  visited: string[]
): void {
  // 날짜순으로 정렬
  const sortedDays = [...days].sort(
    (a, b) => a.day - b.day
  );

  const createdAt = new Date().toISOString();

  // JSON 생성
  const json = JSON.stringify(
    {
      schemaVersion: 1,
      trip: "Sydney 2026",
      exportedAt: createdAt,
      days: sortedDays,
      visited,
    },
    null,
    2
  );

  // 읽기 쉬운 TXT 생성
  const txt = makeReadableItinerary(
    sortedDays,
    visited,
    createdAt
  );

  // 두 파일을 ZIP으로 묶기
  const zip = makeZip([
    {
      name: "sydney-itinerary-2026.json",
      contents: json,
    },
    {
      name: "sydney-itinerary-2026.txt",
      contents: txt,
    },
  ]);

  // 브라우저에서 ZIP 다운로드
  const url = URL.createObjectURL(zip);

  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = "sydney-itinerary-2026.zip";

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 30000);
}
