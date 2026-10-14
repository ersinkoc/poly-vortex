# Changelog

Notable changes are recorded here from the `1.34.0` development cycle onward. Versions follow `MAJOR.MINOR.PATCH`: patch for fixes and small compatible changes, minor for compatible features, and major for breaking changes. A version becomes a release only after its validation passes and its `vX.Y.Z` tag is created.

## Unreleased — target `1.35.0`

### Added

- Add destructible heavy-ship gun mounts, engines and generators with visible modules and functional attack/defense changes.
- Add Mine weaver, Aegis tender, Line bomber, Hive carrier and Escort hunter roles with bounded special attacks and Drydock identification.
- Evolve all six weapons at level 6, including Rail fragments, Scatter ricochets, Cryo projectile stasis and Tesla/escort battery synergy.
- Give all five flightframes a unique gameplay trait and explain it in deployment, ship selection and Tactical overview.
- Add four procedural terrain districts, destructible barricades and chain-exploding fuel depots.
- Replace proximity-only rescues with stabilization, vulnerable following crew and safe-zone evacuation; show crew health and blockers.
- Add convoy protection, moving salvage interception and transmitter sabotage field operations.
- Persist new tactical states and accept older checkpoints with missing transient fields.

### Fixed

- Remove the Sentinel death hit pause and bound its costly volume effect while preserving particles and shockwave.
- Hold field-operation clocks during Sentinel duels and post-boss service.

## `1.34.0` — development milestone (not tagged)

The prepared `1.33.1` patch was never tagged. Its fixes remain in this pending minor release.

### Added

- Add Nova and Bastion flightframes with distinct stats, procedural hulls, portraits and drydock selection.
- Add Rail lance and Scatter array as starting and upgradeable automatic weapons.
- Add Flak Raider and Ion Disruptor platform variants with distinct salvos, warning colors and combat effects.
- Preserve older local checkpoints by restoring missing levels for the two new modules as offline.

### Fixed

- Preserve current v2 preferences when legacy settings or a stale browser tab still contain older values. A partial settings event no longer resets the selected ship.
- Reject invalid save revisions and enemy maximum health before loading a flight checkpoint.
- Keep another tab's active flight when local autosave recovers from unavailable storage, and pause the old flight when checkpoint ownership conflicts.
- Preserve newer credits, achievements, and permanent upgrades committed by another tab when a flight ends or a purchase is made.
- Cancel autosave work with the same scheduling API that created it.
- Resolve rocket impacts in travel order, protect a pilot at the firing endpoint, and retain distinct incoming-fire directions when the warning pool is crowded.

### Tests

- Add deterministic regression coverage for cross-tab save ownership and profile updates. Runnable before/after audit evidence remains in `.temp_files/` locally.

## `1.33.0` — documented baseline

- Merged nearby incoming-fire warnings into compact directional chevrons, moved ground aim markers away from the hull, and reduced visual clutter around the ship.

## `1.32.0`

- Kept the Sentinel service panel inside the flight HUD.

## `1.31.0`

- Added Aegis Overdrive and resumable, versioned local flight saves.

Earlier feature notes remain in [README.md](README.md); those historical labels predate this changelog and are not retroactively treated as tagged releases.
