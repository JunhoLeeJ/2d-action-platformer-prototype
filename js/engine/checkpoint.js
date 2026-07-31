"use strict";

/* --------------------------- 체크포인트 --------------------------- */
// 예전엔 리스폰 지점이 단일 상수(SPAWN_POINT)였지만, 이제는 "지금 이 세션에서 마지막으로 활성화된
// 체크포인트"를 가리키는 가변 상태다. main.js 부트스트랩에서 첫 존 진입 시점에 초기값이 세팅된다.
let currentCheckpoint = null;

// 체크포인트 하나가 "회복"을 이미 한 번 내준 적이 있는지 - zoneId:checkpointId로 키를 잡는다
// (seenTriggerIds, js/engine/cutscene.js와 동일한 "한 번뿐" Set 패턴). 사용자 요청: "한번 체력을 채운
// 체크포인트에서는 다시 체력을 채울 수 없음" - 안 그러면 체크포인트 바로 옆에서 몬스터를 살짝 맞고
// 돌아와 회복하고 다시 나가 맞고 돌아오는 식으로 사실상 무한 회복이 가능해진다. 이 Set은 세션 내내
// 유지되며 절대 지워지지 않는다 - 한 번 회복을 내준 체크포인트는 그 세션에서 다시는 회복을 안 준다.
// 죽어서 리스폰할 때의 회복(resetPlayerVitals, player.js)은 이 제한과 완전히 무관하다 - respawnPlayer는
// activateCheckpoint를 호출하지 않고 항상 무조건 풀피로 되돌리므로, 이 Set은 오직 "살아있는 채로
// 체크포인트를 다시 밟았을 때"의 추가 회복만 막는다.
const healedCheckpointIds = new Set();

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
  // 사용자 요청: "체크포인트를 찍을 때는 체력을 풀로 회복시켜줘." 문 전환/워프의 resetPlayerVitals()
  // (player.js)와 달리 여기서는 HP/피격 타이머만 건드린다 - attackState/표류/속도까지 통째로 리셋하면
  // 전투 도중 체크포인트를 스쳐 지나가는 상황(예: 근접 체크포인트를 밟으며 몬스터와 싸우는 중)에
  // 스윙/표류가 뜬금없이 캔슬돼버리는 부작용이 생긴다 - 체력 회복은 그 문제가 없으므로 범위를 좁혀서만 적용.
  // 단, 이 체크포인트가 이미 한 번 회복을 내준 적이 있으면(healedCheckpointIds) 이번엔 건너뛴다(§ 위).
  const healKey = zoneId + ":" + checkpointId;
  if (!healedCheckpointIds.has(healKey)) {
    healedCheckpointIds.add(healKey);
    player.hp = player.maxHp;
    player.timeSinceHit = Infinity;
  }
}
