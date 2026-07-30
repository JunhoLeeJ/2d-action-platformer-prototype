"use strict";

// 원래 프로토타입의 유일한 레벨을 그대로 존 하나로 옮긴 것 - 수치 하나도 바뀌지 않았다.
// 사용자의 스토리 설계상 이 레벨은 나중에 "2층 구역 3(몬스터들)"으로 재활용될 예정이라 파일명도
// 그에 맞춰뒀다. 여러 존 파일이 각자 groundY 같은 지역 변수를 top-level const로 선언하면 클래식
// <script> 태그들은 전역 렉시컬 스코프를 공유해서 파일 간에 이름이 충돌한다 - 그래서 존 파일은
// 전부 IIFE로 감싸는 걸 규칙으로 한다 (CLAUDE.md 참고).
(function () {
  const groundY = 500, groundH = 40;

  ZONES["f2z3_legacy_arena"] = {
    id: "f2z3_legacy_arena",
    floor: 2, // 참고용 메타데이터일 뿐 - 실제 층 전환 로직은 없음 (zones.js 주석 참고)

    width: 3840, // 캔버스 너비(1440)의 약 2.7배 - 가로 스크롤 레벨
    height: 810, // 화면 높이(H)와 동일 = 세로 스크롤 없는 존
    groundY, groundH,

    // 바닥에 뚫어놓은 낙사 구간 (이 x 범위에는 바닥이 없음 - 떨어지면 사망)
    groundGaps: [
      { x: 900, w: 100 },
      { x: 2350, w: 120 },
    ],

    // 완전 고정형 플랫폼: 모든 방향에서 막힘 (아래에서 점프해도 관통 불가). 바닥(groundGaps를 뺀 나머지)은
    // loadZone()이 buildGroundSegments()로 자동으로 덧붙여주므로 여기엔 안 적는다.
    solidPlatforms: [
      { x: 420, y: 300, w: 160, h: 20 },
      { x: 1300, y: 320, w: 140, h: 20 },
      { x: 1780, y: 260, w: 120, h: 20 },
      { x: 2520, y: 420, w: 160, h: 20 },
      { x: 3600, y: 260, w: 140, h: 20 }, // 레벨 끝자락, 높은 고정 플랫폼
    ],

    // 관통형(원웨이) 플랫폼: 위에서 떨어질 때만 착지, 아래에서 위로 점프할 땐 그냥 통과
    oneWayPlatforms: [
      { x: 150, y: 390, w: 160, h: 20 },
      { x: 700, y: 390, w: 160, h: 20 },
      { x: 1050, y: 420, w: 160, h: 20 },
      { x: 1550, y: 420, w: 160, h: 20 },
      { x: 2000, y: 390, w: 180, h: 20 },
      { x: 2260, y: 300, w: 150, h: 20 },
      { x: 2760, y: 340, w: 140, h: 20 },
      { x: 3150, y: 420, w: 180, h: 20 },
      { x: 3400, y: 340, w: 160, h: 20 },
    ],

    // 넘을 수 없는 봉쇄 벽(게이트): x=1900 안쪽(스폰 쪽) 몬스터를 모두 처치해야 사라짐.
    // 충돌 판정용 y/h는 위아래로 아주 길게 잡아서 어떤 점프로도 넘어갈 수 없게 함 - 눈에 보이는
    // 그림은 visualY/visualH로 따로 그림(안 보이는 위쪽까지 그릴 필요는 없어서).
    wallGates: [
      { x: 1900, y: -2000, w: 40, h: 2600, visualY: 80, visualH: 460 },
    ],

    enemySpawns: [
      { type: "turret", x: 230, y: 460, opts: {} },
      { type: "turret", x: 480, y: 260, opts: {} },
      { type: "turret", x: 760, y: 350, opts: {} },
      { type: "turret", x: 1090, y: 380, opts: {} },
      { type: "turret", x: 1340, y: 280, opts: {} },
      { type: "turret", x: 1600, y: 460, opts: { stunnable: false } }, // 벽 왼쪽 스턴 면역 수문장
      { type: "sniper", x: 1780, y: 220, opts: {} }, // 벽 안쪽 마지막 관문, 반드시 피해야 하는 투사체
      { type: "turret", x: 2040, y: 350, opts: { stunnable: false } }, // 벽 오른쪽 스턴 면역 수문장
      { type: "sniper", x: 2260, y: 260, opts: {} }, // 벽 통과 직후
      { type: "turret", x: 2560, y: 380, opts: {} },
      { type: "turret", x: 3190, y: 380, opts: {} },
      { type: "turret", x: 3630, y: 220, opts: {} },
      { type: "chaser", x: 2200, y: 456, opts: { patrolHalfRange: 100 } }, // 바닥 순찰 - 스턴 걸림
      { type: "chaser", x: 2700, y: 456, opts: { patrolHalfRange: 80, stunnable: false } }, // 바닥 순찰 - 스턴 면역
    ],

    entryPoint: { x: 40, y: 400 }, // 문으로 들어오거나 체크포인트가 없을 때 서는 기본 위치
    checkpoints: [
      { id: "start", x: 40, y: 400, active: true },
    ],

    // 왼쪽 문은 배경일 뿐(트리거 없음 - 뒤로 못 감), 오른쪽 문은 아직 다음 존이 없어서 null.
    doors: {
      left: { x: 0, y: 380, w: 40, h: 140 },
      right: null,
    },

    triggerZones: [],
    ruleFlags: {},
  };
})();
