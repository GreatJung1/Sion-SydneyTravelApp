
type Position = {
  lat: number;
  lng: number;
};

type GroupableStop = {
  time: string;
  category: string;
  mapLocation?: Position | null;
};

type DistanceFunction = (
  a: Position,
  b: Position
) => number;

export type NearbyGroup = {
  startIndex: number;
  endIndex: number;
  totalCount: number;
  confirmedCount: number;
  temporaryCount: number;
};

// 유효한 GPS 좌표인지 확인
function coordinatesOf(
  stop: GroupableStop
): Position | null {
  const point = stop.mapLocation;

  if (
    !point ||
    !Number.isFinite(point.lat) ||
    !Number.isFinite(point.lng) ||
    Math.abs(point.lat) > 90 ||
    Math.abs(point.lng) > 180
  ) {
    return null;
  }

  return point;
}

// HH:mm 형식의 시간을 분 단위로 변환
function timeMinutes(time: string): number | null {
  const match =
    /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time.trim());

  return match
    ? Number(match[1]) * 60 + Number(match[2])
    : null;
}

// 거리 기준 자동 그룹 생성
export function buildNearbyGroups<
  T extends GroupableStop
>(
  stops: readonly T[],
  distanceMeters: DistanceFunction
): NearbyGroup[] {
  const groups: NearbyGroup[] = [];

  let anchors: Array<{
    index: number;
    point: Position;
  }> = [];

  let pendingTimes: number[] = [];

  // 하나의 그룹을 확정
  function closeGroup() {
    if (anchors.length >= 2) {
      const startIndex = anchors[0].index;
      const endIndex =
        anchors[anchors.length - 1].index;

      const totalCount =
        endIndex - startIndex + 1;

      groups.push({
        startIndex,
        endIndex,
        totalCount,
        confirmedCount: anchors.length,
        temporaryCount:
          totalCount - anchors.length,
      });
    }

    anchors = [];
    pendingTimes = [];
  }

  stops.forEach((stop, index) => {
    // 관광·쇼핑만 거리 그룹 대상
    // 식사·카페·숙소·이동은 독립 표시
    if (
      stop.category !== "spot" &&
      stop.category !== "store"
    ) {
      closeGroup();
      return;
    }

    const point = coordinatesOf(stop);

    // 좌표 없는 장소 처리
    if (!point) {
      const time = timeMinutes(stop.time);

      // 시간도 없으면 그룹 연결 불가
      if (time === null) {
        closeGroup();
      } else if (anchors.length > 0) {
        // 앞뒤 장소의 위치 확인을 기다림
        pendingTimes.push(time);
      }

      return;
    }

    // 그룹의 첫 번째 지도 등록 장소
    if (anchors.length === 0) {
      anchors.push({ index, point });
      return;
    }

    const lastAnchor =
      anchors[anchors.length - 1];

    const from = timeMinutes(
      stops[lastAnchor.index].time
    );

    const to = timeMinutes(stop.time);

    // 위치 없는 일정이 실제 시간 사이에 있는지
    const chronologicalGap =
      pendingTimes.length === 0 ||
      (
        from !== null &&
        to !== null &&
        from <= to &&
        pendingTimes.every(
          (time) =>
            from <= time && time <= to
        )
      );

    // 직전 지도 장소와 500m 이내
    const nearLast =
      distanceMeters(
        lastAnchor.point,
        point
      ) <= 500;

    // 그룹 전체 지도 장소와 800m 이내
    const withinCluster = anchors.every(
      (anchor) =>
        distanceMeters(
          anchor.point,
          point
        ) <= 800
    );

    if (
      chronologicalGap &&
      nearLast &&
      withinCluster
    ) {
      anchors.push({ index, point });
      pendingTimes = [];
    } else {
      closeGroup();
      anchors.push({ index, point });
    }
  });

  closeGroup();

  return groups;
}
