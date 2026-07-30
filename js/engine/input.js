"use strict";

// --- 입력 처리 ---
// 키보드와 마우스 버튼을 같은 코드 체계로 다룬다: 마우스 좌클릭="Mouse0", 우클릭="Mouse2"를
// 가상의 키코드처럼 취급해서 heldKeys/justPressed와 동일한 파이프라인을 그대로 공유한다.
//
// - heldKeys[code]      : 지금 물리적으로 눌려있는지 (연속 입력 - 이동에 사용)
// - justPressed[code]   : "이번 프레임에 막 눌렀다"는 단발 신호 (탭 입력 - 점프/공격/표류에 사용).
//                         매 프레임 끝(update() 마지막)에 비워짐.
// - pendingKeyAfterFreeze[code] : 타임스톱(히트스톱) 도중 눌린 입력은 곧바로 justPressed가 되지 않고
//                         여기 대기한다. 타임스톱이 끝나는 순간 그 키가 "아직도" 눌려있으면 그제서야
//                         justPressed로 전환되고, 도중에 뗐으면(heldKeys가 다시 false) 그냥 버려진다
//                         (loop() 참고) - 즉 타임스톱 중의 입력은 "예약"되지 않는다.
const heldKeys = {};
const justPressed = {};
const pendingKeyAfterFreeze = {};
const WATCHED_KEYS = ["KeyA", "KeyD", "KeyW", "Space"]; // 브라우저 기본 동작(스크롤 등)을 막을 키

function handlePress(code) {
  if (!heldKeys[code]) {
    if (timeStopTimer > 0) pendingKeyAfterFreeze[code] = true;
    else justPressed[code] = true;
  }
  heldKeys[code] = true;
}
function handleRelease(code) {
  heldKeys[code] = false;
}

window.addEventListener("keydown", (e) => {
  if (WATCHED_KEYS.includes(e.code)) e.preventDefault();
  if (!e.repeat) handlePress(e.code); // heldKeys 가드가 이미 "처음 눌린 순간"만 걸러주므로 repeat 체크는 보조용
});
window.addEventListener("keyup", (e) => handleRelease(e.code));

// 마우스: 좌클릭=공격, 우클릭=표류. 우클릭 시 브라우저 컨텍스트 메뉴가 뜨지 않게 막는다.
canvas.addEventListener("mousedown", (e) => {
  e.preventDefault();
  if (e.button === 0) handlePress("Mouse0");
  else if (e.button === 2) handlePress("Mouse2");
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 0) handleRelease("Mouse0");
  else if (e.button === 2) handleRelease("Mouse2");
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// 공격 방향(=player.facing)을 결정하는 조준 기준점. 이 게임은 좌우 판정만 쓰므로 x좌표만 추적한다.
// 캔버스 CSS 픽셀 좌표로 들고 있다가 updatePlayer()에서 카메라 오프셋을 더해 월드 좌표로 바꿔 쓴다
// (getMouseWorldX 참고).
let mouseScreenX = W / 2;
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  // 캔버스가 CSS로 확대/축소되어 표시되는 경우를 대비해 실제 캔버스 해상도 기준으로 환산
  mouseScreenX = (e.clientX - rect.left) * (canvas.width / rect.width);
});
