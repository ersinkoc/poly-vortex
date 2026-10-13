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
- **B / charge button:** Plant a ground charge at your position. Three-second fuse, 5.5m blast, three-charge rack. Blue crates and field service reload one.
- **Escape:** Pause or resume. Changing tabs or losing focus also pauses the game.
- **Module reel:** XP and elite salvage install upgrades automatically; keep moving.
- **Touch:** Use the on-screen movement joystick and dash button.

Collect cyan XP prisms. A compact side reel automatically installs one randomized common, rare, or overclocked upgrade without pausing combat. Mix pulse lasers, escort drones, cryo-singularities, and Tesla arcs. At three minutes the Vortex Sentinel arrives. Classic extracts immediately on its defeat; Expedition opens a service and extraction window, then continues into another front. Standard and Overdrive difficulties are available. Every run awards core credits, saved in browser local storage, for permanent armor, damage, and speed upgrades. There are no accounts or server dependencies.

## Live fleet intro — 1.28.0

The desktop launch screen again shows the selected warship surrounded by the original slowly rotating enemy formation: interceptors, ranged craft and heavy armored vehicles. The camera opens out to show both sides while keeping the direct ship-selection cards and deployment controls. The existing instanced fleet renderer handles the thirty preview actors; menu actors do not fire, run combat AI or advance the run. Mobile keeps the lightweight portrait-based launch screen.

## Visual command center and focused HUD — 1.27.0

The launch screen starts with three directly selectable warship image cards, followed by starting weapon and flight plan. Hull/shield/speed values and the deployment button reflect the selected frame immediately. The desktop preview follows the selected ship. Small-screen menus use the three local portraits without mounting a 3D canvas. The portraits are 420×300 JPEG captures of the project's own procedural models, about 20 KB combined, and require no external image service at runtime.

The visual flight manual illustrates movement/dash, aim/autofire, rockets/bombs/reload and prisms/pilot rescue in four small local SVG scenes. Extra boss, drone, rover and service rules live in an expandable section; the rocket manual includes a lock/launch/impact/reload picture sequence. Pause and results use direct actions, including choosing the next ship.

Desktop combat keeps hull/shield, time, the active mission chip, equipped weapons, action buttons, XP and boss integrity. Radar, encounter pacing, mission descriptions, drone batteries, rover status and run details move into the same Tactical overview already used on mobile. Press T or click Tactical to pause and inspect; close or press T/Escape to return. If opened from an existing pause, closing preserves that pause. Extraction remains visible during service. The compact rocket action preserves the last mouse aiming lane while hovered and shows launch readiness/ammunition and actionable notices. No combat rules, upgrade flow, rewards or input bindings are removed.

## Flightframes and adaptive rendering — 1.26.0

Choose a warship below the launch button, or inspect and select it in the 3D drydock. Vector retains the original 100 hull / 40 shield balance. Wraith has 85 hull, 30 shield, 118% speed and 95% damage. Aegis has 125 hull, 60 shield, 85% speed and 105% damage. All three are immediately available; weapon loadouts remain independent and permanent upgrades stack with each chassis. Selection persists in the existing local settings and is snapshotted at deployment. Live/paused runs cannot swap frames. Unknown saved IDs fall back to Vector. The models have different procedural silhouettes, armor, engines and guns while sharing the existing flight scale and docking position.

The default AUTO render mode keeps PBR lighting, bloom and readable combat signals. It caps pixel density at 1.35 and removes the four-sample postprocessing allocation. After sustained foreground FPS below 46, it first reduces pixel density to 1; continued pressure switches to the existing lighter shadow, volume/debris and lighting budget at 0.85 density. A ten-second cooldown and fifteen seconds of stable 58+ FPS prevent rapid quality toggling. Hidden tabs, pause, isolated stalls and startup warmup do not trigger degradation. HIGH and PERFORMANCE remain explicit fixed preferences. Gameplay timing, enemy populations, damage and rewards are unchanged by rendering mode.

Paused combat uses on-demand rendering to avoid continually redrawing a frozen scene. Resume restores continuous simulation and rendering; end-of-run destruction still finishes. The arena builds one selected player model and reuses fleet materials/textures, while the drydock now loads only the inspected model rather than the whole fleet. No external assets or extra canvas are introduced by the selector. The governor is a responsiveness target, not a hardware-independent FPS guarantee.

## Rover radar minefields — 1.25.0

Four-wheel rovers now carry independently rotating procedural phased-array radar heads. Once parked, each projects a terrain-conforming holographic hex field: a solid inner 1.6m sensor boundary and a faint dashed outer 4.2m blast boundary. The small center arc shows remaining parked lifetime, then the short detonation fuse. Cyan means armed, amber marks a radar contact, and red means primed.

The 3.6-second radar sweep registers live hostiles within blast reach and line of sight, leaves up to four fading diamond echoes per rover, follows their positions and immediately removes dead, out-of-range or stone-occluded contacts. Swept intervals cover low frame rates. Radar reads simulation age, so pause/hit-stop freeze both heads and echoes. It is reconnaissance feedback: existing launch, trigger, explosion damage, core/pilot protection and combat RNG are preserved.

The field pool has one draw call and fewer than 11,000 vertices across all twelve rover slots. Ground samples update only when parked positions change; radar heads, lamps and contact marks are instanced. Reduced-effects mode keeps the range/state/countdown information while suppressing rotating heads and ground sweeps. All geometry, shader patterns and signals are local; no extra mobile panel is added.

## Sentinel balance — 1.24.0

Sentinel health snapshots the installed arsenal, damage, critical chance, firing haste and surviving escort count at arrival, with a minimum hull and ordnance reserve. Later upgrades do not rescale an existing boss. Temporary Overdrive pickups still give a real advantage; Overdrive difficulty and later expedition fronts raise the encounter budget.

A blue armored reactor reduces incoming damage by 40% for 3.2 seconds, followed by an amber 3.3-second opening that increases incoming damage by 35%. The shared desktop/mobile meter shows the state and countdown, and the rendered reactor lights follow the same simulation clock. All damage types pass through the same armor calculation; no hidden invulnerability or forced minimum fight timer is added.

The duel retains ring, spiral and targeted barrages. Additional ground strikes escalate from one to two to three marked zones, with a 1.6-second warning and bounded projectile/hazard pools. Phase I ring cadence is 1.3 seconds. Pause and hit-stop freeze armor and strike timers. A deterministic, stationary, invulnerable stress fixture with all four modules at level 6, fourfold damage, maximum legal haste and critical chance required 21.97 seconds and passed through all three phases; actual run duration depends on aim, range, cover, movement and temporary boosts.

## Living battlefield — 1.23.0

Small procedural desert foxes and lizard-like scavengers occasionally wander into the arena, pause, look around and flee nearby ships, hostiles and fresh physical explosions. Goliath wrecks sometimes release one or two unarmed crew: runners escape immediately, while injured survivors crawl before getting up. Their departure starts above the wreck, settles onto the actual terrain and animates independent limbs. Muted colors and a small scale keep them separate from the beacon-marked rescue pilots.

Ambient actors have independent deterministic randomness and identities. They never become weapon targets, enemies, loot or score events; they do not block combat movement or firing lanes. Wildlife is capped at eight and crew at twelve, with lifetimes, distance culling, terrain clearance and instanced rendering. Boss and service windows hold new animal visits. Pause, hit-stop and run endings freeze their motion; restarting clears them. Ordinary unmanned drones and the Sentinel do not release human crew, and recalled enemies never count as wrecks.

## Volumetric explosions — 1.22.0

Physical blasts now use bounded volume integration through turbulent fire clouds, rather than additive glowing disks. A brief ignition flash transitions into orange hot pockets, cooling soot, curling secondary flames and shaded rising smoke. Low dust fronts spread along the ground, and hot fragments briefly glow before cooling. Metal fragments are sized independently of blast radius, settle flat with their thickness above the terrain, and retain their existing ballistic motion. High quality uses eight integration steps and more cloud lobes; performance mode uses six steps and fewer particles. All effects share procedural density textures and fixed instance pools; new impacts take priority over old smoke. Pause and hit-stop freeze the cloud evolution with the simulation. Existing damage, ordnance and weapon timing remain unchanged.

## Vehicle destruction — 1.21.0

Every destroyed vehicle, including ranged platforms, escorts and the player core, emits a physical blast at its hull altitude. A textured fireball gives way to smaller flickering flames for 2.8 seconds, rising dark smoke for six seconds, and distinct metal panels and chassis chunks that fall, bounce and settle on the terrain before fading. Balanced quality also retains fire, smoke and fewer fragments. EMP and energy-only discharges remain clean. Combat effects freeze on pause; after defeat or extraction only the remaining destruction animation finishes while gameplay stays frozen. Effects share fixed instance budgets; overflow retains the latest impacts without changing combat randomness.

## Enemy weapon roles — 1.21.0

Ranged platforms enter patrols after three seconds. Pink plasma platforms hold 7–10m and release three aimed rounds 0.18s apart after a 0.55s warning. Violet laser snipers hold 11–14m and charge for 1.1s before a fast single bolt; amber rocket platforms hold 12–16m and launch a slow unguided rocket after 0.9s. Reloads are respectively 3.5, 4.5 and 5.5 seconds after the salvo. All lock their aim at warning time, respect solid cover and cancel attacks if the core leaves their firing envelope. Gun lights, muzzle flashes, projectile shapes and steady colored aim lines distinguish them. Warnings remain available with reduced effects.

Crowd separation cannot drive ranged platforms or Sentinel into a deliberate ram; only red interceptors pursue contact. Sentinel holds 12–16m while retaining its three barrage phases. Goliath cannons retain their slower cadence. Cryo gravity and flying into a hostile body still cause normal physical contact. Ranged volleys can aim at an exposed airborne escort at most once every four seconds; their shared projectile pool and physical barrel positions remain bounded. Fast hostile shots use swept three-dimensional core collision. Rockets are dodgeable ballistic projectiles, with impact bursts and direct-hit damage.

## Smaller ground rovers — 1.20.1

Four-wheel vehicles now render at 60% of their previous linear size. Chassis, tires, hubs and ground shadows share the scale; wheel spacing, terrain sampling, body clearance and rolling speed use the corresponding physical dimensions. Travel, deployment cadence, sensor radius, fuse and explosion damage remain unchanged.

## Escort battery and carrier bay — 1.20

Each drone now carries an independent 100-point battery. Flying drains five points per second and a successful laser shot spends one more; held or blocked shots spend nothing. Initial charge is staggered by eight points per slot to spread the first recall. At 20% reserve, that unit stops targeting/fire and queues for the core's single aft hatch. It visibly approaches and descends over two seconds, stows inside the carrier, recharges at 12.5 points per second and takes off over 1.4 seconds only after reaching 100%. Full batteries support about 16 seconds of quiet flight; combat shortens sorties. A normal reserve-to-full refill takes 6.4 seconds, excluding approach, takeoff and the hatch queue.

Only one aircraft may enter or leave at a time. Returning aircraft wait above the hatch if a hostile or solid terrain blocks docking; launch also waits for clear space. Shared simulation poses follow the core's movement, bank, heading and hover, and enforce terrain and aircraft clearance during transitions. Docked units leave the rendered fleet and cannot absorb enemy fire at their old positions; units waiting, returning or taking off remain vulnerable. Only airborne combat-ready units fire. Charging restores energy separately from hull damage and never revives casualties. Explicit field service rebuilds one lost unit inside the bay, from which it takes off through the same launch queue.

The escort slot now shows separate hull and battery pips plus the airborne count. Click its readout for each drone's charge percentage and AIR / QUEUED / RETURN / CHARGE / LAUNCH / LOST state. On mobile these details live under **TACTICAL → ARSENAL**, preserving the compact cockpit. A procedural aft hatch and instanced bay lamps identify recalls and charging, and fan rotation slows during transfer and stops when stowed. All timing, charge and rotor motion freeze on pause, hit-stop and ended runs; restart restores the selected starting fleet. The existing seven-drone limit, projectile/debris pools and medical supply cadence remain in effect.

## Compact mobile cockpit — 1.19

Phones and narrow windows use a separate minimal HUD. Core hull, shield, elapsed time and XP remain visible; a left movement joystick and four 52px combat buttons provide dash, rockets, ground charges and EMP. The rocket rack and a short lock indicator remain readable without the full launcher card. Objective/supply markers retain direction and distance, active missions or service show a small tappable chip, and automatic upgrades appear as a compact notification without pausing combat.

Tap **TACTICAL** to open a scrollable overview containing the radar, encounter, field operation, expedition/service, targeting mode, installed modules, individual drone hull, rover bay, score, salvage and rocket manual. Opening it explicitly pauses simulation, including enemy fire and planted charge fuses; closing it resumes only the pause it initiated. The native modal traps focus, makes underlying controls inert and returns focus to the opener. Escape and the close/resume button dismiss it. Ready extraction remains available from the paused service overview. Crossing back into desktop layout closes the sheet safely and restores the full HUD. Safe-area offsets, portrait/landscape layouts, reduced-motion behavior and touch targets are included. No profile or gameplay balance changes are required.

## Destructible escorts — 1.18

Each installed escort has 40 hull, independent of core armor and shield. Hostile projectiles use swept three-dimensional collision against its flight volume: low rounds pass underneath, elevated rounds can hit it, and one round hits at most one escort. Ranged platform salvos can target a visible escort within 12m, no more than once per four seconds per hostile; Sentinel rings replace one existing round with an escort shot. These shots aim at the drone's position when fired, respect cover and can be evaded through movement. Goliath cadence is unchanged.

Hits produce sparks at flight height and briefly light the damaged armor; worn hulls darken. At zero hull, the drone breaks into airborne debris, stops firing and disappears from the instanced fleet. Survivors keep their identities, gun locks and cooldowns while moving into the smaller formation with existing collision clearance. The escort weapon slot shows active/installed count and individual hull pips; red slots indicate losses. Drone destruction awards no enemy kills, XP, combo, credits or loot.

Casualties persist until explicit replacement. Medical crates repair surviving escorts by 20 hull without reviving wrecks or increasing pickup frequency. Completing a service dock repairs all survivors and rebuilds **one** missing escort, once per dock. Module upgrades commission only the newly added capacity; they do not silently restore old casualties. A new deployment restores its selected starting escort fleet. Simulation time drives hit feedback; pause, hit-stop and ended runs freeze incoming attacks and drone state.

## Goliath firing positions — 1.17

Heavy Goliaths approach to a 9–12m engagement band, hold position there and slowly reverse if the core gets closer. Crowd separation cannot push them into a deliberate charge; cryo gravity still pulls them normally. Chaser, Orbiter and Sentinel attack patterns retain their own behavior.

Normal and elite Goliaths wait at least 3.5 seconds after spawning before preparing their first cannon shot. Both barrels glow during a full one-second wind-up, locking the core's position at its start so the shot can be dodged. They launch one amber shell at 5.5m/s, alternating barrels, then reload for 6.5 seconds: subsequent shots are at least 7.5 seconds apart regardless of difficulty, haste or elite status. Each shell deals 18 damage, travels at most 20m and consumes one slot in the existing projectile pool. Cover and leaving the firing band cancel unfinished shots; full pools produce no false shot or catch-up volley.

Simulation time drives charging, reload and muzzle flash. Pause, hit-stop and ended runs freeze the cannon, restart removes its state, and Sentinel arrival recalls the heavy units and their shells. Rendered body transforms and muzzle positions are shared with firing. One bounded instanced light batch shows charging and flash without added point lights, downloaded assets or React updates per shot. Reduced effects retains the steady charging cue and suppresses the short flash.

## Adaptive elevated escorts — 1.16

Escorts hover in stable slots above the core instead of continuously circling it. Their baseline altitude is 2.85m. The shared formation smoothly expands from its 3m resting radius toward 4.4m in close combat, and contracts toward 2.6m during fast movement, dash or near cluttered terrain. Ducted-fan bodies retain gentle hover pitch/bank and their propellers continue rotating. The formation moves with the core; it does not lag into the hull during a phase shift.

Terrain and large-hostile clearance use a conservative full-body flight volume. Motion lookahead prepares climbs; a clearance projection prevents intersection even when a new obstacle enters the footprint. A second check after enemy motion keeps physics and rendering in agreement. When module upgrades add slots, existing drones move into their new arrangement while joining drones yield vertically, maintaining at least 1.8m centre separation in three dimensions. All bodies stay outside the core's perimeter. Their actual poses are updated in the engine's fixed simulation step and shared by rendering, guns and projectile checks; pause/hit-stop freeze the entire formation. Restart resets it.

Drone attacks now use aimed lasers rather than legacy blade-contact damage. Local downward gun pitch follows elevated firing positions, and YXZ muzzle transforms match the rendered barrels. Launch lanes and in-flight laser segments check other escorts' three-dimensional flight volumes, as well as existing core/pilot/cover safeguards. Projectile vertical velocity reaches the targeted ship's height instead of being clipped to the old low-altitude descent limit. Instanced bodies, rotors, shadows and flashes reuse the existing GPU resources without per-drone React updates, extra lights or downloaded assets.

## Sentinel duels — 1.15

At each three-minute Sentinel arrival, ordinary and elite hostiles are recalled, their incoming bullets and lingering environmental strikes are removed, and normal reinforcements stop until the next expedition front. The handoff runs before old contacts or projectiles can damage the core. Recalled enemies award no kills, score, XP or salvage. Existing pickups, rescued pilots, upgrades and friendly ordnance remain available; queued rockets aimed at recalled targets cancel without spending ammunition. An expanding arrival wave marks the arena handoff.

All three Sentinel phases now remain a duel. Its ring, spiral and aimed barrages and its own phase-change strikes continue, while phase changes no longer summon chasers. Defeating it still opens field service in Expedition or completes Classic. After the service window, normal patrols resume on the next front; its next Sentinel clears that front again. Pause and hit-stop retain their existing timing rules.

## Automatic ground rovers — 1.14

Every core now carries an automatic rover bay. At ten seconds, then every randomly selected 24–36 seconds of combat, it deploys a complete three- or six-way fan of small four-wheel explosive vehicles. The heading, sector jitter and 9–14m travel distances vary independently of enemy/upgrade generation. Rovers run at 4.6m/s, stop before rocks and ruins, and stay where they arm. A hostile within the 1.6m sensor radius plus its body radius triggers a 0.35-second red warning before a 4.2m blast dealing 420 base reactor-scaled damage. Enemy proximity can also stop a rover in transit after its initial 0.6-second arming delay. Cover blocks sensing and the blast; your core and pilots are protected. Idle parked mines self-detonate after twelve seconds.

The compact **ROVER BAY / AUTO** HUD tracks rolling/armed vehicles and the next launch. This support system spends no rockets or manually planted B charges. New launches wait during field service. Simulation time drives movement, deployment, warning and expiration; pause and hit-stop freeze them. Ended runs stop all activity, and restarting clears the bay. A hard twelve-vehicle cap defers entire batches rather than creating partial fans. Rover bodies, rubber tires, metal hubs and sensor markers are instanced with bounded counts. Four independently grounded wheels rotate with actual distance; the chassis pitches and banks over the procedural terrain. All geometry, weathering, materials and launch/explosion audio are local and procedural.

## Timed ground charges — 1.13

Press **B** or tap the charge button beside the weapon slots to plant a procedural magnetic bomb on the terrain. It stays where it was placed. A numeric countdown and a shrinking near-body fuse ring track three seconds of simulation time; a larger amber ring follows the terrain surface and marks its 5.5m blast radius, turning red in the last second. Countdown beeps lead into a fire explosion, shockwave, glowing debris, smoke, ground scorch, reactive grid impact and camera trauma. Reduced effects keeps the countdown and warning visible with steadier brightness.

The rack begins with three charges. Deployment has a 1.2-second cooldown, permits at most three armed bombs, and requires 1.2m separation from an already planted charge. Blocked attempts spend nothing. The blast deals 600 base damage multiplied by the reactor's weapon damage to live enemies within range; rocks and ruins block it. It can clear ordinary pursuers and damage bosses, and cannot damage the core or rescue pilots. Death rewards and each detonation occur only once. Pause/hit-stop freeze the fuse; ended runs cannot arm or detonate bombs, and a new deployment clears every bomb and restores its starting stock.

Blue ammo crates refill one charge alongside their existing capped rocket/EMP rewards, including when only the charge rack is empty. Completed field service adds one charge once. Bombs never refill passively. Ammo navigation remains available when rockets are full but bombs are depleted; the supply spawn rates and caps are unchanged. Mechanical bomb bodies reuse the fleet's instanced PBR surfaces, while at most three locally rendered HTML countdown labels require no downloaded font or asset.

## Armed escort update — 1.12

Every escort now has a persistent target lock, motorized aim, its own cooldown and alternating left/right barrel. It acquires visible hostiles within twelve metres from its own position, follows the same mouse cone and Assisted/Precision rules as the core, and holds fire behind terrain, stranded pilots or the mothership. A lost or dead lock is released immediately. Target searches are staggered/cached; valid locks are checked before firing, and the actual muzzle-to-target lane is rechecked against cover and protected bodies.

Cyan laser bolts leave the model's actual transformed muzzle, travel horizontally at 22m/s with a small bounded motion lead, and use the shared 500-projectile pool. They remain straight shots: old bolts never turn toward a replacement hostile. Nominal per-drone cooldown is 0.9 seconds, haste/Overdrive are supported with a 0.35-second minimum, and base shot damage grows from 11 at level one to 21 at level six. Reactor and critical upgrades apply. Core cannon and manual rocket intent keep priority over escort fire. Version 1.16 replaces contact interception with collision-free elevated hover and aimed fire.

Drone bodies turn toward their target within the elevated formation. A short cyan muzzle flash identifies the firing barrel; coloured tracers and a quieter procedural pew distinguish escort fire from the core cannon. Pause, hit-stop and ended runs freeze targeting, cooldowns and flashes; restart clears every gun and shot. Reduced effects suppresses muzzle flashes while keeping bolts visible. Only one extra instanced flash batch is added for the whole fleet, with no per-drone point lights or external assets. Armory explains targeting and range; automatic escort upgrades increase both drone count and laser damage.

## Escort drone update — 1.11

The orbital diamond blades are replaced by detailed procedural ducted-fan drones: armored central chassis, four fan housings and rotating propellers, glass sensor, antenna, twin interception emitters, cooling grilles and cyan friendly identification lights. Each equipped level adds an escort, from two at level one to seven at the cap. Models reuse the fleet's locally generated PBR surface textures, emissive materials and shared shadow map. Six instanced body surfaces, one rotor batch and one ground-shadow batch render the entire escort formation; no downloaded model or texture is needed.

World-space flight positions are shared by rendering and weapon simulation. All drone motion, hover and propeller rotation freezes with simulation time on pause or hit-stop. Escorts disappear in the command-center preview and are cleared on a new deployment. The display name is **Escort drones**; the internal `glaive` module identifier remains compatible with existing saved loadouts. Targeted laser fire was added in version 1.12; version 1.16 adds adaptive elevated formation and removes blade-contact damage.

## Expedition update — 1.10

Expedition is the default route; Classic remains available beside the deploy button and in Settings. Each front brings a Sentinel after three minutes of simulation time; its arrival clears the ordinary horde for a duel. Defeating it opens a 30-second service window, suspends reinforcements and environmental strikes, clears its remaining projectiles, and creates a procedural field station at the wreck. Follow the green navigation signal, keep the docking perimeter clear within five metres, approach below two metres per second, and remain in the docking radius for three uninterrupted seconds with no recent damage. A hit, nearby hostile, fast movement or leaving the radius resets unfinished docking.

Field service restores 35% of maximum hull, fills shields, and adds three rockets, one ground charge and 50 EMP charge, each capped at capacity. It works once per Sentinel. While docked and safe, **Extract & bank credits** ends the run successfully; the same option is available in Pause. Leaving or waiting out the window automatically starts the next front with the entire build, XP, reward queue, score, rescue missions and inventory intact. Extra Sentinel salvage starts at 50 credits and grows to a capped 200. Credits are recorded once at extraction or death. Changing the route during a run applies to the next deployment.

Balanced patrols, faster interceptor packs, orbiter artillery lines and heavy armored columns cycle across fronts. Local front time drives escalation; reinforcement pressure and enemy speed are bounded, while hull strength grows logarithmically with expedition depth. Thruster and haste upgrades retain usable minimum/maximum values even in long runs. There is no fixed maximum run length, and pause freezes the next boss, service window and docking progress. Three Sentinels and ten minutes of survival unlock two new flight-record milestones. Survival still depends on piloting and upgrades; indefinite survival is not guaranteed.

## Directional honeycomb shield — 1.9

The Aegis field is invisible at rest, including while recharging. An absorbed hit reveals only a small cap of cyan hexagonal cells at the incoming attack direction, with a local pulse and contact sparks. The rest of the surface remains fully transparent. Each patch fades over 0.7 seconds of simulation time; pause freezes it, and restart clears it. Projectile velocity determines the incoming side even when the projectile crosses the core between frames. Enemy contacts and hazard centers also supply their attack direction. The patch is stored relative to the core and follows its rotation. The last absorbed charge briefly turns the struck cells amber before disappearing; bare-hull damage and phase invulnerability do not generate new shield patches.

The former full-sphere shield glow, whole-core shield-hit flash, and blue shield shockwave are removed. One procedural mesh renders up to eight bounded impact patches, with no downloaded texture and no extra gameplay randomness. Reduced effects lowers patch brightness. Shield absorption, recovery delay, and capacity upgrades retain their existing rules.

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
