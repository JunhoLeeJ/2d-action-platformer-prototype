"use strict";

// 1층 구역 2 - 플랫폼 형식(이동 및 점프 연습), 낙사 없음. 세 부분으로 구성:
//   1) 계단(§ 계단): 원웨이 발판으로 만든 오르막->내리막, 기존 지상 경로(문까지 이어짐)
//   2) 타워(§ 강제 지그재그 타워): 계단 꼭대기에서 이어지는 보너스 구간. 존 전체 폭(1900px)에 걸친
//      느슨한 지그재그였던 이전 버전은 층 하나 오를 때마다 ~1300px씩 왕복해야 해서 너무 노가다스러웠다
//      - walls(zones.js에서 새로 생긴 "임의 구간에 놓는 세로 벽" 개념)로 폭 400px짜리 좁은 통로(샤프트)를
//      만들고, floors(각 층 하나에 구멍 하나, 좌/우 번갈아)를 그 통로 안에만 놓아서 오갈 거리를 크게
//      줄였다 - 통로 자체가 눈에 보이는 벽으로 감싸여 있어서 "여기 안에서 지그재그로 오르면 된다"는
//      게 한눈에 보이는 것도 목적(그냥 넓은 허공에서 구멍을 찾아 헤매는 것보다 훨씬 안내가 됨).
//   3) 존 좌우 끝의 벽(§ 좌우 벽): 모든 존이 따르는 관례 - 왼쪽 문은 벽(0~40) 바로 뒤(x=40)에 있고,
//      오른쪽도 끝까지 벽으로 막혀 있음(이 존은 아직 오른쪽 문이 없음).
// 존 높이(height=1560)가 화면 높이(H=810)보다 훨씬 커서 타워를 오르면 카메라가 반드시 세로로도
// 따라와야 한다. 바닥 구멍이 아예 없어서(groundGaps: []) "낙사 없음" 규칙이 지형만으로 성립한다.
(function () {
  const groundY = 1500, groundH = 40;

  // 샤프트(타워 통로) 치수 - 존 전체 폭이 아니라 이 구간에만 층/벽이 놓인다.
  const shaftXMin = 700, shaftXMax = 1100; // 400px 폭
  const gapRight = { x: 920, w: 180 }; // 오른쪽(벽 쪽) 구멍
  const gapLeft = { x: 700, w: 180 };  // 왼쪽(벽 쪽) 구멍

  ZONES["f1z2_platforms"] = {
    id: "f1z2_platforms",
    floor: 1,

    width: 1900,
    // groundY(1500)+groundH(40)=1540, 여기에 20px 여유만 더해서 바닥이 존 아래쪽에 거의 맞닿게 함
    // (그래야 카메라가 바닥 근처에서 아래쪽으로 꽉 찼을 때 바닥 밑에 빈 허공이 크게 안 보인다).
    height: 1560,
    groundY, groundH,
    groundGaps: [],

    // 허들 하나 (구역 1과 동일한 장치, 계단/문으로 이어지는 지상 경로의 복습 겸 마무리)
    solidPlatforms: [
      { x: 1500, y: 1462, w: 26, h: 38 },
    ],

    oneWayPlatforms: [
      // --- 계단: 오르막 -> 내리막. 각 단 높이차는 한 번의 점프로 충분한 정도(~60-70px) ---
      { x: 300, y: 1440, w: 150, h: 20 },
      { x: 550, y: 1370, w: 150, h: 20 },
      { x: 800, y: 1300, w: 150, h: 20 }, // 계단 꼭대기 - 여기서부터 타워 샤프트로 올라갈 수 있음
      { x: 1050, y: 1370, w: 150, h: 20 },
      { x: 1300, y: 1440, w: 150, h: 20 },
      // 타워 꼭대기의 보너스 전망대 - 마지막 층(y=720)의 구멍을 통과한 뒤 착지하는 곳(샤프트 폭
      // 전체를 덮어서 착지가 너그러움). 막다른 곳이라 어디로 이어지진 않고, 여기서 떨어져도
      // (낙사 구간이 없으므로) 안전하게 되돌아갈 뿐이다.
      { x: shaftXMin, y: 610, w: shaftXMax - shaftXMin, h: 20 },
    ],

    wallGates: [],

    // --- 강제 지그재그 타워: 계단 꼭대기(x=800,y=1300)에서 곧장 위로. 층 사이 간격은 한 번의 점프로
    //     넉넉히 닿는 110px. 각 층은 샤프트 폭(700~1100) 안에만 있고(xMin/xMax) 구멍이 좌/우로 번갈아
    //     있어서, 층에 올라설 때마다 샤프트 반대쪽 구멍까지 걸어가야 다음 층으로 갈 수 있다 - 다만
    //     샤프트가 좁아서(400px) 예전 버전(존 전체 폭)보다 오가는 거리가 훨씬 짧다.
    floors: [
      { y: 1160, h: 20, xMin: shaftXMin, xMax: shaftXMax, gaps: [gapRight] },
      { y: 1050, h: 20, xMin: shaftXMin, xMax: shaftXMax, gaps: [gapLeft] },
      { y: 940,  h: 20, xMin: shaftXMin, xMax: shaftXMax, gaps: [gapRight] },
      { y: 830,  h: 20, xMin: shaftXMin, xMax: shaftXMax, gaps: [gapLeft] },
      { y: 720,  h: 20, xMin: shaftXMin, xMax: shaftXMax, gaps: [gapRight] }, // 맨 위 층
    ],
    // 샤프트를 감싸는 좌우 벽 - 통로를 눈으로도 명확하게 보여줘서(허공에서 구멍 찾기가 아니라
    // "이 통로 안에서 지그재그") 더 가이드되는 느낌을 준다. yMin/yMax로 샤프트 구간(전망대 바로
    // 위쪽 여유~계단 꼭대기 바로 아래)에만 놓음 - 존 전체 높이를 덮을 필요는 없음.
    // 좌우 끝 벽(§ 위 설명)과는 별개 - 이건 존 경계가 아니라 타워 통로 자체를 감싸는 벽.
    walls: [
      { x: shaftXMin - 20, w: 20, yMin: 550, yMax: 1310, gaps: [] },
      { x: shaftXMax,      w: 20, yMin: 550, yMax: 1310, gaps: [] },
      // 존 좌우 끝 벽 (모든 존이 따르는 관례) - 왼쪽 문은 이 벽 바로 뒤(x=40)에 있음.
      { x: 0, w: 40, gaps: [] },
      { x: 1860, w: 40, gaps: [] },
    ],

    enemySpawns: [],

    entryPoint: { x: 40, y: 1400 },
    checkpoints: [
      { id: "start", x: 40, y: 1400, active: false },
    ],

    // 오른쪽 문은 아직 다음 구역(구역 3: 근접 공격 연습)이 없어서 null - 다음 세션에서 이어붙일 자리.
    doors: {
      left: { x: 40, y: 1380, w: 40, h: 140 }, // 벽(0~40) 바로 뒤에 위치
      right: null,
    },

    // 테스트용 트리거 - 전망대(타워 꼭대기)에 올라서야만 발동하도록 yMin/yMax로 그 층에만 걸어뒀다.
    // yMin은 넉넉하게(위에서 접근해도 됨), yMax는 빡빡하게(전망대 바로 아래까지만) 잡아서, 아래
    // 지상/계단에서 같은 x대를 지나가도 발동하지 않는지 직접 확인할 수 있다. repeatable=true라
    // 몇 번이고 다시 걸어 들어가서 재확인 가능.
    triggerZones: [
      {
        id: "test_tower_top", kind: "walkIn", repeatable: true,
        xMin: shaftXMin, xMax: shaftXMax,
        yMin: 300, yMax: 650,
        sequence: [
          { type: "dialogue", speaker: null, text: "[테스트] 타워 꼭대기 트리거 발동 - X/Y 범위 판정 확인용." },
          { type: "dialogue", speaker: "테스터", text: "yMin/yMax로 층을 구분했으니 아래쪽에서 지나가도 안 뜨는지 확인해봐." },
        ],
      },
    ],
    ruleFlags: { hideGhostNpc: true },
  };
})();
