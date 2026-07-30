"use strict";

/* --------------------------- 존/플로어 --------------------------- */
// 월드는 더 이상 하나로 이어진 연속 공간이 아니라, "존(zone)" 단위로 나뉜 그래프다.
// 각 존은 완전히 독립된 레벨 하나(지형/적/트리거/체크포인트/문)이고, ZONES에 등록된 정의(data)를
// loadZone()이 읽어서 currentZone(런타임 상태)으로 만든다. floor는 zone 정의에 붙는 참고용
// 메타데이터일 뿐 - 층 전환은 별도 개념이 아니라 그냥 다음 존으로 넘어가는 문일 뿐이다 (loadZone 참고).
const ZONES = {};
let currentZone = null;

// 존별 규칙 오버라이드 - zone def의 ruleFlags에 값만 넣으면 특정 존에서 예외를 걸 수 있도록 만들어둔 훅.
const RULE_FLAG_DEFAULTS = {
  disableJump: false,
  disableAttack: false,
  disableDrift: false,
  playerInvincible: false, // true면 damagePlayer()가 아예 등록을 안 함(피격 유예 화면 효과도 안 뜸)
  hpFloor: null,            // 숫자를 넣으면 applyDamageToHp가 HP를 그 이하로 못 내림 (죽지 않는 구간용)
  hideGhostNpc: false,      // 1층은 동료 없이 혼자라는 설정이라(원작 스펙 "npc는 1층에서는 존재하지 않음") 유령 동료도 숨김
};
function getRuleFlag(name) {
  const v = currentZone.ruleFlags[name];
  return v === undefined ? RULE_FLAG_DEFAULTS[name] : v;
}

// 표류는 스토리상 특정 시점(구역 5 재방문)까지 잠겨있어야 한다는 설계라, 존 단위 규칙이 아니라
// 세션 전체를 가로지르는 단일 전역 플래그로 둔다. 1층 콘텐츠가 이제 이 값이 false인 걸 전제로 하므로
// 기본값도 false로 시작 - 나중에 구역 5 재방문 시퀀스(미구현)에서 true로 바꿔주면 된다.
let driftUnlocked = false;

// xA와 xB 사이에 낙사 구간이 하나라도 걸쳐 있는지 - 체이서가 구멍 너머까지는 못 쫓아오게 하는 데 씀.
// 일부러 "바닥"(groundGaps)만 본다 - 체이서는 발밑 지형만 보고 걷지, floors(§ 아래)로 만든 다른 층은
// 애초에 지금 체이서 AI가 오갈 일이 없어서(체이서는 순찰 범위 안에서만 걷는다) 고려 대상이 아님.
function hasGapBetween(xA, xB) {
  const lo = Math.min(xA, xB), hi = Math.max(xA, xB);
  return currentZone.groundGaps.some((gap) => gap.x < hi && gap.x + gap.w > lo);
}

// 가로 막대(바닥/층) 하나를 [xStart,xEnd] 구간 안에서 gaps만큼 구멍 뚫어서 여러 조각으로 쪼갬 -
// buildGroundSegments(기존 바닥, 항상 존 전체 폭)와 zone.floors(§ 추가 층, 아래 - xMin/xMax로 특정
// 구간에만 놓을 수도 있음, 예: 좁은 통로/방)가 이 함수 하나를 공유한다.
function buildHorizontalBarrierSegments(y, h, xStart, xEnd, gaps) {
  const segments = [];
  const sorted = [...gaps].sort((a, b) => a.x - b.x);
  let cursor = xStart;
  for (const gap of sorted) {
    if (gap.x > cursor) segments.push({ x: cursor, y, w: gap.x - cursor, h });
    cursor = Math.max(cursor, gap.x + gap.w);
  }
  if (cursor < xEnd) segments.push({ x: cursor, y, w: xEnd - cursor, h });
  return segments;
}
// zone def의 groundGaps를 뺀 나머지 구간으로 바닥 조각들을 만듦 - "바닥"은 낙사 판정(FR-1.5 등)과
// 체이서의 구멍 회피(hasGapBetween)에 쓰이는 유일한 특별한 층이라 다른 층(floors)과 분리되어 있다.
// 항상 존 전체 폭(0~width)에 걸침 - 부분 구간이 필요하면 그건 floors의 몫.
function buildGroundSegments(def) {
  return buildHorizontalBarrierSegments(def.groundY, def.groundH, 0, def.width, def.groundGaps);
}

// 세로 막대(벽) 하나를 [yStart,yEnd] 구간 안에서 gaps(세로 구간)만큼 뚫어서 여러 조각으로 쪼갬 -
// buildHorizontalBarrierSegments를 가로/세로 뒤집은 버전. zone.walls(§ 아래)가 사용 - yMin/yMax로
// 존 전체 높이가 아니라 특정 구간(예: 통로 하나)에만 놓을 수 있다.
function buildVerticalBarrierSegments(x, w, yStart, yEnd, gaps) {
  const segments = [];
  const sorted = [...gaps].sort((a, b) => a.y - b.y);
  let cursor = yStart;
  for (const gap of sorted) {
    if (gap.y > cursor) segments.push({ x, y: cursor, w, h: gap.y - cursor });
    cursor = Math.max(cursor, gap.y + gap.h);
  }
  if (cursor < yEnd) segments.push({ x, y: cursor, w, h: yEnd - cursor });
  return segments;
}

// 봉쇄 벽(게이트) - 존 하나에 여러 개 있을 수 있다. 게이트 x보다 스폰 쪽(spawnX < gate.x)에 살아있는
// 적이 하나라도 있으면 그 게이트는 잠긴 상태. (원래 단일 WALL 하드코딩을 배열+범용 판정으로 일반화)
function isGateLocked(gate) {
  return enemies.some((e) => e.spawnX < gate.x && e.alive);
}
function countAliveBehindGate(gate) {
  return enemies.filter((e) => e.spawnX < gate.x && e.alive).length;
}
// 게이트 너머(spawnX > gate.x) 몬스터는 그 게이트가 잠긴 동안 "화면 밖"과 똑같이 플레이어를 인식 못 함
function isBehindLockedGate(enemy) {
  return currentZone.wallGates.some((gate) => enemy.spawnX > gate.x && isGateLocked(gate));
}
// 게이트 충돌은 X 범위만 본다(트리거 존과 같은 이유 - "위아래로 아주 긴 판정 사각형"이라는 예전 방식은
// 세로로 긴 존이 생기면서 y/h를 얼마나 크게 잡아야 안전한지 알기 어려워지는 문제가 있었다. Y를 아예
// 안 보면 그 문제 자체가 사라짐). 렌더링용 visualY/visualH와는 완전히 분리된 별개의 판정.
function isGateBlocking(gate, rect) {
  return isGateLocked(gate) && rect.x + rect.w > gate.x && rect.x < gate.x + gate.w;
}

// 오른쪽 문(doors.right)을 "걸어 들어가면 페이드 후 다음 존으로 이동"하는 트리거로 변환.
// 문 자체는 zone def에 좌표만 갖고 있고, 실제 동작(페이드/존 전환)은 여기서 조립한다 - 그래야
// 모든 존이 "문에 닿으면 이렇게 된다"를 똑같이 공유하고 존 데이터에는 목적지만 적으면 된다.
function makeDoorTrigger(door) {
  return {
    id: "__door_right",
    kind: "walkIn",
    xMin: door.x,
    xMax: door.x + door.w,
    repeatable: true, // 문은 일회성 스토리 비트가 아니라 언제든 다시 써야 하는 오브젝트라서
    sequence: [
      {
        type: "fade",
        color: "#000",
        outDuration: 0.4,
        holdDuration: 0.15,
        inDuration: 0.4,
        onMidpoint: () => {
          // 문을 넘는 도중 스윙/표류가 걸려있었다면, 페이드가 끝나고 새 존의 지형을 기준으로
          // 그 판정이 어긋난 채 이어지지 않도록 여기서 확실히 정리한다.
          cancelInFlightCombatState();
          const target = ZONES[door.targetZoneId];
          loadZone(door.targetZoneId, target.entryPoint);
        },
      },
    ],
  };
}

// zoneId로 등록된 존을 불러와 currentZone/enemies/projectiles/플레이어 위치/카메라를 전부 그 존
// 기준으로 다시 세팅한다. 체크포인트 리스폰과 문 전환 둘 다 이 함수 하나로 처리된다(§ 체크포인트 참고) -
// 이 함수는 위치만 옮길 뿐 HP/공격/표류 같은 "생존 상태"는 절대 건드리지 않는다(그건 respawnPlayer의 몫).
function loadZone(zoneId, spawnAt) {
  const def = ZONES[zoneId];

  const triggerZones = def.triggerZones.slice();
  if (def.doors.right) triggerZones.push(makeDoorTrigger(def.doors.right));

  // floors(추가 바닥)/walls(추가 벽)는 각각 gaps만큼 구멍이 뚫린 채로 solidPlatforms에 합쳐진다 -
  // "제일 밑바닥 바닥" 하나뿐이던 것을 임의의 높이에 몇 개든 더 놓을 수 있게 일반화한 것 (§ 위 helper).
  // xMin/xMax(floors)·yMin/yMax(walls)는 선택 사항 - 생략하면 존 전체 폭/높이에 걸침(기존 동작과 동일),
  // 지정하면 좁은 통로나 방처럼 일부 구간에만 놓을 수 있다. 둘 다 zone def에 없으면 빈 배열이라 무영향.
  const floorSegments = (def.floors || []).flatMap((f) =>
    buildHorizontalBarrierSegments(f.y, f.h, f.xMin ?? 0, f.xMax ?? def.width, f.gaps || [])
  );
  const wallSegments = (def.walls || []).flatMap((w) =>
    buildVerticalBarrierSegments(w.x, w.w, w.yMin ?? 0, w.yMax ?? def.height, w.gaps || [])
  );

  currentZone = {
    ...def,
    solidPlatforms: [...buildGroundSegments(def), ...floorSegments, ...wallSegments, ...def.solidPlatforms],
    cameraBounds: { minX: 0, maxX: def.width - W, minY: 0, maxY: def.height - H },
    triggerZones,
  };

  // 적은 항상 스폰 데이터로부터 새로 만든다(리셋이 아니라 재생성) - 그래야 이전 존의 상태가
  // 절대 새 존으로 새어 들어올 수 없다.
  enemies.length = 0;
  for (const spawn of def.enemySpawns) {
    enemies.push(ENEMY_FACTORIES[spawn.type](spawn.x, spawn.y, spawn.opts || {}));
  }
  projectiles.length = 0;

  const at = spawnAt || def.entryPoint;
  player.x = at.x;
  player.y = at.y;
  // 유령 NPC도 즉시 스폰 위치로 순간이동시킨다 - 안 그러면 이전 존 위치에서부터 슬라이딩해오는 것처럼 보임.
  ghostNpc.x = at.x;
  ghostNpc.y = at.y;

  snapCameraToPlayer();

  checkAutoTrigger(zoneId);
}
