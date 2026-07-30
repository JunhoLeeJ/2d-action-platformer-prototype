"use strict";

/* --------------------------- 카메라 --------------------------- */
// camera.x/y = 캔버스 좌측 상단이 가리키는 "월드 좌표". 월드 오브젝트를 그릴 때
// 화면 좌표 = 월드 좌표 - camera 값 이 되도록 draw()에서 translate 처리한다.
const camera = { x: 0, y: 0 };

// 컷신 카메라 홀드용 오버라이드 목표 - null이면 평소처럼 플레이어를 데드존+감쇠로 따라감.
// { x, y } 둘 다 지정 가능 (cutscene.js의 cameraHold 이벤트가 세팅) - x/y 각각 생략하면 그 축은
// 지금 카메라 위치를 그대로 유지한다.
let cameraOverrideTarget = null;

function snapCameraToPlayer() {
  camera.x = clamp(player.x + player.w / 2 - W / 2, currentZone.cameraBounds.minX, currentZone.cameraBounds.maxX);
  camera.y = clamp(player.y + player.h / 2 - H / 2, currentZone.cameraBounds.minY, currentZone.cameraBounds.maxY);
}

function updateCamera(dt) {
  const smoothing = 1 - Math.exp(-CONFIG.CAMERA_SMOOTHING * dt);

  if (cameraOverrideTarget) {
    // 컷신 카메라 홀드: 데드존 없이 목표 지점으로 그대로 감쇠 추적 (플레이어 조작과 무관)
    camera.x += (cameraOverrideTarget.x - camera.x) * smoothing;
    camera.y += (cameraOverrideTarget.y - camera.y) * smoothing;
    camera.x = clamp(camera.x, currentZone.cameraBounds.minX, currentZone.cameraBounds.maxX);
    camera.y = clamp(camera.y, currentZone.cameraBounds.minY, currentZone.cameraBounds.maxY);
    return;
  }

  const playerCenterX = player.x + player.w / 2;
  const halfDeadzoneW = CONFIG.CAMERA_DEADZONE_W / 2;
  const leftBound = camera.x + W / 2 - halfDeadzoneW;
  const rightBound = camera.x + W / 2 + halfDeadzoneW;

  // 데드존: 플레이어가 화면 중앙 근처 일정 범위 안에 있는 동안은 목표 위치를 그대로 유지 (가로/세로 각각 독립)
  let targetX = camera.x;
  if (playerCenterX < leftBound) targetX = playerCenterX - (W / 2 - halfDeadzoneW);
  else if (playerCenterX > rightBound) targetX = playerCenterX - (W / 2 + halfDeadzoneW);

  const playerCenterY = player.y + player.h / 2;
  const halfDeadzoneH = CONFIG.CAMERA_DEADZONE_H / 2;
  const topBound = camera.y + H / 2 - halfDeadzoneH;
  const bottomBound = camera.y + H / 2 + halfDeadzoneH;

  let targetY = camera.y;
  if (playerCenterY < topBound) targetY = playerCenterY - (H / 2 - halfDeadzoneH);
  else if (playerCenterY > bottomBound) targetY = playerCenterY - (H / 2 + halfDeadzoneH);

  // 지수 감쇠 lerp: 프레임레이트가 들쭉날쭉해도 동일한 체감 속도로 부드럽게 따라감
  camera.x += (targetX - camera.x) * smoothing;
  camera.y += (targetY - camera.y) * smoothing;

  // 존 경계를 벗어나지 않도록 고정 (존마다 독립된 폭/높이 - zones.js의 cameraBounds)
  camera.x = clamp(camera.x, currentZone.cameraBounds.minX, currentZone.cameraBounds.maxX);
  camera.y = clamp(camera.y, currentZone.cameraBounds.minY, currentZone.cameraBounds.maxY);
}

// 현재 카메라 뷰포트(화면) 안에 해당 월드 오브젝트가 보이는지 여부
function isInCameraView(rect) {
  return rectsOverlap(rect, { x: camera.x, y: camera.y, w: W, h: H });
}

// 카메라 오프셋을 반영해 마우스 커서의 월드 x좌표를 구함 (player.facing 갱신에 씀)
function getMouseWorldX() {
  return mouseScreenX + camera.x;
}
