"use strict";

/* =========================================================================
   컷신/대화 엔진 - 모든 존이 공유하는 범용 시스템.
   =========================================================================

   트리거 존(triggerZones)이 "이벤트 시퀀스"(events 배열)를 순서대로 재생한다. 시퀀스가 도는 동안
   gameState는 "cutscene"이 되어 updatePlayer()가 아예 호출되지 않으므로(update() 참고) 플레이어
   조작이 자동으로 차단된다 - 대화 넘김(justPressed) 입력만 이 상태에서 별도로 읽는다.

   이벤트 타입:
     dialogue({speaker, text})       - 텍스트박스 표시, 클릭/키 입력으로 다음으로
     cameraHold({target:{x,y}, duration}) - 카메라를 target으로 감쇠 추적(데드존 없음), x/y 둘 다 선택 사항(생략한
                                       축은 유지). duration 후 자동 진행
     animation({entityRef, anim, duration}) - entity.cutsceneAnim 세팅 (실제 렌더링은 아직 없음 - 훅만)
     fade({color, outDuration, holdDuration, inDuration, onMidpoint}) - 암전/화이트아웃, 완전히 어두운
                                       순간(onMidpoint)에 배경/위치를 바꿔치기할 수 있음
     screenGlitch({duration})        - 화면 전체에 랜덤 지지직(글리치) 노이즈를 0->1로 램프업시키며
                                       duration초 동안 재생 (rendering.js의 drawScreenGlitch가 매 프레임
                                       screenGlitchIntensity를 읽어서 그림 - 저장된 애니메이션 상태 없이
                                       매 프레임 새로 랜덤 생성되는 노이즈라 겹쳐써도 안전함). 1층 구역
                                       5(치명상 씬)에서 처음 쓰이지만 이후 다른 긴장감 있는 컷신에도
                                       재사용할 수 있게 존 전용이 아니라 여기 엔진에 둠.
     callback({fn})                  - 그 프레임에 즉시 실행하고 바로 다음으로
     custom({tick, onStart})         - 매 프레임 tick(dt)를 호출, true를 반환하면 다음 이벤트로 진행.
                                       gameState==="cutscene"이라 updatePlayer가 안 도는 동안 임시로
                                       물리 흉내(낙하 등)를 내야 하는 등, 정해진 지속시간이 아니라
                                       "조건이 될 때까지" 기다려야 하는 연출에 씀(zones.js의 문 착지
                                       연출 참고). onStart는 이벤트 진입 시 한 번만 실행.

   트리거의 sequence는 고정 배열 대신 함수(() => events)로 줄 수도 있다 - 트리거가 실제로 발동하는
   순간(fireTrigger)에 그때그때 다시 평가되므로, 존 로드 시점에는 알 수 없는 "발동 시점의 게임 상태"에
   따라 다른 이벤트 목록을 고를 수 있다(예: 문에 공중에서 진입했는지 여부 - zones.js의 makeDoorTrigger
   참고). 정적 배열을 주면 지금까지와 동일하게 그대로 재생된다.

   모든 시퀀스는 반드시 endSequence() 한 곳으로 수렴한다 - 카메라 오버라이드 해제, 텍스트박스 숨김이
   여기 한 군데에만 있어서 "재생하다 만 채로 걸린" 상태가 구조적으로 불가능하다. 시퀀스 도중에는
   startSequence가 활성 시퀀스를 거부(경고만 출력)하므로 두 시퀀스가 동시에 도는 일도 없다 - 다만
   실질적인 방지는 트리거 스캔 자체가 gameState==="playing"일 때만 도는 것(§ 트리거 스캔)이 1차
   방어선이고, 이 가드는 방어적 백스톱이다.
   ========================================================================= */

let activeSequence = null; // { events, index, onDone, eventTimer, fadeElapsed, fadeTotal, awaitingInput }

// 문(door)의 auto 트리거처럼, 시퀀스가 진행 중인 동안(예: 문 페이드의 onMidpoint에서 loadZone이
// 호출되어 다음 존의 auto 트리거를 만난 경우) 새 시퀀스를 바로 시작할 수 없을 때 잠깐 담아두는 자리.
// endSequence()가 현재 시퀀스를 끝맺는 시점에 여기 있으면 곧바로 이어서 시작한다 - 그 사이에 플레이어가
// 조작을 되찾는 프레임이 단 한 프레임도 끼어들지 않는다.
let pendingAutoTrigger = null;

// "screenGlitch" 이벤트가 재생 중일 때 0~1 - rendering.js의 drawScreenGlitch가 매 프레임 이 값만
// 읽어서 노이즈 세기를 정한다. fadeOverlayEl과 달리 DOM이 아니라 canvas에 매 프레임 새로 그려지므로
// (drawScreenGlitch 자체가 저장 상태 없이 Math.random()을 직접 씀) 이 값 하나만 0<->1로 오가면 된다.
let screenGlitchIntensity = 0;

// 한 번 재생한 walkIn/auto 트리거는(repeatable이 아닌 한) 다시 안 튼다 - "zoneId:triggerId"로 키를 잡아서
// 리스폰으로 같은 존을 다시 불러와도(loadZone은 이 Set을 건드리지 않음) 스토리 비트가 중복 재생되지 않는다.
const seenTriggerIds = new Set();

const fadeOverlayEl = document.getElementById("fadeOverlay");
const cutsceneBoxEl = document.getElementById("cutsceneBox");
const cutsceneSpeakerEl = document.getElementById("cutsceneSpeaker");
const cutsceneLineEl = document.getElementById("cutsceneLine");

function showTextbox(speaker, text) {
  cutsceneSpeakerEl.style.display = speaker ? "block" : "none";
  cutsceneSpeakerEl.textContent = speaker || "";
  cutsceneLineEl.textContent = text;
  cutsceneBoxEl.style.display = "block";
}
function hideTextbox() {
  cutsceneBoxEl.style.display = "none";
}

function startFade(ev) {
  fadeOverlayEl.style.background = ev.color || "#000";
  fadeOverlayEl.style.opacity = "0";
  activeSequence.fadeElapsed = 0;
  activeSequence.fadeTotal = ev.outDuration + ev.holdDuration + ev.inDuration;
  activeSequence.fadeMidpointFired = false;
}
function updateFade(dt, ev) {
  activeSequence.fadeElapsed += dt;
  const t = activeSequence.fadeElapsed;
  const outEnd = ev.outDuration;
  const holdEnd = outEnd + ev.holdDuration;
  let opacity;
  if (t < outEnd) {
    opacity = outEnd > 0 ? t / outEnd : 1;
  } else if (t < holdEnd) {
    opacity = 1;
    if (!activeSequence.fadeMidpointFired) {
      activeSequence.fadeMidpointFired = true;
      if (ev.onMidpoint) ev.onMidpoint();
    }
  } else {
    const inLeft = activeSequence.fadeTotal - t;
    opacity = ev.inDuration > 0 ? clamp(inLeft / ev.inDuration, 0, 1) : 0;
  }
  fadeOverlayEl.style.opacity = String(opacity);
}
function endFade() {
  fadeOverlayEl.style.opacity = "0";
}

// screenGlitch - fade와 같은 "elapsed/total을 activeSequence에 얹어 매 프레임 갱신" 패턴이지만,
// DOM opacity 대신 screenGlitchIntensity(위)를 0->1로 램프업만 시킨다 - 실제로 노이즈를 그리는 건
// rendering.js 몫.
function startGlitch(ev) {
  activeSequence.glitchElapsed = 0;
  activeSequence.glitchTotal = ev.duration;
  screenGlitchIntensity = 0;
}
function updateGlitch(dt, ev) {
  activeSequence.glitchElapsed += dt;
  screenGlitchIntensity = clamp(activeSequence.glitchElapsed / ev.duration, 0, 1);
}
function endGlitch() {
  screenGlitchIntensity = 0;
}

function runEvent(ev) {
  switch (ev.type) {
    case "dialogue":
      showTextbox(ev.speaker, ev.text);
      activeSequence.awaitingInput = true;
      break;
    case "cameraHold":
      // target.x/target.y 둘 다 선택 사항 - 생략한 축은 지금 카메라 위치를 그대로 유지(그 축만 안 움직임)
      cameraOverrideTarget = {
        x: ev.target.x !== undefined ? ev.target.x : camera.x,
        y: ev.target.y !== undefined ? ev.target.y : camera.y,
      };
      activeSequence.eventTimer = ev.duration;
      break;
    case "animation":
      if (ev.entityRef) ev.entityRef.cutsceneAnim = ev.anim;
      activeSequence.eventTimer = ev.duration;
      break;
    case "fade":
      startFade(ev);
      break;
    case "screenGlitch":
      startGlitch(ev);
      break;
    case "callback":
      if (ev.fn) ev.fn();
      advanceSequence();
      break;
    case "custom":
      if (ev.onStart) ev.onStart();
      break; // 진행은 updateSequence의 tick(dt) 결과에 달림 - 여기선 그냥 시작만
    default:
      console.warn("[cutscene] unknown event type", ev.type);
      advanceSequence();
  }
}

function updateSequence(dt) {
  if (!activeSequence) return;
  const ev = activeSequence.events[activeSequence.index];
  if (!ev) return;

  if (ev.type === "dialogue") {
    if (activeSequence.awaitingInput && (justPressed["Mouse0"] || justPressed["KeyW"] || justPressed["Space"])) {
      activeSequence.awaitingInput = false;
      hideTextbox();
      advanceSequence();
    }
    return;
  }

  if (ev.type === "fade") {
    updateFade(dt, ev);
    if (activeSequence.fadeElapsed >= activeSequence.fadeTotal) {
      endFade();
      advanceSequence();
    }
    return;
  }

  if (ev.type === "custom") {
    if (ev.tick(dt)) advanceSequence();
    return;
  }

  if (ev.type === "screenGlitch") {
    updateGlitch(dt, ev);
    if (activeSequence.glitchElapsed >= activeSequence.glitchTotal) {
      endGlitch();
      advanceSequence();
    }
    return;
  }

  // cameraHold / animation - 단순 카운트다운, dt마다 무조건 줄어드니 절대 안 걸림(dangle 불가)
  activeSequence.eventTimer -= dt;
  if (activeSequence.eventTimer <= 0) advanceSequence();
}

function startSequence(events, opts = {}) {
  if (activeSequence) {
    console.warn("[cutscene] sequence already active, ignoring new startSequence call");
    return;
  }
  activeSequence = { events, index: -1, onDone: opts.onDone || null };
  gameState = "cutscene";
  advanceSequence();
}

function advanceSequence() {
  activeSequence.index++;
  if (activeSequence.index >= activeSequence.events.length) {
    endSequence();
    return;
  }
  runEvent(activeSequence.events[activeSequence.index]);
}

// 모든 시퀀스가 반드시 거쳐가는 단 하나의 출구 - 여기서만 오버라이드 카메라/텍스트박스를 정리하므로
// 어떤 이벤트 타입에서 끝나든 뒷정리가 누락될 수 없다.
function endSequence() {
  cameraOverrideTarget = null;
  screenGlitchIntensity = 0; // 방어적 백스톱 - 글리치 도중 워프 등으로 시퀀스가 강제 종료돼도 화면에 남지 않게
  hideTextbox();
  const onDone = activeSequence.onDone;
  const pending = pendingAutoTrigger;
  pendingAutoTrigger = null;
  activeSequence = null;

  if (pending) {
    // 페이드 도중(onMidpoint)에 다음 존의 auto 트리거를 만난 경우 - 플레이어에게 조작권을
    // 돌려주지 않고 그대로 다음 시퀀스로 이어붙인다.
    fireTrigger(pending.trigger, pending.zoneId);
    return;
  }
  gameState = "playing";
  if (onDone) onDone();
}

function fireTrigger(trigger, zoneId) {
  const key = zoneId + ":" + trigger.id;
  if (!trigger.repeatable) seenTriggerIds.add(key);
  // sequence는 고정 배열이거나, 발동 시점에 평가할 함수일 수 있다(§ 위 이벤트 타입 설명 참고).
  const events = typeof trigger.sequence === "function" ? trigger.sequence() : trigger.sequence;
  // 발동 순간 플레이어가 아직 공중(점프 중)이었다면, 실제 이벤트가 시작되기 전에 "자연스러운 착지"
  // 비트를 먼저 끼워 넣는다 - 안 그러면 컷신이 시작되는 순간(gameState==="cutscene", updatePlayer 정지)
  // y좌표가 공중에 뜬 채 그대로 얼어붙어 보이거나, 개별 트리거가 각자 y를 순간이동시켜 임기응변해야
  // 한다(1층 구역 5가 처음엔 이렇게 했었음 - 사용자 피드백으로 모든 트리거에 범용 적용됨). 문 전환도
  // 예전엔 이 처리를 자기 것만 따로 갖고 있었지만(makeFallInPlaceTick) 이제 여기 한 곳으로 합쳐짐 -
  // makeFallUntilGroundedTick(js/engine/zones.js)이 미리 정해진 landingY 없이도
  // resolveSolidVerticalCollisions/resolveOneWayVerticalCollisions(player.js)의 "위에서 떨어져 착지"
  // 판정에 기대어 범용으로 동작한다.
  const finalEvents = player.onGround
    ? events
    : [{ type: "custom", tick: makeFallUntilGroundedTick() }, ...events];
  startSequence(finalEvents);
}

// loadZone()이 새 존을 세팅한 직후 호출 - 그 존에 아직 재생 안 한 kind:"auto" 트리거가 있으면 튼다.
// 이미 다른 시퀀스가 진행 중(예: 문 페이드 자체)이면 즉시 시작할 수 없으므로 대기시켰다가
// endSequence에서 이어서 재생한다 (§ pendingAutoTrigger).
function checkAutoTrigger(zoneId) {
  const auto = currentZone.triggerZones.find((t) => t.kind === "auto");
  if (!auto) return;
  const key = zoneId + ":" + auto.id;
  if (!auto.repeatable && seenTriggerIds.has(key)) return;

  if (activeSequence) {
    pendingAutoTrigger = { trigger: auto, zoneId };
  } else {
    fireTrigger(auto, zoneId);
  }
}

// repeatable 트리거가 "그 자리에 가만히 서있는 동안 매 프레임 다시 발동"하지 않도록 - 한 번 겹친
// 트리거는 플레이어가 완전히 벗어났다가 다시 들어와야만 재발동한다("OnTriggerEnter"류의 표준 동작).
// zoneId+triggerId로 키를 잡아서(seenTriggerIds와 동일한 패턴) 존이 달라지면 자연히 별개로 취급됨.
// gameState가 "cutscene"인 동안엔 scanTriggerZones 자체가 안 불리므로(update() 참고), 시퀀스가
// 도는 내내 이 Set은 그대로 유지된다 - 시퀀스가 끝나고 "playing"으로 돌아온 첫 프레임에 플레이어가
// 아직 같은 자리에 서있어도 "계속 안에 있었다"로 잡혀 재발동하지 않고, 실제로 밖으로 나갔다 들어와야
// 다시 발동한다.
const triggerContactState = new Set();

// "playing" 상태에서 매 프레임 호출 - 걸어 들어가면 발동하는(walkIn) 트리거를 확인한다.
// X 범위만 검사하고 세로는 아예 안 봐서(§ 존 트리거 도어 등) 어떤 점프로도 피할 수 없다.
// yMin/yMax는 선택 사항 - 둘 다 생략하면 기존과 동일하게 X 범위만으로 판정(세로 위치 무관, 점프로
// 못 피함이 그대로 유지). 세로로 여러 층이 있는 존에서 "이 트리거는 이 층에서만 의미가 있다"를
// 표현할 때만 채운다. 위/아래를 비대칭으로 잡는 게 자연스럽다: yMin(위쪽 한계)은 넉넉하게(더 위에서도
// 발동하도록 값을 작게) 잡고, yMax(아래쪽 한계)는 빡빡하게(그 층 바로 근처까지만) 잡아야, 트리거가
// 놓인 층보다 훨씬 아래(다른 층)에서 걷다가 X만 맞아서 잘못 발동하는 일을 막으면서도, 위에서 살짝
// 높이 떠서 접근하는 정도는 자연스럽게 허용된다.
function scanTriggerZones() {
  for (const trigger of currentZone.triggerZones) {
    if (trigger.kind !== "walkIn") continue;
    const key = currentZone.id + ":" + trigger.id;
    if (!trigger.repeatable && seenTriggerIds.has(key)) continue;
    const overlapsX = player.x + player.w > trigger.xMin && player.x < trigger.xMax;
    const overlapsY =
      (trigger.yMin === undefined || player.y + player.h > trigger.yMin) &&
      (trigger.yMax === undefined || player.y < trigger.yMax);
    const isInside = overlapsX && overlapsY;
    const wasInside = triggerContactState.has(key);
    if (!isInside) {
      if (wasInside) triggerContactState.delete(key);
      continue;
    }
    if (!wasInside) {
      triggerContactState.add(key);
      fireTrigger(trigger, currentZone.id);
      return;
    }
  }
}
