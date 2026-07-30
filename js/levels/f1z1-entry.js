"use strict";

// 1층 구역 1 - 진입부(튜토리얼: 이동, 점프). 1층 전체에 적용되는 예외 규칙(원작 스펙 참고):
//   - 표류 잠금: driftUnlocked 전역 플래그가 false로 시작(js/engine/zones.js) - 이 존에서 따로 건드릴 필요 없음.
//   - NPC 없음: ruleFlags.hideGhostNpc=true로 유령 동료를 숨김.
//   - 사망 없음: 이 존엔 적/낙사 구간이 아예 없어서(허들만 존재) 애초에 죽을 방법이 없음 - 별도 규칙 불필요.
(function () {
  const groundY = 500, groundH = 40;

  ZONES["f1z1_entry"] = {
    id: "f1z1_entry",
    floor: 1,

    width: 1600,
    groundY, groundH,
    groundGaps: [], // 튜토리얼 - 낙사 구간 없음

    // 허들 하나 - 점프해서 넘어가야 하는 낮은 장애물 (이동+점프를 자연스럽게 강제하는 튜토리얼 장치)
    solidPlatforms: [
      { x: 500, y: 462, w: 26, h: 38 },
    ],
    // 선택 사항으로 밟아볼 수 있는 낮은 발판 - 본 경로를 막지 않는 곁다리 연습용
    oneWayPlatforms: [
      { x: 850, y: 420, w: 150, h: 20 },
    ],

    wallGates: [],
    enemySpawns: [],

    entryPoint: { x: 40, y: 400 },
    checkpoints: [
      { id: "start", x: 40, y: 400, active: true },
    ],

    doors: {
      left: { x: 0, y: 380, w: 40, h: 140 }, // 배경일 뿐, 트리거 없음
      right: { x: 1520, y: 380, w: 40, h: 140, targetZoneId: "f1z2_platforms" },
    },

    triggerZones: [],
    ruleFlags: { hideGhostNpc: true },
  };
})();
