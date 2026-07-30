"use strict";

// 타임스톱(히트스톱) - 0보다 크면 메인 루프가 update()를 아예 건너뛰어 게임 전체가 얼어붙는다.
// reason은 화면 틴트 색을 고르는 용도("damage" = 피격 확정, "counter" = 반격 발동).
// duration으로 비교해서 부여하는 이유: 거의 동시에 두 트리거가 겹쳐도 더 긴/중요한 쪽 표시가 이기도록.
let timeStopTimer = 0;
let timeStopDuration = 0; // 이번 타임스톱이 총 몇 초짜리였는지 - 틴트 알파를 비율로 페이드시키는 데 씀
let timeStopReason = null; // "damage" | "counter" | null
let timeStopOnComplete = null; // 이번 프리즈 구간이 끝나는 순간 실행할 콜백 - 다음 프리즈 구간으로 이어붙이는 용도(예: 반격 2타)
function triggerTimeStop(duration, reason, onComplete = null) {
  timeStopTimer = duration;
  timeStopDuration = duration;
  timeStopReason = reason;
  timeStopOnComplete = onComplete;
}
