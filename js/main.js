"use strict";

/* =========================================================================
   게임 개요 - 처음 이 코드를 보는 사람을 위한 지도.
   =========================================================================

   장르: 가로 스크롤 2D 액션 플랫포머. 좌우 이동 + 이단 점프로 지형을 넘으며
   포탑/추적 몬스터를 처치하고 봉쇄 벽을 넘어 존 끝까지 가는 것이 목표.

   조작 (전부 js/engine/input.js의 WATCHED_KEYS / mousedown 리스너 참고):
     - A / D          : 좌우 이동
     - W 또는 Space    : 점프 (이단 점프 가능, 혼용해서 눌러도 됨)
     - 마우스 좌클릭    : 근접 공격 - 땅에 있으면 마우스 커서 방향의 좁은 사각 판정, 공중이면 방향
                         무관 원형 판정(AIR_ATTACK_RADIUS, 데미지는 지상의 절반 - startAttack 참고).
                         공중 공격은 상승 속도를 AIR_ATTACK_HOP_FORCE로 덮어써 작은 "숏홉"을 겸함 -
                         이단 점프와 이어붙이면 사실상 3단 점프. 단 착지 전까지 MAX_AIR_ATTACKS(1)번만
                         가능 - 안 그러면 공격 후딜레이가 짧아서 연타로 계속 공중에 떠있을 수 있음
     - 마우스 우클릭    : 표류(drift) 발동
     - 마우스 커서      : player.facing(근접 공격 방향)을 매 프레임 결정 - 이동 방향과 무관.
                         단, 표류 반격은 방향 무관(플레이어 중심 광역 판정)이라 이 값의 영향을 안 받음

   핵심 전투 시스템 3개가 서로 맞물려 있음(js/entities/player.js):

   1) 피격 유예 (anchor 상태, DRIFT_DAMAGE_GRACE_PERIOD)
      맞아도 즉시 HP가 깎이지 않고 player.pendingDamage에 { amount, timer }로 잠깐 대기한다.
      화면이 붉게 깜빡이는 동안(유예 중) 반응해서 표류를 쓰면 그 피해가 반격으로 전환되고,
      아무것도 안 하면 유예가 끝나는 순간 HP에 확정 반영된다. (damagePlayer/applyDamageToHp 참고)

   2) 표류(drift) - "안 맞은 척 버티다가 반격하는" 상태
      우클릭 한 번으로 DRIFT_DURATION 동안 진입. 표류 중엔 무적이 아니라 계속 맞을 수 있지만,
      맞은 피해가 HP로 안 가고 전부 pendingDamage에 쌓이기만 한다. 표류가 끝나는 순간(finishDrift):
        - 쌓인 피해가 있으면 그 총합 * DRIFT_COUNTER_DAMAGE_MULTIPLIER로 넓은 범위 반격 (performDriftCounterAttack)
        - 하나도 못 쌓았으면 대신 DRIFT_EMPTY_SELF_DAMAGE만큼 자해
      반격 범위 안의 투사체는 격추되고, 격추한 투사체들의 데미지 총합만큼 "2타"가 짧은 텀을 두고
      한 번 더 들어간다 (반격 2연타 연출 - 아래 3번 타임스톱과 얽혀 있음).
      반격 성공 여부에 따라 다음 표류까지의 쿨타임이 달라진다(성공=COUNTER, 실패=WHIFF).

   3) 타임스톱(히트스톱) - 실제로 피해를 입거나 반격이 터지는 "임팩트 있는 순간" 전체를 잠깐 정지
      loop()에서 timeStopTimer > 0인 동안은 update() 자체를 통째로 건너뛴다 - 플레이어/적/투사체/
      무적시간/쿨타임 등 게임 로직 전부가 그 프레임엔 얼어붙는다 (화면은 계속 그려서 정지 프레임처럼 보임).
      이 정지 덕분에 반격 2타 연출(1타 -> 짧은 정지 -> 2타 -> 정식 길이 정지 -> 재개, triggerTimeStop의
      onComplete 체이닝)이 가능하고, 무적시간도 정지 중엔 같이 멈췄다가 풀리는 순간부터 온전히 흐른다.
      단, 반격 이펙트(driftBurst)의 페이드만큼은 정지 중에도 실시간으로 흘러야 두 번 때린 게 눈에
      보이므로 tickDriftBurst()만 따로 매 프레임 호출된다 (updateDrift가 아니라 loop()에서).

   존/컷신 (js/engine/zones.js, js/engine/cutscene.js):
      월드는 더 이상 하나로 이어진 연속 공간이 아니라 "존" 단위 그래프다. gameState가 "cutscene"이면
      updatePlayer()가 아예 호출되지 않아 조작이 막힌다 - 트리거 존이 재생하는 이벤트 시퀀스(대화/카메라
      홀드/애니메이션/페이드)가 끝나면(endSequence) 자동으로 "playing"으로 돌아간다.

   파일 구성 (전부 전역 스코프를 공유하는 클래식 <script> - 번들러 없음):
     js/config.js                    CONFIG
     js/engine/dom.js                canvas/ctx/W/H, clamp/rectsOverlap/circleRectOverlap
     js/engine/input.js              heldKeys/justPressed, 이벤트 리스너
     js/engine/timestop.js           timeStopTimer, triggerTimeStop
     js/engine/camera.js             camera, updateCamera, cameraOverrideTarget
     js/entities/enemies.js          적 팩토리/AI, enemies[], projectiles[]
     js/entities/player.js           player, ghostNpc, gameState, 표류 시스템, respawnPlayer
     js/engine/zones.js              ZONES, currentZone, loadZone(), 규칙 플래그
     js/engine/checkpoint.js         currentCheckpoint, activateCheckpoint()
     js/engine/cutscene.js           트리거 시퀀스 엔진, 텍스트박스, 페이드
     js/rendering.js                 draw(), updateHud()
     js/levels/*.js                  존 데이터 (ZONES에 등록) - zones.js 다음에 로드되어야 함
     js/main.js                      이 파일 - update()/loop()/부트스트랩, 반드시 맨 마지막에 로드
   ========================================================================= */

const BOOT_ZONE_ID = "f1z1_entry"; // 실제 게임 시작 지점 (1층 구역 1). f2z3_legacy_arena는 2층 구역 3으로 재활용 예정 - 아직 어디서도 연결 안 됨.

function update(dt) {
  if (gameState === "respawning") {
    respawnTimer -= dt;
    updateProjectiles(dt); // 날아가던 투사체는 계속 정리되게
    if (respawnTimer <= 0) respawnPlayer();
  } else if (gameState === "cutscene") {
    updateSequence(dt);
    updateProjectiles(dt);
  } else {
    updatePlayer(dt);
    updateGhostNpc(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    scanTriggerZones();
  }

  updateCamera(dt);

  // justPressed 소비 완료 -> 프레임 끝에서 초기화
  for (const k in justPressed) delete justPressed[k];
}

/* --------------------------- 메인 루프 --------------------------- */
let lastTime = performance.now();

function loop(now) {
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  dt = Math.min(dt, 0.033); // 탭 전환 등으로 인한 프레임 급증 방지

  if (timeStopTimer > 0) {
    // update() 자체를 건너뛴다 - 플레이어/적/투사체/무적시간 등 모든 타이머가 이 프레임엔 그대로 정지.
    // 화면은 계속 그려서(draw) "멈춘 순간"이 화면에 정지 프레임으로 보이게 한다.
    timeStopTimer = Math.max(0, timeStopTimer - dt);
    if (timeStopTimer <= 0) {
      timeStopReason = null;
      // 타임스톱 도중 눌렸던 키가 지금도 눌려있으면 지금 막 누른 것으로 쳐서 이번 프레임에 바로 반영.
      // 이미 떼버린 키는 pendingKeyAfterFreeze에 남아있어도 heldKeys가 false라 무시됨.
      for (const code in pendingKeyAfterFreeze) {
        if (heldKeys[code]) justPressed[code] = true;
        delete pendingKeyAfterFreeze[code];
      }
      // 이 프리즈 구간에 이어붙일 다음 동작(예: 반격 2타)이 있으면 실행 - 그 안에서 triggerTimeStop을
      // 다시 호출하면 화면이 안 풀리고 바로 다음 프리즈 구간으로 넘어간다.
      const onComplete = timeStopOnComplete;
      timeStopOnComplete = null;
      if (onComplete) onComplete();
    }
  } else {
    update(dt);
  }
  tickDriftBurst(dt); // 타임스톱 여부와 무관하게 항상 실시간으로 흐름 (이유는 tickDriftBurst 주석 참고)
  draw();

  requestAnimationFrame(loop);
}

/* --------------------------- 부트스트랩 --------------------------- */
const bootZone = ZONES[BOOT_ZONE_ID];
currentCheckpoint = { zoneId: BOOT_ZONE_ID, x: bootZone.entryPoint.x, y: bootZone.entryPoint.y };
loadZone(BOOT_ZONE_ID, bootZone.entryPoint);

requestAnimationFrame(loop);
