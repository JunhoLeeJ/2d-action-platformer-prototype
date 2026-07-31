"use strict";

// 1층 구역 5 - 치명상 씬. 첫 방문에는 사실상 막다른 방이다 - 안쪽에 reachingEntity(손 뻗은
// 형체)+fragmentObject(그 손이 향하는 조각, 정체는 스펙에 없는 플레이스홀더)가 있고, 접근하면 조작권을
// 뺏긴 채 "느린 걸음"으로 끌려가다(zones.js의 makeSlowWalkTick, 이후 다른 컷신에도 재사용 예정) 화면이
// 지지직대다(cutscene.js의 "screenGlitch" 이벤트) 즉사 -> 사망씬(암전, 지금은 플레이스홀더) -> 구역
// 1로 텔레포트 + 페이드인. 재방문부터는 더 이상 막다른 방이 아니다 - 오른쪽 문(§ 아래)으로 구역 6까지
// 정상적으로 걸어갈 수 있다.
//
// 1층 전체 규칙("구역 5 즉사 씬 제외 플레이어가 죽으면 안 됨" - CLAUDE.md/ROADMAP.md 참고)의 그
// "제외"가 바로 이 구역 - 그래서 다른 1층 구역과 달리 ruleFlags.hpFloor를 일부러 안 넣는다(진짜 죽어야
// 하므로). 전투 자체가 없는 구역이라 hpRegenDelay도 무의미해서 안 넣음.
//
// 즉사 트리거는 repeatable:false라 딱 한 번만 발동한다 - seenTriggerIds가 세션 전체에 걸쳐 유지되므로
// (cutscene.js), 플레이어가 이 존을 다시 찾아와도 재발동하지 않는다.
//
// 1층 구역 1 재진입 처리(ROADMAP.md) - 구역 5 재방문 시의 변화: hasSeenTrigger()로 즉사 트리거를 이미
// 겪었는지 확인해서, ambientProps(reachingEntity/fragmentObject 제거 -> crackMark만 남김)와
// triggerZones(새로운 crack_drift_unlock 트리거)를 둘 다 함수로 만들어 loadZone이 로드 시점마다 다시
// 평가하게 한다(zones.js 참고 - trigger.sequence의 "발동 시점 평가"와 같은 정신, 이번엔 "로드 시점").
// 이미 표류가 풀린 뒤에는(driftUnlocked) crackMark도 사라지고(흡수됐으니) crack_drift_unlock 트리거도
// 더는 필요 없어 triggerZones가 빈 배열을 낸다.
//
// 오른쪽 문(doors.right, 아래) - 구역 6으로 연결. 첫 방문 땐 fatal_approach의 강제 "느린 걸음"이
// 이 문보다 훨씬 앞(slowWalkTargetX=740)에서 플레이어를 붙잡아 죽이므로, 물리적으로 이 문까지 걸어갈
// 수 없다 - 별도의 "죽기 전엔 문 잠금" 처리가 필요 없다. 재방문(crackMark) 이후엔 흡수 애니메이션이
// 끝나고 조작권을 돌려주면 그대로 걸어서 이 문까지 갈 수 있다 - 즉 "1층 구역 6으로 가는 유일한 정상
// 경로"가 이 문이다(그전까지는 구역 선택 패널로만 갈 수 있었음 - 사용자 피드백으로 추가).
(function () {
  const groundY = 750, groundH = 40;
  const doorH = 140;
  const standingTopY = groundY - player.h; // entryPoint/checkpoint/문 y 전부 여기서 파생 (CLAUDE.md 관례)

  // 강제로 끌려가 멈추는 지점 - reachingEntity(x:860)/fragmentObject(x:795)보다 앞에서 멈춰서 서로
  // 겹치지 않으면서도 "손이 뻗어 닿는 대상" 구도가 되도록 잡음(§ 아래 ambientProps 좌표 참고).
  const slowWalkTargetX = 740;

  const FATAL_APPROACH_ID = "fatal_approach";
  const hasDied = () => hasSeenTrigger("f1z5_fatal_encounter", FATAL_APPROACH_ID);

  // crackMark 위치 - reachingEntity가 있던 자리(x:860) 근처에 흔적만 남긴다. fragmentObject도 같이
  // 치워서("reachingEntity 제거 + crackMark만 남음" - ROADMAP.md 원문) 방 안에 남는 건 이 흔적 하나뿐.
  const crackMarkX = 845, crackMarkY = groundY - 34, crackMarkW = 30, crackMarkH = 34;

  ZONES["f1z5_fatal_encounter"] = {
    id: "f1z5_fatal_encounter",
    name: "1층 구역 5 - 치명상 씬",
    floor: 1,

    // width가 1000->1200으로 늘어남(§ 위 오른쪽 문 주석) - crackMark(x:845)/crack_drift_unlock
    // 트리거(x:805~915) 뒤로 문까지 걸어갈 여유 공간(x:1120)을 두기 위함. 막다른 방이었던 시절의
    // 좁은 방 크기(1000)를 그대로 늘린 것일 뿐, 기존 트리거/ambientProps 좌표는 전혀 안 바뀜.
    width: 1200,
    height: 810,
    groundY, groundH,
    groundGaps: [],

    solidPlatforms: [],
    oneWayPlatforms: [],

    wallGates: [],
    floors: [],
    walls: [
      { x: 0, w: 40, gaps: [] },
      { x: 1160, w: 40, gaps: [] },
    ],

    enemySpawns: [], // 막다른 방 - 전투 없음

    // reachingEntity가 왼쪽(다가오는 플레이어 쪽)으로 팔을 뻗고, fragmentObject는 그 손끝이 닿는
    // 자리에 둬서 "무언가에 손을 뻗고 있다"는 구도를 만든다(drawReachingEntityProp/
    // drawFragmentObjectProp, js/rendering.js 참고). 순수 배경 장식 - enemies[]/전투 판정과 무관.
    // 즉사 트리거를 이미 겪었으면(hasDied) 둘 다 사라지고 crackMark(drawCrackMarkProp)만 남는다 -
    // 함수 형태라 loadZone이 존을 다시 불러올 때마다 그 시점의 상태를 반영한다(§ 위 주석 참고).
    // 표류까지 풀리고 나면(driftUnlocked) crackMark도 사라진다 - 흡수 애니메이션(아래 트리거 참고)으로
    // 실제로 빨려들어가 없어졌다는 걸 방 상태에도 반영하는 것.
    ambientProps: () => {
      if (!hasDied()) {
        return [
          { type: "fragmentObject", x: 795, y: 694, w: 20, h: 20 },
          { type: "reachingEntity", x: 860, y: groundY - 70, w: 34, h: 70 },
        ];
      }
      if (driftUnlocked) return [];
      return [{ type: "crackMark", x: crackMarkX, y: crackMarkY, w: crackMarkW, h: crackMarkH }];
    },

    entryPoint: { x: 40, y: standingTopY },
    checkpoints: [
      { id: "start", x: 40, y: standingTopY, active: false },
    ],

    // 오른쪽 문 - 구역 6으로 연결(§ 파일 상단 주석). 다른 모든 문과 동일한 관례(yMax/landingY)를
    // 그대로 따름 - 이 문 하나만 특별 취급할 이유가 없음(첫 방문에 못 가는 이유는 문 자체가 아니라
    // 그 앞의 즉사 트리거가 걸어가지 못하게 막기 때문 - § 위 주석 참고).
    doors: {
      left: { x: 40, y: groundY - doorH, w: 40, h: doorH },
      right: {
        x: 1120, y: groundY - doorH, w: 40, h: doorH,
        targetZoneId: "f1z6_drift_practice", yMax: standingTopY + 25, landingY: groundY,
      },
    },

    // 함수 형태(§ 위 주석) - 아직 안 죽었으면 즉사 트리거만, 죽었지만 표류가 아직 안 풀렸으면
    // crackMark 앞에서 흡수 애니메이션으로 표류를 해금하는 트리거만, 이미 풀렸으면 이 배열 자체는
    // 비어있다(빈 배열 - crackMark 관련 이벤트는 더 이상 없다는 뜻). 오른쪽 문 트리거(doors.right)는
    // 이 함수와 무관하게 loadZone()이 항상 별도로 붙여주므로(zones.js의 makeDoorTrigger), 이 배열이
    // 비어있어도 문은 정상적으로 동작한다 - 매 분기에서 문 트리거를 직접 챙길 필요가 없음.
    triggerZones: () => {
      if (!hasDied()) {
        return [
          {
            id: FATAL_APPROACH_ID,
            kind: "walkIn",
            xMin: 560, xMax: 620,
            repeatable: false,
            sequence: [
              // 트리거 발동 시 아직 공중(점프 등)이었다면 "자연스러운 착지"를 fireTrigger()가 이 시퀀스
              // 앞에 자동으로 붙여준다(js/engine/cutscene.js, makeFallUntilGroundedTick - 전 트리거 공용) -
              // 여기서는 이미 땅에 서 있다는 전제로 느린 걸음만 시작하면 된다.
              { type: "custom", tick: makeSlowWalkTick(slowWalkTargetX, CONFIG.SLOW_WALK_SPEED) },
              { type: "screenGlitch", duration: 1.4 },
              { type: "callback", fn: () => { player.hp = 0; } }, // 즉사 - HP를 직접 0으로 (사망씬 페이드 직전 시각적 확정)
              {
                type: "fade",
                color: "#2b0000", // 일반 문 전환(검정)과 구분되는 핏빛 암전 - "사망씬" 플레이스홀더
                outDuration: 0.5, holdDuration: 1.0, inDuration: 0.6,
                // enterZone()이 위치 이동+체크포인트 갱신+HP 등 생존 상태 리셋을 한 번에 처리 - 문 전환/
                // QA 워프와 동일한 코드 경로(CLAUDE.md의 enterZone 계약 참고). 완전 암전 상태에서
                // 호출되므로 텔레포트가 눈에 보이지 않고, 이어지는 inDuration이 곧 "페이드인"이 된다.
                onMidpoint: () => { enterZone("f1z1_entry"); },
              },
            ],
          },
        ];
      }
      if (driftUnlocked) return [];
      return [
        {
          id: "crack_drift_unlock",
          kind: "walkIn",
          xMin: crackMarkX - 40, xMax: crackMarkX + crackMarkW + 40,
          repeatable: false,
          sequence: [
            // 카메라를 crackMark에 살짝 고정(§ 위 좌표) - "짧은 컷신"이라는 느낌만 주는 용도, duration이
            // 짧아도 cameraOverrideTarget 자체는 이 시퀀스가 끝날 때까지(endSequence) 유지된다.
            {
              type: "cameraHold",
              target: { x: crackMarkX + crackMarkW / 2 - W / 2, y: crackMarkY + crackMarkH / 2 - H / 2 },
              duration: 0.4,
            },
            // "[V] 표류를 받아들인다" 텍스트 프롬프트는 사용자 피드백으로 뺌 - 대신 crackMark(반짝이는
            // 조각)가 플레이어에게 빨려들어가듯 흡수되는 시각적 애니메이션으로 표류 해금을 표현한다
            // (cutscene.js의 "driftAbsorb" 이벤트, js/rendering.js의 drawDriftAbsorb 참고). 입력 대기가
            // 아니라 duration이 지나면 자동으로 다음 이벤트(driftUnlocked=true)로 넘어간다.
            {
              type: "driftAbsorb",
              x: crackMarkX + crackMarkW / 2,
              y: crackMarkY + crackMarkH / 2,
              duration: 1.1,
            },
            {
              type: "callback",
              fn: () => {
                driftUnlocked = true;
                // ambientProps() 함수는 다음 loadZone 때에나 다시 평가되므로(zones.js 참고 - "로드
                // 시점" 평가), 이대로 두면 흡수 애니메이션이 끝난 후에도 crackMark가 그 자리에 그대로
                // 남아있는 것처럼 보인다(글씨/반짝이가 플레이어에게 날아갔는데 원본이 안 사라짐) -
                // currentZone.ambientProps는 loadZone이 만든 실제 배열이라 여기서 직접 지워서 "진짜로
                // 흡수되어 사라졌다"를 그 자리에서 바로 반영한다.
                currentZone.ambientProps = currentZone.ambientProps.filter((p) => p.type !== "crackMark");
              },
            },
          ],
        },
      ];
    },
    ruleFlags: { hideGhostNpc: true },
  };
})();
