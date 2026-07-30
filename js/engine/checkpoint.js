"use strict";

/* --------------------------- 체크포인트 --------------------------- */
// 예전엔 리스폰 지점이 단일 상수(SPAWN_POINT)였지만, 이제는 "지금 이 세션에서 마지막으로 활성화된
// 체크포인트"를 가리키는 가변 상태다. main.js 부트스트랩에서 첫 존 진입 시점에 초기값이 세팅된다.
let currentCheckpoint = null;

// 스토리 트리거(첫 체크포인트)든 근접 자동 감지(이후 체크포인트, 둘 다 아직 미구현 - floor 콘텐츠 몫)든
// 결국 이 함수 하나를 호출하면 된다. 존 정의에 붙은 checkpoint 오브젝트의 active 표시도 여기서 갱신 -
// respawnPlayer가 loadZone(currentCheckpoint.zoneId, currentCheckpoint)로 그대로 재사용한다.
function activateCheckpoint(zoneId, x, y, checkpointId) {
  currentCheckpoint = { zoneId, x, y };
  const zoneDef = ZONES[zoneId];
  for (const cp of zoneDef.checkpoints) cp.active = cp.id === checkpointId;
}
