"use strict";

/* --------------------------- 플레이어 --------------------------- */
// 위치(x/y)는 부트스트랩(main.js)이 loadZone()을 처음 호출할 때 세팅된다 - 더 이상 단일
// SPAWN_POINT 상수에 고정되어 있지 않음(체크포인트/존 전환 둘 다 loadZone이 위치를 옮겨줌).
const player = {
  x: 0, y: 0,
  w: 34, h: 48,
  vx: 0, vy: 0,
  facing: 1,        // -1(왼쪽)|1(오른쪽) - 이동 방향이 아니라 마우스 커서 방향으로 매 프레임 갱신됨 (updatePlayer 참고). 공격/반격 판정 방향이 이 값을 그대로 씀
  onGround: false,
  jumpsUsed: 0,
  airAttacksUsed: 0, // 착지 전까지 쓴 공중 공격 횟수 - jumpsUsed와 동일하게 착지 시에만 0으로 리셋 (MAX_AIR_ATTACKS 참고)

  hp: CONFIG.PLAYER_MAX_HP,
  maxHp: CONFIG.PLAYER_MAX_HP, // tickHpRegen(enemies.js)이 플레이어/몬스터에 공통으로 쓰는 최소 인터페이스({hp,maxHp,timeSinceHit}) 충족용
  invincibleTimer: 0,
  timeSinceHit: Infinity, // 마지막으로 HP가 실제로 깎인 뒤 흐른 시간 (sec) - tickHpRegen이 이 값으로 회복 시작 여부를 판단

  attackState: "idle",     // idle | active | recovery
  attackTimer: 0,
  hitEnemiesThisSwing: new Set(),
  attackIsAirborne: false, // 이번 스윙이 공중 공격인지 (startAttack 시점의 onGround로 고정, getAttackHitbox/draw에서 참고)
  // 지상 공격 후딜레이(recovery)가 끝난 직후에도 아주 짧게 한 번 더 이동을 막는 타이머(sec) - 0보다
  // 크면 movement 블록이 A/D 입력을 무시한다. GROUND_ATTACK_POST_RECOVERY_LOCK_DURATION 참고.
  postAttackLockTimer: 0,

  state: "anchor",         // anchor | drift - 피격 판정에는 영향 없음, "데미지를 축적할지 즉시 적용할지"만 바꾸는 레이어
  driftTimer: 0,           // drift 상태로 진입한 시점부터 DRIFT_DURATION에서 카운트다운, 0이 되면 자동 종료+반격
  driftCooldownTimer: 0,   // 0이어야 우클릭으로 표류 발동 가능 (표류 자동 종료 시점에 반격 성공 여부에 따라 getDriftCooldownOnCounter/Whiff 중 하나로 리셋됨)
  driftCooldownDuration: getDriftCooldownOnWhiff(), // 이번 쿨타임이 총 몇 초짜리였는지 (HUD 게이지가 driftCooldownTimer와 함께 비율을 계산하는 데 씀)
  pendingDamage: [],       // [{ amount, timer }, ...] - 아직 HP에 확정 반영 안 된 피해. anchor 상태에서 맞으면 timer가 DRIFT_DAMAGE_GRACE_PERIOD부터 줄어들다 0이 되면 HP 확정 적용, 그 전에 표류를 발동하면 그대로 축적되어 표류 종료 시 반격 데미지로 전환됨
  driftTrail: [],          // 잔상 표시용 최근 위치 기록 (순수 시각효과, 충돌과 무관)
  driftBurst: null,        // { x, y, w, h, timer } - 표류 종료 시 반격 판정을 잠깐 보여주기 위한 시각효과 상태
};

let gameState = "playing"; // playing | respawning | cutscene
let respawnTimer = 0;

// 플레이어가 마지막으로 A/D를 눌러 실제로 이동한 방향 (제자리에 서 있어도 이전 값 유지) - 마우스 조준
// 방향인 player.facing과는 완전히 별개. 유령 NPC가 "진행 방향 반대편"에 서려고 할 때 기준으로 씀.
let playerLastMoveDir = 1;

// 유령 NPC - 순수 시각효과. 충돌/전투 등 어떤 판정에도 관여하지 않고(관여받지도 않고), 플레이어가
// 마지막으로 이동한 방향의 반대쪽에 약간 거리를 두고 자리 잡으려 한다(따라오는 동료처럼 보이게).
// 목표 위치로 순간이동하지 않고 카메라와 같은 방식(지수 감쇠)으로 매끄럽게 쫓아가므로, 방향을 자주
// 바꿔도(왔다갔다 스팸 등) 뚝뚝 끊기지 않고 자연스럽게 옆을 오간다 - 그 과정에서 잠깐 플레이어와
// 겹칠 수 있는데, 그때는 draw()에서 유령을 플레이어보다 위에 그려서 가려지지 않게 한다.
const ghostNpc = { x: 0, y: 0, facing: -1 };
function updateGhostNpc(dt) {
  const targetCenterX = (player.x + player.w / 2) - playerLastMoveDir * CONFIG.GHOST_NPC_FOLLOW_OFFSET;
  const targetX = targetCenterX - player.w / 2;
  const targetY = player.y;

  // 카메라 추적과 동일한 프레임레이트 무관 지수 감쇠 - 목표가 갑자기 반대편으로 튀어도
  // "즉시 순간이동"이 아니라 "빠르지만 매끄럽게 쫓아감"이 되도록.
  const smoothing = 1 - Math.exp(-CONFIG.GHOST_NPC_FOLLOW_SMOOTHING * dt);
  const prevX = ghostNpc.x;
  ghostNpc.x += (targetX - ghostNpc.x) * smoothing;
  ghostNpc.y += (targetY - ghostNpc.y) * smoothing;

  // 눈(방향 표시)은 실제로 지금 이동하고 있는 방향을 그대로 반영 - 목표점 근처에서 미세하게
  // 흔들리는 걸로 눈이 깜빡이지 않도록 아주 작은 움직임은 무시함.
  if (ghostNpc.x - prevX > 0.05) ghostNpc.facing = 1;
  else if (ghostNpc.x - prevX < -0.05) ghostNpc.facing = -1;
}

/* --------------------------- 업데이트 로직 --------------------------- */

function startAttack() {
  player.attackState = "active";
  player.hitEnemiesThisSwing.clear();
  // 스윙 시작 시점의 접지 상태로 고정 - 도중에 이/착지해도 스윙 종류가 안 바뀌게 함(모양/데미지가
  // 프레임 중간에 바뀌면 시각효과와 판정이 어긋나 보임). attackTimer 분기보다 먼저 정해야 함.
  player.attackIsAirborne = !player.onGround;
  player.attackTimer = player.attackIsAirborne ? CONFIG.ATTACK_ACTIVE_DURATION : CONFIG.GROUND_ATTACK_ACTIVE_DURATION;
  // 이전 스윙이 남긴 후속 이동잠금은 이번 스윙 자신의 잠금(active의 쏠림 + recovery의 정지)이 곧바로
  // 이어받으므로 더 이상 의미가 없다 - 새 스윙 시작 시 확실히 정리.
  player.postAttackLockTimer = 0;
}

// 공중 공격 데미지 = 지상 공격(ATTACK_DAMAGE)의 절반. 상수로 다시 박지 않고 항상 지상 공격을 따라가도록
// 함수화 (getDriftCooldownOnCounter/Whiff와 같은 이유 - CONFIG.ATTACK_DAMAGE가 바뀌어도 관계가 자동 유지됨).
function getAirAttackDamage() {
  return CONFIG.ATTACK_DAMAGE / 2;
}

// 지상 공격 스윙 중 몸이 앞으로 쏠리는 속도 - 총 이동 거리(GROUND_ATTACK_LUNGE_DISTANCE)를 활성
// 시간으로 나눠서 매번 계산한다(상수로 속도를 직접 박지 않는 이유는 getDriftCooldownOnCounter/Whiff와
// 같음 - GROUND_ATTACK_ACTIVE_DURATION을 조정해도 "총 쏠리는 거리"라는 의도가 자동으로 유지됨).
function getGroundAttackLungeSpeed() {
  return CONFIG.GROUND_ATTACK_LUNGE_DISTANCE / CONFIG.GROUND_ATTACK_ACTIVE_DURATION;
}

// 지상 공격 판정 (facing 방향으로 플레이어 옆에 배치되는 사각형). 공중 공격은 방향 무관 원형이라
// 별도 판정(AIR_ATTACK_RADIUS, updatePlayer의 attackIsAirborne 분기 참고)을 쓴다.
function getAttackHitbox() {
  const w = CONFIG.ATTACK_RANGE_W, h = CONFIG.ATTACK_RANGE_H;
  const x = player.facing === 1 ? player.x + player.w : player.x - w;
  const y = player.y + player.h / 2 - h / 2;
  return { x, y, w, h };
}

// 문(door)을 통해 존을 넘는 도중 스윙/표류가 진행 중이었다면, 페이드 뒤 새 존 지형을 기준으로
// 그 판정이 어긋난 채 이어지지 않도록 초기화한다 (zones.js의 makeDoorTrigger onMidpoint에서 호출).
function cancelInFlightCombatState() {
  player.attackState = "idle";
  if (player.state === "drift") {
    player.state = "anchor";
    player.driftTimer = 0;
    player.pendingDamage.length = 0;
  }
}

// 죽음 → 리스폰: 위치/존 전환은 loadZone(체크포인트 존, 체크포인트 좌표)에 위임하고, 여기서는
// "생존 상태"(HP/공격/표류/무적)만 초기값으로 되돌린다. 문 전환은 loadZone만 부르고 이 생존 상태
// 리셋은 하지 않는다 - 그래야 문을 넘을 때 HP/쿨다운이 그대로 유지된다.
function respawnPlayer() {
  loadZone(currentCheckpoint.zoneId, currentCheckpoint);

  player.vx = 0;
  player.vy = 0;
  player.hp = CONFIG.PLAYER_MAX_HP;
  player.timeSinceHit = Infinity;
  player.jumpsUsed = 0;
  player.airAttacksUsed = 0;
  player.invincibleTimer = CONFIG.HIT_INVINCIBILITY_DURATION * 0.5;
  player.attackState = "idle";
  player.postAttackLockTimer = 0;
  player.state = "anchor";
  player.driftTimer = 0;
  player.driftCooldownTimer = 0;
  player.driftCooldownDuration = getDriftCooldownOnWhiff();
  player.pendingDamage.length = 0;
  player.driftTrail.length = 0;
  player.driftBurst = null;
  gameState = "playing";
}

// 고정형 플랫폼(solidPlatforms) 세로 충돌 판정 - 위에서 착지(vy>0)/아래에서 부딪힘(vy<0) 둘 다 막힘.
// updatePlayer의 Y축 처리와 zones.js의 문 착지 연출(공중에서 문에 진입했을 때의 제자리 낙하)이
// 이 로직을 공유한다 - 후자는 gameState==="cutscene"이라 updatePlayer 자체가 안 도는 동안 스스로
// 중력을 흉내내야 하는데, 그때도 천장 같은 solidPlatforms 항목에는 똑같이 부딪혀야 한다 - 안 그러면
// 트리거 발동 직전 이단 점프로 상승 중이던 관성이 그대로 이어져 천장을 뚫고 올라가 버린다(실제로
// 발견된 버그 - 함수로 공유해서 두 곳의 판정이 어긋날 일이 없게 함).
function resolveSolidVerticalCollisions() {
  for (const s of currentZone.solidPlatforms) {
    if (rectsOverlap(player, s)) {
      if (player.vy > 0) {
        player.y = s.y - player.h;
        player.vy = 0;
        player.onGround = true;
        player.jumpsUsed = 0;
        player.airAttacksUsed = 0;
      } else if (player.vy < 0) {
        player.y = s.y + s.h;
        player.vy = 0;
      }
    }
  }
}

function updatePlayer(dt) {
  // --- 타이머 ---
  if (player.invincibleTimer > 0) player.invincibleTimer -= dt;
  tickHpRegen(player, dt);
  if (player.postAttackLockTimer > 0) player.postAttackLockTimer -= dt;

  // 지상 공격으로 인한 조작 잠금(이동 + 점프 전부) - 스윙의 active/recovery 상태이거나(공중 공격은
  // 제외 - attackIsAirborne 체크), 후딜레이 직후의 짧은 여유시간(postAttackLockTimer)이 아직 남아있는
  // 동안 true. 예전엔 이동만 막고 점프는 그대로 통과되던 버그가 있었음(사용자 피드백으로 발견) -
  // 이동/점프 두 입력이 각자 조건을 따로 들고 있다가 어긋난 것이 원인이라, 하나의 플래그로 통일해
  // 두 입력이 항상 같은 기준으로 막히게 함.
  const groundAttackControlLocked =
    (player.attackState !== "idle" && !player.attackIsAirborne) ||
    player.postAttackLockTimer > 0;

  // --- 조준 방향: 이동 방향과 무관하게, 매 프레임 마우스 커서가 있는 쪽을 향하도록 갱신.
  // 근접 공격 판정(getAttackHitbox)이 이 값을 그대로 쓰기 때문에 "왼쪽으로 이동 중이어도
  // 커서가 오른쪽이면 오른쪽을 공격"이 자동으로 성립한다. (표류 반격은 방향 무관 - 플레이어
  // 중심 광역 판정이라 facing을 안 쓴다. performDriftCounterAttack 참고)
  // 단, 지상 공격이 활성(active) 상태인 동안은 갱신을 건너뛴다 - 스윙 도중 마우스를 반대편으로
  // 빠르게 옮겨도 판정/돌진 방향이 시작 시점 그대로 유지되게 하기 위함(공중 공격은 원래 방향
  // 무관한 원형 판정이라 영향 없음). 공격을 누른 바로 그 프레임엔 attackState가 아직 이전 프레임의
  // 값("idle")이라 정상적으로 갱신되고, 그다음 프레임부터 얼어붙는다.
  if (!(player.attackState === "active" && !player.attackIsAirborne)) {
    player.facing = getMouseWorldX() < player.x + player.w / 2 ? -1 : 1;
  }

  // --- 표류 입력 (단발 - 우클릭 한 번으로 발동, 홀드/뗄 때 입력 불필요) ---
  // driftUnlocked: 스토리상 특정 지점(구역 5 재방문)까지는 표류 자체가 잠겨있어야 하는 전역 게이트.
  // disableDrift: 존별 규칙 오버라이드(zones.js) - 둘 다 통과해야 발동 가능.
  if (justPressed["Mouse2"] && driftUnlocked && !getRuleFlag("disableDrift") &&
      player.state === "anchor" && player.driftCooldownTimer <= 0) {
    startDrift();
  }
  updateDrift(dt);

  // --- 좌우 이동 (A/D) ---
  // groundAttackControlLocked인 동안은 입력 자체를 무시한다. 스윙의 active/recovery 상태 자체는 사실
  // 이 게이트가 없어도 결과가 같다 - 아래 공격 처리 블록이 이동 입력 처리 "이후"에 실행되며 그 두
  // 상태 동안의 vx를 각각 쏠림/정지로 다시 덮어쓰기 때문. 그래도 여기서 명시적으로 막아두는 이유는
  // postAttackLockTimer 구간(attackState가 이미 "idle"이라 뒤에서 덮어쓸 코드가 없음)까지 같은
  // 플래그 하나로 일관되게 처리하기 위함.
  let move = 0;
  if (!groundAttackControlLocked) {
    if (heldKeys["KeyA"]) move -= 1;
    if (heldKeys["KeyD"]) move += 1;
  }
  player.vx = move * CONFIG.MOVE_SPEED;
  if (move !== 0) playerLastMoveDir = move; // 유령 NPC가 "진행 방향 반대편"을 계산할 때 씀 - 제자리에 서면 이전 방향 유지

  // --- 중력 ---
  player.vy += CONFIG.GRAVITY * dt;
  if (player.vy > CONFIG.MAX_FALL_SPEED) player.vy = CONFIG.MAX_FALL_SPEED;

  // --- 점프 입력 (W 또는 Space, 둘 다 동일하게 동작) ---
  // groundAttackControlLocked 동안은 점프도 막는다 - 원래 이동만 막고 점프는 그대로 통과되던 버그가
  // 있었음(지상 공격으로 "조작 불가" 상태인데 점프로는 빠져나갈 수 있었던 것 - 사용자 피드백으로 발견).
  if ((justPressed["KeyW"] || justPressed["Space"]) && !getRuleFlag("disableJump") && !groundAttackControlLocked &&
      player.jumpsUsed < CONFIG.MAX_JUMPS) {
    player.vy = -CONFIG.JUMP_FORCE;
    player.jumpsUsed += 1;
    // 이 프레임 안에서 곧바로 아래 공격 입력 블록이 실행되는데, 그 블록은 attackIsAirborne을
    // player.onGround로 판정한다. onGround 자체는 Y축 처리(이 아래, 이번 프레임 후반부)에서만 갱신되므로
    // 안 건드리면 "방금 점프했지만 이번 프레임 내내 onGround가 여전히 true"인 채로 남아있었다 -
    // 점프와 공격을 같은 프레임에(거의 동시에) 누르면 실제로는 막 공중으로 뜬 순간인데도 지상 공격으로
    // 판정되어(레거시 onGround 값을 봄) 지상 공격 전용 조작 잠금이 걸려버리는 문제가 있었음(숏홉 콤보를
    // 빠르게 연타할 때 사용자가 실제로 겪은 버그). 점프를 트리거하는 즉시 여기서 갱신해 바로잡는다.
    player.onGround = false;
  }

  // --- 공격 입력 / 상태 (좌클릭) ---
  // 공중 공격은 점프처럼 착지 전까지 MAX_AIR_ATTACKS번으로 제한된다 - 안 그러면 공격 후딜레이(0.38s)가
  // 점프 체공시간보다 훨씬 짧아서 착지 없이 연타로 계속 공중에 떠있을 수 있었음. 지상 공격은 이 제한과
  // 무관하게 항상 가능(player.onGround 조건). 다 썼는데 공중에서 좌클릭하면 그냥 아무 일도 안 일어남
  // (jumpsUsed 다 쓰고 점프 누르는 것과 동일한 취급).
  // 지상 공격은 좌클릭을 "누르고 있는 동안" 자동으로 연타되고(heldKeys - 연타 피로도 줄이기 위한 사용자
  // 요청), 공중 공격은 여전히 "매번 새로 클릭"해야만 나간다(justPressed) - 숏홉(위 점프 트리거 참고)은
  // 착지 전까지 MAX_AIR_ATTACKS(1)로 엄격히 제한된 소중한 자원이라, 좌클릭을 쥐고 있다는 이유만으로
  // 의도치 않게 그 1회를 원하는 타이밍보다 먼저 써버리면 안 되기 때문 - 홀드 연타는 오직 이 자원 제한이
  // 없는 지상 공격에만 적용해 서로 절대 충돌하지 않게 함.
  const attackInputActive = player.onGround ? heldKeys["Mouse0"] : justPressed["Mouse0"];
  if (attackInputActive && !getRuleFlag("disableAttack") && player.attackState === "idle" &&
      (player.onGround || player.airAttacksUsed < CONFIG.MAX_AIR_ATTACKS)) {
    startAttack();
    // 숏홉: 공중 공격은 매번 상승 속도를 AIR_ATTACK_HOP_FORCE로 덮어써서 작은 점프를 하나 더 만들어준다.
    // jumpsUsed를 건드리지 않으므로 이단 점프를 다 쓴 뒤에도 나갈 수 있고, 점프 -> 이단 점프 -> 공중
    // 공격 1회를 이어붙이면 사실상 3단 점프가 됨 - 그 이상은 위 조건에 막혀 착지해야만 다시 가능.
    if (player.attackIsAirborne) {
      player.vy = -CONFIG.AIR_ATTACK_HOP_FORCE;
      player.airAttacksUsed += 1;
    }
  }
  if (player.attackState === "active") {
    player.attackTimer -= dt;
    // 지상 공격 전용 돌진: 이동 입력을 무시하고 매 프레임 강제로 facing 방향 속도를 덮어써서
    // "몸이 앞으로 쏠리는" 연출 + 그 짧은 순간의 조작 불능을 만든다. 이 블록이 이동 입력 처리
    // (player.vx = move * MOVE_SPEED) 이후, X축 이동 적용 이전에 실행되므로 A/D를 누르고
    // 있었어도 그대로 덮어써진다. active 상태를 벗어나는 즉시(recovery 진입) 다시 정상 입력을 따름.
    if (!player.attackIsAirborne) {
      player.vx = player.facing * getGroundAttackLungeSpeed();
    }
    const hitbox = player.attackIsAirborne ? null : getAttackHitbox();
    const airCx = player.x + player.w / 2, airCy = player.y + player.h / 2;
    const damage = player.attackIsAirborne ? getAirAttackDamage() : CONFIG.ATTACK_DAMAGE;
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      if (player.hitEnemiesThisSwing.has(enemy.id)) continue;
      const hit = player.attackIsAirborne
        ? circleRectOverlap(airCx, airCy, CONFIG.AIR_ATTACK_RADIUS, enemy)
        : rectsOverlap(hitbox, enemy);
      if (hit) {
        damageEnemy(enemy, damage);
        player.hitEnemiesThisSwing.add(enemy.id);
      }
    }
    if (player.attackTimer <= 0) {
      player.attackState = "recovery";
      player.attackTimer = player.attackIsAirborne ? CONFIG.ATTACK_RECOVERY_DURATION : CONFIG.GROUND_ATTACK_RECOVERY_DURATION;
    }
  } else if (player.attackState === "recovery") {
    player.attackTimer -= dt;
    // 지상 공격 후딜레이: "검을 휘두른 뒤 잠깐 멈춰서기" - 이동 입력과 무관하게 완전히 멈춘다.
    // 공중 공격은 후딜레이 중에도 자유롭게 움직일 수 있는 기존 동작을 그대로 유지(건드리지 않음).
    if (!player.attackIsAirborne) player.vx = 0;
    if (player.attackTimer <= 0) {
      player.attackState = "idle";
      // 후딜레이가 끝난 직후에도 아주 짧게 한 번 더 이동을 막는다 - 연타(재공격)하지 않았다면 이
      // 여유시간이 다 지나야 자유롭게 움직일 수 있다. 곧바로 다시 공격하면(재공격은 attackState가
      // "idle"이기만 하면 언제든 가능) 이 타이머가 채 끝나기 전에 startAttack()이 0으로 리셋하고
      // 새 스윙 자신의 잠금이 이어받으므로, 결과적으로 "연타 중엔 안 걸림"이 자동으로 성립한다.
      if (!player.attackIsAirborne) player.postAttackLockTimer = CONFIG.GROUND_ATTACK_POST_RECOVERY_LOCK_DURATION;
    }
  }

  // --- 이동 적용 + 충돌 처리 (X축, 고정형 플랫폼만 - 원웨이는 좌우로 막지 않음) ---
  player.x += player.vx * dt;
  player.x = clamp(player.x, 0, currentZone.width - player.w);
  for (const s of currentZone.solidPlatforms) {
    if (rectsOverlap(player, s)) {
      if (player.vx > 0) player.x = s.x - player.w;
      else if (player.vx < 0) player.x = s.x + s.w;
      player.vx = 0;
    }
  }

  // 봉쇄 벽: 안쪽 몬스터가 다 죽기 전까지는 절대 통과 불가 (존에 게이트가 여러 개 있을 수 있음).
  // X 범위만 판정(isGateBlocking) - 세로 위치와 무관하게 항상 막음, 세로로 긴 존에서도 안전.
  for (const gate of currentZone.wallGates) {
    if (isGateBlocking(gate, player)) {
      if (player.vx > 0) player.x = gate.x - player.w;
      else if (player.vx < 0) player.x = gate.x + gate.w;
      player.vx = 0;
    }
  }

  // --- 이동 적용 + 충돌 처리 (Y축) ---
  const prevBottom = player.y + player.h; // 이번 프레임에 움직이기 전 발 바닥 위치
  player.y += player.vy * dt;
  player.onGround = false;

  // 고정형 플랫폼: 위에서 착지 + 아래에서 점프 시 머리가 부딪힘 (양방향 모두 막힘)
  resolveSolidVerticalCollisions();

  // 원웨이(관통형) 플랫폼: 오직 "위에서 떨어져 착지"할 때만 막힘.
  // 아래에서 위로 통과하거나(vy < 0), 이미 플랫폼 아래에 있던 경우는 그대로 통과시킴.
  for (const p of currentZone.oneWayPlatforms) {
    const horizontallyOverlapping = player.x + player.w > p.x && player.x < p.x + p.w;
    if (!horizontallyOverlapping) continue;
    const newBottom = player.y + player.h;
    const wasAboveSurface = prevBottom <= p.y + 0.5;
    if (player.vy >= 0 && wasAboveSurface && newBottom >= p.y) {
      player.y = p.y - player.h;
      player.vy = 0;
      player.onGround = true;
      player.jumpsUsed = 0;
      player.airAttacksUsed = 0;
    }
  }

  // 낙사 판정: 바닥 구멍으로 떨어져 존 아래로 일정 거리 이상 벗어나면 사망. 화면(H) 기준이 아니라
  // 존의 전체 세로 크기(currentZone.height) 기준 - 세로로 긴 존에서는 카메라에 안 보이는 곳까지도
  // 정상적으로 서 있을 수 있으므로, 화면 밖으로 나갔다고 곧바로 죽으면 안 된다.
  if (player.y > currentZone.height + CONFIG.PIT_FALL_BUFFER) {
    triggerDeath();
  }
}

function triggerDeath() {
  if (gameState !== "playing") return;
  gameState = "respawning";
  respawnTimer = CONFIG.RESPAWN_DELAY;
}

/* --------------------------- 표류(drift) 상태 --------------------------- */
// 핵심: 피격 판정(충돌 감지)은 항상 본체의 실제 좌표 기준으로 그대로 동작한다 (안 바뀜).
// 모든 피격은 일단 player.pendingDamage에 { amount, timer } 로 들어간다 (즉시 HP에 반영되지 않음).
// anchor 상태에서는 이 timer가 DRIFT_DAMAGE_GRACE_PERIOD부터 매 프레임 줄어들고, 0이 되면 그제서야
// HP에 확정 반영된다 - 즉 맞아도 짧은 유예시간 동안은 취소 가능한 상태로 남아있다.
// 이 유예시간 안에 표류(우클릭)를 발동하면 그 순간 timer 감소가 멈춰서 사실상 "확정 취소"되고,
// drift 상태에서 받는 피해도 동일하게 pendingDamage에 쌓이기만 한다 (timer는 anchor일 때만 줄어듦).
// DRIFT_DURATION이 다 되어 표류가 자동 종료되는 순간, 그때까지 남아있던 pendingDamage 합계만큼
// 넓은 범위 반격을 자동으로 시전한다 (축적된 피해가 없으면 대신 플레이어가 DRIFT_EMPTY_SELF_DAMAGE만큼 자해).

// 표류 재발동 쿨타임 계산 (CONFIG의 DRIFT_COOLDOWN_COUNTER_MARGIN/WHIFF_EXTRA 주석 참고).
// 상수로 안 박아두고 함수로 계산하는 이유: HIT_INVINCIBILITY_DURATION이나 DRIFT_DAMAGE_GRACE_PERIOD가
// 나중에 바뀌어도 "반격 성공 쿨타임이 항상 그 둘의 합보다 유의미하게 길다"는 관계가 자동으로 유지되도록.
function getDriftCooldownOnCounter() {
  return CONFIG.HIT_INVINCIBILITY_DURATION + CONFIG.DRIFT_DAMAGE_GRACE_PERIOD + CONFIG.DRIFT_COOLDOWN_COUNTER_MARGIN;
}
function getDriftCooldownOnWhiff() {
  return getDriftCooldownOnCounter() + CONFIG.DRIFT_COOLDOWN_WHIFF_EXTRA;
}

// HP가 실제로 깎이는 유일한 지점 - 무적시간도 여기서 부여한다 (표류 자해로 깎일 때도 동일하게 적용됨).
// damagePlayer()에서 곧바로 주지 않는 이유: 대기 중인(pending) 피해는 아직 "맞은 것으로 확정"되지 않았기 때문.
function applyDamageToHp(amount) {
  player.hp -= amount;
  player.timeSinceHit = 0; // 회복 타이머 리셋 (tickHpRegen) - 표류 자해로 깎일 때도 동일하게 적용됨
  // hpFloor: 존 규칙으로 "이 이하로는 안 죽는다"가 걸려있으면 여기서 바닥을 친다 - 0 이하 분기가
  // 구조적으로 도달 불가능해지므로 별도의 "죽지 않음" 플래그가 따로 필요 없다.
  const floor = getRuleFlag("hpFloor");
  if (floor != null) player.hp = Math.max(player.hp, floor);
  player.invincibleTimer = Math.max(player.invincibleTimer, CONFIG.HIT_INVINCIBILITY_DURATION);
  triggerTimeStop(CONFIG.HITSTOP_DURATION, "damage"); // 표류 자해도 이 함수를 거치므로 동일하게 타임스톱 적용됨
  if (player.hp <= 0) {
    player.hp = 0;
    triggerDeath();
  }
}

// V 탭 한 번으로 호출됨. 쿨타임 중엔 updatePlayer에서 애초에 호출되지 않음.
// pendingDamage는 일부러 비우지 않는다 - 유예시간 안에 맞고 바로 표류를 발동한 경우,
// 그 피해가 여기서 취소되지 않고 그대로 반격 축적량으로 이어져야 하기 때문.
function startDrift() {
  player.state = "drift";
  player.driftTimer = CONFIG.DRIFT_DURATION;
  player.driftTrail.length = 0;
  // 여기서 무적을 주지 않는다 - 표류 중엔 무적이 damagePlayer()의 가드를 막아버려서
  // 표류 중 맞은 피해가 pendingDamage에 쌓이지 못하게 되기 때문 (그건 finishDrift에서 따로 처리됨).
}

// hitbox 범위 안의 살아있는 적에게 amount만큼 데미지 - 평소 근접 공격과 동일한 스턴 규칙 적용
// (stunnable이 false인 보라색 몬스터는 면역). 반격 1타/2타가 공유해서 쓰는 공통 로직.
function applyCounterDamageToEnemies(hitbox, amount) {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    if (!rectsOverlap(hitbox, enemy)) continue;
    damageEnemy(enemy, amount);
  }
}

// variant: "first"(1타, 하늘색) | "bonus"(투사체 흡수로 이어진 2타, 금색) - draw()에서 색 구분에 씀.
// 색이 다른 이유: 1타/2타가 짧은 시간차로 겹쳐 보일 때도 "어느 타격인지"가 명확히 구분되게 하기 위해서.
function showDriftBurst(hitbox, variant = "first") {
  player.driftBurst = { x: hitbox.x, y: hitbox.y, w: hitbox.w, h: hitbox.h, timer: CONFIG.DRIFT_BURST_VISUAL_DURATION, variant };
}

// driftBurst의 페이드는 일부러 updateDrift(dt)가 아니라 loop()에서 매 프레임 실시간으로 돌린다.
// 반격 2연타 사이의 짧은 정지(HITSTOP_DOUBLE_HIT_GAP) 동안 게임 로직은 완전히 멈추지만,
// 이 타이머만큼은 계속 흘러야 1타의 번쩍임이 눈에 보이게 옅어지다가 2타가 다시 확 밝아지는
// 대비가 생겨서 "두 번 때렸다"는 게 실제로 보인다. update() 안에 있었다면 얼어있는 동안
// 알파가 전혀 안 줄어들어서 1타/2타 이펙트가 겹쳐 하나처럼 보이는 문제가 있었다.
function tickDriftBurst(dt) {
  if (!player.driftBurst) return;
  player.driftBurst.timer -= dt;
  if (player.driftBurst.timer <= 0) player.driftBurst = null;
}

// 표류 중 쌓인 피해를 중심으로 플레이어 주변에 넓은 범위 반격을 시전.
// 평소 근접 공격(getAttackHitbox)과 달리 방향에 관계없이 플레이어를 중심으로 한 광역 판정.
//
// 반격 범위 안의 투사체를 격추했다면, 그 투사체들의 데미지 총합으로 2타가 이어지도록 연출한다:
//   1타(투사체 격추) -> 짧은 프리즈 -> 2타(격추한 만큼 데미지) -> 원래 길이의 타임스톱 -> 게임 재개.
// 두 단계 모두 같은 hitbox를 그대로 재사용(어차피 얼어있는 동안 플레이어가 움직일 수 없음).
// 2타 자체는 투사체를 다시 검사하지 않으므로 3타로 이어질 일이 없다(체인은 여기서 끝).
function performDriftCounterAttack(amount) {
  const w = CONFIG.DRIFT_ATTACK_RANGE_W, h = CONFIG.DRIFT_ATTACK_RANGE_H;
  const hitbox = {
    x: player.x + player.w / 2 - w / 2,
    y: player.y + player.h / 2 - h / 2,
    w, h,
  };

  // amount/bonusDamage는 "원래" 피해량이고, 실제로 적에게 꽂히는 데미지는 여기서 배율을 곱해서 낸다.
  applyCounterDamageToEnemies(hitbox, amount * CONFIG.DRIFT_COUNTER_DAMAGE_MULTIPLIER);

  let bonusDamage = 0;
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    if (p.unblockable) continue; // 반격으로 격추 불가 - 반드시 직접 피해야 하는 투사체 (updateProjectiles 참고)
    if (circleRectOverlap(p.x, p.y, p.r, hitbox)) {
      bonusDamage += p.damage;
      projectiles.splice(i, 1);
    }
  }

  showDriftBurst(hitbox);

  if (bonusDamage > 0) {
    // 1타 직후엔 원래보다 짧게 멈춰서 "1타가 있었다"는 걸 눈으로 보여주고,
    // 그 프리즈가 끝나는 순간(=여전히 게임은 멈춰있는 채로) 2타를 발동한다.
    triggerTimeStop(CONFIG.HITSTOP_DOUBLE_HIT_GAP, "counter", () => {
      applyCounterDamageToEnemies(hitbox, bonusDamage * CONFIG.DRIFT_COUNTER_DAMAGE_MULTIPLIER);
      showDriftBurst(hitbox, "bonus");
      triggerTimeStop(CONFIG.HITSTOP_DURATION, "counter"); // 2타 이후엔 평소와 동일한 길이로 마무리
    });
  } else {
    triggerTimeStop(CONFIG.HITSTOP_DURATION, "counter");
  }
}

// DRIFT_DURATION이 다 되는 순간 자동으로 호출됨 - "시간이 다 되면 자동 종료"가 유일한 종료 트리거.
// 이 순간부터 쿨타임(getDriftCooldownOnCounter/Whiff로 계산됨)이 시작된다.
function finishDrift() {
  const totalDamage = player.pendingDamage.reduce((sum, entry) => sum + entry.amount, 0);
  player.pendingDamage.length = 0;
  player.state = "anchor";
  player.driftTrail.length = 0;

  // 표류가 끝나는 이 시점에만 무적을 준다 - 반격이든 자해든(자해는 applyDamageToHp에서 한 번 더 걸리지만
  // Math.max라 안전함) 결과와 무관하게 "이벤트 직후" 무적시간은 항상 HIT_INVINCIBILITY_DURATION으로 동일.
  player.invincibleTimer = Math.max(player.invincibleTimer, CONFIG.HIT_INVINCIBILITY_DURATION);

  // 실제로 피해를 쌓아서 반격이 나갔으면(몬스터 명중 여부와 무관) 쿨타임을 짧게 돌려주고,
  // 아무 피해도 못 쌓아 자해로 끝났으면 페널티로 쿨타임을 길게 문다.
  if (totalDamage > 0) {
    performDriftCounterAttack(totalDamage);
    player.driftCooldownDuration = getDriftCooldownOnCounter();
  } else {
    applyDamageToHp(CONFIG.DRIFT_EMPTY_SELF_DAMAGE); // 아무 피해도 못 쌓았으면 대신 자해
    player.driftCooldownDuration = getDriftCooldownOnWhiff();
  }
  player.driftCooldownTimer = player.driftCooldownDuration;
}

function updateDrift(dt) {
  if (player.driftCooldownTimer > 0) {
    player.driftCooldownTimer = Math.max(0, player.driftCooldownTimer - dt);
  }

  // anchor 상태일 때만 유예시간이 흐른다 - drift로 전환되는 순간 이 루프를 안 타게 되어
  // 남은 pendingDamage가 사실상 "확정 취소 + 반격 축적"으로 잠기는 효과가 생긴다.
  if (player.state === "anchor") {
    for (let i = player.pendingDamage.length - 1; i >= 0; i--) {
      const entry = player.pendingDamage[i];
      entry.timer -= dt;
      if (entry.timer <= 0) {
        applyDamageToHp(entry.amount);
        player.pendingDamage.splice(i, 1);
      }
    }
    // 무적 중엔(이번 루프에서 막 걸렸든 이미 걸려있었든) 대기 중이던 유예 데미지를 전부 무효화한다.
    // 안 그러면: A에 맞고(유예 시작) 무적이 걸리기 전에 B에도 맞아서(유예 시작) 두 건이 대기하다가,
    // A의 유예가 먼저 끝나 HP 확정+무적 부여된 뒤에도 B의 유예 타이머는 계속 돌아가다 무적 중에
    // 끝나버려서 무적을 뚫고 또 HP가 깎이는 문제가 있었음. 루프 뒤에서 한 번 더 검사하므로
    // 이번 프레임에 어느 항목이 무적을 유발했든 지연 없이 같은 프레임에 나머지가 전부 정리된다.
    if (player.invincibleTimer > 0) {
      player.pendingDamage.length = 0;
    }
  }

  if (player.state === "drift") {
    player.driftTrail.push({ x: player.x, y: player.y });
    if (player.driftTrail.length > 6) player.driftTrail.shift();

    player.driftTimer -= dt;
    if (player.driftTimer <= 0) finishDrift();
  }
  // driftBurst의 페이드는 tickDriftBurst()에서 실시간으로 처리한다 (여기서 안 하는 이유는 그 함수 주석 참고).
}

function damagePlayer(amount) {
  if (player.invincibleTimer > 0 || gameState !== "playing" || getRuleFlag("playerInvincible")) return;
  // 무적시간은 여기서 주지 않는다 (실제로 HP가 깎히는 applyDamageToHp에서 부여됨) - 그래야
  // 유예시간/표류 중에 또 맞은 피해도 무적에 막히지 않고 pendingDamage에 쌓여 반격에 반영된다.
  // 즉시 HP를 깎지 않고 항상 유예 상태로 들어간다. anchor 상태면 updateDrift에서 timer가 줄어들다 확정되고,
  // drift 상태면 timer가 아예 줄어들지 않아 표류 종료 시까지 그대로 반격 축적량으로 남는다.
  player.pendingDamage.push({ amount, timer: CONFIG.DRIFT_DAMAGE_GRACE_PERIOD });
}
