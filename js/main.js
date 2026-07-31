"use strict";

/* =========================================================================
   게임 개요 - 처음 이 코드를 보는 사람을 위한 지도.
   =========================================================================

   장르: 가로 스크롤 2D 액션 플랫포머. 좌우 이동 + 이단 점프로 지형을 넘으며
   포탑/추적 몬스터를 처치하고 봉쇄 벽을 넘어 존 끝까지 가는 것이 목표.

   조작 (전부 js/engine/input.js의 WATCHED_KEYS / mousedown 리스너 참고):
     - A / D          : 좌우 이동
     - Space          : 점프 (이단 점프 가능). W는 더 이상 점프 키가 아님(과거 세션에 제거됨) -
                        지금은 QA 패널이 열려있을 때만 W/S가 위/아래 탐색으로 재사용됨(js/engine/pausemenu.js)
     - 마우스 좌클릭    : 근접 공격 - 땅에 있으면 마우스 커서 방향의 좁은 사각 판정, 공중이면 방향
                         무관 원형 판정(AIR_ATTACK_RADIUS, 데미지는 지상의 절반 - startAttack 참고).
                         공중 공격은 상승 속도를 AIR_ATTACK_HOP_FORCE로 덮어써 작은 "숏홉"을 겸함 -
                         이단 점프와 이어붙이면 사실상 3단 점프. 단 착지 전까지 MAX_AIR_ATTACKS(1)번만
                         가능 - 안 그러면 공격 후딜레이가 짧아서 연타로 계속 공중에 떠있을 수 있음
     - 마우스 우클릭    : 표류(drift) 발동
     - 마우스 커서      : player.facing(근접 공격 방향)을 매 프레임 결정 - 이동 방향과 무관.
                         단, 표류 반격은 방향 무관(플레이어 중심 광역 판정)이라 이 값의 영향을 안 받음
     - ` (백틱) / Esc   : 문맥에 따라 다름(js/engine/pausemenu.js가 라우팅) - 실제 플레이 중이면
                         일시정지 메뉴(재개/메인 화면/구역 선택), 메인 메뉴가 보이는 중이면 QA
                         패널(구역 이동, js/engine/qapanel.js)을 바로 엶. QA 패널 안에서는 W/S로
                         존을 고르고 Space로 확정 가능. QA/개발용이자 향후 게임 클리어 보상 기능으로도
                         그대로 쓸 예정이라 제대로 만들어져 있음

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
     js/engine/qapanel.js            QA 패널(구역 이동) - qaPanelOpen, warpToZone()
     js/engine/mainmenu.js           메인 메뉴("게임 시작"/"구역 선택") - 진짜 부트스트랩 진입점
     js/engine/pausemenu.js          일시정지 메뉴(재개/메인 화면/구역 선택) + 백틱/Esc/W/S/Space 통합 라우터
     js/rendering.js                 draw(), updateHud()
     js/levels/*.js                  존 데이터 (ZONES에 등록) - zones.js 다음에 로드되어야 함
     js/main.js                      이 파일 - update()/loop()/부트스트랩, 반드시 맨 마지막에 로드
   ========================================================================= */

const BOOT_ZONE_ID = "f1z1_entry"; // "게임 시작" 버튼(mainmenu.js)이 여는 실제 게임 시작 지점 (1층 구역 1).

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
    checkAllEnemiesDeadTrigger();
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
  // 절대 음수가 되면 안 됨 - ensureLoopStarted()가 lastTime을 (rAF 콜백 밖인) keydown 핸들러 안에서
  // performance.now()로 잡아두는데, 브라우저가 그 다음 rAF 콜백에 넘기는 now는 "이번 프레임이 실제로
  // 시작된 시각" 기준이라 그 직후 잡은 lastTime보다 미세하게 더 이른 값일 수 있다(스펙상 정상적인
  // 오차 - 실제로 최초 부팅 직후 첫 프레임에서 dt가 음수로 관측된 적이 있음). 이 dt가 음수인 채로
  // player.y += vy*dt에 그대로 쓰이면 부호가 뒤집혀서 "위로 점프"가 "아래로 이동"이 되어버리고, 마침
  // 점프 직후라 그 한 프레임의 이동량이 땅(groundH)보다 커서 바닥을 그대로 뚫고 아래로 떨어져 낙사하는
  // 버그로 실제 재현됨(최초 부팅 직후 Space로 "게임 시작"을 확정한 경우에만 등장 - js/engine/input.js의
  // handlePress 수정과 세트로, 둘 중 하나만 고쳐도 이 특정 재현 경로는 막히지만 안전을 위해 둘 다 고침).
  dt = Math.max(0, Math.min(dt, 0.033)); // 위 음수 방지 + 탭 전환 등으로 인한 프레임 급증 방지

  if (qaPanelOpen || pauseMenuOpen || mainMenuOpen || confirmDialogOpen) {
    // QA 패널/일시정지 메뉴/메인 메뉴/확인 대화상자 중 하나라도 열려있는 동안은 게임 전체를 멈춘다
    // (타임스톱과 같은 원리) - 그 화면을 보는 동안 몬스터가 움직이거나 쿨다운/유예시간이 흘러가면 안
    // 되기 때문(메인 메뉴는 일시정지에서 되돌아온 경우에만 실질적 의미가 있음 - 최초 부트스트랩 때는
    // 애초에 루프 자체가 아직 안 돌고 있어서 이 분기까지 오지 않음). update() 자체를 안 부르지만 그
    // 함수 마지막 줄이 하던 justPressed 비우기는 여기서도 그대로 해줘야 한다 - 안 그러면 이 화면들이
    // 열려있던 동안 눌린 키(Space 등)가 화면을 닫는 순간 "막 눌린 것"으로 오인돼 의도치 않은 입력
    // (점프 등)으로 튀어나온다.
    for (const k in justPressed) delete justPressed[k];
  } else if (timeStopTimer > 0) {
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
// 예전엔 여기서 곧바로 BOOT_ZONE_ID를 불러와 루프를 시작했지만, 이제 진짜 시작 지점은 메인
// 메뉴(js/engine/mainmenu.js)의 "게임 시작"/"구역 선택" 버튼이다 - 그 버튼들이 (직접 또는 QA
// 패널을 통해) warpToZone()을 호출하고, warpToZone()이 아직 루프가 안 도는 상태면 아래
// ensureLoopStarted()로 그제서야 루프를 시작시킨다. 그래서 부트스트랩은 그 지연 시작 스위치만
// 정의해두고 끝 - 사용자가 버튼을 누르기 전까지는 currentZone이 null인 채로 loop() 자체가 한
// 번도 안 돌아서 canvas엔 아무 것도 안 그려지고, 메인 메뉴 DOM만 보인다.
let gameStarted = false;
function ensureLoopStarted() {
  if (gameStarted) return;
  gameStarted = true;
  lastTime = performance.now(); // 메뉴 화면에 머문 시간이 첫 프레임의 dt로 새어들어가지 않게 시작 시점을 다시 잡음
  requestAnimationFrame(loop);
}
