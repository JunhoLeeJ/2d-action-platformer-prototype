"use strict";

/* =========================================================================
   QA 패널(구역 이동) - 존 그래프의 아무 존으로나 즉시 이동.
   =========================================================================

   두 가지 용도를 겸한다: (1) 지금 당장은 QA/레벨 디자인 확인용("이 구역만 바로 열어서 보고 싶다"),
   (2) 사용자 요청대로, 나중에 게임을 전부 클리어한 플레이어에게도 그대로 줄 "구역 선택" 기능 -
   그래서 디버그용 임시 코드가 아니라 제대로 된 UI/정리 로직을 갖춘 상시 기능으로 만든다.

   토글: Backquote(`) 키. heldKeys/justPressed(js/engine/input.js) 파이프라인을 안 타고 완전히
   독립된 keydown 리스너로 처리한다 - 그래야 타임스톱(히트스톱)이나 먹통난 컷신 도중에도(원래는
   input이 그 상태와 맞물려 있음) 패널만은 항상 열 수 있어서, 워프가 "막혔을 때 빠져나오는 비상구"
   역할도 겸할 수 있다.

   열려있는 동안은 loop()(js/main.js)가 update() 자체를 건너뛰어 게임 전체가 멈춘다(타임스톱과 같은
   방식) - 패널을 보는 동안 몬스터가 움직이거나 피격 유예/쿨다운이 흘러가면 안 되기 때문. 다만
   update()가 안 도는 동안에도 justPressed는 계속 채워질 수 있으므로, update() 끝에서 하던 것과
   동일하게 매 프레임 직접 비워준다 - 안 그러면 패널이 열려있던 동안 눌린 키(Space 등)가 패널을 닫는
   순간 "이번 프레임에 막 눌린 것"으로 오인되어 점프 등이 의도치 않게 튀어나온다.
   ========================================================================= */

let qaPanelOpen = false;

const qaPanelEl = document.getElementById("qaPanel");
const qaPanelListEl = document.getElementById("qaPanelList");

// 워프는 문/체크포인트를 거치지 않는 임의 이동이라, loadZone()이 옮겨주지 않는 것들을 전부 여기서
// 직접 정리해야 한다: 진행 중이던 컷신(텍스트박스/카메라 홀드/페이드)과 타임스톱, 그리고 "그 지점에서
// 새로 시작"이라는 워프의 의미에 맞는 생존 상태(HP/쿨다운) 리셋 - respawnPlayer(js/entities/player.js)와
// 거의 같은 리셋 블록을 쓰되, 죽어서 오는 게 아니라 언제든(컷신 도중 포함) 호출될 수 있어 컷신 강제
// 종료 처리가 추가로 필요하다.
function warpToZone(zoneId) {
  const def = ZONES[zoneId];
  if (!def) return;

  // 진행 중이던 시퀀스를 강제 중단 - endSequence()가 정상 종료 시 하는 정리(카메라 오버라이드 해제,
  // 텍스트박스 숨김, 대기 중이던 auto 트리거 폐기)를 그대로 반복한다. endSequence() 자체를 호출하지
  // 않는 이유: 그 함수는 "시퀀스가 끝까지 재생됐다"는 전제로 activeSequence.onDone을 실행하는데,
  // 워프는 그 전제 없이 도중에 끊는 것이라 onDone을 실행하면 안 되기 때문(예: onDone이 또 다른
  // loadZone을 부르는 문의 페이드 콜백이면 이 워프와 충돌한다).
  activeSequence = null;
  pendingAutoTrigger = null;
  cameraOverrideTarget = null;
  hideTextbox();
  endFade();

  // 타임스톱(히트스톱) 중에 워프해도 화면이 얼어붙은 채로 남지 않게.
  timeStopTimer = 0;
  timeStopReason = null;
  timeStopOnComplete = null;

  gameState = "playing";
  loadZone(zoneId, def.entryPoint);

  // 워프한 존을 새 리스폰 지점으로 삼는다 - 안 그러면 워프 직후 죽었을 때 엉뚱한(이전) 존의
  // 체크포인트로 되돌아가버려서 워프 자체가 무의미해진다.
  const firstCheckpoint = def.checkpoints[0];
  activateCheckpoint(zoneId, def.entryPoint.x, def.entryPoint.y, firstCheckpoint && firstCheckpoint.id);

  // respawnPlayer와 동일하게 "생존 상태"를 전부 초기값으로 되돌린다 - 워프는 그 지점에서 새로
  // 시작하는 개념이라, 이전 존에서 깎여있던 체력/쿨다운을 그대로 들고 오면 워프 직후 불합리하게
  // 죽거나 표류를 못 쓰는 등 이 기능의 목적(자유로운 탐색)에 어긋난다.
  player.vx = 0;
  player.vy = 0;
  player.hp = CONFIG.PLAYER_MAX_HP;
  player.timeSinceHit = Infinity;
  player.jumpsUsed = 0;
  player.airAttacksUsed = 0;
  player.invincibleTimer = 0;
  player.attackState = "idle";
  player.postAttackLockTimer = 0;
  player.state = "anchor";
  player.driftTimer = 0;
  player.driftCooldownTimer = 0;
  player.driftCooldownDuration = getDriftCooldownOnWhiff();
  player.pendingDamage.length = 0;
  player.driftTrail.length = 0;
  player.driftBurst = null;
}

// 존 목록을 층별로 묶어서 다시 그린다 - 열 때마다 새로 그려서 "지금 여기 있음" 강조가 항상 최신
// 상태를 반영하게 함(패널이 열려있는 동안엔 워프가 곧 패널을 닫으므로 다시 그릴 필요가 없음).
function renderQaPanelList() {
  const sortedIds = Object.keys(ZONES).sort((a, b) => {
    const za = ZONES[a], zb = ZONES[b];
    if (za.floor !== zb.floor) return za.floor - zb.floor;
    return a.localeCompare(b); // 같은 층 안에서는 zone id 알파벳 순 - 등록(스크립트 로드) 순서에 기대지 않기 위함
  });

  qaPanelListEl.innerHTML = "";
  let lastFloor = null;
  for (const id of sortedIds) {
    const def = ZONES[id];
    if (def.floor !== lastFloor) {
      lastFloor = def.floor;
      const heading = document.createElement("div");
      heading.className = "qaPanelFloorHeading";
      heading.textContent = `${def.floor}층`;
      qaPanelListEl.appendChild(heading);
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "qaPanelZoneBtn";
    if (currentZone && currentZone.id === id) btn.classList.add("qaPanelZoneBtnCurrent");
    btn.textContent = (def.name || def.id) + (currentZone && currentZone.id === id ? " (현재 위치)" : "");
    btn.addEventListener("click", () => {
      warpToZone(id);
      closeQaPanel();
    });
    qaPanelListEl.appendChild(btn);
  }
}

function openQaPanel() {
  renderQaPanelList();
  qaPanelOpen = true;
  qaPanelEl.style.display = "block";
}
function closeQaPanel() {
  qaPanelOpen = false;
  qaPanelEl.style.display = "none";
}
function toggleQaPanel() {
  if (qaPanelOpen) closeQaPanel();
  else openQaPanel();
}

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.code === "Backquote") {
    e.preventDefault();
    toggleQaPanel();
  } else if (e.code === "Escape" && qaPanelOpen) {
    closeQaPanel();
  }
});
