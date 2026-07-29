# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A 2D side-scrolling action platformer prototype, implemented as a single static file (`index.html`: inline `<style>` + `<canvas>` + inline `<script>`). No build step, no package manager, no dependencies, no test suite.

For *why* the game works the way it does and the exact behavior of every system, read `PRD.md` (product intent) and `SRS.md` (functional requirements with exact numbers) before making non-trivial gameplay changes — they document the current implementation, not aspirational features. Keep them in sync when you change behavior they describe.

## Commands

- **Run locally**: open `index.html` directly in a browser, or `npx serve .` for a local server.
- **Deploy**: `vercel` (project is already linked via `.vercel/`; push to `master` does not auto-deploy — deployment is manual). There is no lint/build/test command; there is no CI.

## Architecture

Everything lives in `index.html`. Read the "게임 개요" (game overview) comment block at the top of the `<script>` tag first — it's a map of how the core systems interlock. Key points:

- **All tuning values live in one `CONFIG` object** at the top of the script, grouped by system with inline comments explaining units and relationships. Prefer changing `CONFIG` numbers over touching logic when adjusting balance. Where one value must stay derived from another (e.g. drift cooldowns must exceed invincibility + grace period), that relationship is implemented as a function (`getDriftCooldownOnCounter()`/`getDriftCooldownOnWhiff()`), not a second hardcoded constant — follow that pattern rather than reintroducing magic numbers that can drift out of sync.
- **Three interlocking combat systems** are the heart of the game and worth understanding before touching combat code:
  1. **Damage grace period** (`anchor` state) — hits don't apply to HP immediately; they sit in `player.pendingDamage` for `DRIFT_DAMAGE_GRACE_PERIOD` and only confirm if the player doesn't react.
  2. **Drift** (`drift` state, right-click) — a risk/reward parry-riposte: damage taken while drifting accumulates instead of applying, and resolves into a wide counterattack (or self-damage if nothing was absorbed) when the drift timer ends.
  3. **Hitstop/timestop** — `timeStopTimer > 0` makes the main loop skip `update()` entirely for a few frames on confirmed damage or a counter hit. `triggerTimeStop(duration, reason, onComplete)` supports chaining freeze segments (used for the drift counter's two-hit projectile-absorb bonus) — if you add a new hitstop trigger, reuse this rather than a parallel freeze mechanism.
  - Escape hatch: a projectile with `unblockable: true` (currently only the sniper enemy's shots) skips all three — `damagePlayer()` is never called for it, it goes straight to `applyDamageToHp()`, and the drift-counter's projectile-absorb loop explicitly skips it. It still respects `invincibleTimer`. If you add another must-dodge hazard, reuse this flag rather than inventing a parallel bypass.
- **Chaser enemy AI** deliberately perceives the player through a periodic poll (`CHASER_PERCEPTION_INTERVAL`), not live position, to feel laggy — but the actual attack-hit check always uses the real current player position/hitbox, never the perceived one. Keep that split when touching chaser logic: perception can lag, hit resolution must stay fair.
- **Every enemy carries generic detection/leash/attack-range instance fields** (`detectionRangeW/H`, `leashRangeW/H`, `attackRangeW/H`, seeded from `CONFIG` in each `make*` factory) plus an aggro concept — turret/sniper have an explicit `enemy.aggro` boolean toggled in `updateTurretAI`, chaser's equivalent is derived from `aiState` (patrol/return = not aggroed). An enemy only acts (fires/telegraphs/chases) once aggroed; before that it's rendered but inert — that inert state is where per-type idle animations are meant to go later, so don't collapse it back into "act immediately once `hasBeenVisible`." Turret/sniper's `detectionRangeW/H` default to a fixed `ENEMY_DEFAULT_DETECTION_RANGE_W/H` (pinned to the *original* 960×540 screen size, not the live `W`/`H`) — that pin is deliberate: the camera viewport (`W`/`H`, canvas `width`/`height`) is now wider than that so the player can see an enemy on screen before it's actually in range. Don't derive the default range from `W`/`H` or this collapses back to "visible = aggroed."
  - `leashRangeW/H`/`attackRangeW/H` are the general on/off switch for "does this enemy ever give up aggro": a finite number behaves like chaser's leash (`dist > range` can go true again later), `Infinity` makes that comparison permanently false — turret/sniper use `Infinity` for both, so once `aggro` flips true from the one-time detection check it never flips back. No separate "infinite" flag or sentinel needed; it's just what `Infinity` already does in a `>` comparison. Reach for this when adding a new enemy that should either have a real leash (give it a number) or aggro forever once triggered (give it `Infinity`).
- **Enemy HP is in half-point increments** (ground attack = 1, air attack = 0.5 via `getAirAttackDamage()`), rendered as diamond pips (`drawHpPip`) that can show a half-fill. Don't inflate monster max-HP to dodge fractional damage — it was tried once and diluted the drift counter's relative punch (its multiplier scales off damage the player took, not off monster HP).
- **Air attack always overwrites `player.vy`** to `-AIR_ATTACK_HOP_FORCE` on trigger (see `startAttack`/the attack-input block in `updatePlayer`), independent of `jumpsUsed` — this is what lets jump → double jump → air attack chain into a de facto triple jump. Don't gate it behind `MAX_JUMPS`.
- **Rendering** happens in world space inside a single `ctx.translate(-camera.x, -camera.y)` block in `draw()`; HUD elements are DOM overlays outside the canvas and are camera-independent (`updateHud()`).
- **Input** unifies keyboard and mouse buttons through one pipeline (`heldKeys`/`justPressed`/`pendingKeyAfterFreeze`) so mouse clicks get the same during-hitstop input-queueing treatment as keys — see the "입력 처리" section.
- The ghost NPC companion is purely cosmetic and intentionally has zero references from any collision/damage function — don't wire it into gameplay logic.

## Git / deployment

- Repo is linked to Vercel (`.vercel/project.json`) and to GitHub (`origin`). Commits to `master` do not auto-deploy; deploying is a separate explicit step (`vercel` / `vercel --prod`).
- **Pushing to GitHub (`origin`) is pre-authorized**: after committing, push to `master` automatically without asking for confirmation first.
- **Vercel deployment stays manual**: never run `vercel` / `vercel --prod` unless the user explicitly asks for that deploy, even after pushing to GitHub.
- No CI, no PR checks — the only verification available is manual play-testing and reasoning about the code (or writing a throwaway Node script that copies the relevant pure-logic functions to simulate them, since the real code depends on `<canvas>`/DOM).
