"use strict";

// 1층 구역 5 - 치명상 씬. 막다른 방(오른쪽 문 없음 - 다음 구역으로 못 감) 안쪽에 reachingEntity(손
// 뻗은 형체)+fragmentObject(그 손이 향하는 조각, 정체는 스펙에 없는 플레이스홀더)가 있고, 접근하면
// 조작권을 뺏긴 채 "느린 걸음"으로 끌려가다(zones.js의 makeSlowWalkTick, 이후 다른 컷신에도 재사용
// 예정) 화면이 지지직대다(cutscene.js의 "screenGlitch" 이벤트) 즉사 -> 사망씬(암전, 지금은
// 플레이스홀더) -> 구역 1로 텔레포트 + 페이드인.
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
// 이미 표류가 풀린 뒤에는(driftUnlocked) crack_drift_unlock도 더는 필요 없어 triggerZones가 빈 배열을
// 낸다.
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

    width: 1000,
    height: 810,
    groundY, groundH,
    groundGaps: [],

    solidPlatforms: [],
    oneWayPlatforms: [],

    wallGates: [],
    floors: [],
    walls: [
      { x: 0, w: 40, gaps: [] },
      { x: 960, w: 40, gaps: [] },
    ],

    enemySpawns: [], // 막다른 방 - 전투 없음

    // reachingEntity가 왼쪽(다가오는 플레이어 쪽)으로 팔을 뻗고, fragmentObject는 그 손끝이 닿는
    // 자리에 둬서 "무언가에 손을 뻗고 있다"는 구도를 만든다(drawReachingEntityProp/
    // drawFragmentObjectProp, js/rendering.js 참고). 순수 배경 장식 - enemies[]/전투 판정과 무관.
    // 즉사 트리거를 이미 겪었으면(hasDied) 둘 다 사라지고 crackMark(drawCrackMarkProp)만 남는다 -
    // 함수 형태라 loadZone이 존을 다시 불러올 때마다 그 시점의 상태를 반영한다(§ 위 주석 참고).
    ambientProps: () => {
      if (!hasDied()) {
        return [
          { type: "fragmentObject", x: 795, y: 694, w: 20, h: 20 },
          { type: "reachingEntity", x: 860, y: groundY - 70, w: 34, h: 70 },
        ];
      }
      return [{ type: "crackMark", x: crackMarkX, y: crackMarkY, w: crackMarkW, h: crackMarkH }];
    },

    entryPoint: { x: 40, y: standingTopY },
    checkpoints: [
      { id: "start", x: 40, y: standingTopY, active: false },
    ],

    // 오른쪽 문 없음 - 막다른 방이라 다음 구역으로 넘어가는 정상 경로 자체가 없다. 유일한 "출구"는
    // 아래 트리거가 재생하는 즉사 시퀀스의 텔레포트뿐.
    doors: {
      left: { x: 40, y: groundY - doorH, w: 40, h: doorH },
    },

    // 함수 형태(§ 위 주석) - 아직 안 죽었으면 즉사 트리거만, 죽었지만 표류가 아직 안 풀렸으면
    // crackMark 앞에서 V키로 표류를 해금하는 트리거만, 이미 풀렸으면 아무 트리거도 없다(빈 배열 -
    // 막다른 방에 다시 들어와도 더 이상 아무 일도 안 일어남).
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
            // dialogue 이벤트 대신 custom을 직접 써서 "V를 눌러야만" 다음으로 넘어가게 한다(dialogue는
            // Mouse0/KeyW/Space로도 넘어가 버림 - cutscene.js 참고). 서사 대사가 아니라 조작 안내라
            // "레벨에 대사를 임의로 지어 넣지 말 것"(ROADMAP.md) 규칙과 무관.
            {
              type: "custom",
              onStart: () => showTextbox(null, "[V] 표류를 받아들인다"),
              tick: () => {
                if (!justPressed["KeyV"]) return false;
                hideTextbox();
                return true;
              },
            },
            { type: "callback", fn: () => { driftUnlocked = true; } },
          ],
        },
      ];
    },
    ruleFlags: { hideGhostNpc: true },
  };
})();
