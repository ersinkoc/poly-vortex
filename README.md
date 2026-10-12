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
- **Space / right-click:** Phase shift. A brief invulnerable dash with a three-second base cooldown.
- **Escape:** Pause or resume. Changing tabs or losing focus also pauses the game.
- **1 / 2 / 3:** Pick a level-up module.
- **Touch:** Use the on-screen movement joystick and dash button.

Collect cyan XP prisms. Choose randomized common, rare, or overclocked upgrades. Mix pulse lasers, orbital glaives, cryo-singularities, and Tesla arcs. At three minutes the Vortex Sentinel arrives; destroy it to extract. Standard and Overdrive difficulties are available. Every run awards core credits, saved in browser local storage, for permanent armor, damage, and speed upgrades. There are no accounts or server dependencies.

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
