"use strict";

// 원래 프로토타입의 유일한 레벨을 존 하나로 옮긴 것. 사용자의 스토리 설계상 이 레벨은 나중에
// "2층 구역 3(몬스터들)"으로 재활용될 예정이라 파일명도 그에 맞춰뒀다. 여러 존 파일이 각자 groundY 같은
// 지역 변수를 top-level const로 선언하면 클래식 <script> 태그들은 전역 렉시컬 스코프를 공유해서 파일
// 간에 이름이 충돌한다 - 그래서 존 파일은 전부 IIFE로 감싸는 걸 규칙으로 한다 (CLAUDE.md 참고).
//
// 캔버스 높이가 540->810으로 늘어나면서, 원래 y=500이던 바닥을 그대로 두면 바닥 아래로 빈 공간이
// 270px 넘게 남아 캐릭터가 "붕 뜬" 것처럼 보이는 문제가 있었다 - 그래서 모든 y좌표를 +250 만큼
// 아래로 옮겨서, 바닥(groundY+groundH)이 존 높이(height) 바로 근처(20px 여유)에 오도록 했다.
// 상대적인 지형 배치(플랫폼 간 높이차 등)는 원래와 완전히 동일 - 전부 같은 양만큼 이동했을 뿐.
(function () {
  const groundY = 750, groundH = 40;
  const doorH = 140;
  const standingTopY = groundY - player.h; // 서 있을 때 플레이어 상단 y - entryPoint/checkpoint/문 y 계산에 사용

  ZONES["f2z3_legacy_arena"] = {
    id: "f2z3_legacy_arena",
    floor: 2, // 참고용 메타데이터일 뿐 - 실제 층 전환 로직은 없음 (zones.js 주석 참고)

    width: 3840, // 캔버스 너비(1440)의 약 2.7배 - 가로 스크롤 레벨
    height: 810, // 화면 높이(H)와 동일 = 세로 스크롤 없는 존. 바닥(groundY+groundH=790)이 20px 여유로 거의 맞닿음
    groundY, groundH,

    // 바닥에 뚫어놓은 낙사 구간 (이 x 범위에는 바닥이 없음 - 떨어지면 사망)
    groundGaps: [
      { x: 900, w: 100 },
      { x: 2350, w: 120 },
    ],

    // 완전 고정형 플랫폼: 모든 방향에서 막힘 (아래에서 점프해도 관통 불가). 바닥(groundGaps를 뺀 나머지)은
    // loadZone()이 buildGroundSegments()로 자동으로 덧붙여주므로 여기엔 안 적는다.
    solidPlatforms: [
      { x: 420, y: 550, w: 160, h: 20 },
      { x: 1300, y: 570, w: 140, h: 20 },
      { x: 1780, y: 510, w: 120, h: 20 },
      { x: 2520, y: 670, w: 160, h: 20 },
      { x: 3600, y: 510, w: 140, h: 20 }, // 레벨 끝자락, 높은 고정 플랫폼
    ],

    // 관통형(원웨이) 플랫폼: 위에서 떨어질 때만 착지, 아래에서 위로 점프할 땐 그냥 통과
    oneWayPlatforms: [
      { x: 150, y: 640, w: 160, h: 20 },
      { x: 700, y: 640, w: 160, h: 20 },
      { x: 1050, y: 670, w: 160, h: 20 },
      { x: 1550, y: 670, w: 160, h: 20 },
      { x: 2000, y: 640, w: 180, h: 20 },
      { x: 2260, y: 550, w: 150, h: 20 },
      { x: 2760, y: 590, w: 140, h: 20 },
      { x: 3150, y: 670, w: 180, h: 20 },
      { x: 3400, y: 590, w: 160, h: 20 },
    ],

    // 넘을 수 없는 봉쇄 벽(게이트): x=1900 안쪽(스폰 쪽) 몬스터를 모두 처치해야 사라짐.
    // 충돌 판정은 X 범위만 본다(isGateBlocking, zones.js) - 세로 위치와 무관하게 항상 막혀서 y/h가
    // 따로 필요 없음. 눈에 보이는 그림만 visualY/visualH로 따로 그림.
    wallGates: [
      { x: 1900, w: 40, visualY: 330, visualH: 460 },
    ],

    // 존의 좌우 끝을 막는 세로 벽(레벨 디자인 관례 - 모든 존이 이 패턴을 따름). 오른쪽엔 문이 없으니
    // 그냥 끝까지 다 막고, 왼쪽은 문을 40px 안쪽으로 넣고 그 앞을 벽으로 채운다.
    walls: [
      { x: 0, w: 40, gaps: [] },
      { x: 3800, w: 40, gaps: [] },
    ],

    enemySpawns: [
      { type: "turret", x: 230, y: 710, opts: {} },
      { type: "turret", x: 480, y: 510, opts: {} },
      { type: "turret", x: 760, y: 600, opts: {} },
      { type: "turret", x: 1090, y: 630, opts: {} },
      { type: "turret", x: 1340, y: 530, opts: {} },
      { type: "turret", x: 1600, y: 710, opts: { stunnable: false } }, // 벽 왼쪽 스턴 면역 수문장
      { type: "sniper", x: 1780, y: 470, opts: {} }, // 벽 안쪽 마지막 관문, 반드시 피해야 하는 투사체
      { type: "turret", x: 2040, y: 600, opts: { stunnable: false } }, // 벽 오른쪽 스턴 면역 수문장
      { type: "sniper", x: 2260, y: 510, opts: {} }, // 벽 통과 직후
      { type: "turret", x: 2560, y: 630, opts: {} },
      { type: "turret", x: 3190, y: 630, opts: {} },
      { type: "turret", x: 3630, y: 470, opts: {} },
      { type: "chaser", x: 2200, y: 706, opts: { patrolHalfRange: 100 } }, // 바닥 순찰 - 스턴 걸림
      { type: "chaser", x: 2700, y: 706, opts: { patrolHalfRange: 80, stunnable: false } }, // 바닥 순찰 - 스턴 면역
    ],

    entryPoint: { x: 40, y: standingTopY }, // 문으로 들어오거나 체크포인트가 없을 때 서는 기본 위치
    checkpoints: [
      { id: "start", x: 40, y: standingTopY, active: true },
    ],

    // 왼쪽 문은 배경일 뿐(트리거 없음 - 뒤로 못 감), 오른쪽 문은 아직 다음 존이 없어서 null.
    // 벽(0~40) 바로 뒤에 위치하도록 x=40으로 안쪽에 둠. y는 바닥에 딱 맞닿게(sunk 방지) groundY-doorH.
    doors: {
      left: { x: 40, y: groundY - doorH, w: 40, h: doorH },
      right: null,
    },

    floors: [],
    triggerZones: [],
    ruleFlags: {},
  };
})();
