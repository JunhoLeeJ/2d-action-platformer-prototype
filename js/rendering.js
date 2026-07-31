"use strict";

/* --------------------------- 렌더링 --------------------------- */

function drawRect(r, color) {
  ctx.fillStyle = color;
  ctx.fillRect(r.x, r.y, r.w, r.h);
}

// 몬스터 체력 pip 1칸 - 마름모(다이아) 모양. fillRatio(0~1)만큼 왼쪽부터 채워서 반칸 체력(0.5)을
// 표현한다. 몬스터 HP를 부풀리지 않고도(ATTACK_DAMAGE=1, 공중 공격=0.5) 체력을 정확히 보여주기 위한
// 용도 - enemy.hp가 정수+0.5 단위로만 줄어드므로 fillRatio는 항상 0/0.5/1 중 하나만 나온다.
function drawHpPip(cx, cy, size, fillRatio) {
  const half = size / 2;
  function diamondPath() {
    ctx.beginPath();
    ctx.moveTo(cx, cy - half);
    ctx.lineTo(cx + half, cy);
    ctx.lineTo(cx, cy + half);
    ctx.lineTo(cx - half, cy);
    ctx.closePath();
  }
  diamondPath();
  ctx.fillStyle = "rgba(0,0,0,0.4)"; // 빈 칸 배경
  ctx.fill();
  if (fillRatio > 0) {
    ctx.save();
    diamondPath();
    ctx.clip();
    ctx.fillStyle = "#ffd54f";
    ctx.fillRect(cx - half, cy - half, size * fillRatio, size); // 왼쪽부터 fillRatio만큼만 채움(클립으로 다이아 모양 유지)
    ctx.restore();
  }
  diamondPath();
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

// 유령 NPC 렌더링 - 함수로 분리한 이유는 draw()에서 플레이어와 겹칠 때만 호출 순서를
// 바꿔서(플레이어보다 나중에 그려서 위에 보이게) 써야 하기 때문.
function drawGhostNpc() {
  const ghostW = player.w * 0.5, ghostH = player.h * 0.5;
  const ghostDrawX = ghostNpc.x + (player.w - ghostW) / 2; // 가로 중심 정렬
  const ghostDrawY = ghostNpc.y + (player.h - ghostH);     // 바닥(발) 위치 정렬
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = "#b39ddb";
  ctx.fillRect(ghostDrawX, ghostDrawY, ghostW, ghostH);
  // 눈 - 지금 실제로 이동 중인 방향을 가리킴 (플레이어 눈과 같은 스타일, 크기만 절반)
  ctx.fillStyle = "#4a148c";
  const eyeSize = 3;
  const eyeX = ghostNpc.facing === 1 ? ghostDrawX + ghostW - eyeSize - 1 : ghostDrawX + 1;
  ctx.fillRect(eyeX, ghostDrawY + 4, eyeSize, eyeSize);
  ctx.globalAlpha = 1;
}

// 문 - 플레이스홀더 사각형. 왼쪽 문은 배경일 뿐(트리거 없음), 오른쪽 문은 다음 존으로 넘어가는
// 트리거(zones.js의 makeDoorTrigger)를 갖는다. 어느 쪽이든 렌더링은 똑같음.
function drawDoor(door) {
  drawRect(door, "#4e342e");
  ctx.strokeStyle = "#8d6e63";
  ctx.lineWidth = 3;
  ctx.strokeRect(door.x + 3, door.y + 3, door.w - 6, door.h - 6);
  // door.crackWhen(선택) - 로드 시점이 아니라 매 프레임 그릴 때 평가되는 조건 함수(1층 구역 1 재진입
  // 처리 작업에서 추가). 문 자체는 zone def에 고정 데이터로 있지만 "균열이 보이는지"는 세션 진행 상태
  // (구역 5 즉사 트리거를 이미 겪었는지)에 달려있어서, ambientProps/triggerZones처럼 로드 시점 함수로도
  // 안 되고(문은 currentZone.doors에 그대로 남아있는 정적 객체라 재평가 시점이 없음) 그릴 때마다 직접
  // 확인해야 한다.
  if (door.crackWhen && door.crackWhen()) drawDoorCrack(door);
}

// 문에 남은 "새 균열" - 1층 구역 5의 즉사 트리거를 겪고 구역 1로 돌아왔을 때 나타나는 흔적(정체는
// crackMark와 같은 플레이스홀더). 도형(꺾인 선) 몇 개만으로 표현 - 별도 이미지 에셋 없음(§ 5 아트 제약).
function drawDoorCrack(door) {
  const cx = door.x + door.w / 2, topY = door.y + 6, botY = door.y + door.h - 6;
  ctx.save();
  ctx.strokeStyle = "#bdeeff";
  ctx.lineWidth = 2;
  ctx.shadowColor = "#7fd3ff";
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.moveTo(cx, topY);
  ctx.lineTo(cx - 5, topY + (botY - topY) * 0.35);
  ctx.lineTo(cx + 4, topY + (botY - topY) * 0.6);
  ctx.lineTo(cx - 3, botY);
  ctx.stroke();
  ctx.restore();
}

// 배경 장식 - 순수 연출, enemies[]에 없고 어떤 판정에도 관여 안 함(js/entities/enemies.js 상단 주석
// 참고). 지금은 mimeB(웅얼거림) 하나뿐이라 타입 분기 없이 바로 그림 - 몸통 색이 옅게 밝아졌다
// 어두워지는 pulse만 있음(§ 5 아트 제약: 시각적 동작 없음). 포탑 예고 pulse와 같은 패턴으로 저장
// 상태 없이 performance.now()에서 바로 유도하고, prop.x를 위상 오프셋에 섞어 여러 개가 있어도
// 서로 안 겹치게 함(enemy.id 대신 - ambientProps는 enemies[]가 아니라 id 개념이 없음).
function drawMimeBProp(prop) {
  const dimColor = "#5b6470", brightColor = "#aeb8c4";
  const pulse = (Math.sin(performance.now() / CONFIG.MIME_B_PULSE_SPEED + prop.x) + 1) / 2;
  drawRect(prop, pulse > 0.5 ? brightColor : dimColor);
}

// 1층 구역 5(치명상 씬) 전용 배경 장식 두 개 - 둘 다 mimeB처럼 순수 연출, enemies[]/전투 판정과 무관.
//
// reachingEntity - "손 뻗은 형체"(§ 5 아트 제약): 몸통 사각형 + 팔이 반복 없이 한 방향(왼쪽, 다가오는
// 플레이어 쪽)으로 뻗은 채 고정된 정지 자세. mimeA(팔 흔들기)와 달리 애니메이션 자체가 없음 - 저장
// 상태도 필요 없어 인자로 받은 좌표만으로 매번 같은 모양을 그린다.
function drawReachingEntityProp(prop) {
  drawRect(prop, "#3a2e35");
  const armLen = prop.w * 1.6, armThick = 7;
  ctx.fillStyle = "#3a2e35";
  ctx.fillRect(prop.x - armLen, prop.y + prop.h * 0.35 - armThick / 2, armLen, armThick);
}

// fragmentObject - reachingEntity가 뻗은 손이 향하는 조각(정체는 아직 스펙에 없음, 플레이스홀더).
// 시각적 동작은 규정돼 있지 않아 mimeB와 같은 pulse 패턴만 아주 옅게 얹어 "주목할 물건"이라는 것만
// 표시한다 - prop.x를 위상에 섞어 향후 여러 개가 있어도 서로 안 겹치게(§ 6 ROADMAP 패턴 재사용).
// crackMark - 1층 구역 5(치명상 씬)를 재방문했을 때 reachingEntity/fragmentObject 대신 남는 흔적
// (§ ROADMAP.md "1층 구역 1 재진입 처리"). drawDoorCrack과 같은 "꺾인 선" 모양을 재사용하되 땅에 남은
// 자국이라는 느낌을 주려고 여러 갈래로 더 넓게 그린다 - 애니메이션 없는 정지 자국(reachingEntity와
// 같은 이유로 저장 상태 불필요).
function drawCrackMarkProp(prop) {
  const cx = prop.x + prop.w / 2, topY = prop.y, botY = prop.y + prop.h;
  ctx.save();
  ctx.strokeStyle = "#7fd3ff";
  ctx.lineWidth = 2;
  ctx.shadowColor = "#7fd3ff";
  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.moveTo(cx, topY);
  ctx.lineTo(cx - prop.w * 0.3, topY + prop.h * 0.4);
  ctx.lineTo(cx + prop.w * 0.25, topY + prop.h * 0.65);
  ctx.lineTo(cx, botY);
  ctx.moveTo(cx - prop.w * 0.3, topY + prop.h * 0.4);
  ctx.lineTo(cx - prop.w * 0.5, topY + prop.h * 0.8);
  ctx.stroke();
  ctx.restore();
}

function drawFragmentObjectProp(prop) {
  const cx = prop.x + prop.w / 2, cy = prop.y + prop.h / 2;
  const pulse = (Math.sin(performance.now() / 500 + prop.x) + 1) / 2;
  ctx.save();
  ctx.shadowColor = "#7fd3ff";
  ctx.shadowBlur = 6 + pulse * 6;
  ctx.fillStyle = "#bdeeff";
  ctx.beginPath();
  ctx.moveTo(cx, cy - prop.h / 2);
  ctx.lineTo(cx + prop.w / 2, cy);
  ctx.lineTo(cx, cy + prop.h / 2);
  ctx.lineTo(cx - prop.w / 2, cy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// driftAbsorb - crackMark 흡수 애니메이션(cutscene.js의 "driftAbsorb" 이벤트가 driftAbsorbAnim을
// 매 프레임 갱신, 여기서는 그리기만 함). fragmentObject와 같은 다이아몬드 반짝이 모양을 재사용하되,
// 시작 위치에서 플레이어 중심까지 서서히 빨려들어가듯 이동하며 작아지고 옅어진다 - "[V] 표류를
// 받아들인다" 텍스트 프롬프트 대신 시각적으로 표류 해금을 표현해달라는 사용자 피드백으로 추가됨
// (1층 구역 1 재진입 처리). 월드 좌표계라 draw()의 카메라 translate 블록 안에서 호출해야 한다.
function drawDriftAbsorb() {
  if (!driftAbsorbAnim) return;
  const t = clamp(driftAbsorbAnim.elapsed / driftAbsorbAnim.duration, 0, 1);
  const eased = t * t; // 처음엔 천천히, 끝에 가까워질수록 빠르게 빨려들어가는 느낌
  const targetX = player.x + player.w / 2, targetY = player.y + player.h / 2;
  const cx = driftAbsorbAnim.x + (targetX - driftAbsorbAnim.x) * eased;
  const cy = driftAbsorbAnim.y + (targetY - driftAbsorbAnim.y) * eased;
  const size = 20 * (1 - eased * 0.8); // 다가갈수록 작아짐(완전히 0으로 사라지진 않게 살짝 남김)
  ctx.save();
  ctx.globalAlpha = 1 - eased * 0.6; // 다가갈수록 옅어짐
  ctx.shadowColor = "#7fd3ff";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#bdeeff";
  ctx.beginPath();
  ctx.moveTo(cx, cy - size / 2);
  ctx.lineTo(cx + size / 2, cy);
  ctx.lineTo(cx, cy + size / 2);
  ctx.lineTo(cx - size / 2, cy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// 화면 지지직(글리치) - cutscene.js의 "screenGlitch" 이벤트가 screenGlitchIntensity(0~1)를 램프업하는
// 동안 매 프레임 호출됨. 저장 상태 없이 매 프레임 Math.random()으로 새로 노이즈를 그려서 저절로
// 깜빡이게 함(포탑 예고 pulse 등 기존 "상태 없는 도형 애니메이션" 패턴과 같은 정신 - 다만 이번엔 sin
// 대신 random이라 매 프레임 결과가 달라지는 "지지직"스러운 결이 남). 화면(screen) 좌표계에서 그려야
// 하므로 draw()가 ctx.restore()로 카메라 translate를 푼 뒤에 호출된다.
function drawScreenGlitch(intensity) {
  if (intensity <= 0) return;
  const barCount = Math.floor(3 + intensity * 9);
  for (let i = 0; i < barCount; i++) {
    const y = Math.random() * H;
    const h = 2 + Math.random() * 16 * intensity;
    const xOffset = (Math.random() - 0.5) * 50 * intensity;
    const light = Math.random() > 0.5;
    ctx.fillStyle = light
      ? `rgba(255,255,255,${0.12 + 0.35 * intensity * Math.random()})`
      : `rgba(10,10,14,${0.15 + 0.4 * intensity * Math.random()})`;
    ctx.fillRect(xOffset, y, W, h);
  }
  ctx.fillStyle = `rgba(120,0,20,${0.15 * intensity})`;
  ctx.fillRect(0, 0, W, H);
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  // 배경 (화면 좌표 기준 - 카메라와 무관하게 항상 뷰포트 전체를 채움)
  ctx.fillStyle = "#2b2f3a";
  ctx.fillRect(0, 0, W, H);

  // ===== 여기서부터 월드 좌표계 =====
  // ctx.translate로 카메라만큼 밀어서, 아래 코드는 전부 "월드 좌표 그대로" 그리면 됨.
  // 플레이어/적/투사체/지형처럼 카메라를 따라 스크롤되어야 하는 것만 이 블록 안에 넣을 것.
  // (반대로 HP바/조작안내/쿨다운 게이지/리스폰 문구/컷신 텍스트박스/페이드는 canvas가 아니라 HTML
  //  오버레이라서 애초에 카메라 영향을 받지 않음 - updateHud()/cutscene.js 쪽 참고)
  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  // 지형 - 고정형(완전 차단)은 회색, 원웨이(관통형)는 청록색 + 상단에 밝은 선으로 구분
  for (const s of currentZone.solidPlatforms) drawRect(s, "#555b6e");
  for (const p of currentZone.oneWayPlatforms) {
    drawRect(p, "#3f7068");
    ctx.fillStyle = "#8de6cf";
    ctx.fillRect(p.x, p.y, p.w, 3); // 위쪽 밝은 라인 = "위에서만 착지 가능" 표시
  }

  // 문 (왼쪽은 배경, 오른쪽은 다음 존 트리거)
  if (currentZone.doors.left) drawDoor(currentZone.doors.left);
  if (currentZone.doors.right) drawDoor(currentZone.doors.right);

  // 봉쇄 벽 (안쪽 몬스터를 다 잡아야 사라짐) - 잠긴 게이트만 그림. 존 하나에 여러 개 있을 수 있음.
  for (const gate of currentZone.wallGates) {
    if (!isGateLocked(gate)) continue;
    const visual = { x: gate.x, y: gate.visualY, w: gate.w, h: gate.visualH };
    drawRect(visual, "#c2410c");
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let sy = visual.y - visual.w; sy < visual.y + visual.h; sy += 22) {
      ctx.moveTo(visual.x, sy);
      ctx.lineTo(visual.x + visual.w, sy + visual.w);
    }
    ctx.stroke();

    const remaining = countAliveBehindGate(gate);
    ctx.fillStyle = "#ffe0b2";
    ctx.font = "bold 15px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("봉쇄 구역", visual.x + visual.w / 2, visual.y - 14);
    ctx.fillText(`남은 몬스터: ${remaining}`, visual.x + visual.w / 2, visual.y + visual.h + 20);
    ctx.textAlign = "left"; // 이후 다른 텍스트 렌더링에 영향 없도록 기본값으로 복귀
  }

  // 배경 장식 (순수 연출, 전투 판정 없음 - drawMimeBProp 참고)
  for (const prop of currentZone.ambientProps || []) {
    if (prop.type === "mimeB") drawMimeBProp(prop);
    else if (prop.type === "reachingEntity") drawReachingEntityProp(prop);
    else if (prop.type === "fragmentObject") drawFragmentObjectProp(prop);
    else if (prop.type === "crackMark") drawCrackMarkProp(prop);
  }

  // 표류 흡수 애니메이션(cutscene.js "driftAbsorb" 이벤트) - 월드 좌표계라 이 안(카메라 translate)에서 그림
  drawDriftAbsorb();

  // 적 (포탑 + 체이서 공통 렌더링. 보라색 = 근접 공격으로도 스턴 안 걸리는 면역 개체 - 타입 공통 표시)
  for (const enemy of enemies) {
    if (!enemy.alive) continue;

    const isChaser = enemy.type === "chaser";
    const isMimeA = enemy.type === "mimeA";
    // mimeA는 전투 로직(추적/근접 공격) 자체를 체이서와 공유하므로(makeMimeA 참고), "예고 중 보여주는
    // 판정 미리보기"/"경고색 pulse" 같은 체이서 전용 시각 처리도 같이 타야 한다 - isChaser 단독이 아니라
    // 이 합쳐진 플래그로 판정.
    const isChaserLike = isChaser || isMimeA;
    const isSniper = enemy.type === "sniper";
    const isWarning = isChaserLike ? enemy.aiState === "windup" : enemy.telegraphing;
    const baseColor = !enemy.stunnable
      ? "#8e44ad"
      : isMimeA ? "#7c6a53" // 배경 몬스터 - 다른 전투형 몬스터들과 안 겹치는 흙빛 톤
      : isChaser ? "#5c8a3a"
      : isSniper ? "#00838f" // 포탑(빨강)/체이서(초록)/면역(보라)과 겹치지 않는 청록 - "다른 놈"이라는 신호
      : "#b23b3b";
    let color = enemy.flashTimer > 0 ? "#ffffff" : baseColor;
    // 공격 예고 중에는 빠르게 밝아졌다 어두워지는 색으로 경고 (체이서/mimeA는 근접 느낌의 붉은 계열,
    // 저격수는 투사체와 짝을 맞춘 마젠타 계열로 구분 - 반드시 피해야 하는 예고라는 걸 색으로도 강조)
    if (isWarning) {
      const pulse = (Math.sin(performance.now() / 60) + 1) / 2; // 0~1
      color = isChaserLike ? (pulse > 0.5 ? "#ff5252" : "#ff8a65")
        : isSniper ? (pulse > 0.5 ? "#f50057" : "#ff4081")
        : (pulse > 0.5 ? "#ffb300" : "#ff6f3c");
    }
    drawRect(enemy, color);
    // "눈" - 플레이어 방향을 향하는 작은 원, 예고 중엔 커지고 밝아짐
    ctx.fillStyle = isWarning ? "#fff59d" : "#241010";
    ctx.beginPath();
    const cx = enemy.x + enemy.w / 2, cy = enemy.y + enemy.h / 2;
    ctx.arc(cx, cy, isWarning ? 9 : 6, 0, Math.PI * 2);
    ctx.fill();
    // 적 A 전용(§ 5 아트 제약: "몸통 사각형 + 팔이 일정 각도로 왔다갔다 회전") - 감지 전(patrol/return)엔
    // 옆구리에 고정된 팔이 왔다갔다 흔들리고, 감지되면(chase/windup/recovery) 그 자리에 멈춘다.
    // 항상 몸통 오른쪽에 고정해서 그림 - facing에 따라 반대로 뒤집지 않는 단순화(플레이스홀더라 무관).
    if (isMimeA) {
      const idle = enemy.aiState === "patrol" || enemy.aiState === "return";
      const restAngle = -0.3;
      const angle = idle
        ? restAngle + Math.sin(performance.now() / 1000 * CONFIG.MIME_A_ARM_SWING_SPEED + enemy.id) * CONFIG.MIME_A_ARM_SWING_ANGLE
        : restAngle;
      const armLen = enemy.w * 0.9, armThick = 6;
      ctx.save();
      ctx.translate(enemy.x + enemy.w, enemy.y + enemy.h * 0.35);
      ctx.rotate(angle);
      ctx.fillStyle = color;
      ctx.fillRect(0, -armThick / 2, armLen, armThick);
      ctx.restore();
    }
    // 체력 pip (마름모, 반칸 표현 가능 - drawHpPip 참고). 슬롯 개수는 maxHp 기준으로 고정,
    // 각 슬롯이 얼마나 채워졌는지는 남은 hp를 슬롯별로 0~1로 잘라서 계산.
    const pipSize = 11, gap = 4;
    const pipCount = enemy.maxHp;
    const totalW = pipCount * pipSize + (pipCount - 1) * gap;
    let pipCx = enemy.x + enemy.w / 2 - totalW / 2 + pipSize / 2;
    const pipCy = enemy.y - 12;
    for (let i = 0; i < pipCount; i++) {
      const fillRatio = clamp(enemy.hp - i, 0, 1);
      drawHpPip(pipCx, pipCy, pipSize, fillRatio);
      pipCx += pipSize + gap;
    }

    // 체이서/mimeA 전용: 공격 예고(선딜레이) 중에는 실제로 맞을 범위를 미리 그려서 보여줌
    if (isChaserLike && enemy.aiState === "windup") {
      const hb = getChaserAttackHitbox(enemy);
      ctx.fillStyle = "rgba(255,82,82,0.35)";
      ctx.fillRect(hb.x, hb.y, hb.w, hb.h);
      ctx.strokeStyle = "rgba(255,82,82,0.9)";
      ctx.lineWidth = 2;
      ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);
    }
  }

  // 투사체 - unblockable(저격수 투사체)은 표류/반격으로 못 없애는 만큼 색/크기/광륜으로 확실히
  // 다르게 그려서 "이건 반드시 피해야 한다"가 멀리서도 즉시 보이게 한다.
  for (const p of projectiles) {
    if (p.unblockable) {
      ctx.save();
      ctx.shadowColor = "#ff1744";
      ctx.shadowBlur = 16;
      ctx.fillStyle = "#ff1744";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "#fff59d";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#ffee58";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 공격 판정 시각화
  if (player.attackState === "active") {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    if (player.attackIsAirborne) {
      ctx.beginPath();
      ctx.arc(player.x + player.w / 2, player.y + player.h / 2, CONFIG.AIR_ATTACK_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const hb = getAttackHitbox();
      ctx.fillRect(hb.x, hb.y, hb.w, hb.h);
    }
  }

  // 유령 NPC는 평소엔 플레이어와 거리를 두고 있어서 먼저(아래에) 그려도 상관없지만, 방향이 바뀌어
  // 반대편으로 이동하는 도중에는 잠깐 플레이어와 실제로 겹칠 수 있다 - 그 순간만큼은 플레이어에게
  // 가려지지 않도록 나중에(위에) 그린다. respawning 중이 아니면(컷신 포함) 항상 그려서, 컷신 중에도
  // 유령이 사라지지 않고 화면에 그대로 남아있게 한다. 단, hideGhostNpc 존(1층)에서는 아예 안 그림.
  const ghostBox = { x: ghostNpc.x, y: ghostNpc.y, w: player.w, h: player.h };
  const showActors = gameState !== "respawning";
  const showGhost = showActors && !getRuleFlag("hideGhostNpc");
  const ghostOverlapsPlayer = showGhost && rectsOverlap(ghostBox, player);
  if (showGhost && !ghostOverlapsPlayer) drawGhostNpc();

  // 플레이어
  if (showActors) {
    // 표류 잔상 - 별도 오브젝트/히트박스 아님, 본체 위치 기록을 흐리게 겹쳐 그리는 순수 시각효과
    if (player.state === "drift") {
      for (let i = 0; i < player.driftTrail.length - 1; i++) {
        const t = player.driftTrail[i];
        ctx.globalAlpha = 0.08 + 0.05 * i;
        ctx.fillStyle = "#4fc3f7";
        ctx.fillRect(t.x, t.y, player.w, player.h);
      }
      ctx.globalAlpha = 1;
    }

    let color = "#4fc3f7";
    if (player.invincibleTimer > 0 && Math.floor(performance.now() / 60) % 2 === 0) color = "#ffffff";

    ctx.globalAlpha = player.state === "drift" ? 0.55 : 1; // 표류 중엔 본체도 살짝 반투명
    drawRect(player, color);

    // 바라보는 방향 표시 (작은 삼각형 느낌의 사각형)
    ctx.fillStyle = "#01579b";
    const eyeX = player.facing === 1 ? player.x + player.w - 8 : player.x + 2;
    ctx.fillRect(eyeX, player.y + 8, 6, 6);
    ctx.globalAlpha = 1;

    // 축적된 반격 데미지 표시 - 표류 종료 시 이만큼의 데미지가 광역 반격으로 나간다는 걸 눈으로 알 수 있게
    if (player.pendingDamage.length > 0) {
      const totalPending = player.pendingDamage.reduce((sum, e) => sum + e.amount, 0);
      const pulse = (Math.sin(performance.now() / 80) + 1) / 2;
      ctx.fillStyle = pulse > 0.5 ? "#ffd54f" : "#ffecb3";
      ctx.beginPath();
      ctx.arc(player.x + player.w / 2, player.y - 14, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3e2723";
      ctx.font = "bold 11px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(totalPending), player.x + player.w / 2, player.y - 10);
      ctx.textAlign = "left";
    }
  }
  if (ghostOverlapsPlayer) drawGhostNpc(); // 겹치는 프레임엔 플레이어를 그린 다음에 그려서 위에 보이게 함

  // 표류 반격 판정을 잠깐 보여주는 시각효과 (월드 좌표계 - 카메라와 함께 스크롤).
  // 터질 때 확 밝았다가 그라데이션으로 점점 옅어짐 - 실시간으로 페이드되므로(tickDriftBurst)
  // DRIFT_BURST_VISUAL_DURATION이 HITSTOP_DOUBLE_HIT_GAP보다 짧게 잡혀있어서, 2연타의 경우
  // 1타(하늘색)가 완전히 사라진 뒤 잠깐의 암전을 거쳐 2타(금색)가 다시 확 밝아지는 게 눈에 보인다.
  if (player.driftBurst) {
    const b = player.driftBurst;
    const alpha = clamp(b.timer / CONFIG.DRIFT_BURST_VISUAL_DURATION, 0, 1);
    const strokeRGB = b.variant === "bonus" ? "255,193,7" : "79,195,247"; // 2타=금색, 1타=하늘색
    ctx.fillStyle = `rgba(255,255,255,${0.65 * alpha})`;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = `rgba(${strokeRGB},${alpha})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }

  ctx.restore();
  // ===== 여기부터 다시 화면(screen) 좌표계 =====

  // 화면 지지직(글리치) - cutscene.js의 screenGlitch 이벤트가 진행 중일 때만 그려짐(그 외엔 intensity=0
  // 이라 즉시 반환). 다른 화면 틴트(피격 유예/표류/타임스톱)보다 먼저 그려서, 그 위에 얹히는 붉은
  // 타임스톱 틴트 등과 자연스럽게 겹치게 한다.
  drawScreenGlitch(screenGlitchIntensity);

  // 유예시간 경고 - anchor 상태에서 맞아서 아직 확정 안 된 피해가 있으면 화면이 붉게 깜빡임.
  // 이 깜빡임이 보이는 동안 표류(우클릭)를 쓰면 지금 깜빡이는 피해가 취소되고 반격으로 축적된다.
  if (showActors && player.state === "anchor" && player.pendingDamage.length > 0) {
    const pulse = (Math.sin(performance.now() / 60) + 1) / 2;
    const alpha = 0.15 + 0.25 * pulse;
    ctx.fillStyle = `rgba(255,82,82,${alpha})`;
    ctx.fillRect(0, 0, W, H);
  }

  // 표류 중 화면 틴트 - 연파랑으로 "지금 표류 상태"임을 알려주되, 축적된 피해가 있으면(=지금 끝나도
  // 자해 대신 반격이 나감, 안전한 상태) 더 진한 파랑으로 구분해서 보여줌.
  if (showActors && player.state === "drift") {
    const hasAccumulatedDamage = player.pendingDamage.length > 0;
    ctx.fillStyle = hasAccumulatedDamage ? "rgba(41,121,255,0.38)" : "rgba(79,195,247,0.22)";
    ctx.fillRect(0, 0, W, H);
  }

  // 타임스톱 원인별 화면 틴트 - 위의 옅은 틴트들 위에 덧씌워서 그 순간만 확 진해지는 느낌을 줌.
  // 피격 확정(damage)은 더 강한 빨강, 반격 발동(counter)은 더 강한 파랑. 타임스톱 잔여시간 비율로 페이드.
  if (timeStopTimer > 0 && timeStopReason) {
    const fade = clamp(timeStopTimer / timeStopDuration, 0, 1);
    if (timeStopReason === "damage") {
      ctx.fillStyle = `rgba(255,23,23,${0.55 * fade})`;
    } else {
      ctx.fillStyle = `rgba(41,121,255,${0.5 * fade})`;
    }
    ctx.fillRect(0, 0, W, H);
  }

  // HUD (HTML 오버레이) 갱신 - 이 요소들은 애초에 canvas 밖의 절대 위치 DOM이라 카메라와 무관함
  updateHud();
}

/* --------------------------- HUD --------------------------- */
const hpBarInner = document.getElementById("hpBarInner");
const hpText = document.getElementById("hpText");
const atkCdBar = document.getElementById("atkCdBar");
const driftCdBar = document.getElementById("driftCdBar");
const respawnMsg = document.getElementById("respawnMsg");

function updateHud() {
  const hpRatio = clamp(player.hp / CONFIG.PLAYER_MAX_HP, 0, 1);
  hpBarInner.style.width = (hpRatio * 100) + "%"; // 바는 실제 소수점 값 그대로 - 회복 중에도 매끄럽게 채워짐
  // 텍스트는 정수로만 - HP가 소수점 단위(반칸 공중 공격 등)로 깎일 수 있어 그대로 보여주면
  // "HP 3.4237 / 5"처럼 지저분해 보임. floor라서 아직 다 안 찬 값은 항상 실제보다 낮게(더
  // 보수적으로) 보여줌 - 있지도 않은 체력을 있는 것처럼 보여주지 않기 위해. HP 회복(tickHpRegen)은
  // 트리클이 아니라 즉시 스냅이라 이 값이 서서히 올라가다 마는 일은 없음(0 아니면 가득).
  hpText.textContent = `HP ${Math.floor(Math.max(0, player.hp))} / ${CONFIG.PLAYER_MAX_HP}`;

  // 선딜(windup, 지상 전용)/판정 활성(active) 중엔 항상 0% - 둘 다 재사용 불가 구간이라 진행률을
  // 보여줄 필요가 없음. recovery 진입부터 (지상/공중 각각의) 후딜레이 시간을 기준으로 게이지가 차오름.
  let atkRatio;
  if (player.attackState === "windup" || player.attackState === "active") {
    atkRatio = 0;
  } else if (player.attackState === "recovery") {
    const recoveryDuration = player.attackIsAirborne ? CONFIG.ATTACK_RECOVERY_DURATION : CONFIG.GROUND_ATTACK_RECOVERY_DURATION;
    atkRatio = 1 - clamp(player.attackTimer / recoveryDuration, 0, 1);
  } else {
    atkRatio = 1;
  }
  atkCdBar.style.width = (atkRatio * 100) + "%";
  atkCdBar.style.background = atkRatio >= 1 ? "#ffb74d" : "#555";

  // 표류 쿨타임 진행 상태만 표시: 표류 중엔 꽉 찬 채로 "사용 중" 색, 아니면 쿨타임이 채워지는 방향으로 표시
  // (꽉 차있으면 다시 표류 가능, 비어있을수록 쿨타임이 많이 남은 것) - 게이지/홀드 로직은 완전히 제거됨
  if (player.state === "drift") {
    driftCdBar.style.width = "100%";
    driftCdBar.style.background = "#ba68c8";
  } else {
    const driftReadyRatio = 1 - clamp(player.driftCooldownTimer / player.driftCooldownDuration, 0, 1);
    driftCdBar.style.width = (driftReadyRatio * 100) + "%";
    driftCdBar.style.background = driftReadyRatio >= 1 ? "#7e57c2" : "#555";
  }

  respawnMsg.style.display = gameState === "respawning" ? "block" : "none";
}
