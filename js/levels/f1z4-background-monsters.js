"use strict";

// 1층 구역 4 - 배경 몬스터(적 A 2마리) + 배경 장식(적 B 1개). 원작 스펙: "전투 대상 아님(지나가는
// 구간)"이었지만, 사용자 확인으로 실제 봉쇄 벽(적 A를 다 잡아야 열리는 벽)을 넣기로 함 - 그래서
// 적 A(mimeA)만 진짜 "적"(enemies[] 소속, 죽을 수 있고 봉쇄 벽 조건에 들어감)이고, 적 B(mimeB)는
// `enemies[]`에 아예 안 들어가는 순수 배경 장식이다(§ 아래, ambientProps). 죽지 않고 체력 UI도 없는
// 이유가 바로 이것 - "적으로 정의하지 않음" 자체가 곧 "안 죽음"이 되도록 구조 자체로 만족시킴(별도
// 무적 플래그 불필요). 이 설계 덕분에 봉쇄 벽 잠금 조건(`isGateLocked`, js/engine/zones.js)이 보는
// `enemies[]`에 mimeB가 애초에 없어서, 적 B의 생사는 봉쇄 벽과 구조적으로 완전히 무관하다.
//
// 대사는 아직 안 넣음(사용자가 나중에 정확한 문구/타이밍을 직접 지정할 예정) - 컷신 엔진 자체는
// 그대로 있으니(js/engine/cutscene.js) 필요해지면 triggerZones에 추가하면 됨.
(function () {
  const groundY = 750, groundH = 40;
  const doorH = 140;
  const standingTopY = groundY - player.h; // entryPoint/checkpoint/문 y 전부 여기서 파생 (CLAUDE.md 관례)

  ZONES["f1z4_background_monsters"] = {
    id: "f1z4_background_monsters",
    name: "1층 구역 4 - 배경 몬스터",
    floor: 1,

    width: 1800,
    height: 810,
    groundY, groundH,
    groundGaps: [],

    solidPlatforms: [],
    oneWayPlatforms: [],

    // 적 A 2마리를 다 잡아야 열림 - spawnX(480, 1380) 둘 다 gate.x(1650)보다 왼쪽이라 죽어야 잠금 해제.
    // mimeB는 enemies[]에 없으므로 isGateLocked/countAliveBehindGate 어느 쪽 판정에도 아예 안 잡힘.
    wallGates: [
      { x: 1650, w: 40, visualY: 0, visualH: 790 },
    ],
    floors: [],
    walls: [
      { x: 0, w: 40, gaps: [] },
      { x: 1760, w: 40, gaps: [] },
    ],

    enemySpawns: [
      { type: "mimeA", x: 480, y: groundY - 44, opts: {} },
      { type: "mimeA", x: 1380, y: groundY - 44, opts: {} },
    ],

    // 순수 배경 장식 - enemies[]/damageEnemy/wallGates 등 어떤 전투 판정에도 관여하지 않는다.
    // draw()가 zone.ambientProps를 따로 순회하며 그리기만 함(js/rendering.js의 drawMimeBProp 참고) -
    // 공격해도 맞는 판정 자체가 없어서(그 루프에 아예 안 들어감) 죽일 방법이 없다. 몸통 색이 옅게
    // 밝아졌다 어두워지는 pulse만 있음(§ 5 아트 제약 "웅얼거림": 시각적 동작 없음, pulse만).
    ambientProps: [
      { type: "mimeB", x: 950, y: groundY - 40, w: 34, h: 40 },
    ],

    entryPoint: { x: 40, y: standingTopY },
    checkpoints: [
      { id: "start", x: 40, y: standingTopY, active: false },
    ],

    // 오른쪽 문은 아직 다음 구역(구역 5: 치명상 씬)이 없어서 null - 다음 세션에서 이어붙일 자리.
    // (새 문을 달 때는 f1z1/f1z2처럼 yMax+landingY(이 존은 groundY)를 반드시 같이 챙길 것 - CLAUDE.md 참고.)
    doors: {
      left: { x: 40, y: groundY - doorH, w: 40, h: doorH },
      right: null,
    },

    triggerZones: [],
    ruleFlags: { hideGhostNpc: true, hpFloor: 1, hpRegenDelay: CONFIG.HP_REGEN_DELAY },
  };
})();
