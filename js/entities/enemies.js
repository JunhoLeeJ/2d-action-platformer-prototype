"use strict";

/* --------------------------- 적 (포탑 + 저격수 + 체이서 공통) --------------------------- */
let enemyIdCounter = 0;

// 포탑류(제자리형) 공통 인스턴스 필드 - 감지/어그로/공격 범위가 셋 다 동일한 "화면 크기" 기본값
// (ENEMY_DEFAULT_RANGE_W/H)이라 makeTurret/makeSniper가 공유해서 쓴다.
function makeStationaryRangeFields() {
  return {
    detectionRangeW: CONFIG.ENEMY_DEFAULT_DETECTION_RANGE_W,
    detectionRangeH: CONFIG.ENEMY_DEFAULT_DETECTION_RANGE_H,
    // 포탑/저격수는 체이서와 달리 한 번 어그로가 끌리면 절대 안 풀린다 - 최초 감지만 detectionRange로
    // 판정하고, 그 이후엔 leash/attack이 Infinity라 거리 비교가 항상 통과함(CONFIG 주석 참고).
    leashRangeW: Infinity,
    leashRangeH: Infinity,
    attackRangeW: Infinity,
    attackRangeH: Infinity,
    aggro: false, // 감지 범위 안에 들어오기 전까진 완전 대기 상태 (예고/발사 안 함) - updateTurretAI 참고
  };
}

// 모든 팩토리는 (x, y, opts) 시그니처로 통일되어 있다 - 존 데이터(enemySpawns)가 몬스터 종류별로
// 다른 위치 인자 순서를 외울 필요 없이 { type, x, y, opts } 하나의 형태로만 적히도록 하기 위함.
function makeTurret(x, y, opts = {}) {
  const stunnable = opts.stunnable ?? true;
  return {
    id: enemyIdCounter++,
    type: "turret",
    spawnX: x, spawnY: y,
    x, y, w: 36, h: 40,
    hp: CONFIG.TURRET_MAX_HP,
    maxHp: CONFIG.TURRET_MAX_HP,
    fireTimer: CONFIG.TURRET_FIRE_INTERVAL * Math.random(), // 살짝 랜덤 오프셋
    telegraphing: false,
    alive: true,
    flashTimer: 0,
    hasBeenVisible: false, // 카메라 화면 안에 한 번이라도 들어온 적 있는지 (아직 없으면 발사 금지)
    stunnable, // false면 근접 공격을 맞아도 발사 타이머가 초기화되지 않음 (스턴 면역, 보라색으로 표시)
    ...makeStationaryRangeFields(),
  };
}

// 저격수 - 체력/발사 주기/예고 시간/범위는 포탑과 완전히 동일(CONFIG 값 공유), updateTurretAI가
// enemy.type==="sniper"만 보고 투사체를 unblockable로 바꿔서 쏨(반경도 SNIPER_PROJECTILE_RADIUS로
// 더 크게). AI 로직 자체는 포탑과 같아서 updateEnemies의 "chaser가 아니면 updateTurretAI" 분기에
// 그대로 올라탄다 - 별도 update 함수가 필요 없음.
function makeSniper(x, y, opts = {}) {
  const stunnable = opts.stunnable ?? true;
  return {
    id: enemyIdCounter++,
    type: "sniper",
    spawnX: x, spawnY: y,
    x, y, w: 36, h: 40,
    hp: CONFIG.TURRET_MAX_HP,
    maxHp: CONFIG.TURRET_MAX_HP,
    fireTimer: CONFIG.TURRET_FIRE_INTERVAL * Math.random(),
    telegraphing: false,
    alive: true,
    flashTimer: 0,
    hasBeenVisible: false,
    stunnable,
    ...makeStationaryRangeFields(),
  };
}

// 평소엔 spawnX 기준 좌우로 opts.patrolHalfRange만큼 왔다갔다하다가, 플레이어가 가까워지면
// (그리고 화면에 한 번은 보인 뒤라면) 쫓아와서 근접 공격하는 몬스터.
function makeChaser(x, y, opts = {}) {
  const patrolHalfRange = opts.patrolHalfRange ?? 0;
  const stunnable = opts.stunnable ?? true;
  return {
    id: enemyIdCounter++,
    type: "chaser",
    spawnX: x, spawnY: y,
    x, y, w: 32, h: 44,
    patrolMinX: x - patrolHalfRange,
    patrolMaxX: x + patrolHalfRange,
    facing: 1,
    aiState: "patrol", // patrol | chase | windup | recovery | return(아그로 풀려서 순찰 위치로 걸어 복귀 중)
    attackTimer: 0,
    stunTimer: 0, // 0보다 크면 스턴 상태 - 사거리 안이어도 windup 진입 불가
    // "낮은 fps 인식" 연출용 - CHASER_PERCEPTION_INTERVAL마다 한 번씩만 아래 두 값을 실제 플레이어
    // 위치로 다시 채워넣고, 그 사이엔 그대로 둔다 (updateChaserAI 참고). perceptionTimer를 0으로 시작해서
    // 첫 업데이트 프레임에 바로 한 번 샘플링되게 함.
    perceptionTimer: 0,
    perceivedPlayerX: x,
    perceivedPlayerY: y,
    hp: CONFIG.CHASER_MAX_HP,
    maxHp: CONFIG.CHASER_MAX_HP,
    alive: true,
    flashTimer: 0,
    hasBeenVisible: false,
    stunnable,
    // "적 공통" 범위 필드 (CONFIG 주석 참고) - updateChaserAI/getChaserAttackHitbox가 CONFIG.CHASER_*를
    // 직접 읽지 않고 이 인스턴스 필드를 읽는다. leashRangeH는 체이서가 원래 세로 어그로 범위가 따로
    // 없었으므로(가로 거리만 봄) Infinity로 둬서 그 원래 동작을 그대로 유지.
    detectionRangeW: CONFIG.CHASER_DETECTION_RANGE,
    detectionRangeH: CONFIG.CHASER_DETECTION_VERTICAL_RANGE,
    leashRangeW: CONFIG.CHASER_LEASH_RANGE,
    leashRangeH: Infinity,
    attackRangeW: CONFIG.CHASER_ATTACK_RANGE_W,
    attackRangeH: CONFIG.CHASER_ATTACK_RANGE_H,
  };
}

// 존 데이터의 enemySpawns[i].type을 실제 팩토리 함수로 매핑 - loadZone()이 이걸로 몬스터를 새로 만든다.
const ENEMY_FACTORIES = { turret: makeTurret, sniper: makeSniper, chaser: makeChaser };

// 현재 존에 살아있는 몬스터 목록 - 존을 옮길 때마다(loadZone) 통째로 비우고 그 존의 enemySpawns로부터
// 다시 채워진다. 예전 resetEnemies()는 삭제됨 - "리셋"이 아니라 "항상 새로 만든다"라서 이전 존/이전
// 시도의 상태가 새 존으로 새어 들어올 여지가 구조적으로 없다.
const enemies = [];
const projectiles = []; // {x,y,vx,vy,r,damage}

function getChaserAttackHitbox(enemy) {
  const w = enemy.attackRangeW, h = enemy.attackRangeH;
  const x = enemy.facing === 1 ? enemy.x + enemy.w : enemy.x - w;
  const y = enemy.y + enemy.h / 2 - h / 2;
  return { x, y, w, h };
}

function updateTurretAI(enemy, dt) {
  const ex = enemy.x + enemy.w / 2, ey = enemy.y + enemy.h / 2;
  const px = player.x + player.w / 2, py = player.y + player.h / 2;
  const dx = px - ex, dy = py - ey;
  const distX = Math.abs(dx), distY = Math.abs(dy);

  // 감지 → 어그로 토글 (체이서와 같은 히스테리시스 구조 - CONFIG "적 공통" 섹션 참고). 포탑/저격수는
  // 세 범위가 전부 같은 기본값이라 사실상 즉시 토글되지만, 다른 몬스터와 같은 필드/로직을 공유해서
  // 나중에 값만 달리 줘도 그대로 동작하게 함.
  if (!enemy.aggro) {
    if (distX <= enemy.detectionRangeW && distY <= enemy.detectionRangeH) enemy.aggro = true;
  } else if (distX > enemy.leashRangeW || distY > enemy.leashRangeH) {
    enemy.aggro = false;
    enemy.telegraphing = false;
    enemy.fireTimer = CONFIG.TURRET_FIRE_INTERVAL; // 어그로 다시 끌리면 처음부터 예고하도록 리셋
  }

  // 어그로 안 끌렸으면 완전 대기(예고/발사 타이머도 안 돎) - 화면엔 보여도 아무 행동도 안 하는
  // "유휴" 상태. 나중에 이 분기에 유휴 애니메이션을 추가할 예정 (CLAUDE.md 참고).
  if (!enemy.aggro) return;
  // 공격 범위 밖이면(포탑류는 어그로 범위와 동일값이라 사실상 항상 통과) 발사 안 함.
  if (distX > enemy.attackRangeW || distY > enemy.attackRangeH) return;

  enemy.fireTimer -= dt;

  // 발사 CONFIG.TURRET_TELEGRAPH_DURATION 초 전부터 "공격 예고" 상태로 전환 (시각적 경고)
  enemy.telegraphing = enemy.fireTimer <= CONFIG.TURRET_TELEGRAPH_DURATION;

  if (enemy.fireTimer <= 0) {
    enemy.fireTimer = CONFIG.TURRET_FIRE_INTERVAL;
    enemy.telegraphing = false;
    const len = Math.hypot(dx, dy) || 1;
    const isSniper = enemy.type === "sniper";
    projectiles.push({
      x: ex, y: ey,
      vx: (dx / len) * CONFIG.PROJECTILE_SPEED,
      vy: (dy / len) * CONFIG.PROJECTILE_SPEED,
      r: isSniper ? CONFIG.SNIPER_PROJECTILE_RADIUS : CONFIG.PROJECTILE_RADIUS,
      damage: CONFIG.PROJECTILE_DAMAGE, // 투사체별로 들고 있어서, 나중에 다른 데미지의 투사체가 생겨도 그대로 대응 가능
      // 표류 유예(damagePlayer의 pendingDamage)도 안 타고 반격으로 격추도 안 됨 - updateProjectiles/
      // performDriftCounterAttack 참고. 반드시 몸으로 피해야 하는 투사체라는 뜻.
      unblockable: isSniper,
    });
  }
}

function updateChaserAI(enemy, dt) {
  if (enemy.stunTimer > 0) enemy.stunTimer -= dt;

  // "낮은 fps로 세상을 보는" 연출 - CHASER_PERCEPTION_INTERVAL마다 한 번씩만 실제 플레이어 위치로
  // 다시 채워넣고, 그 사이 프레임들에서는 이 값을 그대로 재사용한다 (아래 모든 인식/추적 판단이 이 값 기준).
  enemy.perceptionTimer -= dt;
  if (enemy.perceptionTimer <= 0) {
    enemy.perceptionTimer = CONFIG.CHASER_PERCEPTION_INTERVAL;
    enemy.perceivedPlayerX = player.x;
    enemy.perceivedPlayerY = player.y;
  }

  const enemyCenterX = enemy.x + enemy.w / 2, enemyCenterY = enemy.y + enemy.h / 2;
  const perceivedCenterX = enemy.perceivedPlayerX + player.w / 2, perceivedCenterY = enemy.perceivedPlayerY + player.h / 2;
  const dist = Math.abs(perceivedCenterX - enemyCenterX);
  const verticalDist = Math.abs(perceivedCenterY - enemyCenterY);
  // 인식 범위: 가로/세로 둘 다 안에 들어와야 "발견"한 것으로 침 (patrol/return 양쪽에서 공용으로 씀)
  const withinDetectionRange = dist <= enemy.detectionRangeW && verticalDist <= enemy.detectionRangeH;

  if (enemy.aiState === "patrol") {
    enemy.x += enemy.facing * CONFIG.CHASER_PATROL_SPEED * dt;
    if (enemy.x <= enemy.patrolMinX) { enemy.x = enemy.patrolMinX; enemy.facing = 1; }
    else if (enemy.x >= enemy.patrolMaxX) { enemy.x = enemy.patrolMaxX; enemy.facing = -1; }

    if (withinDetectionRange) enemy.aiState = "chase";
    return;
  }

  if (enemy.aiState === "chase") {
    // 어그로 범위(가죽끈) 밖으로 멀어졌거나, 플레이어가 낙사 구간 너머로 건너가버렸으면(체이서는
    // 구멍을 못 건너므로) 추적을 포기하고 순찰 위치로 돌아간다.
    if (dist > enemy.leashRangeW || hasGapBetween(enemyCenterX, perceivedCenterX)) {
      enemy.aiState = "return";
      return;
    }

    const dir = perceivedCenterX < enemyCenterX ? -1 : 1;
    enemy.facing = dir;

    if (enemy.stunTimer > 0) {
      // 스턴 중에는 그 자리에 멈춰 서 있음 (사거리 안이어도 예고 진입 불가 - 계속 때리면 영원히 공격을 못 함)
    } else if (rectsOverlap(getChaserAttackHitbox(enemy), player)) {
      // 공격 판정은 거리 계산이 아니라 실제 히트박스 겹침으로 결정한다 - 그래야 발판 위처럼 거리는
      // 가까워도 실제로는 안 닿는 상황에서 헛스윙(예고)이 시작되지 않는다. player는 인식 지연과
      // 무관하게 항상 "지금 실제" 위치를 쓴다 (반응이 느린 것과 판정이 불공정한 건 별개 문제라서).
      enemy.aiState = "windup";
      enemy.attackTimer = CONFIG.CHASER_ATTACK_TELEGRAPH_DURATION;
    } else {
      enemy.x += dir * CONFIG.CHASER_CHASE_SPEED * dt;
    }
    return;
  }

  if (enemy.aiState === "windup") {
    // facing은 windup 진입 시점에 고정된 그대로 유지 - 예고 중에 플레이어가 반대쪽으로 이동해도
    // 이미 보여준 공격 범위가 갑자기 반대로 휙 바뀌면 안 되기 때문 (플레이어 입장에서 납득 가능한 판정)
    enemy.attackTimer -= dt;
    if (enemy.attackTimer <= 0) {
      const hitbox = getChaserAttackHitbox(enemy);
      if (rectsOverlap(hitbox, player)) {
        damagePlayer(CONFIG.CHASER_ATTACK_DAMAGE);
      }
      enemy.aiState = "recovery";
      enemy.attackTimer = CONFIG.CHASER_ATTACK_RECOVERY_DURATION;
    }
    return;
  }

  if (enemy.aiState === "recovery") {
    enemy.attackTimer -= dt;
    if (enemy.attackTimer <= 0) {
      enemy.aiState = dist <= enemy.leashRangeW ? "chase" : "return";
    }
    return;
  }

  if (enemy.aiState === "return") {
    // 복귀 도중에 인식 범위 안에 플레이어가 다시 들어오면 즉시 재추적한다 (어그로 범위가 아니라
    // 인식 범위 기준 - 어그로 범위로 하면 훨씬 넓어서 복귀 중에 거의 항상 재감지되어 버림).
    if (withinDetectionRange) {
      enemy.aiState = "chase";
      return;
    }

    // 순간이동하지 않고, 순찰 속도 그대로 걸어서 순찰 범위로 복귀한다.
    // 이미 순찰 범위 안이면(예: 어그로 범위 안에서 풀린 경우) 바로 순찰로 전환됨.
    if (enemy.x < enemy.patrolMinX) {
      enemy.facing = 1;
      enemy.x = Math.min(enemy.patrolMinX, enemy.x + CONFIG.CHASER_PATROL_SPEED * dt);
    } else if (enemy.x > enemy.patrolMaxX) {
      enemy.facing = -1;
      enemy.x = Math.max(enemy.patrolMaxX, enemy.x - CONFIG.CHASER_PATROL_SPEED * dt);
    }
    if (enemy.x >= enemy.patrolMinX && enemy.x <= enemy.patrolMaxX) {
      enemy.aiState = "patrol";
    }
  }
}

function updateEnemies(dt) {
  for (const enemy of enemies) {
    if (enemy.flashTimer > 0) enemy.flashTimer -= dt;
    if (!enemy.alive) continue;
    if (gameState !== "playing") continue;

    // 화면에 한 번이라도 들어온 적이 있는지 기록 (한 번 보이고 나면 이후 화면 밖으로 나가도 계속 유지).
    // 단, 봉쇄 벽 너머의 몬스터는 벽이 잠긴 동안은 화면에 보여도 "안 보인 것"으로 취급.
    if (!enemy.hasBeenVisible && isInCameraView(enemy) && !isBehindLockedGate(enemy)) {
      enemy.hasBeenVisible = true;
    }

    // 아직 한 번도 화면에 보인 적 없는 몬스터는 완전 대기 상태 - 순찰/추적/발사 전부 안 함.
    // (화면에 등장하는 순간부터 정상적으로 움직이기 시작해서, 예고 없이 갑자기 당하는 일이 없음)
    if (!enemy.hasBeenVisible) continue;

    if (enemy.type === "chaser") updateChaserAI(enemy, dt);
    else updateTurretAI(enemy, dt);
  }
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (p.x < -50 || p.x > currentZone.width + 50 || p.y < -50 || p.y > currentZone.height + 50) {
      projectiles.splice(i, 1);
      continue;
    }

    if (gameState === "playing" &&
        circleRectOverlap(p.x, p.y, p.r, player) &&
        player.invincibleTimer <= 0) {
      // unblockable: 피격 유예(pendingDamage)를 거치지 않고 즉시 HP에 반영 - anchor의 유예도,
      // drift 중 축적도 못 타므로 표류/반격으로는 절대 무효화할 수 없고 몸으로 피해야만 한다.
      // (무적 프레임은 다른 피격과 동일하게 적용됨 - applyDamageToHp가 부여)
      if (p.unblockable) applyDamageToHp(p.damage);
      else damagePlayer(p.damage);
      projectiles.splice(i, 1);
    }
  }
}
