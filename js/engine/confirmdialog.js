"use strict";

/* =========================================================================
   확인 대화상자 - 되돌리기 번거로운 동작(구역 워프, 메인 화면으로 나가기) 전에 "예/아니오"를
   한 번 더 묻는 범용 오버레이. 사용자 요청("구역 선택해서 그 구역으로 순간이동하기 전이랑 메인화면으로
   가기 전에 확인 절차도 넣어줘")으로 추가됨.
   =========================================================================

   QA 패널/일시정지 메뉴 둘 다 "닫아도 사라지지 않는 배경 화면" 위에 다른 오버레이가 겹쳐 뜨는 관례를
   써왔다(메인 메뉴 위 QA 패널, 일시정지 메뉴 위 QA 패널) - 이 대화상자도 같은 관례를 따른다: 여는 쪽
   (QA 패널의 pickZone, 일시정지 메뉴의 "메인 화면" 버튼)은 자기 자신을 안 닫은 채 이 위에 그대로 띄우고,
   "아니오"/Esc로 취소하면 그 배경 화면이 그대로 남아있던 것처럼 보인다. z-index(11)가 QA 패널(10)보다
   높아서 QA 패널 위에도 정상적으로 뜬다.

   W/S 이동 + Space/Enter 확정은 createMenuNav(js/engine/menunav.js)를 그대로 재사용 - 버튼 두 개짜리
   정적 목록이라 항상 같은 배열만 반환하면 됨. 기본 포커스는 "예"(index 0) - 이미 한 번 명시적으로
   선택/확정한 행동에 대한 안전장치일 뿐이라, 위험한 작업의 "기본은 취소"와는 다르게 빠른 재확인이
   더 자연스럽다고 판단함.

   실제 키 입력 라우팅(Backquote/Escape/W/S/Space/Enter)은 이 파일이 아니라 js/engine/pausemenu.js가
   전담한다 - 그 파일의 keydown 리스너 하나로 모든 오버레이의 키를 몰아두는 기존 설계(여러 리스너가
   같은 키에 동시에 반응하는 충돌을 피하기 위함)를 그대로 따름. 이 파일은 open/close/nav 객체만 내보낸다.
   ========================================================================= */

let confirmDialogOpen = false;
let confirmDialogOnConfirm = null;

const confirmDialogEl = document.getElementById("confirmDialog");
const confirmDialogMessageEl = document.getElementById("confirmDialogMessage");
const confirmDialogYesBtnEl = document.getElementById("confirmDialogYesBtn");
const confirmDialogNoBtnEl = document.getElementById("confirmDialogNoBtn");

const confirmDialogNav = createMenuNav(() => [confirmDialogYesBtnEl, confirmDialogNoBtnEl]);

// message: 화면에 보여줄 질문 문구. onConfirm: "예"를 골랐을 때 실행할 콜백(취소/아니오 땐 아무 것도
// 안 함) - 호출자가 실제 동작(warpToZone, showMainMenu 등)을 여기 담아 넘긴다.
function openConfirmDialog(message, onConfirm) {
  confirmDialogMessageEl.textContent = message;
  confirmDialogOnConfirm = onConfirm;
  confirmDialogOpen = true;
  confirmDialogEl.style.display = "flex";
  confirmDialogNav.reset();
}
function closeConfirmDialog() {
  confirmDialogOpen = false;
  confirmDialogOnConfirm = null;
  confirmDialogEl.style.display = "none";
}

confirmDialogYesBtnEl.addEventListener("click", () => {
  const fn = confirmDialogOnConfirm;
  closeConfirmDialog();
  if (fn) fn();
});
confirmDialogNoBtnEl.addEventListener("click", () => {
  closeConfirmDialog();
});
