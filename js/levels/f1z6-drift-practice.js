"use strict";

// 1층 구역 6 - 표류 연습. 원본 스펙: "구역 3과 비슷하지만 배치 다르게, 접근성 더 어렵게"(ROADMAP.md).
// 구역 3과 같은 핵심 메커니즘(죽지 않되 깎이는 건 보임)을 그대로 재사용한다 - hpFloor(플레이어 1,
// 몬스터 0.5)+HP 자연 회복(playerHpRegenDelay/enemyHpRegenDelay) 인프라 전부 구역 3에서 이미 범용으로
// 만들어졌으므로 ruleFlags만 채우면 됨(§ 8 판단 사항: "구역 6도 특별한 이유가 없다면 구역 3과 같은
// 불사 방식을 재사용" - 그대로 따름). 몬스터 구성(포탑 1 + 체이서 1)도 구역 3과 동일 - "배치 다르게"가
// 요구사항이지 "몬스터를 바꿔라"가 아니므로.
//
// "배치 다르게, 접근성 더 어렵게"는 지형으로 구현: 구역 3은 완전히 평평한 외길이었지만, 여기선 포탑을
// 땅이 아니라 원웨이 발판(널빤지) 위에 얹어서 바로 옆에서 근접으로 때리기 어렵게 만들었다 - 아래서
// 계속 날아오는 투사체를 표류로 받아넘기는 연습이 자연스럽게 유도되고(근접으로 처리하려면 일부러
// 점프해서 발판 위로 올라가야 함), 체이서는 그 뒤에 순찰 범위를 넓혀 배치해서 포탑을 상대하다 보면
// 자연스럽게 사거리 안에 들어오게 했다. 낙사 구간(groundGaps)은 일부러 안 씀 - 낙사는 hpFloor로도 못
// 막는 즉사라(triggerDeath는 applyDamageToHp를 안 거침) 1층의 "안 죽는다" 규칙과 충돌한다(구역 3과
// 동일한 이유, f1z3-melee-practice.js 참고).
//
// 오른쪽 문(doors.right, 아래) - 2층 구역 1(f2z1_gyeol_encounter, 결 조우)로 연결. "층 이동
// (1층→2층)" 작업 완료 - 원본 스펙엔 "층 이동 전용 컷신"이라고 되어 있었지만, CLAUDE.md의 "구조 관련
// 확정 사항"대로 층 이동도 다른 문과 다를 것 없는 평범한 doors.right일 뿐이다(엔진이 이미 범용으로
// 처리 - 새 엔진 기능 불필요, ROADMAP.md § 7 예상대로). "컷신이 이어진다"는 부분은 문 자체가 아니라
// 2층 구역 1이 담당한다 - f2z1_gyeol_encounter.js 참고.

(function () {
  const groundY = 750, groundH = 40;
  const doorH = 140;
  const standingTopY = groundY - player.h; // entryPoint/checkpoint/문 y 전부 여기서 파생 (CLAUDE.md 관례)

  // 포탑 발판 - 지상에서 90px 위(싱글 점프 정점 ≈137px보다 낮아 여유 있게 오를 수 있음, f1z2_platforms의
  // 실측 점프 물리 참고). 원웨이라 아래에서는 그냥 지나칠 수 있고, 위로도 올라갈 수 있음 - "근접하려면
  // 일부러 올라가야 한다"는 선택지를 만들 뿐 강제 경로는 아니다.
  const ledgeY = groundY - 90, ledgeH = 20;
  const turretH = 40;

  ZONES["f1z6_drift_practice"] = {
    id: "f1z6_drift_practice",
    name: "1층 구역 6 - 표류 연습",
    floor: 1,

    width: 1800,
    height: 810,
    groundY, groundH,
    groundGaps: [], // 1층 "안 죽는다" 규칙 - 낙사는 hpFloor로 못 막는 즉사라 애초에 안 만듦(구역 3과 동일 이유)

    solidPlatforms: [],
    // 포탑이 얹힌 발판 - 원웨이라 아래에서 위로 뚫고 올라갈 수 있고(점프해서 착지), 위에서는 정상적으로
    // 서있을 수 있다. x=640~840(폭 200) - 포탑(x=700,w=36)이 발판 위 대략 중앙 왼쪽에 놓임.
    oneWayPlatforms: [
      { x: 640, y: ledgeY, w: 200, h: ledgeH },
    ],

    wallGates: [], // 몬스터가 전부 hpFloor라 절대 안 죽으므로(isGateLocked는 enemy.alive를 봄) 게이트 불필요 - 구역 3과 동일
    floors: [],
    walls: [
      { x: 0, w: 40, gaps: [] },
      { x: 1760, w: 40, gaps: [] },
    ],

    enemySpawns: [
      // 발판 위에 얹힌 포탑 - 근접하려면 점프해서 발판에 올라가야 하므로, 지상에서는 표류로 투사체를
      // 받아넘기는 쪽이 훨씬 자연스럽다("표류 연습"이라는 존 목적에 맞춘 배치).
      { type: "turret", x: 700, y: ledgeY - turretH, opts: { hpFloor: 0.5 } },
      // 포탑을 상대하다 보면 자연스럽게 사거리에 들어오도록 그 뒤에 순찰 범위를 넓게 배치 - 구역 3보다
      // patrolHalfRange를 키워서(120 -> 160) "배치 다르게"를 반영.
      { type: "chaser", x: 1350, y: groundY - 44, opts: { hpFloor: 0.5, patrolHalfRange: 160 } },
    ],

    entryPoint: { x: 40, y: standingTopY },
    checkpoints: [
      { id: "start", x: 40, y: standingTopY, active: false },
    ],

    // 왼쪽 문은 배경(트리거 없음), 오른쪽 문은 층 이동(§ 위 주석) - 다른 모든 문과 동일한 관례
    // (yMax/landingY)를 그대로 따름.
    doors: {
      left: { x: 40, y: groundY - doorH, w: 40, h: doorH },
      right: {
        x: 1720, y: groundY - doorH, w: 40, h: doorH,
        targetZoneId: "f2z1_gyeol_encounter", yMax: standingTopY + 25, landingY: groundY,
      },
    },

    // 대사는 아직 안 넣음(사용자가 나중에 정확한 문구/타이밍을 직접 지정할 예정) - 구역 3/4와 동일 원칙.
    //
    // drift_demo_placeholder - "표류 실사용 예시를 컷신으로 보여준다"는 계획의 자리표시자(사용자 요청,
    // LATER.md에도 메모해둠). 지금은 카메라를 잠깐 오른쪽으로 훑는 것뿐인 텅 빈 자리 - 나중에 실제
    // 표류 사용 예시(예: 동료가 투사체를 표류로 받아넘기는 모습)로 교체할 것. auto라 존 진입 즉시
    // 1회만 재생되고(repeatable:false), 대사/애니메이션 등 실제 데모 콘텐츠가 없어 지금은 존재감이
    // 거의 없지만, 트리거 자리 자체는 미리 잡아둬서 나중에 이 자리에 이벤트만 채워 넣으면 되게 했다.
    triggerZones: [
      // makeCheckpointTrigger(js/engine/zones.js) - 예외 없이 실제로 닿아야만 체크포인트가 활성화된다
      // (사용자 요청). 기둥 UI가 없으므로 entryPoint 자체를 판정 범위로 잡는다 - 스폰 즉시 범위 안이라
      // "playing"의 첫 프레임에 바로 발동한다(kind:"auto"인 아래 플레이스홀더와는 별개의 walkIn).
      makeCheckpointTrigger({
        zoneId: "f1z6_drift_practice", checkpointId: "start", x: 40, y: standingTopY,
        xMin: 20, xMax: 120, standingTopY,
      }),
      {
        id: "drift_demo_placeholder",
        kind: "auto",
        repeatable: false,
        sequence: [
          { type: "cameraHold", target: { x: 360, y: 0 }, duration: 1.2 }, // 360 = cameraBounds.maxX(width 1800 - W 1440)
        ],
      },
    ],
    ruleFlags: {
      hideGhostNpc: true, hpFloor: 1,
      playerHpRegenDelay: CONFIG.HP_REGEN_DELAY, enemyHpRegenDelay: CONFIG.HP_REGEN_DELAY,
    },
  };
})();
