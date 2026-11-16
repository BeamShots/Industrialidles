# Treasure Tides verification
45 automated checks passed in this build:
- 18 simulation checks cover save migration, invalid data, placement and costs, resource/research requirements, production, blocked output, competing transfers, belt corners, paused machines, gatherers, advanced processors, offline limits and quest completion.
- 19 baseline DOM interaction checks cover all navigation screens, first-run help, catalogue, building, selection, turning, pause, moving and cancellation, upgrades, cargo, dismantling, crafting, research, quests, shipping, expansion, fishing, slime waves, defeat and retreat, save serialization, imports, interruption recovery, pointer taps and drag separation.
- 8 added feature checks cover generated sprites in the catalogue, overdrive/cooldown, gathering bonuses, wave powers and freeze, salvage trap penalties and duplicate-claim prevention, pick limits and cargo recovery, full inventory, and the starter factory.
Additional checks cover the service-worker manifest and cached file availability, activation, cached entry points and bypassing non-GET requests. JavaScript syntax and ZIP integrity also checked.

The interaction checks run in a simulated DOM. The map was drawn with the real generated sprite atlas into a native canvas and visually inspected.
Full browser and phone screenshots, physical touch feel, Android installation and a real browser offline reload remain unverified. Local Chromium could not launch, an alternative browser download failed, and the remote browser disallowed local-file previews.
