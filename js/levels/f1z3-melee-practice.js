"use strict";

// 1층 구역 3 - 근접 공격 연습(포탑 1 + 체이서 1). 1층 전체 예외 규칙 중 "죽으면 안 됨"이 처음으로
// 실제 시험대에 오르는 구역 - 여기서 처음 등장하는 두 메커니즘:
//   1) 무피격 시간 경과 후 즉시(스냅) 최대 체력 회복 (ruleFlags.hpRegenDelay, js/entities/enemies.js의
//      tickHpRegen) - 플레이어와 몬스터 둘 다 이 존 안에서는 동일하게 적용됨: 맞아서 깎이는 건
//      그대로 보이되, 잠시(CONFIG.HP_REGEN_DELAY초) 안 맞고 버티면 그 순간 바로 풀피로 돌아온다
//      (서서히 차오르는 연출 아님). hpFloor(§ 아래)와는 독립된 별개의 레버라 - hpRegenDelay가 없는
//      존(2층 등)에서는 플레이어도 몬스터도 이 회복이 아예 발동하지 않으므로 실제 전투 긴장감엔
//      영향 없음. 플레이어 HP 최소값(hpFloor=1)과 짝을 이뤄 "죽지는 않지만 계속 깎일 수 있고,
//      버티면 다시 풀피로 리셋된다"는 연습 구간의 느낌을 만듦.
//   2) 몬스터 쪽 hpFloor(enemy.hpFloor, js/entities/enemies.js의 damageEnemy) - 리스폰 반복 대신
//      "안 죽되 체력 핍은 거의 바닥까지 보여줌"을 택함(스펙이 둘 다 허용). 포탑/체이서 모두 hpFloor:0.5로
//      스폰해서, 몇 대 때리면 마지막 반 칸 핍에서 멈추고 더 이상 안 줄어든다 - 계속 때려도 안 죽는다는
//      게 명확히 보임.
// 지형 자체는 낙사 구간 없는 평지 하나(f1z1과 동일하게 height=810, 세로 스크롤 없음) - 낙사는 hpFloor로도
// 못 막는 즉사이므로(triggerDeath는 applyDamageToHp를 거치지 않음) 이 구역엔 애초에 만들지 않는다.
(function () {
  const groundY = 750, groundH = 40;
  const doorH = 140;
  const standingTopY = groundY - player.h; // 서 있을 때 플레이어 상단 y - entryPoint/checkpoint/문 y 계산에 사용

  ZONES["f1z3_melee_practice"] = {
    id: "f1z3_melee_practice",
    floor: 1,

    width: 1700,
    height: 810,
    groundY, groundH,
    groundGaps: [],

    solidPlatforms: [],
    oneWayPlatforms: [],

    wallGates: [], // 몬스터가 hpFloor라 절대 안 죽으므로(isGateLocked는 enemy.alive를 봄) 이 구역엔 게이트를 안 씀
    floors: [],
    walls: [
      { x: 0, w: 40, gaps: [] },
      { x: 1660, w: 40, gaps: [] },
    ],

    enemySpawns: [
      { type: "turret", x: 650, y: groundY - 40, opts: { hpFloor: 0.5 } },
      { type: "chaser", x: 1250, y: groundY - 44, opts: { hpFloor: 0.5, patrolHalfRange: 120 } },
    ],

    entryPoint: { x: 40, y: standingTopY },
    checkpoints: [
      { id: "start", x: 40, y: standingTopY, active: false },
    ],

    // 오른쪽 문 - 구역 4(배경 몬스터)로 연결. 땅바닥 문이라 yMin은 안 둠(f1z1_entry와 동일 패턴).
    doors: {
      left: { x: 40, y: groundY - doorH, w: 40, h: doorH }, // 벽(0~40) 바로 뒤, 바닥에 딱 맞닿게(sunk 방지)
      right: {
        x: 1620, y: groundY - doorH, w: 40, h: doorH,
        targetZoneId: "f1z4_background_monsters", yMax: standingTopY + 25, landingY: groundY,
      },
    },

    // 대사는 아직 안 넣음(사용자가 나중에 정확한 문구/타이밍을 직접 지정할 예정) - 컷신 엔진 자체는
    // 그대로 있으니 필요해지면 이 배열에 트리거를 추가하면 됨.
    triggerZones: [],
    ruleFlags: { hideGhostNpc: true, hpFloor: 1, hpRegenDelay: CONFIG.HP_REGEN_DELAY },
  };
})();
