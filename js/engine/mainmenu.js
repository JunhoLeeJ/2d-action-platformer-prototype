"use strict";

/* =========================================================================
   메인 메뉴 - 게임의 실제 시작 화면.
   =========================================================================

   전에는 스크립트가 파싱되자마자 main.js 맨 아래에서 곧바로 BOOT_ZONE_ID를 불러와 루프를 시작했지만,
   이제 그 자리를 이 화면이 대신한다 - 사용자가 버튼을 누르기 전까지는 어떤 존도 로드되지 않고 루프도
   돌지 않는다(js/main.js의 gameStarted/ensureLoopStarted 참고).

   버튼 두 개 다 결국 warpToZone()(js/engine/qapanel.js) 하나로 수렴한다:
     - "게임 시작"   : warpToZone(BOOT_ZONE_ID) - 1층 구역 1에서 새로 시작.
     - "구역 선택"   : QA 패널(같은 warpToZone을 쓰는 그 화면)을 그대로 열어서 보여준다 - 전용 UI를
                      새로 안 만들고 그대로 재사용. 메인 메뉴는 패널 뒤에서 계속 떠 있는 채로 있다가
                      (숨기지 않음) 구역을 실제로 고르면 그때 hideMainMenu()가 불려서 사라진다 -
                      그래서 패널만 닫고(Esc/`) 아무 것도 안 고르면 자연스럽게 메뉴로 되돌아온 것처럼
                      보인다(별도의 "뒤로가기" 로직이 필요 없음).

   부트스트랩 이후에도 이 화면으로 다시 돌아올 수 있다 - 일시정지 메뉴(js/engine/pausemenu.js)의
   "메인 화면" 버튼이 showMainMenu()를 부른다. 그 시점엔 이미 gameStarted=true라 ensureLoopStarted가
   또 실행될 일은 없고, mainMenuOpen이 true가 되어 loop()(js/main.js)가 그동안 게임을 멈춰준다 -
   그 뒤 "게임 시작"/"구역 선택"으로 뭘 고르든 warpToZone()이 다시 전부 새로 초기화하므로, 화면
   뒤에 멈춰있던 이전 판의 상태는 그냥 덮어써질 뿐 따로 정리할 필요가 없다.
   ========================================================================= */

let mainMenuOpen = true; // 부트스트랩 시점엔 항상 보이는 채로 시작
const mainMenuEl = document.getElementById("mainMenu");
const mainMenuStartBtnEl = document.getElementById("mainMenuStartBtn");
const mainMenuZoneSelectBtnEl = document.getElementById("mainMenuZoneSelectBtn");

// W/S 이동 + Space/Enter 확정 - 버튼 두 개뿐인 정적 목록이라 항상 같은 배열을 반환하기만 하면 됨
// (js/engine/menunav.js 참고, 실제 키 라우팅은 js/engine/pausemenu.js가 담당).
const mainMenuNav = createMenuNav(() => [mainMenuStartBtnEl, mainMenuZoneSelectBtnEl]);
mainMenuNav.reset(); // 페이지가 로드된 시점(=이 메뉴가 처음부터 보이는 중)에도 강조 표시가 바로 보이도록

function showMainMenu() {
  mainMenuOpen = true;
  mainMenuEl.style.display = "flex";
  mainMenuNav.reset();
}
function hideMainMenu() {
  mainMenuOpen = false;
  mainMenuEl.style.display = "none";
}

mainMenuStartBtnEl.addEventListener("click", () => {
  hideMainMenu();
  warpToZone(BOOT_ZONE_ID);
});

mainMenuZoneSelectBtnEl.addEventListener("click", () => {
  openQaPanel();
});
