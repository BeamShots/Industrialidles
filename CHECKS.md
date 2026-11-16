# Verification — Wild Tides v3
Completed against this build:
- 18 simulation checks covering save migration and validation, terrain and research restrictions, affordable placement, drill/furnace/depot production, blocked cargo, belts and corners, competing outputs, incompatible inputs, paused machines, gatherers, wire/steel/coin production, offline limits, advanced deposits and quest conditions.
- 19 DOM interaction checks covering first-run help, all six navigation screens, build catalog, placement, gathering, rotation, pause/resume, movement cancellation, upgrades, collection, dismantling, crafting, all research tiers, expansion, orders, claiming quests once, slime waves, retreat and defeat, fishing hits/misses/cooldown, settings, reset confirmation, save serialization, interrupted expedition recovery, valid and invalid imports, pointer taps and drag separation.
- Service-worker checks covering precached file existence, installation, activation, cached app and root requests, and non-GET bypass.
- JavaScript syntax and ZIP integrity checks.

UI interaction checks ran in a simulated DOM with canvas drawing. A full Chromium launch failed because the execution environment denied its local socket creation. These checks do not verify real browser layout, physical touch feel, Android installation or a real service-worker offline reload. Those remain device checks. No claim of a bug-free build.
