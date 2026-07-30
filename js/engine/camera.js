"use strict";

/* --------------------------- 카메라 --------------------------- */
// camera.x/y = 캔버스 좌측 상단이 가리키는 "월드 좌표". 월드 오브젝트를 그릴 때
// 화면 좌표 = 월드 좌표 - camera 값 이 되도록 draw()에서 translate 처리한다.
const camera = { x: 0, y: 0 };

// 컷신 카메라 홀드용 오버라이드 목표 - null이면 평소처럼 플레이어를 데드존+감쇠로 따라감.
// { x } 형태만 지원 (이 게임엔 세로 스크롤이 없어서 camera.y는 항상 0으로 고정 - updateCamera 참고).
let cameraOverrideTarget = null;

function snapCameraToPlayer() {
  camera.x = clamp(player.x + player.w / 2 - W / 2, currentZone.cameraBounds.minX, currentZone.cameraBounds.maxX);
  camera.y = 0;
}

function updateCamera(dt) {
  const smoothing = 1 - Math.exp(-CONFIG.CAMERA_SMOOTHING * dt);

  if (cameraOverrideTarget) {
    // 컷신 카메라 홀드: 데드존 없이 목표 지점으로 그대로 감쇠 추적 (플레이어 조작과 무관)
    camera.x += (cameraOverrideTarget.x - camera.x) * smoothing;
    camera.x = clamp(camera.x, currentZone.cameraBounds.minX, currentZone.cameraBounds.maxX);
    camera.y = 0;
    return;
  }

  const playerCenterX = player.x + player.w / 2;
  const halfDeadzone = CONFIG.CAMERA_DEADZONE_W / 2;
  const leftBound = camera.x + W / 2 - halfDeadzone;
  const rightBound = camera.x + W / 2 + halfDeadzone;

  // 데드존: 플레이어가 화면 중앙 근처 일정 범위 안에 있는 동안은 목표 위치를 그대로 유지
  let targetX = camera.x;
  if (playerCenterX < leftBound) targetX = playerCenterX - (W / 2 - halfDeadzone);
  else if (playerCenterX > rightBound) targetX = playerCenterX - (W / 2 + halfDeadzone);

  // 지수 감쇠 lerp: 프레임레이트가 들쭉날쭉해도 동일한 체감 속도로 부드럽게 따라감
  camera.x += (targetX - camera.x) * smoothing;

  // 레벨 경계를 벗어나지 않도록 고정
  camera.x = clamp(camera.x, currentZone.cameraBounds.minX, currentZone.cameraBounds.maxX);
  camera.y = 0; // 세로 스크롤 없음 (레벨 높이 = 캔버스 높이)
}

// 현재 카메라 뷰포트(화면) 안에 해당 월드 오브젝트가 보이는지 여부
function isInCameraView(rect) {
  return rectsOverlap(rect, { x: camera.x, y: camera.y, w: W, h: H });
}

// 카메라 오프셋을 반영해 마우스 커서의 월드 x좌표를 구함 (player.facing 갱신에 씀)
function getMouseWorldX() {
  return mouseScreenX + camera.x;
}
