"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// 엄격한 부등호(>, <)를 반드시 유지할 것 - 포함적(>=, <=)으로 바꿔본 적이 있는데(정확히 맞닿은
// 경우도 "겹침"으로 잡으려는 의도였음), 그러면 플레이어가 평소처럼 바닥에 딱 서 있기만 해도(발바닥이
// 바닥 표면에 정확히 맞닿음, standingTopY 관례상 항상 이렇게 됨) X축 충돌 루프(updatePlayer)가 그
// "바닥"까지 걸어서 부딪힌 벽으로 착각해서 `player.x = groundSegment.x - player.w`로 순간이동시켜버리는
// 심각한 버그가 생겼다(실측: 가만히 서 있기만 해도 x가 0 근처로 튐). 즉 이 코드베이스의 X/Y축 충돌
// 처리 전반이 "닿아있기만 한 상태는 안 겹침"이라는 엄격한 판정에 암묵적으로 의존하고 있어서, 여기를
// 느슨하게 바꾸는 건 안전한 변경이 아니었음 - Playwright로 실제 이동을 시켜보고서야 발견됨(정적
// 분석/짧은 테스트로는 안 보임). 절대 다시 포함적으로 바꾸지 말 것.
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function circleRectOverlap(cx, cy, r, rect) {
  const closestX = clamp(cx, rect.x, rect.x + rect.w);
  const closestY = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - closestX, dy = cy - closestY;
  return dx * dx + dy * dy < r * r;
}
