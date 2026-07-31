"use strict";

// 원래 프로토타입의 유일한 레벨을 존 하나로 옮긴 것. 사용자의 스토리 설계상 이 레벨은 나중에
// "2층 구역 3(몬스터들)"으로 재활용될 예정이라 파일명도 그에 맞춰뒀다. 여러 존 파일이 각자 groundY 같은
// 지역 변수를 top-level const로 선언하면 클래식 <script> 태그들은 전역 렉시컬 스코프를 공유해서 파일
// 간에 이름이 충돌한다 - 그래서 존 파일은 전부 IIFE로 감싸는 걸 규칙으로 한다 (CLAUDE.md 참고).
//
// 캔버스 높이가 540->810으로 늘어나면서, 원래 y=500이던 바닥을 그대로 두면 바닥 아래로 빈 공간이
// 270px 넘게 남아 캐릭터가 "붕 뜬" 것처럼 보이는 문제가 있었다 - 그래서 모든 y좌표를 +250 만큼
// 아래로 옮겨서, 바닥(groundY+groundH)이 존 높이(height) 바로 근처(20px 여유)에 오도록 했다.
// 상대적인 지형 배치(플랫폼 간 높이차 등)는 원래와 완전히 동일 - 전부 같은 양만큼 이동했을 뿐.
//
// SPAWN_SAFE_OFFSET - 원래 첫 번째/두 번째 터렛(x=230/480)이 체크포인트(entryPoint x=40)에서 각각
// 190px/440px밖에 안 떨어져 있어서, 죽고 리스폰하는 즉시 다시 포탑 감지 범위
// (CONFIG.ENEMY_DEFAULT_DETECTION_RANGE_W=480px) 안에 서 있는 채로 시작하는 문제가 있었다 -
// 리스폰하자마자 대응할 새도 없이 다시 얻어맞기 시작함. 개별 좌표를 하나씩 눈대중으로 밀지 않고,
// 벽/바닥/게이트/적/플랫폼 전부에 이 오프셋 하나를 균일하게 더해서 레벨 내부의 상대적 배치(간격,
// 순서, 난이도 곡선)는 원래 그대로 유지한 채 "스폰 지점부터 첫 위협까지의 안전 거리"만 늘렸다.
//
// POST_GATE_SAFE_OFFSET(두 번째 체크포인트 추가하면서 신설) - "한 존에 체크포인트가 두 개 있을 때
// 정상 작동하는지 확인"하기 위해 봉쇄 벽(wallGate) 통과 직후에 체크포인트를 하나 더 두기로 함(사용자
// 요청). 문제는 봉쇄 벽 바로 뒤(원래 좌표 2040)에 이미 "벽 오른쪽 스턴 면역 수문장" 터렛이 있어서,
// 새 체크포인트를 게이트 바로 뒤에 두면 안전 거리(480px+여유)를 확보할 자리가 없었다 - 그래서
// SPAWN_SAFE_OFFSET과 같은 방식으로, 게이트보다 뒤(원래 좌표 1900 초과)인 모든 콘텐츠에 추가 오프셋을
// 한 번 더 얹어서 게이트 직후에 새 체크포인트가 들어갈 만큼 빈 공간을 만들었다 - 게이트 자체와 그
// 앞쪽(스폰 쪽) 콘텐츠는 이 오프셋의 영향을 안 받는다(SPAWN_SAFE_OFFSET만 적용). 두 오프셋을 합치면
// (x + SPAWN_SAFE_OFFSET + POST_GATE_SAFE_OFFSET) 게이트 뒤쪽 콘텐츠의 최종 좌표가 나온다.
//
// **몬스터 배치와 체크포인트 사이의 안전 거리는 이후 모든 존에서 계속 지킬 것 - 리스폰 직후 가만히
// 서 있기만 해도 어떤 몬스터의 어그로도 끌리면 안 된다. 예외는 보스전 하나뿐** - 보스방은 맵 크기
// 자체가 한정되어 있어서 보스의 어그로가 원래부터 걸려 있는 게 당연하기 때문(ROADMAP.md 참고).
(function () {
  const groundY = 750, groundH = 40;
  const doorH = 140;
  const standingTopY = groundY - player.h; // 서 있을 때 플레이어 상단 y - entryPoint/checkpoint/문 y 계산에 사용
  // 둘 다 IIFE 안에 둬야 함 - 존 파일은 전역 스코프를 공유하므로(파일 상단 주석 참고)
  const SPAWN_SAFE_OFFSET = 450;
  const POST_GATE_SAFE_OFFSET = 1050; // 게이트(원래 좌표 1900)보다 뒤인 콘텐츠에만 추가로 더해짐
  const GATE_SPLIT_X = 1900; // 이 원래 좌표보다 크면 "게이트 뒤" - POST_GATE_SAFE_OFFSET을 더 받음
  const post = (x) => x + SPAWN_SAFE_OFFSET + (x > GATE_SPLIT_X ? POST_GATE_SAFE_OFFSET : 0);

  const START_CHECKPOINT_ID = "start";
  const startPillarX = 100, pillarW = 20, pillarH = 50;
  const startPillarY = groundY - pillarH;

  // 게이트(최종 x = 1900+450 = 2350) 통과 직후의 두 번째 체크포인트. 게이트 앞의 마지막 저격수(원래
  // 1780, 최종 2230)에서 600px, 게이트 뒤 첫 터렛(원래 2040, 최종 2040+450+1050=3540)에서 640px
  // 떨어져 있어 양쪽 다 안전 거리(480px) 여유가 넉넉하다.
  const GATE_CHECKPOINT_ID = "past_gate";
  const gatePillarX = 2900, gatePillarY = groundY - pillarH;

  ZONES["f2z3_legacy_arena"] = {
    id: "f2z3_legacy_arena",
    name: "2층 구역 3 - 몬스터들 (레거시 아레나)",
    floor: 2, // 참고용 메타데이터일 뿐 - 실제 층 전환 로직은 없음 (zones.js 주석 참고)

    width: post(3840), // 캔버스 너비(1440)의 약 2.7배 - 가로 스크롤 레벨
    height: 810, // 화면 높이(H)와 동일 = 세로 스크롤 없는 존. 바닥(groundY+groundH=790)이 20px 여유로 거의 맞닿음
    groundY, groundH,

    // 바닥에 뚫어놓은 낙사 구간 (이 x 범위에는 바닥이 없음 - 떨어지면 사망)
    groundGaps: [
      { x: post(900), w: 100 },
      { x: post(2350), w: 120 },
    ],

    // 완전 고정형 플랫폼: 모든 방향에서 막힘 (아래에서 점프해도 관통 불가). 바닥(groundGaps를 뺀 나머지)은
    // loadZone()이 buildGroundSegments()로 자동으로 덧붙여주므로 여기엔 안 적는다.
    solidPlatforms: [
      { x: post(420), y: 550, w: 160, h: 20 },
      { x: post(1300), y: 570, w: 140, h: 20 },
      { x: post(1780), y: 510, w: 120, h: 20 },
      { x: post(2520), y: 670, w: 160, h: 20 },
      { x: post(3600), y: 510, w: 140, h: 20 }, // 레벨 끝자락, 높은 고정 플랫폼
    ],

    // 관통형(원웨이) 플랫폼: 위에서 떨어질 때만 착지, 아래에서 위로 점프할 땐 그냥 통과
    oneWayPlatforms: [
      { x: post(150), y: 640, w: 160, h: 20 },
      { x: post(700), y: 640, w: 160, h: 20 },
      { x: post(1050), y: 670, w: 160, h: 20 },
      { x: post(1550), y: 670, w: 160, h: 20 },
      { x: post(2000), y: 640, w: 180, h: 20 },
      { x: post(2260), y: 550, w: 150, h: 20 },
      { x: post(2760), y: 590, w: 140, h: 20 },
      { x: post(3150), y: 670, w: 180, h: 20 },
      { x: post(3400), y: 590, w: 160, h: 20 },
    ],

    // 넘을 수 없는 봉쇄 벽(게이트): 안쪽(스폰 쪽) 몬스터를 모두 처치해야 사라짐. 게이트 자신은
    // POST_GATE_SAFE_OFFSET을 안 받음(경계선 자체이므로 SPAWN_SAFE_OFFSET만).
    // 충돌 판정은 X 범위만 본다(isGateBlocking, zones.js) - 세로 위치와 무관하게 항상 막혀서 y/h가
    // 따로 필요 없음. 눈에 보이는 그림만 visualY/visualH로 따로 그림.
    wallGates: [
      { x: GATE_SPLIT_X + SPAWN_SAFE_OFFSET, w: 40, visualY: 330, visualH: 460 },
    ],

    // 존의 좌우 끝을 막는 세로 벽(레벨 디자인 관례 - 모든 존이 이 패턴을 따름). 오른쪽엔 문이 없으니
    // 그냥 끝까지 다 막고, 왼쪽은 문을 40px 안쪽으로 넣고 그 앞을 벽으로 채운다. 왼쪽 벽은 스폰 안전
    // 거리와 무관하므로 오프셋을 안 받는다 - 밀려야 하는 건 그 안쪽 콘텐츠 전체뿐.
    walls: [
      { x: 0, w: 40, gaps: [] },
      { x: post(3800), w: 40, gaps: [] },
    ],

    enemySpawns: [
      { type: "turret", x: post(230), y: 710, opts: {} },
      { type: "turret", x: post(480), y: 510, opts: {} },
      { type: "turret", x: post(760), y: 600, opts: {} },
      { type: "turret", x: post(1090), y: 630, opts: {} },
      { type: "turret", x: post(1340), y: 530, opts: {} },
      { type: "turret", x: post(1600), y: 710, opts: { stunnable: false } }, // 벽 왼쪽 스턴 면역 수문장
      { type: "sniper", x: post(1780), y: 470, opts: {} }, // 벽 안쪽 마지막 관문, 반드시 피해야 하는 투사체
      { type: "turret", x: post(2040), y: 600, opts: { stunnable: false } }, // 벽 오른쪽 스턴 면역 수문장(게이트 뒤 - POST_GATE_SAFE_OFFSET 적용)
      { type: "sniper", x: post(2260), y: 510, opts: {} }, // 벽 통과 직후
      { type: "turret", x: post(2560), y: 630, opts: {} },
      { type: "turret", x: post(3190), y: 630, opts: {} },
      { type: "turret", x: post(3630), y: 470, opts: {} },
      { type: "chaser", x: post(2200), y: 706, opts: { patrolHalfRange: 100 } }, // 바닥 순찰 - 스턴 걸림
      { type: "chaser", x: post(2700), y: 706, opts: { patrolHalfRange: 80, stunnable: false } }, // 바닥 순찰 - 스턴 면역
    ],

    // 문 앞 체크포인트 기둥(모든 존 기본 관례 - ROADMAP.md/CLAUDE.md 참고) + 게이트 통과 직후의 두
    // 번째 체크포인트(§ 파일 상단 주석 - 체크포인트 2개 정상 작동 검증용, 사용자 요청). 둘 다 "켜짐"은
    // 정적 데이터가 아니라 currentZone.checkpoints의 cp.active를 매 프레임 직접 확인해서 결정한다
    // (js/rendering.js의 drawCheckpointPillarProp) - 한쪽을 켜면 activateCheckpoint()가 다른 쪽을
    // 자동으로 꺼주므로 항상 하나만 빛난다.
    ambientProps: [
      { type: "checkpointPillar", x: startPillarX, y: startPillarY, w: pillarW, h: pillarH, checkpointId: START_CHECKPOINT_ID },
      { type: "checkpointPillar", x: gatePillarX, y: gatePillarY, w: pillarW, h: pillarH, checkpointId: GATE_CHECKPOINT_ID },
    ],

    entryPoint: { x: 40, y: standingTopY }, // 문으로 들어오거나 체크포인트가 없을 때 서는 기본 위치
    checkpoints: [
      // active 기본값은 둘 다 false - enterZone()이 더 이상 이 값을 안 건드리므로, 실제로 기둥을
      // 만지기 전까지는 이 정적 초기값이 그대로 남아있는다(f2z2_checkpoint와 동일한 이유).
      // start의 x는 기둥(startPillarX) 자신의 위치 - 예전엔 문 위치(40)를 그대로 썼는데, 그러면 이
      // 체크포인트가 활성 상태로 죽었을 때 기둥이 아니라 문 앞으로 리스폰되는 버그가 있었다(사용자
      // 피드백으로 발견). past_gate는 처음부터 gatePillarX를 썼으므로 이 버그가 없었음.
      { id: START_CHECKPOINT_ID, x: startPillarX, y: standingTopY, active: false },
      { id: GATE_CHECKPOINT_ID, x: gatePillarX, y: standingTopY, active: false },
    ],

    // 왼쪽 문은 배경일 뿐(트리거 없음 - 뒤로 못 감), 오른쪽 문은 아직 다음 존이 없어서 null.
    // 벽(0~40) 바로 뒤에 위치하도록 x=40으로 안쪽에 둠. y는 바닥에 딱 맞닿게(sunk 방지) groundY-doorH.
    doors: {
      left: { x: 40, y: groundY - doorH, w: 40, h: doorH },
      right: null,
    },

    floors: [],
    // makeCheckpointTrigger(js/engine/zones.js) - 기둥에 실제로 닿아야만 활성화된다(예외 없음, 사용자
    // 요청). 이 존은 기믹을 이미 소개받은 뒤라 둘 다 손짓 컷신 없이 조용히 activateCheckpoint만 부름.
    triggerZones: [
      makeCheckpointTrigger({
        zoneId: "f2z3_legacy_arena",
        checkpointId: START_CHECKPOINT_ID,
        x: startPillarX, y: standingTopY,
        xMin: startPillarX - 20, xMax: startPillarX + pillarW + 20,
        topY: startPillarY,
        standingTopY,
      }),
      makeCheckpointTrigger({
        zoneId: "f2z3_legacy_arena",
        checkpointId: GATE_CHECKPOINT_ID,
        x: gatePillarX, y: standingTopY,
        xMin: gatePillarX - 20, xMax: gatePillarX + pillarW + 20,
        topY: gatePillarY,
        standingTopY,
      }),
    ],
    ruleFlags: {},
  };
})();
