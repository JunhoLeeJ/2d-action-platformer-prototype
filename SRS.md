# SRS — 2D 액션 플랫포머 프로토타입

문서 버전: 1.0 (커밋 `88b20d8` 기준, `index.html`의 실제 구현을 역기술)

## 1. 목적 및 범위

이 문서는 `index.html`에 구현된 게임의 기능적/비기능적 요구사항을 현재 코드 기준으로 명세한다. PRD가 "무엇을, 왜"를 다룬다면 이 문서는 "정확히 어떻게 동작해야 하는가"를 수치와 조건으로 못박는다. 각 요구사항은 현재 코드의 실제 동작이며, 괄호 안 `CONFIG.*`는 해당 수치를 조정하는 튜닝 변수를 가리킨다 (전부 `index.html` 상단 `CONFIG` 객체 하나에 모여 있음).

## 2. 시스템 개요

- **구성**: `index.html`(마크업 + 인라인 `<style>` + `<canvas>`)이 `js/` 아래 클래식 `<script src>` 파일들을 순서대로 불러오는 구조. 빌드 도구/번들러/외부 라이브러리 없음 - `file://`로 직접 열어도 그대로 동작해야 해서 ES 모듈도 쓰지 않음(파일 구성/로드 순서는 `CLAUDE.md` "File layout" 참고).
- **월드 구조**: 더 이상 하나로 이어진 연속 월드가 아니라 "존(zone)" 단위 그래프(`js/engine/zones.js`의 `ZONES`). 현재 등록된 존은 3개: `f1z1_entry`(부팅 시작 지점, 1층 구역 1 - 이동/점프 튜토리얼), `f1z2_platforms`(1층 구역 2 - 플랫폼 연습, 세로로 긴 보너스 타워 포함), `f2z3_legacy_arena`(원래 프로토타입의 전투 레벨 - 나중에 2층 구역 3으로 재활용 예정이며 아직 어디서도 문으로 연결되어 있지 않음). 아래 FR 중 특정 존 전용 수치는 해당 존 이름을 명시.
- **렌더링**: Canvas 2D API. 1440×810 고정 해상도(`<canvas>` 태그의 `width`/`height` 속성이 곧 `W`/`H`), `image-rendering: pixelated`. 가로가 원래(960)보다 넓은 이유는 FR-9.5a 참고. 존마다 `height`(세로 전체 크기)가 다를 수 있어 `H`보다 큰 존에서는 카메라가 세로로도 스크롤됨(FR-2 참고) - `f1z1_entry`/`f2z3_legacy_arena`는 `height=810`(세로 스크롤 없음), `f1z2_platforms`만 `height=1800`.
- **루프**: `requestAnimationFrame` 기반. 프레임마다 `dt`(초 단위 경과시간, 0.033초로 클램프)를 계산해 물리/로직에 사용 (프레임레이트 무관 동작).
- **좌표계**: 월드 좌표(픽셀) 기준으로 모든 오브젝트 위치를 관리하고, 렌더링 시 카메라 오프셋만큼 캔버스를 `translate`해서 화면에 투영. HUD는 DOM 오버레이라 카메라와 무관.
- **영속성**: 없음. 새로고침 시 모든 상태 초기화.
- **네트워크**: 없음 (외부 API/서버 호출 전무).

## 3. 용어 정의

| 용어 | 의미 |
|---|---|
| anchor 상태 | 플레이어 기본 상태. 피격 시 유예 후 HP 확정 반영 |
| drift 상태 | 표류 중. 피격이 HP로 안 가고 반격 재료로 축적됨 |
| pendingDamage | 아직 HP에 확정 반영되지 않은 대기 중 피해 목록 |
| 타임스톱(히트스톱) | `update()` 자체를 건너뛰어 게임 전체가 멈추는 짧은 구간 |
| 인식 범위 | 체이서가 patrol/return 상태에서 플레이어를 발견해 추적을 시작하는 거리 |
| 어그로 범위 | 체이서가 이미 추적 중일 때, 이 거리를 넘으면 추적을 포기하는 거리 |
| 존(zone) | 독립된 레벨 하나(지형/적/체크포인트/문/트리거). 월드는 존들의 그래프이지 하나로 이어진 공간이 아님 |
| cutscene 상태 | `gameState`의 세 번째 값. 트리거 시퀀스 재생 중 - `updatePlayer()`가 호출되지 않아 조작이 막힘 |
| 트리거 시퀀스 | 트리거 존이 순서대로 재생하는 이벤트 목록(대화/카메라 홀드/애니메이션/페이드) |

## 4. 기능 요구사항

### FR-1. 이동 / 물리
- FR-1.1 좌우 이동: `heldKeys["KeyA"/"KeyD"]`에 따라 `vx = ±MOVE_SPEED`(420px/s).
- FR-1.2 중력: `vy += GRAVITY·dt`(2100px/s²), `MAX_FALL_SPEED`(1400px/s)로 클램프.
- FR-1.3 점프: `Space`가 눌리는 순간(`justPressed`) `vy = -JUMP_FORCE`(760px/s). `jumpsUsed < MAX_JUMPS`(2)이고 `groundAttackControlLocked`(FR-3.5b)가 아닐 때만 허용 — 이단 점프. 바닥 착지 시 `jumpsUsed` 리셋. 점프 트리거 즉시 `player.onGround`도 함께 `false`로 갱신됨(원래 Y축 처리 시점까지 미뤄졌던 것을 앞당김) — 점프와 공격을 같은 프레임에 누르면 바로 뒤이어 실행되는 공격 판정(FR-3.1)이 최신 접지 상태를 보게 하기 위함(FR-3.1b). 이전에는 `KeyW`도 동일하게 동작했으나 점프 전용 키를 `Space` 하나로 단순화함.
- FR-1.4 지형 충돌: 고정형 플랫폼은 X/Y 양방향 모두 차단. 원웨이 플랫폼은 위에서 낙하해 착지할 때만(`vy≥0`이고 직전 프레임에 발판 위였을 때) 차단, 그 외엔 통과.
- FR-1.5 낙사: `player.y > 캔버스높이 + PIT_FALL_BUFFER`(60px)가 되면 즉시 사망 처리.
- FR-1.6 월드 경계: `player.x`는 `[0, WORLD_WIDTH - player.w]`로 클램프 (WORLD_WIDTH=3840).
- FR-1.7 캐릭터 방향(`player.facing`, -1=왼쪽/1=오른쪽): 기본은 "가는 방향"이 주도권을 쥔다 — 좌우 이동 입력이 있는 프레임(`move !== 0`)마다 그 방향으로 갱신되고, 가만히 서있으면(`move === 0`) 전혀 건드리지 않아 직전 방향(마지막 이동 방향, 또는 아래 FR-3.2가 남겨둔 방향)을 그대로 유지한다. 지상 공격의 `active` 스윙 도중에는 이동 여부와 무관하게 무조건 고정(FR-3.2). 마우스 커서 방향은 이동 상태와 무관하게 이 값에 개입하지 않으며, 오직 공격을 "막 시작하는 그 순간"에만 FR-3.2가 별도로 이 값을 덮어써서 그 순간만 마우스가 이동 방향보다 우선권을 가져간다(예: 오른쪽으로 달리면서도 마우스가 왼쪽이면 왼쪽을 벤다).

### FR-2. 카메라
- FR-2.1 화면 정중앙 기준 가로/세로 데드존(`CAMERA_DEADZONE_W`=160px, `CAMERA_DEADZONE_H`=140px) 안에서는 플레이어가 움직여도 카메라 고정 - 두 축이 서로 독립적으로 판정됨.
- FR-2.2 데드존을 벗어나면 지수 감쇠(`1-e^(-CAMERA_SMOOTHING_X/Y·dt)`)로 목표 위치를 부드럽게 추적. 프레임레이트 무관. 가로/세로 계수가 분리되어 있음(`CAMERA_SMOOTHING_X`=6, `CAMERA_SMOOTHING_Y`=11) - 세로가 더 커서 낙하 중에도 카메라가 눈에 띄게 뒤처지지 않음.
- FR-2.3 카메라 X/Y는 각각 `[0, currentZone.width - 화면폭]` / `[0, currentZone.height - 화면높이]`로 클램프(존마다 독립된 크기). `height`가 `H`와 같은 존(현재 `f1z1_entry`/`f2z3_legacy_arena`)은 사실상 세로 스크롤이 없고, `height > H`인 존(`f1z2_platforms`)에서만 세로 스크롤이 실제로 일어남. 컷신 카메라 홀드 중(`cameraOverrideTarget` ≠ null)에는 데드존 없이 목표 지점으로 그대로 감쇠 추적 - target의 x/y는 각각 생략 가능(생략한 축은 현재 카메라 위치 유지).

### FR-3. 근접 공격
- FR-3.1 좌클릭 시, 공격 상태가 `idle`이면 새 스윙이 시작됨(`startAttack`). 트리거 조건은 지상/공중이 다름(FR-3.1a): 지상은 `heldKeys["Mouse0"]`(누르고 있는 동안 자동 연타), 공중은 `justPressed["Mouse0"]`(매번 새로 클릭). 이 시점의 `player.onGround`로 `attackIsAirborne`이 고정되어, 스윙 도중 착지/이륙해도 종류가 안 바뀜. 시작 직후 상태는 지상/공중이 다름 — 공중은 곧장 `active`(FR-3.4), 지상은 `windup`을 먼저 거침(FR-3.4a).
- FR-3.1a (홀드 연타 - 지상 전용) 지상 공격은 좌클릭을 누르고 있는 동안(`heldKeys["Mouse0"]`) `attackState`가 `idle`로 돌아올 때마다 자동으로 재발동된다("연타 피로도"를 줄이기 위한 사용자 요청). 공중 공격은 여전히 `justPressed["Mouse0"]`만 보므로 좌클릭을 쥐고 있어도 자동 재발동되지 않음 - FR-3.7의 착지 전 1회 제한(`MAX_AIR_ATTACKS`)이 원하는 타이밍보다 먼저 소모되지 않도록 일부러 분리함. 트리거 판정 시점의 `player.onGround`(FR-3.1b 참고로 이미 갱신된 값)로 두 분기를 나눔.
- FR-3.1b (점프+공격 동시 입력 레이스 수정) 점프 트리거(FR-1.4 등) 순간 `player.onGround`를 즉시 `false`로 갱신한다 - 원래는 Y축 처리(같은 프레임 후반부)에서만 갱신되어, 같은 프레임에 점프와 공격을 동시에(또는 거의 동시에) 누르면 실제로는 막 공중으로 뜬 순간인데도 아직 `true`로 남아있는 `onGround`를 보고 지상 공격으로 오판정되는 문제가 있었음(사용자가 숏홉 콤보를 빠르게 연타하는 도중 실제로 겪은 간헐적 버그 - 지상 공격으로 오판정되면 지상 전용 조작 잠금(FR-3.5/3.5b)이 걸려 공중에서도 이동/재점프가 묶여버림). 점프 처리(공격 입력 처리보다 항상 먼저 실행됨)가 끝나는 즉시 `onGround`를 갱신해 바로 뒤이어 실행되는 공격 판정이 항상 최신 상태를 보게 함.
- FR-3.2 (공격 방향은 `player.facing`을 그대로 씀, FR-1.7의 "이동 방향이 기본 주도권" 규칙에 대한 예외 - 단 지상 공격에 한함) 지상 공격을 시작하는 그 프레임(`attackState`가 `idle`→트리거되는 순간이고 `player.onGround`가 true)에만 "마우스 커서가 플레이어 중심보다 왼쪽/오른쪽인지"로 `player.facing`을 그 자리에서 덮어씀 — 그 순간만큼은 이동 입력과 무관하게 마우스가 우선권을 가져간다. `active` 상태인 동안은 이후 이 값이 그대로 고정된다(스윙을 시작한 프레임에 한 번 확정된 뒤 FR-1.7의 이동-방향 갱신이 멈춤) — 스윙 도중 마우스를 반대편으로 빠르게 옮기거나 반대 방향으로 이동해도 판정/돌진 방향이 시작 시점 그대로 유지됨. `active`를 벗어나면(recovery 진입) FR-1.7의 이동-우선 규칙이 다시 매 프레임 적용되어, 계속 이동 중이었다면 그 방향으로 즉시 되돌아감.
- FR-3.2a (공중 공격/표류 반격은 마우스에 전혀 영향받지 않음) 공중 공격(`!player.onGround`)이 트리거될 때는 FR-3.2의 마우스 덮어쓰기 자체를 건너뛴다 — 방향 무관 원형 판정이라 애초에 방향이 의미 없기도 하고, "공중 공격 중엔 가던 방향을 그대로 유지해야 한다"는 명시적 요청에 따른 것. 이 경우 FR-1.7의 이동-우선 규칙만 그대로 적용되어, 공중 공격 도중에도(active 상태가 지상처럼 facing을 얼리지 않으므로) 실제 이동 입력에 따라 자연스럽게 갱신되거나, 이동이 없으면 직전 방향이 유지된다. 표류/표류 반격(FR-5/FR-6)은 `player.facing`을 아예 참조하지 않는 방향 무관 판정이라(`performDriftCounterAttack` 등 어디에서도 `facing`을 쓰거나 바꾸지 않음) 반격 도중에도 항상 직전 방향 그대로 유지됨 - 별도 처리가 필요 없다.
- FR-3.3 (지상 공격) 판정 박스: 가로 85px×세로 75px(`ATTACK_RANGE_W/H`), `facing` 방향으로 플레이어 옆에 배치하되 매 프레임 현재 `player.x`로 다시 계산됨(FR-3.3b의 돌진과 함께 앞으로 이동). 겹친 살아있는 적마다(한 스윙에 1회 한정) `ATTACK_DAMAGE`(1) 피해 + 스턴 적용.
- FR-3.3a (공중 공격) `player.onGround`가 false일 때: 방향 무관, 플레이어 중심 기준 반지름 85px(`AIR_ATTACK_RADIUS`) 원형 판정(`circleRectOverlap`). 지상 공격(85×75)과 크기는 비슷하지만 방향 무관 원형이라 위/아래로 더 잘 닿고, 표류 반격(FR-6, 최대 리치 ~152px)보다는 확실히 좁음. 데미지는 지상 공격의 절반(`getAirAttackDamage()` = `ATTACK_DAMAGE/2` = 0.5) — 상수로 고정하지 않고 항상 `ATTACK_DAMAGE`에서 파생. 몬스터 HP는 부풀리지 않고 반칸(0.5) 단위 그대로 두며, 대신 체력 표시를 반칸 표현 가능한 마름모 pip로 바꿈(FR-9.1a/FR-10.1a, `drawHpPip`).
- FR-3.3b (지상 공격 전용 돌진) `active` 상태인 동안 매 프레임 좌우 이동 입력을 무시하고 `player.vx`를 `player.facing × (GROUND_ATTACK_LUNGE_DISTANCE / GROUND_ATTACK_ACTIVE_DURATION)`(`getGroundAttackLungeSpeed()`)으로 강제 덮어씀 — "대시"가 아니라 검을 휘두른 반작용으로 몸이 아주 살짝(총 이동거리 `GROUND_ATTACK_LUNGE_DISTANCE`=10px) 쏠리는 정도. 속도가 아니라 총 이동거리로 정의되어 있어 활성 시간을 조정해도 쏠리는 거리 자체는 유지됨. 공중 공격은 영향 없음.
- FR-3.4 활성 시간: 공중 공격은 0.08초(`ATTACK_ACTIVE_DURATION`), 지상 공격은 0.13초(`GROUND_ATTACK_ACTIVE_DURATION`, FR-3.3b의 돌진이 보이도록 살짝 늘림) 동안 판정.
- FR-3.4a (지상 공격 전용 선딜/windup) 지상 공격은 `active`에 들어가기 전에 `windup` 상태를 `GROUND_ATTACK_WINDUP_DURATION`(0.06s, 사람이 인지 못 할 만큼 짧게 잡음) 동안 먼저 거친다 — 판정/데미지가 전혀 없는 순수 대기 구간(공격 판정 루프 자체가 `attackState==="active"`일 때만 돎). 즉발이면 클릭한 프레임에 곧바로 판정/데미지가 들어가 캐릭터와 공격 이펙트(추후 실제 스윙 애니메이션 포함)가 겹쳐 보이는 부자연스러움이 있어서 도입됨(사용자 피드백). `windup` 동안은 `groundAttackControlLocked`(FR-3.5b)에 걸려 이동이 잠기며, 시간이 다 되면 자동으로 `active`로 넘어간다(`GROUND_ATTACK_ACTIVE_DURATION`으로 `attackTimer` 재설정). 공중 공격은 이 상태를 아예 거치지 않고 트리거되는 즉시 `active`(FR-3.1) — 원형 판정이라 방향/위치가 이미 확정적이고 숏홉의 반응성이 중요하기 때문에 선딜을 넣지 않음. `windup` 도중 점프를 누르면 FR-3.8이 이 스윙을 공중 공격으로 캔슬·전환한다.
- FR-3.5 활성 종료 후 후딜레이: 공중 공격은 0.30초(`ATTACK_RECOVERY_DURATION`) 동안 재공격 불가하되 자유롭게 이동/점프 가능(기존 동작 유지). 지상 공격은 0.14초(`GROUND_ATTACK_RECOVERY_DURATION`, 공중과 별개 상수 - 원래 0.30이었으나 "가만히 서있는 시간이 너무 길다"는 피드백으로 절반 가까이 줄임) 동안 재공격 불가 + 좌우 이동도 완전히 멈춤(`player.vx=0` 강제) — "검을 휘두른 뒤 잠깐 멈춰서기".
- FR-3.5a (지상 공격 전용 후속 잠금) `recovery`가 끝나 `attackState`가 `idle`로 돌아오는 순간, `player.postAttackLockTimer`가 `GROUND_ATTACK_POST_RECOVERY_LOCK_DURATION`(0.03s, 원래 0.08 - "쿨타임이 돌자마자 거의 바로 움직이고 싶다"는 피드백으로 거의 0에 가깝게 줄임)로 설정되어 그 시간만큼 좌우 이동 입력이 한 번 더 무시된다("연타하지 않았다면 조금 더 있다가 움직일 수 있음"). `attackState==="idle"`이면 언제든 재공격이 가능하므로, 이 잠금 시간이 끝나기 전에 다시 좌클릭하면 `startAttack()`이 `postAttackLockTimer`를 0으로 리셋하고 새 스윙 자신의 잠금(FR-3.3b+본 항목)이 곧바로 이어받는다 — 즉 "연타 중엔 이 여유시간이 사실상 존재하지 않게" 되는 동작이 별도 분기 없이 자연히 성립함. 공중 공격은 이 잠금이 아예 설정되지 않음.
- FR-3.5b (지상 공격 조작 잠금은 이동뿐 아니라 점프도 막음) `player.attackState !== "idle" && !player.attackIsAirborne`(FR-3.4a/3.3b/3.5의 windup/active/recovery 구간) 이거나 `postAttackLockTimer > 0`(FR-3.5a)인 동안은 `groundAttackControlLocked` 플래그가 true가 되어, 좌우 이동 입력뿐 아니라 점프 입력(`justPressed["Space"]`)도 무시된다 — 최초 구현 시 이동만 막고 점프는 그대로 통과되던 버그가 있었음(사용자 피드백으로 발견). 이동/점프 두 입력이 하나의 플래그를 공유하므로 항상 같은 기준으로 함께 막히거나 풀린다. 공중 공격은 `attackIsAirborne`이 true라 이 플래그가 항상 false — 기존처럼 후딜레이 중에도 점프가 자유로움.
- FR-3.6 숏홉(낮은 점프): 공격 입력이 `startAttack()`을 트리거하는 순간 `attackIsAirborne`이 true이면(타이밍 조건 없음, 매번) `player.vy`를 무조건 `-AIR_ATTACK_HOP_FORCE`(420)로 덮어쓴다. `jumpsUsed`를 소모/참조하지 않으므로 이단 점프를 다 쓴 뒤(`jumpsUsed=MAX_JUMPS`)에도 발동. 일반 점프(`JUMP_FORCE`=760, 최고 높이 ~137.5px) 대비 숏홉 최고 높이는 ~42px.
- FR-3.7 공중 공격 횟수 제한: `player.airAttacksUsed`가 `CONFIG.MAX_AIR_ATTACKS`(1) 이상이면, 공중(`!player.onGround`)에서의 좌클릭은 `attackState==="idle"`이어도 `startAttack()` 자체가 호출되지 않음(스윙/판정/숏홉 전부 없음 - 점프 횟수를 다 쓰고 점프 입력을 누르는 것과 동일 취급). 지상 공격은 이 제한과 무관하게 항상 가능. `airAttacksUsed`는 공중 공격이 발동할 때마다 1 증가하고, `jumpsUsed`와 동일한 착지 판정 지점(고정형/원웨이 플랫폼 착지, 리스폰) 각각에서 0으로 리셋됨. 결과적으로 한 번 착지한 뒤 낼 수 있는 최대 상승 횟수는 점프(`MAX_JUMPS`=2) + 공중 공격(`MAX_AIR_ATTACKS`=1) = 3회(FR-3.6의 "사실상 3단 점프")로 고정되며, 착지 없이는 그 이상 불가능.
- FR-3.8 (숏홉 콤보 입력 보정 - windup 캔슬) `player.attackState==="windup"`인 동안 점프(`Space`)가 눌리면, FR-3.5b의 조작 잠금 대신 그 스윙을 공중 공격으로 캔슬·전환한다: `attackIsAirborne=true`, `attackState="active"`, `attackTimer`를 공중 공격 본연의 활성 시간(`ATTACK_ACTIVE_DURATION`)으로 설정, `vy=-AIR_ATTACK_HOP_FORCE`, `airAttacksUsed+=1`, `jumpsUsed+=1`, `onGround=false`. `windup`은 판정/데미지가 전혀 없는 순수 대기 구간(FR-3.4a)이라 이 시점에 캔슬해도 이미 맞은 적이 있을 수 없어 안전함(적을 두 번 맞추는 하이브리드 스윙이 될 여지가 구조적으로 없음). 숏홉 콤보(점프→공중 공격)를 시도하다 공격 클릭이 점프보다 아주 살짝 먼저 처리되어(입력 이벤트 순서의 미세한 흔들림) 스윙이 지상 공격으로 확정돼버리는 경우, `GROUND_ATTACK_WINDUP_DURATION`(0.06s, 사람이 인지 못 할 만큼 짧음)이 그 미세한 차이를 자연스럽게 흡수해준다. `windup`을 완전히 지나 `active`로 넘어간 뒤에 점프가 들어오면(플레이어가 "공격부터 하고 한참 뒤에 점프를 눌렀다"고 인지할 시점) 더 이상 캔슬하지 않고 FR-3.5b대로 그대로 막는다 — 의도치 않은 스킬 발동을 억지로 만들어주지 않기 위해 이 여지를 windup 시간 이내로만 제한함.

### FR-4. 피격 유예 (anchor 상태)
- FR-4.1 모든 피격(`damagePlayer`)은 즉시 HP를 깎지 않고 `pendingDamage`에 `{amount, timer=DRIFT_DAMAGE_GRACE_PERIOD(0.5s)}`로 push. 단, `invincibleTimer > 0`이면 아예 등록되지 않음(무시).
- FR-4.2 `anchor` 상태에서만 각 항목의 `timer`가 매 프레임 감소. `drift` 상태에서는 감소하지 않음(그대로 축적).
- FR-4.3 `timer ≤ 0`이 되면 그 항목만 HP에 확정 반영(`applyDamageToHp`) 후 제거.
- FR-4.4 `invincibleTimer > 0`이 되는 순간(해당 프레임의 유예 처리 루프 종료 직후), 남아있는 `pendingDamage` 전부를 무효화(길이 0으로 초기화) — 무적 중에 다른 대기 항목이 뒤늦게 확정되어 "무적인데 또 맞는" 상황을 방지.
- FR-4.5 시각 피드백: `anchor` 상태이고 `pendingDamage`가 비어있지 않으면 화면 전체에 옅은 붉은 펄스 오버레이.

### FR-5. 표류(drift)
- FR-5.1 발동 조건: 우클릭(`justPressed["Mouse2"]`) + `state==="anchor"` + `driftCooldownTimer≤0`.
- FR-5.2 발동 시 `state="drift"`, `driftTimer=DRIFT_DURATION`(0.4s) 설정. 무적은 부여하지 않음(그래야 표류 중 피격이 `damagePlayer` 가드를 통과해 계속 축적 가능).
- FR-5.3 이동속도: 표류 중에도 평상시와 동일한 `MOVE_SPEED` (표류 전용 가속 없음).
- FR-5.4 `driftTimer≤0`이 되면 `finishDrift()` 실행:
  - `pendingDamage` 합계(`totalDamage`) > 0 → `performDriftCounterAttack(totalDamage)` 호출, 쿨다운=`getDriftCooldownOnCounter()`
  - 합계 = 0 → `DRIFT_EMPTY_SELF_DAMAGE`(1)만큼 자해(`applyDamageToHp`), 쿨다운=`getDriftCooldownOnWhiff()`
  - 결과와 무관하게 이 시점에 `invincibleTimer = max(현재값, HIT_INVINCIBILITY_DURATION)` 부여
- FR-5.5 표류 재발동 쿨다운은 상수가 아니라 계산값:
  - `getDriftCooldownOnCounter() = HIT_INVINCIBILITY_DURATION + DRIFT_DAMAGE_GRACE_PERIOD + DRIFT_COOLDOWN_COUNTER_MARGIN(0.4)` → 현재 1.5초
  - `getDriftCooldownOnWhiff() = getDriftCooldownOnCounter() + DRIFT_COOLDOWN_WHIFF_EXTRA(0.8)` → 현재 2.3초
- FR-5.6 시각 피드백: `drift` 상태 동안 화면 전체 파란 틴트. `pendingDamage`가 쌓여 있으면(=지금 끝나도 자해 대신 반격이 나감) 더 진한 파랑으로 구분.

### FR-6. 표류 반격
- FR-6.1 판정 범위: 플레이어 중심 기준 가로 230px×세로 200px(`DRIFT_ATTACK_RANGE_W/H`), 방향(facing) 무관 — 광역 판정.
- FR-6.2 1타: 범위 안 살아있는 적에게 `totalDamage × DRIFT_COUNTER_DAMAGE_MULTIPLIER(2)` 피해 + 스턴 적용.
- FR-6.3 투사체 격추: 1타와 같은 판정 범위 안의 투사체를 전부 제거하고, 제거된 투사체들의 `damage` 필드 합계(`bonusDamage`)를 구함.
- FR-6.4 2타(조건부): `bonusDamage > 0`이면, `HITSTOP_DOUBLE_HIT_GAP`(0.66s) 경과 후 같은 범위에 `bonusDamage × DRIFT_COUNTER_DAMAGE_MULTIPLIER` 피해를 한 번 더 적용. 2타 자체는 투사체를 다시 검사하지 않음(3타로 연쇄되지 않음).
- FR-6.5 반격 이펙트(`driftBurst`)는 1타=하늘색, 2타=금색으로 구분 표시되며, `DRIFT_BURST_VISUAL_DURATION`(0.12s) 동안 실시간(타임스톱과 무관하게)으로 페이드아웃.

### FR-7. 타임스톱(히트스톱)
- FR-7.1 트리거: (a) `applyDamageToHp` 호출 시 — 원인 "damage", 길이 `HITSTOP_DURATION`(0.3s). (b) `performDriftCounterAttack`의 각 타격 시 — 원인 "counter", 1타/2타 모두 최종적으로 `HITSTOP_DURATION`으로 마무리(1타→2타 사이는 `HITSTOP_DOUBLE_HIT_GAP`).
- FR-7.2 `timeStopTimer>0`인 동안 메인 루프는 `update()`를 완전히 건너뜀 — 플레이어/적/투사체/무적시간/쿨다운 등 모든 게임 로직이 정지. `draw()`는 계속 호출되어 정지 프레임처럼 보임.
- FR-7.3 다단 정지 연결: `triggerTimeStop(duration, reason, onComplete)`의 `onComplete`가 타임스톱 종료 시점에 실행되며, 그 안에서 다시 `triggerTimeStop`을 호출하면 화면이 풀리지 않고 다음 정지 구간으로 바로 이어짐(반격 2연타 연출에 사용).
- FR-7.4 입력 처리: 타임스톱 도중 눌린 키/마우스 버튼은 `justPressed`로 바로 들어가지 않고 `pendingKeyAfterFreeze`에 대기. 타임스톱이 끝나는 순간 그 입력이 "아직 눌려있으면" 그제서야 `justPressed`로 전환(그 프레임에 즉시 반영), 이미 뗐다면 폐기 — 즉 타임스톱 중 입력은 예약되지 않음.
- FR-7.5 화면 틴트: 원인별로 다른 색(damage=빨강 `rgba(255,23,23,·)`, counter=파랑 `rgba(41,121,255,·)`)을 잔여 비율(`timeStopTimer/timeStopDuration`)로 페이드.

### FR-8. 무적
- FR-8.1 무적은 오직 `applyDamageToHp()` 호출 시점(HP가 실제로 깎이는 순간, 자해 포함)에만 부여 — `HIT_INVINCIBILITY_DURATION`(0.6s), 항상 `Math.max` 방식(기존 더 긴 무적을 줄이지 않음).
- FR-8.2 `finishDrift()`도 결과(반격/자해)와 무관하게 별도로 같은 값을 부여 — "이벤트 직후 무적시간"이 항상 동일 길이로 보장됨.
- FR-8.3 무적 중엔 `damagePlayer()`의 최초 진입 가드(`invincibleTimer>0`)에 의해 새로운 피격이 아예 등록되지 않음.
- FR-8.4 무적 중엔 타임스톱도 함께 멈춰있다가(FR-7.2), 타임스톱이 끝나는 시점부터 실제로 감소 시작 — 즉 "타임스톱 끝난 직후"부터 온전한 길이만큼 무적이 보장됨.

### FR-9. 적 — 포탑 (turret)
- FR-9.1 체력 `TURRET_MAX_HP`(5). 근접 공격/표류 반격으로만 처치 가능(투사체 없음, 이동 없음).
- FR-9.1a 체력 표시: `enemy.maxHp`개의 마름모 pip를 몬스터 머리 위에 렌더링(`drawHpPip`). 각 pip는 `clamp(enemy.hp - i, 0, 1)`만큼 왼쪽부터 채워짐 — 정수 피해는 pip 전체, 공중 공격(0.5) 피해는 pip 절반만 채워서 보여줌.
- FR-9.2 발사 주기 `TURRET_FIRE_INTERVAL`(2.2s), 발사 `TURRET_TELEGRAPH_DURATION`(0.5s) 전부터 예고 표시.
- FR-9.3 발사 시점의 플레이어 중심을 향해 투사체 생성(속도 `PROJECTILE_SPEED`=260px/s, 반경 `PROJECTILE_RADIUS`=8, 피해 `PROJECTILE_DAMAGE`=1을 투사체 자체의 `damage` 필드로 보유).
- FR-9.4 일부 개체(`stunnable=false`)는 근접 공격을 맞아도 발사 타이머가 초기화되지 않음(스턴 면역).
- FR-9.5 화면에 한 번도 보인 적 없는 개체(`hasBeenVisible=false`)는 완전 대기 상태(AI 자체가 안 돎) — 카메라에 처음 들어오는 순간부터 매 프레임 `updateTurretAI` 호출 시작.
- FR-9.5a 감지/어그로/공격 범위(모든 몬스터 공통 개념 - FR-10.3/10.4 체이서와 동일 구조를 공유): `hasBeenVisible`이 true여도 `enemy.aggro`가 true가 되기 전까진 예고/발사를 전혀 안 함(완전 대기 - 향후 유휴 애니메이션이 들어갈 자리). 플레이어와의 거리(가로/세로 각각)가 `enemy.detectionRangeW/H` 이내면 `aggro=true`로 전환, 이미 `aggro`인 상태에서 `enemy.leashRangeW/H`를 벗어나면 `aggro=false`로 되돌아가며 `fireTimer`/`telegraphing`도 리셋됨. `aggro`이고 `enemy.attackRangeW/H` 이내일 때만 `fireTimer`가 실제로 줄어들고 발사됨.
  - 포탑/저격수의 `detectionRangeW/H`는 `ENEMY_DEFAULT_DETECTION_RANGE_W/H`(480/270, 원래 960×540 화면의 절반값 - FR-1의 렌더링 해상도 참고)로 세팅됨. 이 기본값은 실제 캔버스 `W`/`H`(현재 1440×810)와 무관하게 고정되어 있어, 넓어진 카메라 뷰 안에서 아직 감지 범위 밖인 몬스터를 플레이어가 미리 볼 수 있음.
  - 포탑/저격수의 `leashRangeW/H`/`attackRangeW/H`는 `Infinity` — 체이서(FR-10.4, 유한한 `CHASER_LEASH_RANGE`라서 멀어지면 어그로가 풀림)와 달리, 최초 감지(`detectionRange` 진입) 이후로는 거리와 무관하게 `aggro`가 절대 `false`로 되돌아가지 않고 공격 범위 제한도 없음("무한 어그로"). 유한 범위(숫자)와 무한 어그로(`Infinity`)는 같은 필드에 다른 값만 넣으면 되는 구조라, 새 몬스터도 둘 중 하나를 그대로 골라 쓸 수 있음.
- FR-9.6 저격수(`type="sniper"`) 변종: FR-9.1~FR-9.5을 값 그대로 전부 공유(체력/발사 주기/예고 시간 동일, `updateTurretAI`를 그대로 재사용). 유일한 차이는 발사하는 투사체에 `unblockable: true`가 붙는다는 것과 그 투사체의 반경이 `SNIPER_PROJECTILE_RADIUS`(15, 일반 `PROJECTILE_RADIUS`=8보다 큼)라는 것.
  - `unblockable` 투사체는 FR-4(피격 유예)/FR-5(표류)를 전혀 타지 않음 — 명중 시 `damagePlayer()`(유예 큐에 push) 대신 `applyDamageToHp()`를 직접 호출해 즉시 HP를 깎음(`invincibleTimer`는 그대로 존중).
  - FR-6.2(표류 반격의 투사체 격추/2연타 보너스) 루프에서도 명시적으로 제외되어 반격으로 격추 불가 — 표류·반격 어느 쪽으로도 무효화할 수 없고 오직 이동으로 피해야 함.
  - 시각적으로 몸통은 청록(`#00838f`, 예고 중엔 마젠타 계열 펄스)으로 포탑(빨강)/체이서(초록)/스턴 면역(보라)과 구분되고, 투사체는 빨간 광륜(`ctx.shadowBlur`)이 있는 큰 원으로 일반 투사체(노란 원)와 확실히 구분됨.

### FR-10. 적 — 체이서 (chaser)
- FR-10.1 상태 머신: `patrol → chase → windup → recovery → (chase|return)`, `return → patrol`. `chase|windup|recovery` = 어그로 상태, `patrol|return` = 비-어그로(FR-9.5a의 공통 감지/어그로/공격 범위 개념에서 체이서의 "아그로" 등가물).
- FR-10.2 인식(perception) 폴링: 매 프레임이 아니라 `CHASER_PERCEPTION_INTERVAL`(0.1s)마다 한 번씩만 실제 플레이어 위치를 다시 샘플링(`perceivedPlayerX/Y`). 그 사이엔 마지막 샘플을 그대로 사용 — 모든 인식/추적 판단은 이 값 기준.
- FR-10.3 인식 범위: 가로 `CHASER_DETECTION_RANGE`(480px) × 세로 `CHASER_DETECTION_VERTICAL_RANGE`(130px) 안에 들어오면 `patrol`/`return`에서 `chase`로 전환.
- FR-10.4 어그로(추적 유지) 범위: `chase` 중 `CHASER_LEASH_RANGE`(650px)보다 멀어지면 추적 포기 → `return`.
- FR-10.5 낙사 구간 회피: `chase` 중 자신과 인식 위치 사이에 `GROUND_GAPS`에 정의된 구멍이 하나라도 걸쳐 있으면 즉시 추적 포기 → `return` (체이서는 점프/낙하 판정이 없어 구멍을 못 건넘).
- FR-10.6 공격 트리거: 거리 기반이 아니라, 실제 공격 히트박스(`getChaserAttackHitbox`, 가로/세로 `CHASER_ATTACK_RANGE_W/H`=130/130)가 **현재 실제 플레이어 위치**와 조금이라도 겹칠 때만 `windup` 진입. 스턴 중에는 진입 불가.
- FR-10.7 `windup`: 진입 시점 `facing`으로 고정, `CHASER_ATTACK_TELEGRAPH_DURATION`(0.65s) 후 그 시점의 실제 플레이어 위치로 재판정하여 명중 시 `CHASER_ATTACK_DAMAGE`(2) 적용 → `recovery`(`CHASER_ATTACK_RECOVERY_DURATION`=0.6s).
- FR-10.8 `return`: 순간이동 없이 `CHASER_PATROL_SPEED`(90px/s)로 순찰 범위(`patrolMinX~patrolMaxX`)까지 걸어서 복귀. 복귀 도중 인식 범위(FR-10.3) 안에 플레이어가 다시 들어오면 즉시 `chase`로 전환. 순찰 범위에 도달하면 `patrol`로 전환.
- FR-10.9 근접 공격/표류 반격에 맞으면 스턴(`CHASER_STUN_DURATION`=0.5s, 스턴 면역 개체 제외) — `windup` 중이면 캔슬되어 `chase`로 되돌아감.

### FR-11. 레벨 지형 (현재 유일한 존 `f2z3_legacy_arena` 기준)
- FR-11.1 존 폭 3840px(화면 폭의 약 2.7배), 존 높이 810px(세로 스크롤 없음, FR-2.3 참고). 바닥 y=750(존 높이에서 20px 여유만 남기고 거의 맞닿음 - CLAUDE.md "groundY + groundH" 참고), 낙사 구멍 2곳(x=900±100, x=2350±120).
- FR-11.2 고정형 플랫폼 5개(바닥 제외) + 원웨이 플랫폼 9개로 수직 구간 구성.
- FR-11.3 봉쇄 벽(x=1900, `zone.wallGates`의 원소 1개): 벽보다 스폰 쪽(`spawnX<1900`)에 살아있는 적이 하나라도 있으면 잠김 — 플레이어/체이서 모두 통과 불가. 판정은 X 범위만 봄(`isGateBlocking`) - 세로 위치와 무관하게 항상 막혀서, 세로로 긴 존에서도 y/h를 따로 튜닝할 필요가 없음. 벽 너머 적은 벽이 잠긴 동안 "화면 밖"과 동일하게 플레이어를 인식하지 못함. 존 하나에 여러 게이트가 있을 수 있도록 일반화되어 있음(`isGateLocked`/`countAliveBehindGate`).
- FR-11.4 존 왼쪽 끝에 배경용 문(트리거 없음, `doors.left`), 오른쪽 끝 문은 다음 존으로의 트리거를 가질 수 있으나(`doors.right`) 이 존은 아직 `null` — 다음 존이 콘텐츠로 아직 존재하지 않음. 모든 존 공통 관례: 좌우 끝은 `zone.walls`로 막혀있고(두께 40px), `doors.left`는 그 벽 바로 뒤(x=40)에 위치 - `doors.right`가 원래부터 존 끝에서 40px 안쪽에 있던 것과 같은 간격.
- FR-11.5 `zone.floors`/`zone.walls`(이 존은 좌우 끝 벽 2개만 있고 `floors`는 비어있음)로 기본 바닥 외에 임의 위치의 추가 바닥/벽을 놓을 수 있음 - 각각 `gaps`로 구멍을 뚫어 여러 조각으로 쪼갠 뒤 `solidPlatforms`에 합쳐짐. `xMin`/`xMax`(floors)·`yMin`/`yMax`(walls)로 존 전체가 아니라 일부 구간에만 놓을 수도 있음(생략 시 전체). 세로로 긴 존에서 강제 지그재그 이동을 만들 때 쓰는 용도(`f1z2_platforms`의 타워 참고, FR-11.6).
- FR-11.6 `f1z2_platforms` 존: 존 높이 1560px(바닥 y=1500 기준 20px 여유). 지상 계단(원웨이 발판 3개, 오르막만)이 폭 400px짜리 좁은 통로(샤프트, x:950~1350)로 틈 없이 이어짐 - `walls` 2개(`yMin`/`yMax`로 통로 구간에만)가 통로 좌우를 감싸고, 그 안에 `floors` 5개(`xMin`/`xMax`로 통로 폭에만)가 강제 지그재그 층을 이룸: 각 층은 통로 폭 대부분을 막고 한쪽 끝(좌/우 번갈아)에만 180px 구멍을 남겨, 층을 오를 때마다 통로 반대쪽 구멍을 찾아야 다음 층으로 갈 수 있음(오른쪽으로 오르고 왼쪽으로 오르고 반복). 층간 간격 110px(한 번의 점프로 여유 있게 도달). 맨 위 층을 통과하면 통로 폭을 넘어 존 오른쪽 끝(벽 1860~1900 바로 앞)까지 넓게 이어지는 착지대(원웨이 발판)로 나오고, **그 착지대 위(땅바닥이 아님)에 다음 존(`f1z3_melee_practice`)으로 가는 문이 있음** - 땅바닥을 따라 그냥 오른쪽 끝까지 걸어가면 문 없이 벽만 있는 막다른 길이라, 반드시 샤프트를 다 올라야만 다음 구역으로 진행 가능.

### FR-12. HP / 사망 / 리스폰
- FR-12.1 `PLAYER_MAX_HP`=5. HP가 0 이하가 되면 `gameState="respawning"` 전환, `RESPAWN_DELAY`(1.2s) 후 현재 체크포인트(`currentCheckpoint`)로 복귀.
- FR-12.2 리스폰(`respawnPlayer`)은 `loadZone(currentCheckpoint.zoneId, currentCheckpoint)`를 호출해 위치/존/적(스폰 데이터로부터 재생성, 리셋이 아님)/투사체/카메라를 전부 그 체크포인트 기준으로 다시 세팅한 뒤, HP/무적(0.5×`HIT_INVINCIBILITY_DURATION`)/표류 관련 상태를 추가로 초기화한다. 죽은 존과 체크포인트의 존이 다를 수 있음(존을 넘나든 뒤 사망) - 두 경우 모두 동일하게 처리됨. `loadZone` 자체는 HP/공격/표류 상태를 건드리지 않으므로, 문 전환(`loadZone`만 호출)은 HP/쿨다운을 그대로 유지하고 사망(`respawnPlayer`)만 그 상태들을 리셋한다.
- FR-12.3 `respawning` 상태에서도 투사체 업데이트는 계속되어 화면에서 자연스럽게 정리됨.
- FR-12.4 체력 자연 회복(`tickHpRegen`, 플레이어/몬스터 공용 - `entity`는 `{hp, maxHp, timeSinceHit}`만 갖추면 됨): 존 규칙 `ruleFlags.hpRegenDelay`(숫자, 기본값 `null`=비활성)가 설정된 존에서만 발동. 마지막으로 피해를 입은 시점(`timeSinceHit=0`으로 리셋되는 시점 - 플레이어는 `applyDamageToHp`, 몬스터는 `damageEnemy`)부터 그 값(초)만큼 다시 피해를 안 입으면, 그 즉시(트리클 없이 한 프레임 만에) `hp`가 `maxHp`로 스냅됨. `hpFloor`(플레이어 최소 체력/몬스터 개별 불사)와는 독립된 별개의 존 규칙이라 서로 다른 조합으로 켜고 끌 수 있음(예: 현재 `f1z3_melee_practice`는 둘 다 켜져 있음). 존마다 이 값만 다르게 주면 난이도별 회복 속도를 조절할 수 있도록 설계됨.

### FR-13. 동료 유령 NPC (비상호작용)
- FR-13.1 어떤 충돌/전투 판정 함수에서도 참조되지 않음 — 피해를 주지도 받지도, 플레이어/적 판정에 영향을 주지도 않음.
- FR-13.2 목표 위치: 플레이어가 마지막으로 A/D를 눌러 이동한 방향(`playerLastMoveDir`, 정지 시에도 이전 값 유지)의 **반대쪽**으로 `GHOST_NPC_FOLLOW_OFFSET`(40px, 중심 기준) 떨어진 지점, 세로는 플레이어와 동일.
- FR-13.3 목표 위치로 순간이동하지 않고, 카메라와 동일한 지수 감쇠(`GHOST_NPC_FOLLOW_SMOOTHING`=10)로 매 프레임 부드럽게 추적.
- FR-13.4 크기는 플레이어의 절반, 발 위치(바닥)와 가로 중심을 플레이어 박스에 맞춰 정렬.
- FR-13.5 렌더링 순서: 플레이어와 겹치지 않는 프레임엔 플레이어보다 먼저(아래에) 그리고, 겹치는 프레임(방향 전환 중 스쳐 지나갈 때)엔 플레이어보다 나중에(위에) 그림.
- FR-13.6 눈(방향 표시): 그 프레임에 실제로 이동한 방향을 가리킴.

### FR-14. 입력
- FR-14.1 이동: `KeyA`/`KeyD` (연속 입력). 점프: `Space` (단발). 공격: 마우스 좌클릭(`Mouse0` - 지상은 연속 입력으로 자동 연타, 공중은 단발). 표류: 마우스 우클릭(`Mouse2`, 단발).
- FR-14.2 마우스 우클릭 시 브라우저 기본 컨텍스트 메뉴 표시 안 함.
- FR-14.3 `WATCHED_KEYS`(`KeyA/KeyD/KeyW/Space`)는 브라우저 기본 동작(스크롤 등) 방지를 위해 `preventDefault` 처리.

### FR-15. HUD
- FR-15.1 HP 바(그라디언트) + 텍스트(`HP n / max`).
- FR-15.2 공격 쿨다운 게이지: `windup`/`active` 중엔 0%, `recovery` 중엔 (지상/공중 각각의) 후딜레이 시간 기준으로 채워짐, `idle`이면 100%.
- FR-15.3 표류 쿨다운 게이지: `drift` 상태 중엔 100%(보라색, "사용 중" 표시), 그 외엔 `driftCooldownTimer/driftCooldownDuration` 비율로 채워짐(어떤 쿨다운이 적용됐는지와 무관하게 항상 정확한 비율).

## 5. 비기능 요구사항

- **NFR-1 성능**: 60fps 목표. 프레임 간 `dt`는 0.033초로 클램프해 탭 전환 등으로 인한 프레임 급증 시 물리 발산을 방지.
- **NFR-2 이식성**: `<canvas>` 2D 컨텍스트와 표준 DOM 이벤트만 사용하는 최신 데스크톱 브라우저에서 별도 설치/빌드 없이 동작.
- **NFR-3 유지보수성**: 모든 밸런스 수치는 `CONFIG` 객체 하나에 집중되어 있어, 로직 코드를 건드리지 않고 숫자만 바꿔 튜닝 가능. 파생 관계가 있는 값(예: 표류 쿨다운)은 상수 대신 함수로 계산해 관계가 자동으로 유지되도록 함.
- **NFR-4 공정성**: 인식/반응 지연이 있는 로직(체이서 폴링)도 실제 피해 판정(명중 여부)만큼은 항상 지연 없는 실시간 위치로 계산 — "반응이 느린 것"과 "판정이 불공정한 것"을 분리.
- **NFR-5 무상태 배포**: 서버/DB/세션 없음. 정적 파일 배포(Vercel)만으로 전체 기능 동작.

## 6. 데이터 모델 요약

### player
`x,y,w,h,vx,vy,facing,onGround,jumpsUsed,hp,invincibleTimer,attackState,attackTimer,hitEnemiesThisSwing,state(anchor|drift),driftTimer,driftCooldownTimer,driftCooldownDuration,pendingDamage[],driftTrail[],driftBurst`

### enemy (공통) / turret 전용 / chaser 전용
공통: `id,type,spawnX,spawnY,x,y,w,h,hp,maxHp,alive,flashTimer,hasBeenVisible,stunnable`
turret: `fireTimer,telegraphing`
chaser: `patrolMinX,patrolMaxX,facing,aiState,attackTimer,stunTimer,perceptionTimer,perceivedPlayerX,perceivedPlayerY`

### projectile
`x,y,vx,vy,r,damage`

### 전역 타임스톱 상태
`timeStopTimer,timeStopDuration,timeStopReason(damage|counter|null),timeStopOnComplete`

## 7. 부록 — CONFIG 파라미터 전체 목록

| 그룹 | 키 | 현재값 |
|---|---|---|
| 이동 | MOVE_SPEED / GRAVITY / MAX_FALL_SPEED / JUMP_FORCE / MAX_JUMPS | 420 / 2100 / 1400 / 760 / 2 |
| 이동(숏홉) | AIR_ATTACK_HOP_FORCE / MAX_AIR_ATTACKS | 420 / 1 |
| 근접 공격(지상) | ATTACK_RANGE_W/H / GROUND_ATTACK_WINDUP_DURATION / GROUND_ATTACK_ACTIVE_DURATION / GROUND_ATTACK_LUNGE_DISTANCE / GROUND_ATTACK_RECOVERY_DURATION / GROUND_ATTACK_POST_RECOVERY_LOCK_DURATION / ATTACK_DAMAGE | 85/75 / 0.06 / 0.13 / 10 / 0.14 / 0.03 / 1 |
| 체력 자연 회복(플레이어+몬스터, hpRegenDelay 걸린 존만) | HP_REGEN_DELAY | 2.5 |
| 근접 공격(공중) | AIR_ATTACK_RADIUS / 데미지(getAirAttackDamage = ATTACK_DAMAGE/2) | 85 / 0.5 |
| 플레이어 | PLAYER_MAX_HP / HIT_INVINCIBILITY_DURATION / RESPAWN_DELAY / PIT_FALL_BUFFER | 5 / 0.6 / 1.2 / 60 |
| 적 공통 범위(포탑/저격수 기본값) | ENEMY_DEFAULT_DETECTION_RANGE_W/H (감지만 유한, leash/attackRange는 Infinity=무한 어그로) | 480/270 |
| 포탑 | TURRET_FIRE_INTERVAL / TURRET_TELEGRAPH_DURATION / TURRET_MAX_HP / PROJECTILE_SPEED/RADIUS/DAMAGE | 2.2 / 0.5 / 5 / 260 / 8 / 1 |
| 저격수 | (FR-9.1~9.5 값 전부 포탑과 공유) / SNIPER_PROJECTILE_RADIUS | - / 15 |
| 카메라 | CAMERA_SMOOTHING_X / CAMERA_SMOOTHING_Y / CAMERA_DEADZONE_W / CAMERA_DEADZONE_H | 6 / 11 / 160 / 140 |
| 체이서 | CHASER_MAX_HP / PATROL_SPEED / CHASE_SPEED | 3 / 90 / 260 |
| 체이서 범위 | DETECTION_RANGE / DETECTION_VERTICAL_RANGE / LEASH_RANGE / ATTACK_RANGE_W/H | 480 / 130 / 650 / 130/130 |
| 체이서 타이밍 | ATTACK_TELEGRAPH_DURATION / ATTACK_RECOVERY_DURATION / ATTACK_DAMAGE / STUN_DURATION / PERCEPTION_INTERVAL | 0.65 / 0.6 / 2 / 0.5 / 0.1 |
| 유령 NPC | GHOST_NPC_FOLLOW_OFFSET / GHOST_NPC_FOLLOW_SMOOTHING | 40 / 10 |
| 표류 | DAMAGE_GRACE_PERIOD / DRIFT_DURATION | 0.5 / 0.4 |
| 표류 쿨다운 | COOLDOWN_COUNTER_MARGIN / COOLDOWN_WHIFF_EXTRA (→ 계산값 1.4s / 2.2s) | 0.4 / 0.8 |
| 표류 반격 | ATTACK_RANGE_W/H / COUNTER_DAMAGE_MULTIPLIER / EMPTY_SELF_DAMAGE / BURST_VISUAL_DURATION | 230/200 / 2 / 1 / 0.12 |
| 타임스톱 | HITSTOP_DURATION / HITSTOP_DOUBLE_HIT_GAP | 0.3 / 0.66 |

수치의 의미와 서로간의 관계(특히 왜 특정 값이 다른 값보다 커야 하는지)에 대한 상세 설명은 `index.html`의 `CONFIG` 객체 내 인라인 주석 및 파일 최상단 "게임 개요" 주석 블록을 참고.
