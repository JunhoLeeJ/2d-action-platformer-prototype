"use strict";

// 2층 구역 2 - 체크포인트. 원본 스펙: "매듭 묶인 기둥. 손 갖다대는 애니메이션→매듭 파랗게 반짝→은은한
// 빛 유지. 이후 모든 구역 왼쪽 문 옆엔 체크포인트 기둥(첫 체크포인트 제외, 컷신 없이 자동 활성화)".
// 이 두 문장은 서로 다른 두 단계를 말하는 것으로 해석함(ROADMAP.md 참고): 이 존이 그 기둥 기믹을
// *처음* 제대로 보여주는 자리라서 손 갖다대는 컷신(카메라 홀드+애니메이션 훅+`activateCheckpoint` 호출)
// 을 전부 갖추고, 그 뒤로 만드는 존들은 "컷신 없이 자동 활성화"이므로 굳이 이 트리거를 다시 안 넣고
// 그냥 이미 켜진(lit) 상태의 `ambientProps` 항목 하나만 두면 충분하다 - 문 전환(`enterZone`)이 이미
// 체크포인트를 자동으로 활성화해주므로, 그런 존들의 기둥은 순수 시각적 확인(컷신 없이 자동 활성화)일
// 뿐이다.
//
// 기둥의 "켜짐" 여부는 ambientProp 데이터에 저장하지 않는다 - hasSeenTrigger(currentZone.id,
// prop.triggerId)를 매 프레임 직접 확인해서 결정한다(js/rendering.js의 drawCheckpointPillarProp).
// door.crackWhen()과 같은 이유: ambientProps는 로드 시점에 캐싱되지만(zones.js) 활성화(트리거 발동)는
// 같은 방문 도중에 일어나므로, 그 순간 바로 반영되려면 매 프레임 다시 확인해야 한다.
//
// 오른쪽 문은 기존 f2z3_legacy_arena(몬스터들 - 전투 프로토타입 재활용)로 정식 연결 - ROADMAP.md에
// 이미 "배선만 하면 됨"이라고 예고되어 있던 항목.
(function () {
  const groundY = 750, groundH = 40;
  const doorH = 140;
  const standingTopY = groundY - player.h; // entryPoint/checkpoint/문 y 전부 여기서 파생 (CLAUDE.md 관례)

  const PILLAR_TRIGGER_ID = "checkpoint_pillar_touch";
  const pillarX = 120, pillarW = 20, pillarH = 50;
  const pillarY = groundY - pillarH;

  ZONES["f2z2_checkpoint"] = {
    id: "f2z2_checkpoint",
    name: "2층 구역 2 - 체크포인트",
    floor: 2,

    width: 900,
    height: 810,
    groundY, groundH,
    groundGaps: [],

    solidPlatforms: [],
    oneWayPlatforms: [],

    wallGates: [],
    floors: [],
    walls: [
      { x: 0, w: 40, gaps: [] },
      { x: 860, w: 40, gaps: [] },
    ],

    enemySpawns: [], // 이 존의 목적은 순수하게 체크포인트 기믹 소개 - 전투 없음

    ambientProps: [
      { type: "checkpointPillar", x: pillarX, y: pillarY, w: pillarW, h: pillarH, triggerId: PILLAR_TRIGGER_ID },
    ],

    entryPoint: { x: 40, y: standingTopY },
    checkpoints: [
      { id: "start", x: 40, y: standingTopY, active: true },
    ],

    doors: {
      left: { x: 40, y: groundY - doorH, w: 40, h: doorH },
      right: {
        x: 820, y: groundY - doorH, w: 40, h: doorH,
        targetZoneId: "f2z3_legacy_arena", yMax: standingTopY + 25, landingY: groundY,
      },
    },

    // 기둥에 다가가면(walkIn) 손을 갖다대는 짧은 컷신 - 카메라 홀드(주목시키는 용도) + 손짓 애니메이션
    // 훅(아직 렌더링 미구현, § 5 아트 제약과 동일 상태) + activateCheckpoint 호출. 이 존의 체크포인트는
    // 이미 enterZone()이 문을 넘는 순간 자동으로 활성화해뒀으므로(다른 모든 존과 동일) 이 호출은
    // 기능적으로는 같은 값을 다시 넣는 것뿐 - 이 컷신의 진짜 목적은 "체크포인트가 활성화된다"는
    // 규칙을 플레이어에게 처음 보여주는 연출이다.
    triggerZones: [
      {
        id: PILLAR_TRIGGER_ID,
        kind: "walkIn",
        xMin: pillarX - 20, xMax: pillarX + pillarW + 20,
        repeatable: false,
        sequence: [
          { type: "cameraHold", target: { x: pillarX + pillarW / 2 - W / 2, y: pillarY + pillarH / 2 - H / 2 }, duration: 0.6 },
          { type: "animation", entityRef: player, anim: "touchPillar", duration: 0.5 }, // "손 갖다대는 애니메이션" 훅 (렌더링 미구현)
          { type: "callback", fn: () => { activateCheckpoint("f2z2_checkpoint", 40, standingTopY, "start"); } },
        ],
      },
    ],
    ruleFlags: {},
  };
})();
