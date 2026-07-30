"use strict";

/* =========================================================================
   밸런스 / 튜닝 변수 - 여기서만 수정하면 게임 느낌을 바꿀 수 있습니다.
   ========================================================================= */
const CONFIG = {
  // --- 이동 ---
  MOVE_SPEED: 420,           // 좌우 이동 속도 (px/sec)
  GRAVITY: 2100,             // 중력 가속도 (px/sec^2)
  MAX_FALL_SPEED: 1400,      // 최대 낙하 속도 (px/sec)
  JUMP_FORCE: 760,           // 점프 초기 상승 속도 (px/sec)
  MAX_JUMPS: 2,              // 최대 점프 횟수 (2 = 이단 점프)
  // 낮은 점프("숏홉") - 공중 공격을 넣는 순간 현재 상승/낙하 속도와 무관하게 항상 AIR_ATTACK_HOP_FORCE로
  // 덮어써서 작은 점프 한 번을 더 만들어준다 (updatePlayer의 공격 입력 블록 참고). 막 뛴 직후라면 원래
  // 점프의 큰 상승 속도를 깎는 "캔슬"로 느껴지고, 이미 낙하 중이었다면 공중에서 다시 살짝 튀어오르는
  // "추가 점프"로 느껴짐 - 조건 분기 없이 같은 대입 한 줄로 두 상황 모두 자연스럽게 처리됨.
  // 이단 점프(MAX_JUMPS=2)와 조합하면 점프 → 이단 점프 → 공중 공격을 이어붙여 사실상 3단 점프도 가능.
  AIR_ATTACK_HOP_FORCE: 420, // 공중 공격 시 적용되는 상승 속도 (px/sec) - JUMP_FORCE(760)의 최고 높이(~137px) 대비 약 42px로 "낮은" 점프
  // 공중 공격은 attackRecovery(0.38s)가 점프 체공시간보다 훨씬 짧아서, 착지 없이 연타하면 매번
  // AIR_ATTACK_HOP_FORCE로 상승 속도가 갱신되어 사실상 계속 공중에 떠있을 수 있었다. 점프 횟수
  // (MAX_JUMPS)와 똑같은 방식으로 제한한다 - player.jumpsUsed/airAttacksUsed 둘 다 착지 시에만
  // 0으로 리셋되므로, "점프 → 이단 점프 → 공중 공격 1회"가 한 번 땅을 밟기 전까지 낼 수 있는 전부.
  MAX_AIR_ATTACKS: 1,        // 착지하기 전까지 공중 공격(=숏홉)을 쓸 수 있는 횟수

  // --- 근접 공격 ---
  // 땅/공중 판정은 모양(사각형 vs 원)과 데미지가 다르지만 활성/후딜레이 타이밍은 공유한다 (startAttack 참고).
  ATTACK_RANGE_W: 85,        // 지상 공격 판정 가로 크기
  ATTACK_RANGE_H: 75,        // 지상 공격 판정 세로 크기
  ATTACK_ACTIVE_DURATION: 0.08,  // 판정이 활성화되는 시간 (sec)
  ATTACK_RECOVERY_DURATION: 0.30, // 후딜레이 (sec, 이 동안 재공격 불가)
  ATTACK_DAMAGE: 1,          // 지상 공격 1회당 적에게 주는 데미지
  // 공중 공격(플레이어가 땅에 없을 때 좌클릭) 판정 반경. 플레이어 중심 기준 원형이라 방향 무관.
  // 지상 공격 판정(85x75)보다 훨씬 넓지는 않되, 방향 무관 원형이라 위/아래로는 여전히 지상 공격보다
  // 잘 닿음. 표류 반격의 최대 리치(~152px)보다는 확실히 작게 잡아 반격과 위계가 겹치지 않게 함.
  AIR_ATTACK_RADIUS: 85,
  // 데미지는 getAirAttackDamage()로 계산 - ATTACK_DAMAGE의 절반(0.5)을 상수로 다시 박지 않고 항상
  // 지상 공격의 절반으로 유지되도록 함수화 (getDriftCooldownOnCounter/Whiff와 같은 이유). 몬스터 HP를
  // 부풀리는 대신 반칸 단위 HP를 그대로 쓰고, 대신 체력 표시를 마름모(다이아) pip로 바꿔 반칸을
  // 시각적으로 표현한다 (draw()의 drawHpPip 참고) - 그래야 몬스터 HP가 낮게 유지되어 몇 대 때려야
  // 죽는지 한눈에 보이고, 표류 반격의 배율(DRIFT_COUNTER_DAMAGE_MULTIPLIER)도 원래 체감 그대로 유지됨.

  // --- 플레이어 ---
  PLAYER_MAX_HP: 5,
  HIT_INVINCIBILITY_DURATION: 0.5, // 피격 후 무적시간 (sec) - HP가 실제로 깎이는 순간(applyDamageToHp)부터 시작
  RESPAWN_DELAY: 1.2,        // 사망 후 리스폰까지 대기시간 (sec)
  PIT_FALL_BUFFER: 60,       // 낙사 판정 여유값 (px) - 화면 아래로 이 정도 더 떨어지면 사망 처리

  // --- 적 공통: 감지/어그로/공격 범위 ---
  // 모든 몬스터가 감지(detection) → 어그로(leash) → 공격(attack) 3단계 범위 개념을 공통으로 갖는다.
  // 각 몬스터 팩토리(makeTurret/makeSniper/makeChaser)가 아래 값들을 enemy.detectionRangeW/H,
  // enemy.leashRangeW/H, enemy.attackRangeW/H 인스턴스 필드로 박아 넣고, updateTurretAI/updateChaserAI는
  // CONFIG를 직접 보지 않고 그 인스턴스 필드를 읽는다 - 몬스터 종류별로 범위가 달라도 로직은
  // 똑같은 필드 이름으로 동작하게 하기 위함(체이서 전용이던 걸 전체로 일반화).
  //
  // leash/attack 범위는 숫자를 넣으면 그 거리만큼의 "유한" 범위가 되고, `Infinity`를 넣으면 그 비교
  // (`dist > range`)가 항상 false가 되어 사실상 "무제한"이 된다 - 새 상수나 특수 문자열 없이 JS의
  // Infinity 값 자체가 "이 몬스터는 한 번 어그로가 끌리면 절대 안 풀린다"는 뜻을 그대로 표현한다.
  // 체이서(유한 어그로, CHASER_LEASH_RANGE)와 포탑/저격수(무한 어그로 - makeStationaryRangeFields 참고)가
  // 서로 다른 값을 넣는 것만으로 완전히 다른 성격의 몬스터가 되는 게 이 설계의 핵심.
  ENEMY_DEFAULT_DETECTION_RANGE_W: 480, // 원래 화면(960x540) 절반 폭 - 포탑/저격수의 최초 감지 판정에 씀
  ENEMY_DEFAULT_DETECTION_RANGE_H: 270, // 원래 화면 절반 높이 - 가로/세로 둘 다 만족해야 감지됨
  // 원래 캔버스 크기에 고정해서 실제 카메라 뷰(W/H)가 넓어져도 같이 안 늘어나게 했다 - 그래야
  // 뷰포트를 넓혔을 때 "화면엔 보이지만 아직 어그로는 안 끌린" 몬스터가 생길 수 있음(나중에
  // 비-어그로 상태 전용 유휴 애니메이션을 넣을 계획이라 이 여백이 필요함 - updateTurretAI 참고).

  // --- 적 (포탑) ---
  TURRET_FIRE_INTERVAL: 2.2, // 포탑 발사 주기 (sec, 예고 시작부터 다음 예고 시작까지)
  TURRET_TELEGRAPH_DURATION: 0.5, // 발사 전 "예고" 시간 (sec) - 이 동안 포탑이 경고 표시를 보여줌
  TURRET_MAX_HP: 5,          // 포탑 체력 (지상 공격 5회 또는 공중 공격 10회에 파괴)
  PROJECTILE_SPEED: 260,     // 투사체 속도 (px/sec) - 낮을수록 피하기 쉬움
  PROJECTILE_RADIUS: 8,
  PROJECTILE_DAMAGE: 1,

  // --- 적 (저격수: 일반 포탑과 체력/발사 타이밍/투사체 속도·데미지는 전부 동일하게 공유하고
  //     projectile.unblockable만 다름 - 표류 유예/축적도 안 타고 반격으로 격추도 안 되는, 반드시
  //     직접 피해야 하는 투사체. makeSniper/updateTurretAI(sniper 분기)/updateProjectiles/
  //     performDriftCounterAttack 참고. 반경만 훨씬 크게 잡고 draw()에서 색도 다르게 그려서
  //     "이건 다른 놈이다"가 멀리서도 보이게 함.
  SNIPER_PROJECTILE_RADIUS: 15, // 일반 투사체(PROJECTILE_RADIUS=8)보다 훨씬 큼 - 눈에 확 띄어야 함

  // --- 카메라 ---
  CAMERA_SMOOTHING: 6,       // 클수록 카메라가 플레이어를 더 빨리 따라잡음 (지수 감쇠 계수, 프레임레이트 무관)
  CAMERA_DEADZONE_W: 160,    // 화면 정중앙 기준 가로 데드존 폭(px) - 이 안에서 움직이는 동안엔 카메라가 안 움직임
  CAMERA_DEADZONE_H: 140,    // 세로 데드존 높이(px) - 가로와 같은 개념, 존 높이가 화면보다 큰 경우(예: 세로로 긴 존)에만 실질적으로 작동함

  // --- 적 (추적형 근접 몬스터: 체이서) ---
  CHASER_MAX_HP: 3,          // 지상 공격 3회 또는 공중 공격 6회에 처치
  CHASER_PATROL_SPEED: 90,   // 평상시 좌우 순찰 속도 (px/sec) - 아그로가 풀려 순찰 위치로 복귀할 때도 이 속도로 걸어감
  CHASER_CHASE_SPEED: 260,   // 플레이어를 인식하고 쫓아갈 때 속도 (px/sec)

  // 체이서의 "범위" 세 가지는 서로 다른 목적이라 명확히 분리되어 있다 (makeChaser가 아래 값들을
  // enemy.detectionRangeW/H, leashRangeW/H, attackRangeW/H로 복사해 넣고, updateChaserAI는 그 인스턴스
  // 필드를 읽는다 - 위 "적 공통" 섹션 참고):
  //  1) 인식 범위 (detectionRangeW/H) - patrol/return 상태에서 플레이어를 처음 발견하고
  //     추적(chase)을 "시작"하는 거리.
  //  2) 어그로 범위 (leashRangeW, 세로는 없음 - 원래부터 가로 거리만 봄) - 이미 추적 중일 때, 이 거리보다
  //     멀어지면 추적을 "포기"하는 거리. 인식 범위보다 넉넉히 커야 한다 - 안 그러면 딱 경계선에서
  //     왔다갔다하며 계속 추적 시작/포기를 반복하는 플리커링이 생긴다.
  //  3) 공격 판정 - 더 이상 단순 거리 비교가 아니라, 실제 공격 히트박스(getChaserAttackHitbox)가
  //     플레이어 히트박스와 조금이라도 겹치는지로 판단한다 (attackRangeW/H는 그 히트박스의
  //     "크기"만 정의함). 그래서 예를 들어 플레이어가 체이서 머리 위 발판에 서 있어서 거리는
  //     가까워도 실제로는 안 닿는 상황이면 공격이 시작되지 않는다.
  CHASER_DETECTION_RANGE: 480,          // 인식 범위 (가로, px)
  CHASER_DETECTION_VERTICAL_RANGE: 130, // 인식 범위 (세로, px) - 이 정도 높이 차이까지는 발견함
  CHASER_LEASH_RANGE: 650,              // 어그로 범위 - 추적 중 이 거리보다 멀어지면 포기
  CHASER_ATTACK_RANGE_W: 130, // 근접 공격 히트박스 가로 크기
  CHASER_ATTACK_RANGE_H: 130, // 근접 공격 히트박스 세로 크기
  CHASER_ATTACK_TELEGRAPH_DURATION: 0.65, // 공격 전 선딜레이 (sec) - 플레이어 공격보다 길게 잡아서 눈으로 보고 피할 여유를 줌
  CHASER_ATTACK_RECOVERY_DURATION: 0.6,  // 공격 후딜레이 (sec)
  CHASER_ATTACK_DAMAGE: 2,
  CHASER_STUN_DURATION: 0.5, // 근접 공격에 맞아 스턴되면 이 시간 동안은 사거리 안이어도 재공격(예고) 진입 불가
  // 체이서는 매 프레임이 아니라 이 주기(sec)마다 한 번씩만 플레이어의 실제 위치를 다시 확인하고,
  // 그 사이엔 마지막으로 확인한 위치를 그대로 쓴다 - "낮은 fps로 세상을 보는" 것처럼 반응이 뚝뚝 끊겨서
  // 느리게 느껴지게 하는 연출. (플레이어별 인스턴스 필드 perceptionTimer/perceivedPlayerX/Y로 관리 - makeChaser 참고)
  // 실제 공격 명중 판정만큼은 항상 지금 이 순간의 진짜 플레이어 위치로 하므로 이 주기와 무관하게 공정하다.
  CHASER_PERCEPTION_INTERVAL: 0.1,

  // --- 유령 NPC (순수 시각효과, 아무 판정에도 관여 안 함) ---
  // 플레이어가 마지막으로 이동한 방향의 반대쪽에서 살짝 거리를 두고 따라다니는 잔상 NPC.
  // (updateGhostNpc 참고 - 목표 위치를 지수 감쇠로 부드럽게 쫓아가서 순간이동처럼 보이지 않음)
  GHOST_NPC_FOLLOW_OFFSET: 40,     // 평소 유지하려는 플레이어와의 가로 거리 (px, 중심 기준)
  GHOST_NPC_FOLLOW_SMOOTHING: 10,  // 클수록 목표 위치를 더 빨리 쫓아감 (카메라 추적과 같은 지수 감쇠 계수)

  // --- 플레이어 표류(drift) 상태 ---
  // 마우스 우클릭 한 번으로 발동. 홀드/재입력 불필요 - 고정 시간 후 자동 종료 + 자동 반격.
  DRIFT_DAMAGE_GRACE_PERIOD: 0.5, // anchor 상태에서 맞았을 때, 실제로 HP가 깎이기까지 주는 유예시간 (sec). 이 안에 표류를 발동하면 취소되고 반격으로 축적됨
  DRIFT_DURATION: 0.4,             // 표류 지속시간 (sec) - 발동 시점부터 이 시간이 지나면 자동 종료
  // 표류 자체는 무적을 안 준다 (표류 중에도 damagePlayer()가 정상 통과해서 pendingDamage에 계속 쌓여야 하기 때문).
  // 무적은 표류가 끝나는 순간(finishDrift)에만 HIT_INVINCIBILITY_DURATION만큼 부여되어, 일반 피격 후와 동일한 길이의
  // "이벤트 직후 유예"를 준다.
  //
  // 표류 재발동 쿨타임은 상수로 안 박아두고 아래 두 값으로 "계산"한다 (getDriftCooldownOnCounter/Whiff 참고):
  // 반격 성공 쿨타임 = HIT_INVINCIBILITY_DURATION + DRIFT_DAMAGE_GRACE_PERIOD + 이 여유값보다 항상 유의미하게 길어야
  // 한다 - 안 그러면 "반격 후 무적+유예가 끝나기도 전에 벌써 표류를 또 쓸 수 있는" 상황이 생겨서 쿨타임 페널티가
  // 무의미해진다. HIT_INVINCIBILITY_DURATION이나 DRIFT_DAMAGE_GRACE_PERIOD를 나중에 바꿔도 이 관계가 자동으로 유지됨.
  DRIFT_COOLDOWN_COUNTER_MARGIN: 0.4,
  // 자해(반격 실패) 쿨타임 = 위 반격 성공 쿨타임 + 이 여유값. "성공하면 확실히 이득"이 항상 유지되도록,
  // 둘 사이에 유의미한 차이를 강제하기 위해 고정값이 아니라 성공 쿨타임에 얹는 식으로 계산한다.
  DRIFT_COOLDOWN_WHIFF_EXTRA: 0.8,
  DRIFT_ATTACK_RANGE_W: 230,       // 표류 종료 시 자동 발동되는 반격 판정 가로 크기 (평소 근접 공격보다 큼, 플레이어 중심 기준)
  DRIFT_ATTACK_RANGE_H: 200,       // 표류 종료 시 자동 발동되는 반격 판정 세로 크기
  DRIFT_COUNTER_DAMAGE_MULTIPLIER: 2, // 반격 1타(축적 피해)와 2타(투사체 흡수) 모두 이 배율만큼 세게 나감
  DRIFT_EMPTY_SELF_DAMAGE: 1,      // 표류 중 아무 피해도 축적하지 못한 채 종료되면 대신 플레이어가 입는 데미지
  // 반격 판정을 화면에 보여주는 시각효과 지속시간 (sec). 타임스톱과 달리 실시간으로 흐른다(loop() 참고).
  // 일부러 HITSTOP_DOUBLE_HIT_GAP보다 짧게 잡아서, 2타로 이어지는 경우 1타의 번쩍임이 완전히
  // 사라진 뒤에 2타(다른 색)가 다시 번쩍이는 "번쩍-암전-번쩍" 리듬이 나오게 한다 (showDriftBurst 참고).
  DRIFT_BURST_VISUAL_DURATION: 0.12,

  // --- 타임스톱(히트스톱) --- 이 시간 동안은 게임 전체가 완전히 멈춤(update 자체를 안 돌림).
  // player.invincibleTimer도 타임스톱 중엔 같이 멈춰있다가
  // 타임스톱이 끝나고 다시 게임이 돌아가는 시점부터 정상적으로 줄어들기 시작한다 - 즉 이미 있던 무적시간 로직은
  // 그대로 유지되고, 타임스톱이 끝난 직후부터 온전한 길이만큼 무적이 보장된다.
  // 실제로 HP가 깎이는 순간(자해 포함)과 표류 반격이 발동되는 순간(몬스터 명중 여부 무관) 둘 다
  // 같은 길이로 타임스톱이 걸린다. 화면 틴트 색만 원인(damage/counter)에 따라 다르게 표시됨.
  HITSTOP_DURATION: 0.3,
  // 반격이 투사체를 격추해 2타로 이어질 때, 1타와 2타 사이에 끼워넣는 짧은 정지 (sec).
  // DRIFT_BURST_VISUAL_DURATION보다 넉넉히 길게 잡아서, 1타 이펙트가 다 사라지고 나서도
  // 잠깐의 "정적"이 있은 뒤에 2타가 터지게 한다 - 이 정적이 있어야 두 타격이 분리되어 보인다.
  // 이 동안에도 게임은 완전히 멈춰있고, 이 시간이 끝나는 순간 2타가 발동한 뒤 HITSTOP_DURATION으로 마무리된다.
  HITSTOP_DOUBLE_HIT_GAP: 0.66,
};
