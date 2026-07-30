"use strict";

// 1층 구역 4 - 배경 몬스터(적 A 2마리 + 적 B 1마리). 원작 스펙: "전투 대상 아님(지나가는 구간)" -
// 그래서 이 존엔 wallGates가 없다(몬스터를 다 잡아야 열리는 봉쇄 벽 자체가 없음 - 그냥 지나가면 됨).
// "배경"이라는 성격은 AI를 약하게 만들어서가 아니라 순수 레벨 디자인으로 만든다:
//   - 적 A(mimeA)는 실제 전투 능력(감지→추적→근접 공격) 자체는 체이서를 그대로 재사용한다
//     (js/entities/enemies.js의 makeMimeA/updateChaserAI 참고) - 새 몬스터 "타입"이 필요한 이유는
//     체력값과 도형 기반 유휴 애니메이션(§ 5, 손짓 반복→감지 시 정지) 때문이지 AI 로직 때문이 아니다.
//   - 적 B(mimeB)는 완전 수동형 - 감지/공격 개념 자체가 없고 몸통 색이 옅게 pulse만 한다(웅얼거림).
// 1층 전체 예외 규칙(§ 1층 레벨 레이아웃 상단, ROADMAP.md) "구역 5 즉사 씬 제외 플레이어가 죽으면
// 안 됨"이 여기도 적용된다 - mimeA가 실제로 근접 공격 데미지를 줄 수 있는 이상, 구역 3과 동일하게
// hpFloor+hpRegenDelay를 걸어서 지나가다 우연히 얻어맞아도 죽지 않게 한다(적 자체엔 hpFloor를
// 안 줬음 - "안 죽는 연습용 몬스터"가 아니라 그냥 지나치는 배경이라, 플레이어가 굳이 잡으면 죽어도 무방).
(function () {
  const groundY = 750, groundH = 40;
  const doorH = 140;
  const standingTopY = groundY - player.h; // entryPoint/checkpoint/문 y 전부 여기서 파생 (CLAUDE.md 관례)

  ZONES["f1z4_background_monsters"] = {
    id: "f1z4_background_monsters",
    floor: 1,

    width: 1800,
    height: 810,
    groundY, groundH,
    groundGaps: [],

    solidPlatforms: [],
    oneWayPlatforms: [],

    wallGates: [], // "전투 대상 아님" - 몬스터를 안 잡아도 그냥 지나갈 수 있어야 하므로 봉쇄 벽 없음
    floors: [],
    walls: [
      { x: 0, w: 40, gaps: [] },
      { x: 1760, w: 40, gaps: [] },
    ],

    enemySpawns: [
      { type: "mimeA", x: 480, y: groundY - 44, opts: {} },
      { type: "mimeB", x: 950, y: groundY - 40, opts: {} },
      { type: "mimeA", x: 1380, y: groundY - 44, opts: {} },
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

    triggerZones: [
      {
        id: "background_monsters_intro", kind: "auto",
        sequence: [
          { type: "dialogue", speaker: null, text: "[정적] ...저것들은 나를 신경 쓰지 않는 것 같다. 그냥 지나가자." },
        ],
      },
    ],
    ruleFlags: { hideGhostNpc: true, hpFloor: 1, hpRegenDelay: CONFIG.HP_REGEN_DELAY },
  };
})();
