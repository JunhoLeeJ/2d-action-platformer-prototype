# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A 2D side-scrolling action platformer prototype, implemented as plain HTML/CSS/JS: `index.html` (markup + inline `<style>` + `<canvas>`) loading a sequence of classic `<script src>` files under `js/`. No build step, no bundler, no package manager, no dependencies, no test suite — deliberately kept this way so `index.html` still opens directly via `file://` with zero setup (see "File layout" below for why this rules out ES modules).

For *why* the game works the way it does and the exact behavior of every system, read `PRD.md` (product intent) and `SRS.md` (functional requirements with exact numbers) before making non-trivial gameplay changes — they document the current implementation, not aspirational features. Keep them in sync when you change behavior they describe.

## Commands

- **Run locally**: open `index.html` directly in a browser, or `npx serve .` for a local server.
- **Deploy**: `vercel` (project is already linked via `.vercel/`; push to `master` does not auto-deploy — deployment is manual). There is no lint/build/test command; there is no CI.

## Architecture

### File layout

Read `js/main.js`'s top-of-file "게임 개요" comment block first — it's a map of how the core systems interlock. Files load as plain classic `<script src>` tags (no `type="module"`, no bundler — modules fail via CORS when `index.html` is opened with `file://`, which would break the zero-setup "just open it" workflow), so every file shares one global scope. Load order in `index.html` matters in exactly two places — everything else resolves at call time, not parse time:

```
js/config.js                    CONFIG
js/engine/dom.js                canvas/ctx/W/H, clamp/rectsOverlap/circleRectOverlap
js/engine/input.js               heldKeys/justPressed/pendingKeyAfterFreeze, event listeners
js/engine/timestop.js           timeStopTimer, triggerTimeStop
js/engine/camera.js             camera, updateCamera, cameraOverrideTarget (cutscene camera holds)
js/entities/enemies.js          적 팩토리(makeTurret/makeSniper/makeChaser)/AI, enemies[], projectiles[]
js/entities/player.js           player, ghostNpc, gameState, 표류(drift) 시스템, respawnPlayer
js/engine/zones.js              ZONES registry, currentZone, loadZone(), 존별 규칙 플래그(ruleFlags)
js/engine/checkpoint.js         currentCheckpoint, activateCheckpoint()
js/engine/cutscene.js           트리거 시퀀스 엔진(대화/카메라 홀드/애니메이션/페이드), 텍스트박스
js/rendering.js                 draw(), updateHud()
js/levels/*.js                  존 데이터 - ZONES에 등록. zones.js *다음*에 로드되어야 함 (파싱 시점에 등록하므로)
js/main.js                      update()/loop()/부트스트랩 - 반드시 맨 *마지막*에 로드
```

Every `js/levels/*.js` file wraps its content in an IIFE (`(function(){ ... })();`) rather than declaring top-level `const`/`let` — classic `<script>` tags share one lexical scope, so two zone files both declaring e.g. `const groundY` would throw a `SyntaxError` and take down the whole page. Follow that pattern for every new level file.

### World model: zones, floors, checkpoints, cutscenes

The world is a **graph of discrete zones** (`ZONES` in `js/engine/zones.js`), not one continuous world. Each zone is a self-contained level — its own `width`/`height`/platforms/gaps/wall-gates/enemy spawns/checkpoints/doors/trigger zones — and `loadZone(zoneId, spawnAt)` swaps `currentZone` (rebuilding `enemies` fresh from that zone's `enemySpawns` every time, never mutating in place, so no state leaks between zones) and repositions the player/ghost/camera. `floor` on a zone def is bookkeeping metadata only — there's no separate "floor transition" mechanism; a floor boundary is just an ordinary door into a zone that happens to carry an entry cutscene (see below).
- **Camera follows both axes** (`js/engine/camera.js`): `updateCamera` runs the same deadzone+exponential-lerp logic on X and Y independently (`CAMERA_DEADZONE_W`/`CAMERA_DEADZONE_H`), clamped to `currentZone.cameraBounds` (`{minX,maxX,minY,maxY}`, derived from the zone's `width`/`height` in `loadZone`). Most zones set `height` equal to the canvas height `H` so `maxY` collapses to `0` and there's effectively no vertical scroll (matches the original game's fixed-height feel) — give a zone a `height` taller than `H` (see `f1z2_platforms` for a worked example: a climbing tower well above one screen height) when you actually want vertical traversal to pull the camera up/down. Don't set a zone's `width`/`height` *smaller* than `W`/`H` — the clamp range inverts (`maxX/maxY` goes negative) and collapses the camera to a fixed `0`, which silently breaks follow on that axis.

- **Doors**: a zone's `doors.right` is real data (`{x,y,w,h,targetZoneId}`) that `loadZone` turns into a synthesized trigger — walking into it fades to black, swaps zones at full-black (`onMidpoint`), fades back in. `doors.left` is background-only geometry with no trigger (no generic backward travel — a specific narrative exception, if one is ever needed, is a hand-authored trigger, not an engine feature).
- **Trigger zones** (`zone.triggerZones`, fired by `js/engine/cutscene.js`) come in two kinds: `"walkIn"` (fires once the player's **X range** overlaps `[xMin,xMax]` — deliberately no Y check, so it can never be jumped over) and `"auto"` (fires immediately when its zone loads). Both play an ordered `sequence` of events (`dialogue`/`cameraHold`/`animation`/`fade`/`callback`) through `startSequence`/`advanceSequence`/`endSequence` — `endSequence` is the **one** exit point every sequence funnels through (camera override cleared, textbox hidden, next queued auto-trigger drained), which is what guarantees a sequence can never leave dangling UI state or let two sequences run concurrently. While a sequence runs, `gameState === "cutscene"` routes around `updatePlayer()` entirely, which is also what makes enemies/projectiles/death auto-freeze during cutscenes (they already gated on `gameState !== "playing"` before cutscenes existed — extending the enum got that for free instead of adding new guards). Reuse this system for any new story beat rather than inventing a parallel "block input" flag.
- **Checkpoints**: `currentCheckpoint` (`js/engine/checkpoint.js`) is a mutable `{zoneId,x,y}`, set via `activateCheckpoint()`. `respawnPlayer()` composes `loadZone(currentCheckpoint.zoneId, currentCheckpoint)` (handles same-zone *and* cross-zone respawn uniformly) and then resets vitals (HP/attack/drift state) — `loadZone` itself never touches HP/combat state, so an ordinary door transition (which also calls `loadZone`) correctly preserves HP/cooldowns while death correctly resets them.
- **Rule flags** (`zone.ruleFlags`, defaults in `RULE_FLAG_DEFAULTS`): per-zone overrides (`disableJump`/`disableAttack`/`disableDrift`/`playerInvincible`/`hpFloor`) for tutorial-style exceptions, read via `getRuleFlag(name)`. `driftUnlocked` is a separate single global boolean (not a rule flag) since drift is meant to be locked/unlocked once for the whole game by a specific story beat, not per zone.

### Combat/movement (unchanged by the above — still exactly as it was pre-refactor)

- **All tuning values live in one `CONFIG` object** (`js/config.js`), grouped by system with inline comments explaining units and relationships. Prefer changing `CONFIG` numbers over touching logic when adjusting balance. Where one value must stay derived from another (e.g. drift cooldowns must exceed invincibility + grace period), that relationship is implemented as a function (`getDriftCooldownOnCounter()`/`getDriftCooldownOnWhiff()`), not a second hardcoded constant — follow that pattern rather than reintroducing magic numbers that can drift out of sync.
- **Three interlocking combat systems** are the heart of the game and worth understanding before touching combat code:
  1. **Damage grace period** (`anchor` state) — hits don't apply to HP immediately; they sit in `player.pendingDamage` for `DRIFT_DAMAGE_GRACE_PERIOD` and only confirm if the player doesn't react.
  2. **Drift** (`drift` state, right-click) — a risk/reward parry-riposte: damage taken while drifting accumulates instead of applying, and resolves into a wide counterattack (or self-damage if nothing was absorbed) when the drift timer ends.
  3. **Hitstop/timestop** — `timeStopTimer > 0` makes the main loop skip `update()` entirely for a few frames on confirmed damage or a counter hit. `triggerTimeStop(duration, reason, onComplete)` supports chaining freeze segments (used for the drift counter's two-hit projectile-absorb bonus) — if you add a new hitstop trigger, reuse this rather than a parallel freeze mechanism.
  - Escape hatch: a projectile with `unblockable: true` (currently only the sniper enemy's shots) skips all three — `damagePlayer()` is never called for it, it goes straight to `applyDamageToHp()`, and the drift-counter's projectile-absorb loop explicitly skips it. It still respects `invincibleTimer`. If you add another must-dodge hazard, reuse this flag rather than inventing a parallel bypass.
- **Chaser enemy AI** deliberately perceives the player through a periodic poll (`CHASER_PERCEPTION_INTERVAL`), not live position, to feel laggy — but the actual attack-hit check always uses the real current player position/hitbox, never the perceived one. Keep that split when touching chaser logic: perception can lag, hit resolution must stay fair.
- **Every enemy carries generic detection/leash/attack-range instance fields** (`detectionRangeW/H`, `leashRangeW/H`, `attackRangeW/H`, seeded from `CONFIG` in each `make*` factory) plus an aggro concept — turret/sniper have an explicit `enemy.aggro` boolean toggled in `updateTurretAI`, chaser's equivalent is derived from `aiState` (patrol/return = not aggroed). An enemy only acts (fires/telegraphs/chases) once aggroed; before that it's rendered but inert — that inert state is where per-type idle animations are meant to go later, so don't collapse it back into "act immediately once `hasBeenVisible`." Turret/sniper's `detectionRangeW/H` default to a fixed `ENEMY_DEFAULT_DETECTION_RANGE_W/H` (pinned to the *original* 960×540 screen size, not the live `W`/`H`) — that pin is deliberate: the camera viewport (`W`/`H`, canvas `width`/`height`) is now wider than that so the player can see an enemy on screen before it's actually in range. Don't derive the default range from `W`/`H` or this collapses back to "visible = aggroed."
  - `leashRangeW/H`/`attackRangeW/H` are the general on/off switch for "does this enemy ever give up aggro": a finite number behaves like chaser's leash (`dist > range` can go true again later), `Infinity` makes that comparison permanently false — turret/sniper use `Infinity` for both, so once `aggro` flips true from the one-time detection check it never flips back. No separate "infinite" flag or sentinel needed; it's just what `Infinity` already does in a `>` comparison. Reach for this when adding a new enemy that should either have a real leash (give it a number) or aggro forever once triggered (give it `Infinity`).
- **Enemy HP is in half-point increments** (ground attack = 1, air attack = 0.5 via `getAirAttackDamage()`), rendered as diamond pips (`drawHpPip`) that can show a half-fill. Don't inflate monster max-HP to dodge fractional damage — it was tried once and diluted the drift counter's relative punch (its multiplier scales off damage the player took, not off monster HP).
- **Air attack always overwrites `player.vy`** to `-AIR_ATTACK_HOP_FORCE` on trigger (see `startAttack`/the attack-input block in `updatePlayer`), independent of `jumpsUsed` — this is what lets jump → double jump → air attack chain into a de facto triple jump. Don't gate it behind `MAX_JUMPS`. It's gated by its own counter instead: `player.airAttacksUsed` vs `CONFIG.MAX_AIR_ATTACKS` (1), reset to 0 alongside `jumpsUsed` at every landing spot — without this, the attack's recovery is short enough that spamming it while airborne never lets you touch the ground. When out of charges, the attack input is silently ignored while airborne (same as pressing jump with no jumps left) — no swing, no hitbox, no hop.
- **Rendering** happens in world space inside a single `ctx.translate(-camera.x, -camera.y)` block in `draw()` (`js/rendering.js`); HUD elements, the cutscene textbox (`#cutsceneBox`), and the fade overlay (`#fadeOverlay`) are DOM overlays outside the canvas and are camera-independent. The fade overlay in particular must stay DOM (not a canvas fill) so it also covers the HP bar — a "black screen" that leaves the HUD visible isn't actually a fade.
- **Input** unifies keyboard and mouse buttons through one pipeline (`heldKeys`/`justPressed`/`pendingKeyAfterFreeze`, `js/engine/input.js`) so mouse clicks get the same during-hitstop input-queueing treatment as keys.
- The ghost NPC companion is purely cosmetic and intentionally has zero references from any collision/damage function — don't wire it into gameplay logic. (It's slated to become the `gyeol` AI companion in future floor content — that conversion hasn't happened yet.)

## Git / deployment

- Repo is linked to Vercel (`.vercel/project.json`) and to GitHub (`origin`). Commits to `master` do not auto-deploy; deploying is a separate explicit step (`vercel` / `vercel --prod`).
- **Committing is pre-authorized and automatic**: after finishing a meaningful chunk of work (a feature, a fix, a session's worth of changes), commit it without waiting to be asked — the user wants work saved as it happens, not batched up for an explicit "commit this" request. Use judgment on commit granularity (don't commit mid-edit or in a broken state); split unrelated work into separate commits rather than one giant one.
- **Pushing to GitHub (`origin`) is pre-authorized**: after committing, push to `master` automatically without asking for confirmation first.
- **Vercel deployment stays manual**: never run `vercel` / `vercel --prod` unless the user explicitly asks for that deploy, even after pushing to GitHub.
- No CI, no PR checks — the only verification available is manual play-testing and reasoning about the code (or writing a throwaway Node script that copies the relevant pure-logic functions to simulate them, since the real code depends on `<canvas>`/DOM).
