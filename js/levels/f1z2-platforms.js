"use strict";

// 1층 구역 2 - 플랫폼 형식(이동 및 점프 연습), 낙사 없음. 계단식으로 올라갔다가 다시 내려오는
// 원웨이 발판 구성으로 점프(+이단 점프) 타이밍을 연습시킨다. 바닥 구멍이 아예 없어서(groundGaps: [])
// "낙사 없음" 규칙이 별도 코드 없이 지형만으로 성립한다 - 낙사 위험 자체가 존재하지 않음.
(function () {
  const groundY = 500, groundH = 40;

  ZONES["f1z2_platforms"] = {
    id: "f1z2_platforms",
    floor: 1,

    width: 1900,
    groundY, groundH,
    groundGaps: [],

    // 허들 하나 (구역 1과 동일한 장치, 복습 겸 마무리)
    solidPlatforms: [
      { x: 1500, y: 462, w: 26, h: 38 },
    ],

    // 계단식 오르막 -> 내리막. 각 단 사이 높이차는 한 번의 점프로 충분히 오를 수 있는 정도(~60-70px)로 잡아서
    // 이단 점프 없이도 순서대로 밟고 올라갈 수 있게 하되, 맨 위 칸은 지면 기준으로 보면 충분히 높아서
    // 실질적으로 이단 점프를 써보게 유도한다.
    oneWayPlatforms: [
      { x: 300, y: 440, w: 150, h: 20 },
      { x: 550, y: 370, w: 150, h: 20 },
      { x: 800, y: 300, w: 150, h: 20 }, // 계단 꼭대기
      { x: 1050, y: 370, w: 150, h: 20 },
      { x: 1300, y: 440, w: 150, h: 20 },
    ],

    wallGates: [],
    enemySpawns: [],

    entryPoint: { x: 40, y: 400 },
    checkpoints: [
      { id: "start", x: 40, y: 400, active: false },
    ],

    // 오른쪽 문은 아직 다음 구역(구역 3: 근접 공격 연습)이 없어서 null - 다음 세션에서 이어붙일 자리.
    doors: {
      left: { x: 0, y: 380, w: 40, h: 140 },
      right: null,
    },

    triggerZones: [],
    ruleFlags: { hideGhostNpc: true },
  };
})();
