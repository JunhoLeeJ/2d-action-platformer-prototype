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

// 워프는 문/체크포인트를 거치지 않는 임의 이동이라, 실제 존 전환(위치+체크포인트+생존 상태 리셋)
// 자체는 zones.js의 enterZone()에 위임하고 - 문 전환도 이제 같은 함수를 쓴다(사용자 요청: "문 넘는
// 거랑 구역 선택이랑 정확히 똑같은 코드로 처리됐으면 좋겠다") - 이 함수는 그 위에 "임의의 시점에
// 끼어드는 워프"이기 때문에 추가로 필요한 것만 처리한다: 진행 중이던 컷신/타임스톱 강제 정리.
// 문 전환은 이미 "페이드 시퀀스 안"이라는 안전한 시점에서만 enterZone을 부르므로 이 정리가 필요
// 없지만, 워프는 컷신 도중이든 아무 때든 호출될 수 있어 이 강제 정리가 반드시 있어야 한다.
function warpToZone(zoneId) {
  if (!ZONES[zoneId]) return;

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
  enterZone(zoneId);

  // 사용자가 "게임을 맨 처음 켰을 때만" 가끔 낙사한다고 제보한 것에 대한 방어적 조치 - 원인을 코드
  // 레벨에서 특정하지 못했음(자동화 테스트로 광범위하게 재현 시도했으나 실패) - 대신 사용자가 직접
  // 제안한 완화책(스폰을 아주 살짝 위에서 시작)을 정확히 이 "최초 부트스트랩" 한 순간에만 적용한다.
  // !gameStarted 시점에만 걸리므로(ensureLoopStarted가 곧 true로 뒤집음) 문 전환/이후의 모든 워프/
  // 리스폰에는 전혀 영향이 없다 - entryPoint 자체를 건드리면(모든 진입에 다 적용되어) "존에 막 들어가면
  // 잠깐 공중에 떠 보인다"는 예전에 고쳤던 버그가 되살아나므로 반드시 이 한 경로로만 좁혀야 한다.
  if (!gameStarted) player.y -= 2;

  // 아직 메인 메뉴 단계라 루프가 한 번도 안 돈 상태였다면(js/main.js) 여기서 처음 시작시킨다 -
  // 이미 돌고 있으면 아무 일도 안 함(중복 시작 방지 - ensureLoopStarted 자체가 멱등).
  ensureLoopStarted();
}

// 마우스 클릭과 키보드(W/S로 이동, Space/Enter로 확정) 둘 다 결국 이 함수 하나로 수렴한다 - 실제
// 워프는 사용자 요청으로 확인 대화상자(js/engine/confirmdialog.js)의 "예"를 거쳐야만 일어난다 -
// 그 전까지 QA 패널은 안 닫힌 채 그대로 있고("아니오"/Esc로 취소하면 패널 화면 그대로 남아있는 것처럼
// 보임), "예"를 고르면 그제서야 원래의 워프+뒤처리가 실행된다.
function pickZone(id) {
  const def = ZONES[id];
  const label = (def && def.name) || id;
  openConfirmDialog(`${label}(으)로 이동하시겠습니까?`, () => {
    warpToZone(id);
    closeQaPanel();
    // 이 패널을 열었던 배경 화면이 뭐였든(메인 메뉴 또는 일시정지 메뉴) 실제로 구역을 골랐으면 그
    // 화면도 같이 치운다 - 안 그러면 워프는 성공했는데 화면은 계속 그 배경 화면에 멈춰 보인다(둘 중
    // 관련 없는 쪽 호출은 이미 닫혀있어 아무 효과 없이 멱등하게 넘어감). "패널만 닫고 아무 것도 안
    // 고르면 배경 화면으로 돌아온 것처럼 보인다"는 트릭(mainmenu.js/pausemenu.js 참고)은 어디까지나
    // "안 골랐을 때"의 얘기고, 실제로 골랐으면 워프가 이겨야 한다.
    hideMainMenu();
    closePauseMenu();
  });
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
