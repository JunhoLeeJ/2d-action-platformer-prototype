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
  // 숫자를 넣으면 마지막 피격 후 이 시간(sec)만큼 안 맞으면 즉시(스냅) 최대 체력으로 회복된다
  // (tickHpRegen, enemies.js) - hpFloor와는 독립된 별개의 레버라, "안 죽는다"와 "회복된다"를 존마다
  // 따로 켜고 끌 수 있다. null이면 완전히 비활성. 플레이어용/몬스터용이 서로 독립된 별개의 플래그다 -
  // 예전엔 hpRegenDelay 하나로 플레이어+몬스터가 같이 묶여 있었는데, "1층 구역 4는 몬스터는 회복
  // 안 하지만 플레이어는 회복해야 한다"는 요구사항 때문에 분리함(사용자 확인) - 둘 다 켜고 싶으면
  // (구역 3처럼) 그냥 둘 다 값을 넣으면 됨. 이후 난이도 시스템에서도 이 둘을 독립적으로 조절할 예정.
  playerHpRegenDelay: null,
  enemyHpRegenDelay: null,
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

// 문에서 아직 착지 못 한 채(공중에서) 트리거에 걸린 경우 전용 - 조작권을 뺏은 채 제자리(가로 고정)에서
// landingY까지 중력만 적용해 떨어뜨린다. gameState가 "cutscene"이라 updatePlayer 자체가 안 도는 동안엔
// 중력도 안 걸리므로, 이 틱 함수가 그동안 대신 최소한의 낙하 물리를 흉내낸다 - 착지하면 true를 반환해
// 다음 이벤트(오른쪽으로 걸어나가기)로 넘어간다.
function makeFallInPlaceTick(landingY) {
  return function fallInPlaceTick(dt) {
    player.vx = 0;
    player.vy += CONFIG.GRAVITY * dt;
    if (player.vy > CONFIG.MAX_FALL_SPEED) player.vy = CONFIG.MAX_FALL_SPEED;
    player.y += player.vy * dt;
    // 트리거가 발동한 순간 아직 상승 중(이단 점프 관성)이었다면, 여기서도 천장에 막혀야 한다 -
    // updatePlayer와 완전히 같은 판정을 재사용(player.js 참고. 안 그러면 이 틱 동안은 순수 낙하만
    // 흉내내느라 충돌을 아예 안 봐서 천장을 뚫고 올라가 버림 - 실제로 발견된 버그).
    resolveSolidVerticalCollisions();
    if (player.y + player.h >= landingY) {
      player.y = landingY - player.h;
      player.vy = 0;
      player.onGround = true;
      player.jumpsUsed = 0;
      player.airAttacksUsed = 0;
      return true;
    }
    return false;
  };
}

// 착지 후 이어지는 두 번째 단계 - 오른쪽으로 걸어 화면(카메라 뷰) 밖으로 사라질 때까지.
// 벽 충돌 등 평소 이동 판정은 일부러 안 거친다 - 이미 문을 쓰는 연출 중이라 실제 지형과는 무관하게
// 화면 밖으로 빠져나가는 것 자체가 목적.
function walkRightOffscreenTick(dt) {
  player.vx = CONFIG.MOVE_SPEED;
  player.x += player.vx * dt;
  return player.x > camera.x + W;
}

// 오른쪽 문(doors.right)을 "걸어 들어가면 페이드 후 다음 존으로 이동"하는 트리거로 변환.
// 문 자체는 zone def에 좌표만 갖고 있고, 실제 동작(페이드/존 전환)은 여기서 조립한다 - 그래야
// 모든 존이 "문에 닿으면 이렇게 된다"를 똑같이 공유하고 존 데이터에는 목적지만 적으면 된다.
//
// door.yMin/yMax(선택) - 트리거 자체의 Y 범위 제한. 문이 땅바닥이 아니라 높은 착지대 위에 있는 존
// (예: f1z2_platforms)에서, X 범위만 보면 그 아래 땅바닥을 그냥 걸어가도 발동해버리는 문제를 막는다.
// yMin은 비워두면(undefined) 위쪽 제한 없음 - 점프로 착지대보다 훨씬 높이 떠서 들어와도 발동은 되어야
// 하므로(§ 아래 landingY 분기가 그 경우를 자연스럽게 처리) 일부러 안 좁힘. yMax만 타이트하게 잡아서
// 땅바닥처럼 훨씬 아래에 있는 위치는 제외한다.
//
// door.landingY(선택) - 이 문에 대응하는 착지대의 표면 y. 있으면 트리거 발동 시점에 플레이어가 아직
// 공중(!player.onGround)이었는지 확인해서, 공중이면 즉시 암전하는 대신 제자리 낙하->오른쪽으로 걸어
// 화면 밖으로 사라짐->암전 순서로 이어붙인 시퀀스를 재생한다(공중에서 갑자기 얼어붙은 채 바로
// 암전되는 어색함을 없애기 위함). 이미 착지한 채(onGround) 걸어 들어온 경우는 기존과 동일하게 즉시 암전.
function makeDoorTrigger(door) {
  const transitionFade = {
    type: "fade",
    color: "#000",
    outDuration: 0.4,
    holdDuration: 0.15,
    inDuration: 0.4,
    // enterZone()이 위치 이동+체크포인트 갱신+생존 상태(HP 등) 리셋을 전부 처리한다 - QA 패널 워프와
    // 완전히 동일한 코드 경로(사용자 요청, § 위 enterZone 주석 참고). 이 리셋 안에 attackState/표류
    // 초기화가 이미 포함되어 있어서, 문을 넘는 도중 스윙/표류가 걸려있었어도 새 존 지형 기준으로
    // 어긋난 채 이어질 걱정이 없다 - 예전엔 이걸 위해 cancelInFlightCombatState()를 따로 불렀지만
    // 이제 resetPlayerVitals()가 더 넓게 포괄하므로 그 함수 자체가 필요 없어짐.
    onMidpoint: () => {
      enterZone(door.targetZoneId);
    },
  };
  return {
    id: "__door_right",
    kind: "walkIn",
    xMin: door.x,
    xMax: door.x + door.w,
    yMin: door.yMin,
    yMax: door.yMax,
    repeatable: true, // 문은 일회성 스토리 비트가 아니라 언제든 다시 써야 하는 오브젝트라서
    // 트리거가 실제로 발동하는 시점(fireTrigger)에 그때의 player.onGround를 보고 매번 새로 구성한다 -
    // 정적 배열이면 존 로드 시점에 한 번 고정되어 버려서 발동 시점의 상태를 반영할 수 없다.
    sequence: () => {
      if (door.landingY == null || player.onGround) return [transitionFade];
      return [
        { type: "custom", tick: makeFallInPlaceTick(door.landingY) },
        { type: "custom", tick: walkRightOffscreenTick },
        transitionFade,
      ];
    },
  };
}

// zoneId로 등록된 존을 불러와 currentZone/enemies/projectiles/플레이어 위치/카메라를 전부 그 존
// 기준으로 다시 세팅한다. 체크포인트 리스폰과 문 전환 둘 다 이 함수 하나로 처리된다(§ 체크포인트 참고) -
// 이 함수 자체는 위치만 옮길 뿐 HP/공격/표류 같은 "생존 상태"는 건드리지 않는다 - 그건 호출자의 몫이다
// (죽어서 리스폰하는 경우는 respawnPlayer가, 문 전환/QA 패널 워프처럼 "새로 시작"하는 경우는 아래
// enterZone이 이어서 처리한다).
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

// "정식으로 새 존에서 시작"하는 두 경로(문 전환, QA 패널/메인 메뉴의 워프)가 완전히 똑같은 코드를
// 타도록 만든 공용 진입점 - 사용자가 명시적으로 요청한 사항("문 넘는 거랑 구역 선택이랑 정확히 똑같은
// 코드로 처리됐으면 좋겠다"). loadZone()으로 위치를 옮기고, 그 존의 entryPoint를 새 체크포인트로
// 활성화하고(activateCheckpoint), resetPlayerVitals()(js/entities/player.js)로 HP를 포함한 생존
// 상태를 전부 초기화한다 - 이 세 가지가 이제 문 전환/워프 어느 쪽에서 들어와도 동일하게 적용되므로,
// "문으로 넘으면 체력이 안 차거나 리스폰 위치가 이상해진다"류의 두 경로 간 불일치가 구조적으로
// 불가능해진다. 죽어서 리스폰하는 경우(respawnPlayer)는 일부러 이 함수를 안 쓴다 - 그쪽은 항상
// entryPoint가 아니라 currentCheckpoint(반드시 entryPoint와 같으란 법 없음 - 존 중간의 체크포인트일
// 수도 있음)로 돌아가야 하기 때문.
//
// 컷신 강제종료(activeSequence 등)는 일부러 이 함수에 안 넣는다 - 문 전환은 이미 "페이드 시퀀스 안"에서
// 안전하게 호출되므로 그 시퀀스 자신의 activeSequence를 여기서 건드리면 그 시퀀스 자체가 끊겨서
// 크래시가 난다(진행 중인 fade의 updateSequence가 그 다음 줄에서 activeSequence를 계속 참조함).
// 반대로 QA 패널 워프는 임의의 시점에 끼어드는 것이라 그 강제종료가 반드시 필요한데, 그건 호출자인
// qapanel.js의 warpToZone()이 이 함수를 부르기 전에 직접 처리한다.
function enterZone(zoneId) {
  const def = ZONES[zoneId];
  loadZone(zoneId, def.entryPoint);

  const firstCheckpoint = def.checkpoints[0];
  activateCheckpoint(zoneId, def.entryPoint.x, def.entryPoint.y, firstCheckpoint && firstCheckpoint.id);

  resetPlayerVitals();
}
