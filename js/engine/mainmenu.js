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
   ========================================================================= */

const mainMenuEl = document.getElementById("mainMenu");

function hideMainMenu() {
  mainMenuEl.style.display = "none";
}

document.getElementById("mainMenuStartBtn").addEventListener("click", () => {
  hideMainMenu();
  warpToZone(BOOT_ZONE_ID);
});

document.getElementById("mainMenuZoneSelectBtn").addEventListener("click", () => {
  openQaPanel();
});
