"use strict";

/* =========================================================================
   QA 패널(구역 이동) - 존 그래프의 아무 존으로나 즉시 이동.
   =========================================================================

   세 가지 용도를 겸한다: (1) 지금 당장은 QA/레벨 디자인 확인용("이 구역만 바로 열어서 보고 싶다"),
   (2) 사용자 요청대로, 나중에 게임을 전부 클리어한 플레이어에게도 그대로 줄 "구역 선택" 기능,
   (3) 메인 메뉴(js/engine/mainmenu.js)의 "구역 선택" 버튼이 여는 화면도 바로 이 패널이다 - 별도
   화면을 새로 만들지 않고 그대로 재사용함. 그래서 디버그용 임시 코드가 아니라 제대로 된 UI/정리
   로직을 갖춘 상시 기능으로 만든다. warpToZone()은 아직 게임 루프가 시작 전(메인 메뉴 단계)이어도
   안전하게 호출 가능하도록 설계되어 있다 - 그래서 "게임 시작" 버튼조차 별도 부트스트랩 코드 없이
   그냥 `warpToZone(BOOT_ZONE_ID)` 한 줄로 구현된다(mainmenu.js 참고).

   열기/닫기/키보드 탐색(W/S/Space)의 실제 키 라우팅은 이 파일이 아니라 js/engine/pausemenu.js가
   전담한다 - 백틱/Esc 하나로 "지금 열려있는 UI 레이어(QA 패널/일시정지 메뉴/메인 메뉴)가 뭔지"에
   따라 다르게 반응해야 해서, 그 판단을 한 곳에 모아두는 게 각 파일이 서로 다른 keydown 리스너로
   따로 반응하다가 충돌하는 것보다 안전하다(pausemenu.js 상단 주석 참고). 이 파일은 open/close/탐색용
   함수만 내보내고, 실제로 언제 그 함수를 부를지는 pausemenu.js가 결정한다.

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
  // respawnPlayer처럼 짧은 무적시간을 줘서(0으로 두지 않음) - 워프해서 도착한 자리가 하필 적 근접
  // 사거리 안(예: 몬스터가 스폰 지점 바로 옆에 있는 존)이어도 화면을 파악할 틈도 없이 바로 얻어맞는
  // 일이 없게 한다. 0으로 두면 몬스터가 붐비는 존으로 워프하는 순간 아무런 유예 없이 즉시 피격될
  // 수 있어서(실제로 겪은 문제) respawnPlayer와 동일한 값으로 맞춤.
  player.invincibleTimer = CONFIG.HIT_INVINCIBILITY_DURATION * 0.5;
  player.attackState = "idle";
  player.postAttackLockTimer = 0;
  player.state = "anchor";
  player.driftTimer = 0;
  player.driftCooldownTimer = 0;
  player.driftCooldownDuration = getDriftCooldownOnWhiff();
  player.pendingDamage.length = 0;
  player.driftTrail.length = 0;
  player.driftBurst = null;

  // 아직 메인 메뉴 단계라 루프가 한 번도 안 돈 상태였다면(js/main.js) 여기서 처음 시작시킨다 -
  // 이미 돌고 있으면 아무 일도 안 함(중복 시작 방지 - ensureLoopStarted 자체가 멱등).
  ensureLoopStarted();
}

// 마우스 클릭과 키보드(W/S로 이동, Space로 확정) 둘 다 결국 이 함수 하나로 수렴한다 - 워프 자체(그리고
// 그 뒤처리)는 입력 수단과 무관하게 항상 동일해야 하므로.
function pickZone(id) {
  warpToZone(id);
  closeQaPanel();
  hideMainMenu(); // 메인 메뉴(mainmenu.js) 단계에서 이 패널로 바로 구역을 고른 경우 메뉴도 같이 치움 -
  // 게임 중 백틱으로 연 경우엔 메뉴가 이미 숨겨져 있어 아무 효과 없음(멱등).
}

// 키보드 탐색(W/S)이 지금 가리키고 있는 항목의 인덱스 - qaPanelZoneIds와 같은 순서로 매칭된다.
// 렌더링된 <button class="qaPanelZoneBtn">들이 헤딩(층 구분선)과 같은 리스트 안에 섞여 있지만,
// qaPanelZoneIds는 헤딩을 빼고 존만 순서대로 담아두므로 인덱스가 항상 버튼 순서와 일치한다.
let qaPanelZoneIds = [];
let qaPanelSelectedIndex = 0;

// 존 목록을 층별로 묶어서 다시 그린다 - 열 때마다 새로 그려서 "지금 여기 있음" 강조가 항상 최신
// 상태를 반영하게 함(패널이 열려있는 동안엔 워프가 곧 패널을 닫으므로 다시 그릴 필요가 없음).
function renderQaPanelList() {
  qaPanelZoneIds = Object.keys(ZONES).sort((a, b) => {
    const za = ZONES[a], zb = ZONES[b];
    if (za.floor !== zb.floor) return za.floor - zb.floor;
    return a.localeCompare(b); // 같은 층 안에서는 zone id 알파벳 순 - 등록(스크립트 로드) 순서에 기대지 않기 위함
  });

  qaPanelListEl.innerHTML = "";
  let lastFloor = null;
  for (const id of qaPanelZoneIds) {
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
    btn.addEventListener("click", () => pickZone(id));
    qaPanelListEl.appendChild(btn);
  }
}

// i를 0~qaPanelZoneIds.length-1 범위로 순환시킴(맨 끝에서 더 내리면 맨 위로, 맨 위에서 올리면 맨 끝으로)
function wrapQaPanelIndex(i) {
  const len = qaPanelZoneIds.length;
  return ((i % len) + len) % len;
}

// 키보드 포커스 표시를 다시 그림 - 인덱스가 바뀔 때마다(열 때 최초 1회 + W/S로 이동할 때마다) 호출.
function applyQaPanelSelectionHighlight() {
  const buttons = qaPanelListEl.querySelectorAll(".qaPanelZoneBtn");
  buttons.forEach((btn, i) => btn.classList.toggle("qaPanelZoneBtnFocused", i === qaPanelSelectedIndex));
}

function moveQaPanelSelection(delta) {
  qaPanelSelectedIndex = wrapQaPanelIndex(qaPanelSelectedIndex + delta);
  applyQaPanelSelectionHighlight();
}

function confirmQaPanelSelection() {
  const id = qaPanelZoneIds[qaPanelSelectedIndex];
  if (id != null) pickZone(id);
}

function openQaPanel() {
  renderQaPanelList();
  // 키보드 탐색 시작 위치는 "지금 있는 존"에 맞춰준다 - 없으면(메인 메뉴 단계 등) 맨 위(0)부터.
  const currentIndex = qaPanelZoneIds.indexOf(currentZone ? currentZone.id : null);
  qaPanelSelectedIndex = currentIndex >= 0 ? currentIndex : 0;
  applyQaPanelSelectionHighlight();
  qaPanelOpen = true;
  qaPanelEl.style.display = "block";
}
function closeQaPanel() {
  qaPanelOpen = false;
  qaPanelEl.style.display = "none";
}
