"use strict";

/* =========================================================================
   일시정지 메뉴 - 실제 플레이 중 백틱(`)을 누르면 뜨는 화면(재개/메인 화면/구역 선택).
   =========================================================================

   이 파일이 백틱/Esc/W/S/Space/Enter에 대한 keydown 라우팅을 전부 도맡는다(아래 리스너 하나). 이유:
   지금 화면에 QA 패널/일시정지 메뉴/메인 메뉴 중 뭐가 떠 있는지에 따라 같은 키가 완전히 다른
   동작을 해야 한다 -
     - QA 패널이 열려있으면        : 백틱/Esc는 그 패널만 닫는다. W/S는 존 목록 이동, Space/Enter는 확정
       (moveQaPanelSelection/confirmQaPanelSelection, js/engine/qapanel.js).
     - (패널은 닫혀있고) 일시정지 메뉴가 열려있으면 : 백틱/Esc는 "재개"와 동일 - 메뉴를 닫는다. W/S는
       버튼 이동, Space/Enter는 확정(pauseMenuNav, js/engine/menunav.js) - QA 패널과 같은 "W/S+Space"
       패턴을 다른 메뉴에도 적용해달라는 사용자 요청으로 추가됨.
     - 아무 것도 안 열려있고 메인 메뉴가 보이는 중이면 : 마찬가지로 W/S 이동+Space/Enter 확정
       (mainMenuNav, js/engine/mainmenu.js). 백틱은 QA 패널을 곧장 연다(옛 동작 유지 - 메인 메뉴
       단계에선 "일시정지"할 게 없으므로 그냥 구역 선택 화면으로 바로 감).
     - 아무 것도 안 열려있고 실제로 플레이 중이면      : 백틱은 일시정지 메뉴를 연다(W/S/Space/Enter는
       평소처럼 게임플레이 입력 - 이 상태에선 아래로 안 내려오므로 메뉴 탐색과 안 겹침).
   이 판단을 qapanel.js/mainmenu.js 각자가 독립된 keydown 리스너로 나눠 가지고 있으면, 같은 키 입력에
   여러 리스너가 동시에 반응해 서로 다른 화면을 동시에 열어버리는 충돌이 생긴다 - 그래서 "지금 뭐가
   열려있는지"를 다 아는 곳(가장 나중에 추가된, 가장 위 레이어인 여기) 한 곳에서만 반응하고, 나머지
   파일들은 open/close 함수(+각자의 메뉴 nav 객체)만 내보낸다.

   일시정지 메뉴는 QA 패널과 똑같은 관계로 메인 메뉴와 엮여있다 - "구역 선택" 버튼을 누르면 QA
   패널이 이 메뉴 위에 그대로 겹쳐 뜨고, 이 메뉴 자신은 숨겨지지 않는다. 그래서 패널만 닫고 아무
   것도 안 고르면 다시 일시정지 메뉴로 돌아온 것처럼 보인다(메인 메뉴와 동일한 트릭).
   ========================================================================= */

let pauseMenuOpen = false;

const pauseMenuEl = document.getElementById("pauseMenu");
const pauseResumeBtnEl = document.getElementById("pauseResumeBtn");
const pauseMainMenuBtnEl = document.getElementById("pauseMainMenuBtn");
const pauseZoneSelectBtnEl = document.getElementById("pauseZoneSelectBtn");

// W/S 이동 + Space/Enter 확정 (js/engine/menunav.js 참고) - 메인 메뉴와 동일한 패턴, 버튼 세 개짜리
// 정적 목록이라 항상 같은 배열만 반환하면 됨.
const pauseMenuNav = createMenuNav(() => [pauseResumeBtnEl, pauseMainMenuBtnEl, pauseZoneSelectBtnEl]);

function openPauseMenu() {
  pauseMenuOpen = true;
  pauseMenuEl.style.display = "flex";
  pauseMenuNav.reset();
}
function closePauseMenu() {
  pauseMenuOpen = false;
  pauseMenuEl.style.display = "none";
}

pauseResumeBtnEl.addEventListener("click", () => {
  closePauseMenu();
});
pauseMainMenuBtnEl.addEventListener("click", () => {
  // 사용자 요청 - 메인 화면으로 나가기 전에도 확인 대화상자(js/engine/confirmdialog.js)를 거친다.
  // "아니오"/Esc로 취소하면 일시정지 메뉴가 그대로 남아있는 것처럼 보임(패널 안 닫음).
  openConfirmDialog("메인 화면으로 이동하시겠습니까?", () => {
    closePauseMenu();
    showMainMenu();
  });
});
pauseZoneSelectBtnEl.addEventListener("click", () => {
  openQaPanel();
});

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;

  // 확인 대화상자(js/engine/confirmdialog.js)가 열려있으면 다른 무엇보다 최우선으로 처리하고 끝 -
  // QA 패널 위에도, 일시정지 메뉴 위에도 뜰 수 있는 가장 바깥쪽 레이어이기 때문에 항상 제일 먼저
  // 검사해야 한다(안 그러면 아래 qaPanelOpen 분기가 먼저 걸려서 이 대화상자가 떠 있는 동안에도 QA
  // 패널 쪽 키 처리가 반응해버린다).
  if (confirmDialogOpen) {
    if (e.code === "Backquote" || e.code === "Escape") { e.preventDefault(); closeConfirmDialog(); }
    else if (e.code === "KeyW") { e.preventDefault(); confirmDialogNav.move(-1); }
    else if (e.code === "KeyS") { e.preventDefault(); confirmDialogNav.move(1); }
    else if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); confirmDialogNav.confirm(); }
    return;
  }

  // QA 패널이 열려있으면 이 리스너가 그 안의 모든 관련 키를 처리하고 끝 - 아래(일시정지/메인 메뉴)
  // 분기로 안 내려간다. moveQaPanelSelection/confirmQaPanelSelection은 js/engine/qapanel.js 참고.
  // Space/Enter 둘 다 확정으로 받는다(사용자 요청) - QA 패널은 zoneIds 기반의 자체 선택 인덱스를 쓰므로
  // menunav.js의 범용 헬퍼 대신 그 파일의 moveQaPanelSelection/confirmQaPanelSelection을 그대로 씀.
  if (qaPanelOpen) {
    if (e.code === "Backquote" || e.code === "Escape") { e.preventDefault(); closeQaPanel(); }
    else if (e.code === "KeyW") { e.preventDefault(); moveQaPanelSelection(-1); }
    else if (e.code === "KeyS") { e.preventDefault(); moveQaPanelSelection(1); }
    else if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); confirmQaPanelSelection(); }
    return;
  }

  // 일시정지 메뉴 - QA 패널과 같은 W/S 이동 + Space/Enter 확정을 pauseMenuNav(js/engine/menunav.js)로
  // 제공(사용자 요청: "다른 메뉴창에도 적용해줘").
  if (pauseMenuOpen) {
    if (e.code === "Backquote" || e.code === "Escape") { e.preventDefault(); closePauseMenu(); }
    else if (e.code === "KeyW") { e.preventDefault(); pauseMenuNav.move(-1); }
    else if (e.code === "KeyS") { e.preventDefault(); pauseMenuNav.move(1); }
    else if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); pauseMenuNav.confirm(); }
    return;
  }

  // 메인 메뉴가 보이는 중(아직 부트스트랩 전이거나, 일시정지 메뉴의 "메인 화면"으로 돌아온 상태) -
  // 마찬가지로 mainMenuNav(js/engine/mainmenu.js)로 W/S/Space/Enter를 지원. 백틱은 예전과 동일하게
  // QA 패널을 곧장 연다(메인 메뉴 단계엔 "일시정지"할 게임 화면 자체가 없으므로).
  if (mainMenuOpen) {
    if (e.code === "KeyW") { e.preventDefault(); mainMenuNav.move(-1); }
    else if (e.code === "KeyS") { e.preventDefault(); mainMenuNav.move(1); }
    else if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); mainMenuNav.confirm(); }
    else if (e.code === "Backquote") { e.preventDefault(); openQaPanel(); }
    return;
  }

  // 여기까지 왔다는 건 QA 패널/일시정지 메뉴/메인 메뉴 전부 안 열려있다는 뜻 = 실제 플레이 중.
  if (e.code === "Backquote") {
    e.preventDefault();
    openPauseMenu();
  }
});
