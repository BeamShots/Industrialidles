# Tideforge — Wild Tides v3

A portrait, offline-capable factory and expedition game. No build step, accounts, dependencies or external game assets.

## Publish on GitHub Pages
1. Extract this ZIP.
2. Upload index.html, style.css, model.js, app.js, sw.js, manifest.json, icon192.png and icon512.png into the root of your existing repository. Replace the matching files. The old game.js can be removed.
3. Settings → Pages → Deploy from a branch → main → / (root).
4. Open your Pages website online. If the old version is visible, close and reopen it after deployment.
5. Android Chrome → menu → Install app or Add to home screen. The website must load online once to cache all game files.

Keep the same repository URL to migrate your old v1/v2 inventory and machines automatically. The new quest campaign begins at its first story. Export your old island before replacing files if you want an additional backup. Saves belong to this browser/device and this website address.

## Playing
Tap trees, rocks and blue seams for materials. Resources are renewable.
Your first blue iron seam is two tiles west of center. Place a Drill there, a Furnace immediately east and a Depot immediately east of that. Point arrows east. Belts bridge gaps and turn corners. One item advances at most one tile per simulation tick.
Select Gather / select before tapping a machine to turn, pause, move, collect, upgrade or dismantle it. The direction button turns the selected machine immediately. In build mode it sets the direction for future machines.
Sawmills need trees and quarries need grey rock. They deliver straight into inventory. Other production needs connected outputs.
Drag to pan, use + / − to zoom, and Center to return home.

Follow the twelve quests. Expand to radius 5 for copper and 7 for crystal.
Research six technologies through iron, gel, copper, steel and crystals to restore the beacon.
Craft gears and upgrade your blade, ship hull and fishing rod.
Slime expeditions have escalating waves and a boss every fifth wave. Tap slimes to attack. Survive a wave to bank all loot or continue. Retreat banks everything earned so far. Hull defeat recovers half. Interrupted sessions recover saved cargo on reopening.
Fishing uses the gold moving marker. Tap REEL inside the green zone. Every third consecutive catch doubles the fish. A short cooldown prevents repeated taps from granting duplicate fish.
Harbour orders and four exchanges turn surplus supplies into useful resources.

Factory production continues while exploring and simulates up to two hours away.
Settings contains export, import and confirmed reset. Dialogs pause the action minigames.

## Verification
See CHECKS.md for automated coverage and remaining device checks.
