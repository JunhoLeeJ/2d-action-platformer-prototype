"use strict";

/* --------------------------- 체크포인트 --------------------------- */
// 예전엔 리스폰 지점이 단일 상수(SPAWN_POINT)였지만, 이제는 "지금 이 세션에서 마지막으로 활성화된
// 체크포인트"를 가리키는 가변 상태다. main.js 부트스트랩에서 첫 존 진입 시점에 초기값이 세팅된다.
let currentCheckpoint = null;

// 스토리 트리거(첫 체크포인트)든 근접 자동 감지(이후 체크포인트)든 결국 이 함수 하나를 호출하면 된다.
// 존 정의에 붙은 checkpoint 오브젝트의 active 표시도 여기서 갱신 - respawnPlayer가
// loadZone(currentCheckpoint.zoneId, currentCheckpoint)로 그대로 재사용한다.
//
// 리스폰 지점은 세션 전체에서 항상 하나뿐이어야 한다(사용자 요청 - 체크포인트 기둥이 하나만 파랗게
// 빛나야 "지금 여기서 리스폰한다"는 게 시각적으로 명확함, js/rendering.js의 drawCheckpointPillarProp
// 참고). 그래서 지금 활성화하는 존(zoneId)뿐 아니라 ZONES에 등록된 *모든* 존을 순회해서 정확히 하나의
// 체크포인트만 active:true로 만든다 - 예전엔 지금 존의 checkpoints만 갱신해서, 다른 존에 갔다가
// 되돌아오면 두 존의 체크포인트가 동시에 active:true로 남아있는 버그가 있었음(화면에 안 보일 뿐
// 데이터는 잘못된 채로 남아있었음 - 기둥 렌더링을 붙이면서 실제로 드러남).
function activateCheckpoint(zoneId, x, y, checkpointId) {
  currentCheckpoint = { zoneId, x, y, checkpointId };
  for (const zid in ZONES) {
    for (const cp of ZONES[zid].checkpoints) cp.active = zid === zoneId && cp.id === checkpointId;
  }
}
