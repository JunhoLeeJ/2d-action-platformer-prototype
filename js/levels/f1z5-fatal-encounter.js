"use strict";

// 1층 구역 5 - 치명상 씬. 막다른 방(오른쪽 문 없음 - 다음 구역으로 못 감) 안쪽에 reachingEntity(손
// 뻗은 형체)+fragmentObject(그 손이 향하는 조각, 정체는 스펙에 없는 플레이스홀더)가 있고, 접근하면
// 조작권을 뺏긴 채 "느린 걸음"으로 끌려가다(zones.js의 makeSlowWalkTick, 이후 다른 컷신에도 재사용
// 예정) 화면이 지지직대다(cutscene.js의 "screenGlitch" 이벤트) 즉사 -> 사망씬(암전, 지금은
// 플레이스홀더) -> 구역 1로 텔레포트 + 페이드인.
//
// 1층 전체 규칙("구역 5 즉사 씬 제외 플레이어가 죽으면 안 됨" - CLAUDE.md/ROADMAP.md 참고)의 그
// "제외"가 바로 이 구역 - 그래서 다른 1층 구역과 달리 ruleFlags.hpFloor를 일부러 안 넣는다(진짜 죽어야
// 하므로). 전투 자체가 없는 구역이라 hpRegenDelay도 무의미해서 안 넣음.
//
// 트리거는 repeatable:false라 딱 한 번만 발동한다 - seenTriggerIds가 세션 전체에 걸쳐 유지되므로
// (cutscene.js), 나중에(1층 구역 1 재진입 처리 작업에서) 플레이어가 이 존을 다시 찾아와도 이 즉사
// 트리거는 재발동하지 않는다. 그때 reachingEntity를 치우고 crackMark를 남기는 건 ROADMAP.md에 이미
// 별도 체크리스트 항목으로 분리되어 있는 다음 작업 - 여기서는 손대지 않는다.
(function () {
  const groundY = 750, groundH = 40;
  const doorH = 140;
  const standingTopY = groundY - player.h; // entryPoint/checkpoint/문 y 전부 여기서 파생 (CLAUDE.md 관례)

  // 강제로 끌려가 멈추는 지점 - reachingEntity(x:860)/fragmentObject(x:795)보다 앞에서 멈춰서 서로
  // 겹치지 않으면서도 "손이 뻗어 닿는 대상" 구도가 되도록 잡음(§ 아래 ambientProps 좌표 참고).
  const slowWalkTargetX = 740;

  ZONES["f1z5_fatal_encounter"] = {
    id: "f1z5_fatal_encounter",
    name: "1층 구역 5 - 치명상 씬",
    floor: 1,

    width: 1000,
    height: 810,
    groundY, groundH,
    groundGaps: [],

    solidPlatforms: [],
    oneWayPlatforms: [],

    wallGates: [],
    floors: [],
    walls: [
      { x: 0, w: 40, gaps: [] },
      { x: 960, w: 40, gaps: [] },
    ],

    enemySpawns: [], // 막다른 방 - 전투 없음

    // reachingEntity가 왼쪽(다가오는 플레이어 쪽)으로 팔을 뻗고, fragmentObject는 그 손끝이 닿는
    // 자리에 둬서 "무언가에 손을 뻗고 있다"는 구도를 만든다(drawReachingEntityProp/
    // drawFragmentObjectProp, js/rendering.js 참고). 순수 배경 장식 - enemies[]/전투 판정과 무관.
    ambientProps: [
      { type: "fragmentObject", x: 795, y: 694, w: 20, h: 20 },
      { type: "reachingEntity", x: 860, y: groundY - 70, w: 34, h: 70 },
    ],

    entryPoint: { x: 40, y: standingTopY },
    checkpoints: [
      { id: "start", x: 40, y: standingTopY, active: false },
    ],

    // 오른쪽 문 없음 - 막다른 방이라 다음 구역으로 넘어가는 정상 경로 자체가 없다. 유일한 "출구"는
    // 아래 트리거가 재생하는 즉사 시퀀스의 텔레포트뿐.
    doors: {
      left: { x: 40, y: groundY - doorH, w: 40, h: doorH },
    },

    triggerZones: [
      {
        id: "fatal_approach",
        kind: "walkIn",
        xMin: 560, xMax: 620,
        repeatable: false,
        sequence: [
          // 트리거 발동 시 아직 공중(점프 등)이었다면 "자연스러운 착지"를 fireTrigger()가 이 시퀀스
          // 앞에 자동으로 붙여준다(js/engine/cutscene.js, makeFallUntilGroundedTick - 전 트리거 공용) -
          // 여기서는 이미 땅에 서 있다는 전제로 느린 걸음만 시작하면 된다.
          { type: "custom", tick: makeSlowWalkTick(slowWalkTargetX, CONFIG.SLOW_WALK_SPEED) },
          { type: "screenGlitch", duration: 1.4 },
          { type: "callback", fn: () => { player.hp = 0; } }, // 즉사 - HP를 직접 0으로 (사망씬 페이드 직전 시각적 확정)
          {
            type: "fade",
            color: "#2b0000", // 일반 문 전환(검정)과 구분되는 핏빛 암전 - "사망씬" 플레이스홀더
            outDuration: 0.5, holdDuration: 1.0, inDuration: 0.6,
            // enterZone()이 위치 이동+체크포인트 갱신+HP 등 생존 상태 리셋을 한 번에 처리 - 문 전환/
            // QA 워프와 동일한 코드 경로(CLAUDE.md의 enterZone 계약 참고). 완전 암전 상태에서
            // 호출되므로 텔레포트가 눈에 보이지 않고, 이어지는 inDuration이 곧 "페이드인"이 된다.
            onMidpoint: () => { enterZone("f1z1_entry"); },
          },
        ],
      },
    ],
    ruleFlags: { hideGhostNpc: true },
  };
})();
