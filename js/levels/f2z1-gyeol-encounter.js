"use strict";

// 2층 구역 1 - 결과 조우("결 조우", 원본 스펙 오타로 보이는 "결과"는 "결" 조우로 해석 - ROADMAP.md 참고).
// 원래 스펙은 "몬스터 3마리에게 둘러싸인 결을 플레이어가 구해준다"였지만, 사용자 결정으로 그 전투를
// 플레이어가 직접 하는 대신 컷신으로 처리하기로 바뀌었다 - 그래서 이 존엔 실제 몬스터(enemies[])가
// 없고, 존에 들어가자마자(kind:"auto") 짧은 플레이스홀더 컷신 하나만 재생된 뒤 곧바로 구출/대사
// 시퀀스로 이어진다. 실제 "몬스터를 처치하는" 연출은 아직 미정이라 지금은 카메라 홀드 하나뿐인 빈
// 자리표시자 - LATER.md에 메모해둠, 나중에 진짜 컷신으로 교체할 것.
//
// 결(gyeol)은 이 존에 들어온 순간부터 실제 ghostNpc가 아니다 - 몬스터에게 둘러싸여 있던(지금은 컷신
// 이전 한 프레임 정도만 스쳐가는) 동안은 순수 배경 장식 ambientProps(type:"gyeolCaptured",
// js/rendering.js의 drawGyeolCapturedProp)로 표시되고, 트리거 콜백에서 그 자리에서 진짜 ghostNpc로
// "교체"된다 - ghostNpc 자체는 updateGhostNpc()가 gameState와 무관하게 항상 플레이어를 따라가도록
// 매 프레임 갱신되고 있었으므로(숨겨져 있었을 뿐), 트리거가 fireTrigger() 안에서 seenTriggerIds에
// 즉시 기록되는 순간 아래 ruleFlags.hideGhostNpc(함수 형태, zones.js의 getRuleFlag가 "읽을 때마다"
// 평가)가 자동으로 false로 뒤집혀 그 프레임부터 바로 렌더링된다 - 별도의 위치 이동/토글 코드가 필요
// 없다.
//
// 결은 앞으로도 전투에 절대 관여하지 않는다(사용자 최종 확정, ROADMAP.md § 4/§ 8 참고) - ghostNpc의
// 기존 불변 조건("어떤 충돌/전투 판정에도 관여하지 않음")이 그대로 유지된다는 뜻.
(function () {
  const groundY = 750, groundH = 40;
  const doorH = 140;
  const standingTopY = groundY - player.h; // entryPoint/checkpoint/문 y 전부 여기서 파생 (CLAUDE.md 관례)

  const ENCOUNTER_ID = "monsters_defeated";
  const rescued = () => hasSeenTrigger("f2z1_gyeol_encounter", ENCOUNTER_ID);

  // 결이 (컷신 이전 잠깐) 있는 자리.
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

    // 몬스터 전투가 컷신으로 대체되어 실제 enemies[]는 없음(§ 파일 상단 주석).
    enemySpawns: [],

    // 컷신이 시작되는 즉시(auto라 존 진입 직후) 트리거 콜백에서 지워지는 "포박된 결" - 존에 들어온
    // 순간 아주 잠깐만 보이고 사라진다.
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

    // auto 트리거 - 존 진입 즉시 발동. 대사 4줄(+ 아래 삽입된 대사 없는 "..." 한 줄)은 ROADMAP.md
    // "2층 구역 1 대사 원문"에 확정되어 있는 문구를 그대로 사용 - 재해석/임의 대사 추가 금지(ROADMAP.md
    // 원칙). 원문의 2번째 줄("짧은 카메라 홀드, 결 표정 클로즈업")은 대사가 아니라 카메라 지시라서
    // cameraHold 이벤트로, 마지막 줄의 "결, 주인공 쪽 잠깐 바라보는 모션"은 도형 애니메이션이 아직
    // 미구현이라(§ 5 아트 제약) 렌더링 효과는 없지만 훅만 걸어둔다(animation 이벤트 - CLAUDE.md에 이미
    // 문서화된 "훅만 있고 실제 렌더링은 아직" 상태).
    triggerZones: [
      {
        id: ENCOUNTER_ID,
        kind: "auto",
        repeatable: false,
        sequence: [
          {
            type: "callback",
            fn: () => {
              // ambientProps는 로드 시점에 캐싱되므로(zones.js) 직접 지워야 이 순간 바로 사라진다.
              // ghostNpc 쪽은 ruleFlags.hideGhostNpc가 함수라 hasSeenTrigger가 true가 되는 순간(바로
              // 이 트리거가 발동한 시점) 자동으로 보이기 시작하지만, 위치는 여전히 예전 그대로라
              // 플레이어 바로 옆으로 명시적으로 스냅시켜 등장 위치를 확정한다.
              currentZone.ambientProps = currentZone.ambientProps.filter((p) => p.type !== "gyeolCaptured");
              ghostNpc.x = player.x;
              ghostNpc.y = player.y;
            },
          },
          // 플레이스홀더 - "몬스터들을 처치하는" 컷신 자리. 사용자 결정: 이 첫 만남의 몬스터 전투는
          // 플레이어가 직접 싸우는 대신 컷신으로 처리할 예정이지만 구체적인 연출은 아직 미정 - 지금은
          // 카메라 홀드 하나뿐인 빈 자리표시자(LATER.md에 메모해둠, 나중에 진짜 컷신으로 교체할 것).
          { type: "cameraHold", target: { x: capturedX + capturedW / 2 - W / 2, y: capturedY + capturedH / 2 - H / 2 }, duration: 0.8 },
          { type: "cameraHold", target: { x: capturedX + capturedW / 2 - W / 2, y: capturedY + capturedH / 2 - H / 2 }, duration: 0.5 },
          { type: "dialogue", speaker: "???", text: "와, 고마워! 이름이 뭐야?" },
          // 화자 없는 "..." - 침묵하는 주인공의 반응(사용자 요청으로 추가, ROADMAP.md 원문에도 반영됨).
          // "이름이 뭐야?"라는 물음에 대답 없이 침묵하는 것이므로 그 직후, 결의 반응(클로즈업)보다 앞에 옴.
          { type: "dialogue", speaker: null, text: "..." },
          // "짧은 카메라 홀드, 결 표정 클로즈업" - 실제 확대는 없어 같은 지점을 조금 더 오래 고정하는
          // 것으로 대신함(원문 자체가 "지금 단계에선 확대 정도로만 처리 가능"이라고 명시).
          { type: "cameraHold", target: { x: capturedX + capturedW / 2 - W / 2, y: capturedY + capturedH / 2 - H / 2 }, duration: 1.0 },
          { type: "dialogue", speaker: "결", text: "...말 안 해도 상관없어! 나 결이야." },
          { type: "animation", entityRef: ghostNpc, anim: "lookAtPlayer", duration: 0.4 }, // "주인공 쪽 잠깐 바라보는 모션" 훅 (렌더링 미구현)
          { type: "dialogue", speaker: "결", text: "...너도." },
        ],
      },
    ],
    // hideGhostNpc가 함수 형태(zones.js의 getRuleFlag 확장 참고) - 컷신이 시작되기 전까진 true(결은
    // 아직 ambientProps 쪽의 포박된 모습으로만 존재), 시작되는 순간부터 자동으로 false.
    ruleFlags: { hideGhostNpc: () => !rescued() },
  };
})();
