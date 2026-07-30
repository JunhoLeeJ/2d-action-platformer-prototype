"use strict";

/* =========================================================================
   컷신/대화 엔진 - 모든 존이 공유하는 범용 시스템.
   =========================================================================

   트리거 존(triggerZones)이 "이벤트 시퀀스"(events 배열)를 순서대로 재생한다. 시퀀스가 도는 동안
   gameState는 "cutscene"이 되어 updatePlayer()가 아예 호출되지 않으므로(update() 참고) 플레이어
   조작이 자동으로 차단된다 - 대화 넘김(justPressed) 입력만 이 상태에서 별도로 읽는다.

   이벤트 타입:
     dialogue({speaker, text})       - 텍스트박스 표시, 클릭/키 입력으로 다음으로
     cameraHold({target:{x}, duration}) - 카메라를 target으로 감쇠 추적(데드존 없음), duration 후 자동 진행
     animation({entityRef, anim, duration}) - entity.cutsceneAnim 세팅 (실제 렌더링은 아직 없음 - 훅만)
     fade({color, outDuration, holdDuration, inDuration, onMidpoint}) - 암전/화이트아웃, 완전히 어두운
                                       순간(onMidpoint)에 배경/위치를 바꿔치기할 수 있음
     callback({fn})                  - 그 프레임에 즉시 실행하고 바로 다음으로

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

function runEvent(ev) {
  switch (ev.type) {
    case "dialogue":
      showTextbox(ev.speaker, ev.text);
      activeSequence.awaitingInput = true;
      break;
    case "cameraHold":
      cameraOverrideTarget = { x: ev.target.x };
      activeSequence.eventTimer = ev.duration;
      break;
    case "animation":
      if (ev.entityRef) ev.entityRef.cutsceneAnim = ev.anim;
      activeSequence.eventTimer = ev.duration;
      break;
    case "fade":
      startFade(ev);
      break;
    case "callback":
      if (ev.fn) ev.fn();
      advanceSequence();
      break;
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
  startSequence(trigger.sequence);
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

// "playing" 상태에서 매 프레임 호출 - 걸어 들어가면 발동하는(walkIn) 트리거를 확인한다.
// X 범위만 검사하고 세로는 아예 안 봐서(§ 존 트리거 도어 등) 어떤 점프로도 피할 수 없다.
function scanTriggerZones() {
  for (const trigger of currentZone.triggerZones) {
    if (trigger.kind !== "walkIn") continue;
    const key = currentZone.id + ":" + trigger.id;
    if (!trigger.repeatable && seenTriggerIds.has(key)) continue;
    const overlaps = player.x + player.w > trigger.xMin && player.x < trigger.xMax;
    if (overlaps) {
      fireTrigger(trigger, currentZone.id);
      return;
    }
  }
}
