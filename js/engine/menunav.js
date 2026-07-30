"use strict";

/* =========================================================================
   메뉴 키보드 탐색 - W/S로 항목 이동 + Space/Enter로 확정.
   =========================================================================

   QA 패널(js/engine/qapanel.js)이 처음 만든 "W/S로 고르고 Space로 확정" 패턴을, 버튼 목록이 있는
   다른 오버레이(메인 메뉴/일시정지 메뉴)에도 그대로 재사용하기 위한 범용 헬퍼 - 사용자 요청("ws로
   왔다갔다하고 space로 고를 수 있는 거 구역 선택뿐만 아니라 다른 메뉴창에도 적용해줘")으로 추가됨.

   getButtons를 함수로 받아서 move/confirm이 호출될 때마다 다시 조회한다 - QA 패널처럼 열 때마다
   버튼을 새로 그리는 동적 목록과, 메인 메뉴/일시정지 메뉴처럼 항상 같은 버튼인 정적 목록 둘 다 이
   하나의 헬퍼로 대응하기 위함(정적인 경우는 그냥 같은 배열을 반환하는 함수만 넘기면 됨).

   실제 키 입력 라우팅(어느 오버레이가 열려있을 때 이 move/confirm을 부를지 판단하는 것)은 이 파일이
   아니라 js/engine/pausemenu.js가 전담한다(그 파일 상단 주석 참고 - 여러 리스너가 같은 키에 동시에
   반응하는 충돌을 피하려고 한 곳에 몰아둔 설계). 이 파일은 순수하게 "지금 몇 번째가 선택돼 있는지"
   상태와 그 이동/확정 로직만 제공한다.
   ========================================================================= */
function createMenuNav(getButtons) {
  let selectedIndex = 0;

  function applyHighlight() {
    const buttons = getButtons();
    buttons.forEach((btn, i) => btn.classList.toggle("menuBtnFocused", i === selectedIndex));
  }

  // 오버레이가 열릴 때마다 호출 - 맨 위 항목부터 다시 시작(QA 패널의 openQaPanel과 같은 관례,
  // 다만 QA 패널은 "지금 있는 존"부터 시작하는 특수 로직이 있어 그건 그대로 별개로 둠).
  function reset() {
    selectedIndex = 0;
    applyHighlight();
  }

  function move(delta) {
    const buttons = getButtons();
    if (buttons.length === 0) return;
    selectedIndex = ((selectedIndex + delta) % buttons.length + buttons.length) % buttons.length;
    applyHighlight();
  }

  function confirm() {
    const buttons = getButtons();
    if (buttons[selectedIndex]) buttons[selectedIndex].click();
  }

  return { move, confirm, reset, applyHighlight };
}
