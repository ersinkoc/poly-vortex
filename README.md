# POLY-VORTEX: NEON PROTOCOL

[Play the game](https://poly-vortex.oxog.dev) · [Inspect the fleet](https://poly-vortex.oxog.dev/hangar/) · [GitHub](https://github.com/ersinkoc/poly-vortex)

A procedural 3D roguelite bullet heaven, built with Next.js 16, React 19, TypeScript 7, React Three Fiber, Drei, Three.js, Zustand, Framer Motion, and Tailwind CSS. All models, effects, terrain, and audio are generated locally. No external fonts, models, textures, or audio files are fetched.

Direct dependencies are pinned to the npm registry's stable `latest` releases verified on October 12, 2026: Next.js 16.4.0, React 19.3.0, Three.js 0.186.1, Framer Motion 14.1.0, Lucide React 1.55.0, TypeScript 7.0.2, and Tailwind CSS 4.3.3. `bun.lock` pins the complete dependency graph. Next.js 16 uses Turbopack and the project-local TypeScript CLI by default. Explicit ambient types in `tsconfig.json` include the Bun test runner for TypeScript 7.

Use Node.js 20.9 or newer and Bun 1.4.3 or newer. Development output is kept in `.next-dev`, separate from production output in `.next`.

## Run

```sh
bun install
bun run dev
```

Open the local URL printed by Next.js. To build and preview the static production site:

```sh
bun run build
bun run verify:export
bun run start
```

Requires a modern browser with WebGL 2 and hardware acceleration. Audio unlocks on the first player interaction. Muting and performance rendering are available in system settings. High quality caps pixel ratio at 1.5; performance quality uses pixel ratio 1 and disables multisampled postprocessing. Actual frame rate depends on hardware and resolution.

## GitHub Pages

The app is exported to `out/` with `output: 'export'` and directory-style URLs. No Node.js server is required in production. `.github/workflows/pages.yml` runs on pushes to `main`, pull requests, and manual dispatches. It installs from `bun.lock`, generates route types, runs strict TypeScript and regression tests, builds and verifies the export, and deploys successful `main` builds to the `github-pages` environment. Pull requests run validation without deploying. Action versions are pinned to verified commit SHAs.

The custom domain is `poly-vortex.oxog.dev`, configured in `public/CNAME` and GitHub Pages settings. Its DNS CNAME must point to `ersinkoc.github.io`. Enable **Enforce HTTPS** once GitHub finishes issuing the domain certificate. `public/.nojekyll` preserves the `_next` asset directory for static hosts. `bun run start --port 3002` previews exactly the exported files with the bundled Bun static server.

## Play

- **WASD / arrows:** Move with smooth inertia.
- **Mouse:** Aim your ship and dash direction. Weapons target automatically.
- **F / targeting button:** Switch Assisted targeting and Precision targeting. Precision requires the cursor in the arena and never falls back to an automatic target.
- **Space / right-click:** Phase shift. A brief invulnerable dash with a three-second base cooldown.
- **E / rocket button:** Fire one Hellion rocket at a clear, aligned hostile. Six rounds per deployment; blue ammo crates refill up to three rounds and 20 EMP charge.
- **Escape:** Pause or resume. Changing tabs or losing focus also pauses the game.
- **Module reel:** XP and elite salvage install upgrades automatically; keep moving.
- **Touch:** Use the on-screen movement joystick and dash button.

Collect cyan XP prisms. A compact side reel automatically installs one randomized common, rare, or overclocked upgrade without pausing combat. Mix pulse lasers, orbital glaives, cryo-singularities, and Tesla arcs. At three minutes the Vortex Sentinel arrives; destroy it to extract. Standard and Overdrive difficulties are available. Every run awards core credits, saved in browser local storage, for permanent armor, damage, and speed upgrades. There are no accounts or server dependencies.

## Visible hull damage — 1.8

The Poly-Core now shows actual lost integrity: expanding scorch patches, fractured panels and canopy, soot, and rougher, less reflective damaged surfaces. Shield-only hits retain the blue shield response; damage that reaches the hull produces orange sparks and a brief hot impact. Below 60% integrity, smoke rises from damaged wing sections and trails behind the moving ship. Below 35%, exposed wiring glows and sparks, signal lights weaken, and failing thrusters turn orange and flicker. Damage is normalized against maximum integrity, including permanent armor and Nanite upgrades. Repairs reduce the wear immediately; existing smoke dissipates naturally. Pause freezes impact and smoke simulation, and new deployments clear the effects. Menu previews always show a healthy core.

Smoke and sparks reuse fixed pools of 24 and 16 particles; Performance mode reduces their density. Reduced effects suppresses impact flashes and thruster flicker and reduces persistent sparks while preserving visible wear and smoke warnings. These are cosmetic indicators and do not change ship handling or weapon damage. All effects remain procedural with no downloaded assets.

## Automatic upgrades — 1.7

XP levels and elite caches feed one FIFO reward reel. Each 1.7-second spin installs exactly one of three random candidates, shows the installed result and actual stat changes for 1.35 seconds, then resolves the next reward. Multiple crates and several levels of XP queue without discarding rewards or interrupting movement, weapons, missions, or rocket intent. Candidates are generated from the latest build so maxed modules are excluded. Pause freezes the reel; ended runs stop installation and restart clears the queue. Reduced effects keeps the symbol stationary during decoding. There are no choice dialogs, selection keys, or card rerolls.

## Experience update — 1.4

- An encounter director alternates insertion, buildup, assault, and eight-second recovery windows. Nearby threats and integrity/shield loss can bring recovery forward, with a cooldown preventing endless relief. Remaining threats keep fighting; their health and damage do not change. Completing an operation also pauses reinforcements briefly. The Sentinel always arrives at three minutes and bypasses adaptive recovery.
- The encounter HUD shows the current phase, remaining time, and wave number. Contextual flight hints explain movement, Precision targeting, empty rocket racks, and critical integrity.
- Projected amber mission, red repair, and blue ammo signals follow their world positions. Off-screen signals become directional arrows. Only the closest unfinished objective and needed live supplies are shown, capped at three markers.
- Assisted mode retains mouse-priority targeting and keyboard/touch automatic tracking. Precision mode holds weapons when mouse aim is unavailable. Both retain cover, alignment, range, and pilot protection rules. Rockets remain manual and finite.
- Reduced effects disables camera shake, hit chromatic distortion, and interface movement. It follows the system reduced-motion preference by default and can be overridden in Settings. Warnings, weapons, and combat continue to work. Targeting and effects preferences persist alongside existing settings without replacing flight records.

The pacing design is informed by [Valve's AI Systems of Left 4 Dead](https://cdn.akamai.steamstatic.com/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf). Objective guidance and optional camera motion draw on Microsoft's [XAG 109](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/109) and [XAG 117](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/117). These are design references, not accessibility certification.

## Visual overhaul — 1.6

- A player-following directional shadow rig grounds the fleet, rocks, and industrial ruins. Warm key light, cool fill light, and a procedural reflection studio bring out chipped armor, brushed metal, and coated cockpit glass. Invulnerability retains the visible ship and adds an armor glow instead of rapidly hiding the entire model.
- The ground combines deterministic mineral/crack textures, stronger normal detail, macro weathering, varying roughness and reflective patches. The reactive neon grid follows the existing height geometry at a lower base intensity. Up to 324 instanced, decorative stone chips add depth without changing collision or firing lanes.
- Thruster nozzles emit crossed shader ribbons with hot cores and animated exhaust cells. The player's three engines respond to movement and extend during phase shift; Chaser and Goliath plumes follow their actual nozzle positions. Laser cores are rounded and gain soft tracer halos.
- Enemy deaths, rocket impacts and ion/EMP bursts create bounded layered effects. Fire blooms fade into rising smoke; metal fragments tumble and fall; larger fire explosions leave temporary ground scars. Up to three nearby explosion lights briefly illuminate ships and terrain. Energy bursts do not leave fire scorch marks.
- Visual state has separate budgets and identifiers: at most 24 active blasts, 48 scars, 144 puffs per layer and 192 debris fragments. Sprite textures and random detail are generated locally without consuming gameplay RNG. Effects freeze with the simulation and clear on redeployment.
- High mode enables shadows, smoke, debris, rubble and explosion lights. Performance mode retains the gameplay cues with smaller fire/exhaust layers and disables the expensive extras. Reduced effects limits fire brightness and disables explosion lighting and rapid exhaust modulation.
- The shader clamps interpolated UVs before fractional powers so invalid edge values cannot propagate through Bloom. All geometry, maps and GPU pools are reused and disposed on unmount. Frame rate still depends on hardware, resolution and horde density.

## Combat systems

- Five escalating sectors with distinct grid colors and timed ion-strike warnings.
- Regenerating Aegis shields; four seconds without taking a hit starts recovery.
- **Q / on-screen Surge:** an EMP that damages and pushes back nearby enemies, clears nearby hostile projectiles, and grants brief invulnerability. Charge rebuilds from combat and time; its own kills cannot refill it.
- Gold-marked elite variants carry rare salvage. Collect their crates for 20 extra run credits, a small repair, and a guaranteed rare-or-better module choice.
- White first-aid cases with red crosses first spawn at 30 seconds, then at 55–75-second intervals. Only one can remain on the field, it expires after 35 seconds, and routine kills no longer drop medical kits. Collect for +28 integrity, +15 shields, and 8 seconds of fast repair (+4 integrity/second). Red plus signs on the radar and hovering beacons mark their location. Additional kits refresh the repair duration; integrity never exceeds its maximum.
- Prism-magnet and temporary overdrive supply drops are also spaced out: timed drops every 40 seconds after the first at 24 seconds, combat drops no more than once per 25 seconds.
- Critical-targeting, shield-capacity, and piercing-round upgrades installed by the automatic module reel.
- A three-phase Sentinel with radial, spiral, and targeted barrages plus telegraphed strikes.
- Instanced shockwaves, shield impacts, floating damage numbers, critical indicators, tactical radar, sector transmissions, and overdrive status.
- Persistent flight records and seven achievements. Legacy saves retain credits and upgrades; known victories and deployment counts unlock the corresponding records. Audio, quality, difficulty, and starting loadout preferences are also saved locally.

## Limited ordnance

### Launcher clarity — 1.5

The rocket panel now states **E / tap to fire**, shows the locked enemy and distance, the six-round rack, alignment/cycling progress, and an actionable explanation for missing aim, range, cover, protected pilots, empty ammunition or a full flight pool. HUD readiness and actual launch checks share one inspection function, so a stale laser lock cannot falsely mark a blocked rocket shot ready.

Pressing E or tapping while the ship turns queues one launch for at most 0.85 seconds. The intent belongs to that exact hostile; target loss, a blocked lane, timeout, pause or an ended run cancels it without spending ammunition. Automatic upgrade rolls keep the launch active. Commands never transfer to another enemy and repeated presses cannot extend the queue. Ready launches remain immediate with a 0.75-second cycle. A launch flare, **ROCKET AWAY** feedback and the changing rack count confirm the shot. Reload notices show the actual capped round count or an EMP-only recharge.

Manual rocket intent runs before automatic Pulse/Cryo/Tesla attacks, so a Tesla kill in the same frame cannot silently discard the command. A missile already in flight remembers its target's last position. If another weapon kills that hostile, it airbursts at that position instead of wandering past the fight; surviving nearby hostiles still receive covered, distance-based blast damage. Terrain collision and pilot protection retain priority.

**HELP** on the launcher opens a four-step flight manual and pauses combat. Close the manual and resume when ready. It explains acquisition, launch, confirmation and blue-crate reloading. Precision aim holds while moving from the canvas onto the launcher panel for a mouse click; leaving the panel releases it. The keyboard and touch paths use the same finite-ammunition rules.

- Hellion rockets are manually launched with **E** or the HUD button. The rack holds six rounds, has a 0.75-second firing cooldown, and never regenerates ammunition over time. Invalid targets, blocked firing lanes, and suspended gameplay spend no ammunition.
- Rockets accelerate, steer towards the locked hostile, leave exhaust trails, and explode on contact with terrain or a hostile. A direct hit deals 130 base damage; nearby hostiles receive distance-based blast damage within 4.5 units. Cover and protected pilots remain part of the targeting rules.
- Blue rocket-rack crates first appear at 18 seconds, then every 35–50 seconds. Up to two can remain on the map for 70 seconds. They refill up to three rockets and 20 EMP charge; a crate stays available if both resources are already full. Ammo markers appear in blue on the radar.
- Red first-aid cases are scarce: first at 30 seconds, then every 55–75 seconds, at most one on the map. They expire after 35 seconds. Dense kill streaks cannot flood the map with medical or support drops.

## Deliberate targeting

- Mouse aim selects a hostile within a narrow aiming cone. The cannon holds fire when the aim is empty, obstructed, or points past an unrescued pilot. Without mouse aim, stable automatic tracking remains available for keyboard and touch play.
- Pulse upgrades create a focused multi-barrel salvo at the same primary target. The ship turns before firing; moving sideways does not break automatic tracking. A target ring, subtle aiming cone, target name, range, and integrity meter make the selected hostile visible.
- Laser steering has a limited turn rate. Bolts stop following targets behind their flight direction, retain their heading after losing a target, expire at their travel range, and hit terrain instead of passing through it. Enemy shots also collide with cover.
- Cryo has a 16-unit deployment range. Tesla starts on the primary target, then chains only to nearby hostiles with clear lines. Survivors are separate from hostile targets and prevent friendly shots through their position.

## Field operations and terrain

- The first operation opens after eight seconds. Three stranded human pilots wait beside damaged escape pods: remain within the amber perimeter for 1.5 seconds each to beam them out. Leaving the perimeter gradually interrupts extraction.
- Rescue, relay restoration, and blockade missions rotate. Relays require eight seconds inside their perimeter; blockade operations count twenty new eliminations. Operations have deadlines, navigation arrows, radar markers, progress meters, and a ten-second breather after success.
- A rescue grants 45 bonus credits; relay and blockade operations grant 30. All completed operations also grant 1,500 score, 15 integrity, and 25 EMP charge. Rescued pilots and completed missions appear in the run summary. Failed operations yield no reward and a new operation follows.
- The world now has actual height geometry, shallow crater basins, uneven rock formations, and industrial ruins. Stone albedo, normal, and roughness maps are generated locally. The neon grid and explosion ripples follow the shaped surface.
- Terrain is regenerated around the moving player, with bounded instanced scenery. Ships slide around solid formations; mission locations spawn outside their footprint. Existing first-aid packs and weapons remain available.

## Architecture

- `src/game/engine.ts`: Seedable, fixed-step simulation. Mutable game state runs outside React. Horde flocking uses local spatial bins; enemies, projectiles, debris, and XP have hard pool limits.
- `src/game/store.ts`: Zustand state for UI snapshots, run lifecycle, safe local storage hydration, and permanent progression. HUD snapshots publish at approximately 10 Hz.
- `src/game/audio.ts`: Web Audio oscillator synthesizer. A combo-reactive bassline, percussion, and procedural sound effects. Music stops while paused, upgrading, or outside a run.
- `src/components/arena.tsx`: Client-only R3F canvas, instanced geometry, reactive shader floor, camera trauma, emissive bloom, hit-reactive chromatic aberration, vignette, and tone mapping.
- `src/game/ship-models.ts`: Five procedural hard-surface spacecraft models with layered armor, rivets, vents, cannons, engine nacelles, cockpit glass, brushed surface textures, roughness, and normal maps. Each model stays under 7,500 triangles and uses six material batches.
- `src/components/ships.tsx`: Shared instanced ship pools, hover/bank animations, engine response, and soft contact shadows.
- `src/components/ship-lighting.tsx`: Procedural studio reflection environment; no external HDRI files.
- `src/components/ship-hangar.tsx`: Interactive Drydock for rotating and zooming into every player/enemy model, including the Sentinel.
- `src/components/game-shell.tsx`: Command center, live HUD, loadout selection, settings, core upgrades, touch controls, and run overlays.

Rendering uses WebGL 2 because the requested postprocessing composer is WebGL-based. Resources are declaratively owned and disposed by R3F. Geometries are reused by instanced pools; no geometry or material is allocated in the frame loop. Only the player and preview reactor use local point lights to avoid per-projectile light overhead.

## Verify

```sh
bun run typecheck
bun run test
bun run build
bun run verify:export
```

The Bun test suite covers movement, dash invulnerability, all four weapon systems, damage, bounded pools, guaranteed boss spawning, paused simulation, XP and upgrade sequencing, extraction, restart isolation, permanent progression purchases, and procedural GPU resources. Fleet tests verify finite complete vertex attributes, geometry budgets, deterministic textures, correct color spaces, shared PBR resources, and soft shadow edges.
