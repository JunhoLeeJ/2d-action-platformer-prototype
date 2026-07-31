"use strict";

// 2층 구역 1 - 결과 조우("결 조우", 원본 스펙 오타로 보이는 "결과"는 "결" 조우로 해석 - ROADMAP.md 참고).
// 몬스터 3마리에게 둘러싸인 결(gyeol)을 구해주면 대사 4줄(ROADMAP.md에 원문 그대로 보존됨) 후 결이
// AI 동료(ghostNpc)로 전환된다. 1층과 달리 이 존부터는 "안 죽는다" 예외 규칙이 없다 - 죽으면 정상적으로
// 리스폰(hpFloor/hpRegenDelay를 일부러 안 넣음, f2z3_legacy_arena와 동일한 "진짜 죽는" 존).
//
// 결(gyeol)은 아직 실제 ghostNpc가 아니다 - 몬스터에게 둘러싸인 동안은 순수 배경 장식
// ambientProps(type:"gyeolCaptured", js/rendering.js의 drawGyeolCapturedProp)로 표시되고, 몬스터를
// 전부 잡으면(kind:"allEnemiesDead" 트리거, js/engine/cutscene.js) 그 자리에서 진짜 ghostNpc로
// "교체"된다 - ghostNpc 자체는 updateGhostNpc()가 gameState와 무관하게 항상 플레이어를 따라가도록
// 매 프레임 갱신되고 있었으므로(숨겨져 있었을 뿐), 트리거가 fireTrigger() 안에서 seenTriggerIds에
// 즉시 기록되는 순간 아래 ruleFlags.hideGhostNpc(함수 형태, zones.js의 getRuleFlag가 "읽을 때마다"
// 평가)가 자동으로 false로 뒤집혀 그 프레임부터 바로 렌더링된다 - 별도의 위치 이동/토글 코드가 필요
// 없다. ambientProps의 gyeolCaptured 항목만 컷신 시퀀스의 첫 callback에서 직접 지워서(ambientProps는
// 로드 시점에 캐싱되므로 - zones.js/loadZone 참고) "포박된 결"이 사라지는 시점을 그 콜백에 맞춘다.
(function () {
  const groundY = 750, groundH = 40;
  const doorH = 140;
  const standingTopY = groundY - player.h; // entryPoint/checkpoint/문 y 전부 여기서 파생 (CLAUDE.md 관례)

  const ENCOUNTER_ID = "monsters_defeated";
  const rescued = () => hasSeenTrigger("f2z1_gyeol_encounter", ENCOUNTER_ID);

  // 결이 둘러싸여 있는 자리 - 몬스터 3마리가 좌우로 감싼 구도(560/650/800)로 배치해서 딱 하나만
  // 지키는 게 아니라 "포위"라는 느낌을 준다.
  const capturedX = 700, capturedW = 30, capturedH = 48;
  const capturedY = groundY - capturedH;

  ZONES["f2z1_gyeol_encounter"] = {
    id: "f2z1_gyeol_encounter",
    name: "2층 구역 1 - 결 조우",
    floor: 2,

    width: 1400,
    height: 810,
    groundY, groundH,
    groundGaps: [],

    solidPlatforms: [],
    oneWayPlatforms: [],

    wallGates: [],
    floors: [],
    walls: [
      { x: 0, w: 40, gaps: [] },
      { x: 1360, w: 40, gaps: [] },
    ],

    // 진짜 죽는 몬스터(hpFloor 없음) - 1층의 "안 죽는다" 예외 규칙은 이 존부터 적용되지 않는다.
    // patrolHalfRange를 일부러 안 줌(기본값 0) - 플레이어가 다가가기 전까진 그 자리에 가만히 서서
    // "결을 지키고 있다"는 정지 포진처럼 보이게 함(감지되면 즉시 체이서 AI로 추격 시작).
    enemySpawns: [
      { type: "chaser", x: 560, y: groundY - 44, opts: {} },
      { type: "chaser", x: 650, y: groundY - 44, opts: {} },
      { type: "chaser", x: 800, y: groundY - 44, opts: {} },
    ],

    // 몬스터를 다 잡기 전까지만 보이는 "포박된 결" - 다 잡으면 트리거 콜백에서 지운다(§ 파일 상단 주석).
    ambientProps: () => {
      if (rescued()) return [];
      return [{ type: "gyeolCaptured", x: capturedX, y: capturedY, w: capturedW, h: capturedH }];
    },

    entryPoint: { x: 40, y: standingTopY },
    checkpoints: [
      { id: "start", x: 40, y: standingTopY, active: true }, // 2층의 첫 체크포인트
    ],

    // 오른쪽 문은 아직 없음(의도적) - 2층 구역 2(체크포인트)가 아직 없어서 이을 곳이 없다. f1z6에서
    // 이미 한 번 쓴 패턴 그대로: QA 패널로는 바로 확인 가능하고, 2층 구역 2를 만들 때 doors.right만
    // 채우면 됨(CLAUDE.md "구조 관련 확정 사항" 참고 - 엔진 차원 추가 작업 불필요).
    doors: {
      left: { x: 40, y: groundY - doorH, w: 40, h: doorH },
    },

    // allEnemiesDead 트리거 - 3마리를 전부 잡으면 자동 발동(js/engine/cutscene.js의
    // checkAllEnemiesDeadTrigger 참고). 대사 4줄은 ROADMAP.md "2층 구역 1 대사 원문"에 이미 확정되어
    // 있는 문구를 그대로 사용 - 재해석/임의 대사 추가 금지(ROADMAP.md 원칙). 원문의 2번째 줄("짧은
    // 카메라 홀드, 결 표정 클로즈업")은 대사가 아니라 카메라 지시라서 cameraHold 이벤트로, 4번째 줄의
    // "결, 주인공 쪽 잠깐 바라보는 모션"은 도형 애니메이션이 아직 미구현이라(§ 5 아트 제약) 렌더링
    // 효과는 없지만 훅만 걸어둔다(animation 이벤트 - CLAUDE.md에 이미 문서화된 "훅만 있고 실제 렌더링은
    // 아직" 상태).
    triggerZones: [
      {
        id: ENCOUNTER_ID,
        kind: "allEnemiesDead",
        repeatable: false,
        sequence: [
          {
            type: "callback",
            fn: () => {
              // ambientProps는 로드 시점에 캐싱되므로(zones.js) 직접 지워야 이 순간 바로 사라진다.
              // ghostNpc 쪽은 ruleFlags.hideGhostNpc가 함수라 hasSeenTrigger가 true가 되는 순간(바로
              // 이 트리거가 발동한 시점) 자동으로 보이기 시작하지만, 위치는 여전히 예전 그대로(계속
              // 숨겨진 채로 플레이어를 따라오고 있었으므로 대개 이미 근처지만 보장은 아님) - 결이
              // "포박된 자리에서 나타나는 게 아니라 화면 저 끝에서 슬라이딩해온 것처럼" 보이는 걸
              // 막기 위해 플레이어 바로 옆으로 명시적으로 스냅시켜 등장 위치를 확정한다.
              currentZone.ambientProps = currentZone.ambientProps.filter((p) => p.type !== "gyeolCaptured");
              ghostNpc.x = player.x;
              ghostNpc.y = player.y;
            },
          },
          { type: "cameraHold", target: { x: capturedX + capturedW / 2 - W / 2, y: capturedY + capturedH / 2 - H / 2 }, duration: 0.5 },
          { type: "dialogue", speaker: "???", text: "와, 고마워! 이름이 뭐야?" },
          // "짧은 카메라 홀드, 결 표정 클로즈업" - 실제 확대는 없어 같은 지점을 조금 더 오래 고정하는
          // 것으로 대신함(원문 자체가 "지금 단계에선 확대 정도로만 처리 가능"이라고 명시).
          { type: "cameraHold", target: { x: capturedX + capturedW / 2 - W / 2, y: capturedY + capturedH / 2 - H / 2 }, duration: 1.0 },
          { type: "dialogue", speaker: "결", text: "...말 안 해도 상관없어! 나 결이야." },
          { type: "animation", entityRef: ghostNpc, anim: "lookAtPlayer", duration: 0.4 }, // "주인공 쪽 잠깐 바라보는 모션" 훅 (렌더링 미구현)
          { type: "dialogue", speaker: "결", text: "...너도." },
        ],
      },
    ],
    // hideGhostNpc가 함수 형태(zones.js의 getRuleFlag 확장 참고) - 몬스터를 다 잡기 전까진 true(결은
    // 아직 ambientProps 쪽의 포박된 모습으로만 존재), 다 잡은 순간부터 자동으로 false.
    ruleFlags: { hideGhostNpc: () => !rescued() },
  };
})();
