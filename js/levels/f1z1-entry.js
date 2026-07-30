"use strict";

// 1층 구역 1 - 진입부(튜토리얼: 이동, 점프). 1층 전체에 적용되는 예외 규칙(원작 스펙 참고):
//   - 표류 잠금: driftUnlocked 전역 플래그가 false로 시작(js/engine/zones.js) - 이 존에서 따로 건드릴 필요 없음.
//   - NPC 없음: ruleFlags.hideGhostNpc=true로 유령 동료를 숨김.
//   - 사망 없음: 이 존엔 적/낙사 구간이 아예 없어서(허들만 존재) 애초에 죽을 방법이 없음 - 별도 규칙 불필요.
//
// groundY=750: 캔버스 높이가 540->810으로 늘어난 뒤, 바닥을 존 아래쪽 가까이(20px 여유) 두기 위해
// 750으로 잡았다(=height(810) - groundH(40) - 20px 여유) - 안 그러면 바닥 밑으로 빈 공간이 크게
// 남아서 캐릭터가 "붕 뜬" 것처럼 보인다.
(function () {
  const groundY = 750, groundH = 40;

  ZONES["f1z1_entry"] = {
    id: "f1z1_entry",
    floor: 1,

    width: 1600,
    height: 810, // 화면 높이(H)와 동일 = 세로 스크롤 없는 존 (세로로 긴 구간은 f1z2_platforms 참고)
    groundY, groundH,
    groundGaps: [], // 튜토리얼 - 낙사 구간 없음

    // 허들 하나 - 점프해서 넘어가야 하는 낮은 장애물 (이동+점프를 자연스럽게 강제하는 튜토리얼 장치)
    solidPlatforms: [
      { x: 500, y: 712, w: 26, h: 38 },
    ],
    // 선택 사항으로 밟아볼 수 있는 낮은 발판 - 본 경로를 막지 않는 곁다리 연습용
    oneWayPlatforms: [
      { x: 850, y: 670, w: 150, h: 20 },
    ],

    wallGates: [],
    floors: [],
    // 존의 좌우 끝을 막는 세로 벽. 오른쪽 문은 원래부터 끝에서 40px 떨어져 있었으니(x=1520, 폭
    // 1600) 그 뒤(1560~1600)에 벽을 채우고, 왼쪽도 같은 간격을 맞춰 문을 40px 안쪽으로 옮긴 뒤
    // 그 앞(0~40)을 벽으로 채운다 - 양쪽 문이 "벽에 뚫린 문" 모양으로 통일됨.
    walls: [
      { x: 0, w: 40, gaps: [] },
      { x: 1560, w: 40, gaps: [] },
    ],
    enemySpawns: [],

    entryPoint: { x: 40, y: 650 },
    checkpoints: [
      { id: "start", x: 40, y: 650, active: true },
    ],

    doors: {
      left: { x: 40, y: 630, w: 40, h: 140 }, // 배경일 뿐, 트리거 없음 - 벽(0~40) 바로 뒤에 위치
      right: { x: 1520, y: 630, w: 40, h: 140, targetZoneId: "f1z2_platforms" },
    },

    triggerZones: [],
    ruleFlags: { hideGhostNpc: true },
  };
})();
