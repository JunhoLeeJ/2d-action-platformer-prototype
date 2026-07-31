"use strict";

// 2층 구역 2 - 체크포인트 + (사용자 요청으로 추가된) 구역 3보다 쉬운 몬스터 구간. 원본 스펙: "매듭 묶인
// 기둥. 손 갖다대는 애니메이션→매듭 파랗게 반짝→은은한 빛 유지. 이후 모든 구역 왼쪽 문 옆엔 체크포인트
// 기둥(첫 체크포인트 제외, 컷신 없이 자동 활성화)". 이 존이 그 기둥 기믹을 *처음* 제대로 보여주는
// 자리라서 손 갖다대는 컷신(카메라 홀드+애니메이션 훅+`activateCheckpoint` 호출)을 첫 접촉 때만 보여줌
// - `makeCheckpointTrigger()`(js/engine/zones.js)의 `introEvents`가 이 역할.
//
// **체크포인트는 문을 넘는 것만으로 자동 활성화되지 않는다 - 예외 없이 모든 존에서 실제로 닿아야만
// 켜진다(사용자 요청)** - 그래서 `enterZone()`은 이제 어떤 존이든 체크포인트를 직접 켜지 않고, 활성화는
// 전부 `makeCheckpointTrigger()`가 만든 walkIn 트리거가 담당한다. 기둥의 "켜짐" 여부는 ambientProp
// 데이터에 저장하지 않는다 - currentZone.checkpoints에서 prop.checkpointId와 같은 id를 찾아 그
// cp.active를 매 프레임 직접 확인해서 결정한다(js/rendering.js의 drawCheckpointPillarProp). 리스폰
// 지점은 세션에 하나뿐이어야 하므로(사용자 요청) activateCheckpoint()(js/engine/checkpoint.js)가 새
// 체크포인트를 켤 때마다 다른 모든 체크포인트를 같이 꺼준다 - 그래서 기둥 여러 개가 동시에 빛나는
// 일이 없다.
//
// 몬스터 구간: "구역 3과 비슷하지만 좀 더 쉽게"(사용자 요청) - 터렛 2 + 체이서 1로 구역 3(터렛
// 다수+저격수+체이서, wallGates 포함)보다 훨씬 짧고 단순하게 구성. **체크포인트에서 리스폰하자마자
// 몬스터 어그로가 끌리면 안 된다는 것도 사용자가 명시적으로 요구한 규칙 - 이후 모든 존의 몬스터 배치에
// 계속 적용할 것(보스전 제외 - 맵 크기가 한정돼 있어 보스 어그로는 원래 끌려 있어야 함).** 첫
// 몬스터(x=650)와 체크포인트(entryPoint x=40) 사이 거리는 약 610px로
// CONFIG.ENEMY_DEFAULT_DETECTION_RANGE_W(480px, 포탑/저격수 감지 판정의 가로 절반 - updateTurretAI
// 참고)보다 넉넉히(130px 이상) 떨어져 있어, 리스폰 직후 그 자리에 서 있어도 절대 감지되지 않는다.
//
// 오른쪽 문은 기존 f2z3_legacy_arena(몬스터들 - 전투 프로토타입 재활용)로 정식 연결 - ROADMAP.md에
// 이미 "배선만 하면 됨"이라고 예고되어 있던 항목.
(function () {
  const groundY = 750, groundH = 40;
  const doorH = 140;
  const standingTopY = groundY - player.h; // entryPoint/checkpoint/문 y 전부 여기서 파생 (CLAUDE.md 관례)

  const CHECKPOINT_ID = "start";
  const pillarX = 120, pillarW = 20, pillarH = 50;
  const pillarY = groundY - pillarH;

  ZONES["f2z2_checkpoint"] = {
    id: "f2z2_checkpoint",
    name: "2층 구역 2 - 체크포인트",
    floor: 2,

    width: 1830,
    height: 810,
    groundY, groundH,
    groundGaps: [], // 구역 3과 달리 낙사 구간 없음 - "더 쉽게"의 일부

    solidPlatforms: [],
    oneWayPlatforms: [],

    wallGates: [], // 구역 3과 달리 강제 클리어 게이트 없음 - "더 쉽게"의 일부, 그냥 지나쳐도 됨
    floors: [],
    walls: [
      { x: 0, w: 40, gaps: [] },
      { x: 1790, w: 40, gaps: [] },
    ],

    // 터렛 2 + 체이서 1 - 구역 3(터렛 다수+저격수 2+체이서 2+wallGates)보다 훨씬 적고 단순함.
    // 전부 체크포인트(x=40)에서 최소 610px 이상 떨어져 있음(§ 파일 상단 주석 - 리스폰 직후 안전 거리).
    enemySpawns: [
      { type: "turret", x: 650, y: groundY - 40, opts: {} },
      { type: "chaser", x: 950, y: groundY - 44, opts: { patrolHalfRange: 80 } },
      { type: "turret", x: 1250, y: groundY - 40, opts: {} },
    ],

    ambientProps: [
      { type: "checkpointPillar", x: pillarX, y: pillarY, w: pillarW, h: pillarH, checkpointId: CHECKPOINT_ID },
    ],

    entryPoint: { x: 40, y: standingTopY },
    checkpoints: [
      // active 기본값은 false - enterZone()이 더 이상 이 값을 안 건드리므로, 실제로 기둥을 만지기
      // 전까지는 이 정적 초기값이 그대로 남아있는다. true로 박아두면 "만지기 전엔 안 빛난다"는
      // 규칙이 깨진다 - 실제로 겪은 버그.
      // x는 기둥(pillarX) 자신의 위치 - 예전엔 문 위치(40)를 그대로 썼는데, 그러면 이 체크포인트가
      // 활성 상태로 죽었을 때 기둥이 아니라 문 앞으로 리스폰되는 버그가 있었다(사용자 피드백으로 발견 -
      // "죽으면 체크포인트가 아니라 문으로 돌아온다"). 기둥이 곧 "실제로 밟은 자리"이므로 리스폰 좌표도
      // 그 자리와 일치해야 한다.
      { id: CHECKPOINT_ID, x: pillarX, y: standingTopY, active: false },
    ],

    doors: {
      left: { x: 40, y: groundY - doorH, w: 40, h: doorH },
      right: {
        x: 1750, y: groundY - doorH, w: 40, h: doorH,
        targetZoneId: "f2z3_legacy_arena", yMax: standingTopY + 25, landingY: groundY,
      },
    },

    // makeCheckpointTrigger(js/engine/zones.js) - 기둥에 실제로 닿아야만 활성화된다. 이 존은 기믹을
    // 처음 소개하는 자리라 introEvents로 손짓 컷신(카메라 홀드+애니메이션 훅)을 첫 접촉 때만 재생.
    triggerZones: [
      makeCheckpointTrigger({
        zoneId: "f2z2_checkpoint",
        checkpointId: CHECKPOINT_ID,
        x: pillarX, y: standingTopY,
        xMin: pillarX - 20, xMax: pillarX + pillarW + 20,
        topY: pillarY,
        standingTopY,
        introEvents: () => [
          { type: "cameraHold", target: { x: pillarX + pillarW / 2 - W / 2, y: pillarY + pillarH / 2 - H / 2 }, duration: 0.6 },
          { type: "animation", entityRef: player, anim: "touchPillar", duration: 0.5 }, // "손 갖다대는 애니메이션" 훅 (렌더링 미구현)
        ],
      }),
    ],
    ruleFlags: {},
  };
})();
