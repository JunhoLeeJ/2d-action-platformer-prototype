"use strict";

// 2층 구역 4 - 보스방("지키는 자", keeperBoss). 원본 스펙: 화면 크기=맵 크기(카메라 고정), 크고
// 스턴면역·공속빠른 포탑 변형 보스, 1/2/3페이즈(색+공속 변화), 처치 시 컷신(느려짐->문 쪽으로
// 돌아섬->releaseSpot으로 플레이어 이동->보스 파티클로 흩어짐)+대사, 이후 1층 구역 1로 페이드아웃
// (재시작 가능하게 만들 필요는 아직 없음 - ROADMAP.md 참고).
//
// "카메라 고정"은 새 엔진 기능이 필요 없다 - zone.width/height를 캔버스 크기(W/H)와 똑같이 두면
// cameraBounds.maxX/maxY가 0으로 collapse해서 카메라가 항상 (0,0)에 고정된다(CLAUDE.md World model
// 섹션에 이미 문서화된 동작) - 다른 한 화면짜리 존(f2z1_gyeol_encounter 등)은 height만 맞추고 width는
// 더 넓었던 반면, 여기는 폭까지 W로 맞춰 가로 스크롤도 완전히 없앤다.
//
// "보스가 문 쪽으로 돌아섬"의 문은 새로 만들지 않는다 - 이 방엔 doors.right가 없고(스토리상 다음
// 구역 진입은 컷신의 fade가 전담), 보스가 "돌아서는" 방향은 플레이어가 실제로 들어온 왼쪽 문
// (entryPoint) 그대로다. 처치 후 플레이어를 "놓아준다"는 서사와도 자연스럽게 맞아떨어짐(들어온 문으로
// 내보내는 셈) - 오른쪽에 쓰지도 않을 장식용 문을 하나 더 만드는 것보다 단순하다.
(function () {
  const groundY = 750, groundH = 40;
  const doorH = 140;
  const standingTopY = groundY - player.h; // entryPoint/checkpoint/문 y 전부 여기서 파생 (CLAUDE.md 관례)

  const CHECKPOINT_ID = "start";
  const pillarX = 100, pillarW = 20, pillarH = 50;
  const pillarY = groundY - pillarH;

  const bossX = 1000, bossY = groundY - 120, bossW = 100, bossH = 120;
  const RELEASE_SPOT_X = 220; // 처치 컷신에서 플레이어가 걸어가는 지점 - 문(entryPoint) 근처, 보스로부터 충분히 떨어짐

  ZONES["f2z4_boss"] = {
    id: "f2z4_boss",
    name: "2층 구역 4 - 보스전 (지키는 자)",
    floor: 2,

    width: W, height: H, // 화면 크기=맵 크기(카메라 고정) - 원본 스펙, § 파일 상단 주석 참고
    groundY, groundH,
    groundGaps: [], // 보스방은 낙사 구간 없음(스펙에 언급 없음, 순수 대치 공간)

    solidPlatforms: [],
    oneWayPlatforms: [],

    wallGates: [], // 보스방은 wallGate가 아니라 보스 자체가 봉쇄 - 처치=클리어(allEnemiesDead 트리거)
    floors: [],
    walls: [
      { x: 0, w: 40, gaps: [] },
      { x: W - 40, w: 40, gaps: [] },
    ],

    // 보스방은 몬스터 스폰-체크포인트 안전 거리 규칙의 명시적 예외(ROADMAP.md/CLAUDE.md "몬스터
    // 스폰과 체크포인트 사이 최소 안전 거리" 참고) - 맵 크기 자체가 보스 인카운터에 맞춰져 있어
    // 처음부터 대치 상태인 게 당연함.
    enemySpawns: [
      { type: "keeperBoss", x: bossX, y: bossY, opts: {} },
    ],

    // 문 앞 체크포인트 기둥(모든 존 기본 관례) - 이 존은 기믹을 처음 소개하는 자리가 아니라서
    // walkIn 컷신 없이 이미 켜진 상태로만 둔다(f2z3_legacy_arena와 동일한 패턴). 보스 처치 컷신 중에는
    // currentZone.ambientProps에 "bossDefeated" 하나가 잠깐 더 추가됐다가 사라진다(js/rendering.js 참고).
    ambientProps: [
      { type: "checkpointPillar", x: pillarX, y: pillarY, w: pillarW, h: pillarH, checkpointId: CHECKPOINT_ID },
    ],

    entryPoint: { x: 40, y: standingTopY },
    checkpoints: [
      // active 기본값은 false - enterZone()이 이 값을 안 건드리므로, 실제로 기둥에 닿기 전까지는
      // 이 정적 초기값이 그대로 남아있는다(CLAUDE.md "Checkpoints require an actual touch" 참고).
      { id: CHECKPOINT_ID, x: pillarX, y: standingTopY, active: false },
    ],

    // 왼쪽 문만 있음(배경, 트리거 없음 - 뒤로 못 감) - 오른쪽 문은 없음, 다음 구역 진입은 보스 처치
    // 컷신의 fade가 전담한다(§ 아래 allEnemiesDead 트리거).
    doors: {
      left: { x: 40, y: groundY - doorH, w: 40, h: doorH },
      right: null,
    },

    triggerZones: [
      makeCheckpointTrigger({
        zoneId: "f2z4_boss",
        checkpointId: CHECKPOINT_ID,
        x: pillarX, y: standingTopY,
        xMin: pillarX - 20, xMax: pillarX + pillarW + 20,
        topY: pillarY,
        standingTopY,
      }),
      // 보스(keeperBoss)를 처치하면(enemies 전부 alive:false) 발동 - checkAllEnemiesDeadTrigger(kind:
      // "allEnemiesDead")는 2층 구역 1(결 조우) 세션에서 "처치 시 컷신" 용도로 미리 만들어두고 그 존
      // 자체는 결국 안 썼던 걸 여기서 재사용한다(ROADMAP.md § 6 참고, 정확히 예고된 재사용처).
      {
        id: "boss_defeated",
        kind: "allEnemiesDead",
        repeatable: false,
        sequence: () => [
          // 보스는 죽는 순간(alive:false) 다른 몬스터처럼 더 이상 그려지지 않으므로, 이어지는 "돌아섬
          // -> 흩어짐" 연출을 위해 currentZone.ambientProps에 전용 오브젝트를 직접 끼워 넣는다
          // (drawBossDefeatedProp, js/rendering.js - crackMark/gyeolCaptured와 같은 패턴).
          {
            type: "callback",
            fn: () => {
              currentZone.ambientProps.push({
                type: "bossDefeated", x: bossX, y: bossY, w: bossW, h: bossH,
                turnProgress: 0, disperseProgress: 0,
                fromDir: player.x < bossX ? -1 : 1,
              });
            },
          },
          // "느려짐" - 카메라는 이 방에서 어차피 고정이라(width/height===W/H) 실제로 움직이지는 않지만,
          // 그 자리에서 잠깐 정지된 듯한 호흡을 주는 순수 페이싱용 홀드.
          { type: "cameraHold", target: { x: camera.x, y: camera.y }, duration: 0.5 },
          // "문 쪽으로 돌아섬" - 보스의 "눈" 방향이 플레이어 쪽에서 문(왼쪽) 쪽으로 서서히 돈다
          // (drawBossDefeatedProp의 eyeDir 보간).
          {
            type: "custom",
            tick: makeTimedTick(0.6, (t) => {
              const prop = currentZone.ambientProps.find((p) => p.type === "bossDefeated");
              if (prop) prop.turnProgress = t;
            }),
          },
          // "releaseSpot으로 플레이어 이동" - 조작권을 뺏은 채 문 근처로 느리게 걸어감(makeSlowWalkTick,
          // 1층 구역 5에서 이미 재사용된 범용 헬퍼 - ROADMAP.md § 5/§ 6 참고).
          { type: "custom", tick: makeSlowWalkTick(RELEASE_SPOT_X, CONFIG.SLOW_WALK_SPEED) },
          // "보스 파티클로 흩어짐"
          {
            type: "custom",
            tick: makeTimedTick(0.8, (t) => {
              const prop = currentZone.ambientProps.find((p) => p.type === "bossDefeated");
              if (prop) prop.disperseProgress = t;
            }),
          },
          {
            type: "callback",
            fn: () => {
              currentZone.ambientProps = currentZone.ambientProps.filter((p) => p.type !== "bossDefeated");
            },
          },
          // 대사 원문 보존(ROADMAP.md "2층 구역 4 보스전 완결 대사 원문") - 화자 미지정이지만 2층 구역
          // 1의 대사 관례("이후 별도 언급 없으면 화자는 항상 결")를 그대로 따라 결로 표기.
          { type: "dialogue", speaker: "결", text: "...저렇게, 그냥 놓아줄 수도 있는 거구나." },
          {
            type: "fade", color: "#000", outDuration: 0.4, holdDuration: 0.15, inDuration: 0.4,
            onMidpoint: () => { enterZone("f1z1_entry"); },
          },
        ],
      },
    ],
    ruleFlags: {},
  };
})();
