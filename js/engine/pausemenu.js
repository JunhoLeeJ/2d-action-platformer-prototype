"use strict";

/* =========================================================================
   일시정지 메뉴 - 실제 플레이 중 백틱(`)을 누르면 뜨는 화면(재개/메인 화면/구역 선택).
   =========================================================================

   이 파일이 백틱/Esc/W/S/Space에 대한 keydown 라우팅을 전부 도맡는다(아래 리스너 하나). 이유:
   지금 화면에 QA 패널/일시정지 메뉴/메인 메뉴 중 뭐가 떠 있는지에 따라 같은 백틱 키가 완전히 다른
   동작을 해야 한다 -
     - QA 패널이 열려있으면        : 백틱/Esc는 그 패널만 닫는다(W/S/Space는 패널 안 탐색용).
     - (패널은 닫혀있고) 일시정지 메뉴가 열려있으면 : 백틱/Esc는 "재개"와 동일 - 메뉴를 닫는다.
     - 아무 것도 안 열려있고 메인 메뉴가 보이는 중이면 : 백틱은 QA 패널을 곧장 연다(옛 동작 유지 -
       메인 메뉴 단계에선 "일시정지"할 게 없으므로 그냥 구역 선택 화면으로 바로 감).
     - 아무 것도 안 열려있고 실제로 플레이 중이면      : 백틱은 일시정지 메뉴를 연다.
   이 판단을 qapanel.js/mainmenu.js 각자가 독립된 keydown 리스너로 나눠 가지고 있으면, 같은 키 입력에
   여러 리스너가 동시에 반응해 서로 다른 화면을 동시에 열어버리는 충돌이 생긴다 - 그래서 "지금 뭐가
   열려있는지"를 다 아는 곳(가장 나중에 추가된, 가장 위 레이어인 여기) 한 곳에서만 반응하고, 나머지
   파일들은 open/close 함수만 내보낸다.

   일시정지 메뉴는 QA 패널과 똑같은 관계로 메인 메뉴와 엮여있다 - "구역 선택" 버튼을 누르면 QA
   패널이 이 메뉴 위에 그대로 겹쳐 뜨고, 이 메뉴 자신은 숨겨지지 않는다. 그래서 패널만 닫고 아무
   것도 안 고르면 다시 일시정지 메뉴로 돌아온 것처럼 보인다(메인 메뉴와 동일한 트릭).
   ========================================================================= */

let pauseMenuOpen = false;

const pauseMenuEl = document.getElementById("pauseMenu");

function openPauseMenu() {
  pauseMenuOpen = true;
  pauseMenuEl.style.display = "flex";
}
function closePauseMenu() {
  pauseMenuOpen = false;
  pauseMenuEl.style.display = "none";
}

document.getElementById("pauseResumeBtn").addEventListener("click", () => {
  closePauseMenu();
});
document.getElementById("pauseMainMenuBtn").addEventListener("click", () => {
  closePauseMenu();
  showMainMenu();
});
document.getElementById("pauseZoneSelectBtn").addEventListener("click", () => {
  openQaPanel();
});

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;

  // QA 패널이 열려있으면 이 리스너가 그 안의 모든 관련 키를 처리하고 끝 - 아래(일시정지/메인 메뉴)
  // 분기로 안 내려간다. moveQaPanelSelection/confirmQaPanelSelection은 js/engine/qapanel.js 참고.
  if (qaPanelOpen) {
    if (e.code === "Backquote" || e.code === "Escape") { e.preventDefault(); closeQaPanel(); }
    else if (e.code === "KeyW") { e.preventDefault(); moveQaPanelSelection(-1); }
    else if (e.code === "KeyS") { e.preventDefault(); moveQaPanelSelection(1); }
    else if (e.code === "Space") { e.preventDefault(); confirmQaPanelSelection(); }
    return;
  }

  if (pauseMenuOpen) {
    if (e.code === "Backquote" || e.code === "Escape") { e.preventDefault(); closePauseMenu(); }
    return;
  }

  if (e.code === "Backquote") {
    e.preventDefault();
    // mainMenuOpen(js/engine/mainmenu.js)으로 판단 - gameStarted가 아니라 "지금 메인 메뉴가 보이는
    // 중인지"를 봐야 한다. gameStarted는 한 번 true가 되면 계속 true라서, 일시정지→"메인 화면"으로
    // 돌아온 뒤에도 gameStarted 기준으로는 여전히 "시작됨"인데, 그 상태에서 백틱을 누르면 일시정지
    // 메뉴가 아니라 다시 QA 패널이 곧장 떠야 자연스럽다(메인 메뉴가 보이는 동안은 "일시정지"할
    // 게임 화면 자체가 없으므로).
    if (mainMenuOpen) openQaPanel();
    else openPauseMenu();
  }
});
