# The Glasshouse Job

An original browser-based museum heist platformer: an agile weasel, a crowded gala, optional preparation, and a prize worth climbing for.

**Status:** early playable prototype, character and gala pass 0.6.0. The full recon–prepare–steal–escape loop is implemented. Art, animation, crowd behavior, and performance are still being refined.

[Play the live build](https://glasshouse-silk.vercel.app)

## Play

The game is a client-only WebGL application. Its production build is one self-contained HTML page, with no runtime API calls, sign-in, or environment variables. Desktop keyboard and mouse are required.

| Input | Action |
|---|---|
| WASD | Move |
| Space | Jump / climb; automatically catch reachable ledges after a near miss |
| E | Contextual action: hold to prepare, steal, or extract; tap to use the fixed tether |
| Q | Signal scrambler |
| Shift | Sneak / careful movement |
| Drag or arrow keys | Override the following camera |
| C | Recenter camera behind your travel direction |
| R | Regroup at the last safe point |
| Escape | Pause |

Release E between different actions. Camera follow can be disabled in Pause. The menu also offers brighter lighting, footstep/sound volume on/off, and rendering-resolution choices. Sound starts quietly after the explicit Take the job click; it can be muted in Pause.

## The heist

1. Scout from the planted terrace or the service-side entrance on the left of the gala.
2. Optionally pickpocket the stationary curator from behind while they read their catalogue. Their access card permanently authorizes the prize case. No tailing sequence is required.
3. Choose the screened inner gallery, or climb the independent service stairwell into the restoration wing and roof beams. The original gallery-to-scaffold connection also remains. Prepare the roof tether if desired.
4. Approach through the gallery or descend from the roof. Use the scrambler if needed; hold E to take the bird.
5. Escape through the gala entrance or the prepared roof anchor.

Patrols build suspicion using sight cones, elevation and real line-of-sight blockers. The new inner arcade has physical screens and a safe waiting pocket; its approach was tested without visor use across six patrol phases. The service-floor route reaches the roof without crossing the artifact walkway.

Q is no longer consequence-free: affected guards stop for 1.8 seconds, turn toward the last fault position, then investigate within their patrol surfaces for 7 seconds. Suspicion does not reset to zero. The case bypass remains 8 seconds with a 16-second recharge. Theft redirects east/north patrols toward the gallery and activates the front guard without sealing every exit. Retry preserves card, prep and loot; guards do not teleport on reaction or recovery.

## Readability and atmosphere pass

Warm ivory stone, burgundy panels and brass trim now carry muted botanical accents. Architectural plaques and framed botanical prints share one generated texture atlas; the museum is still statically batched and uses baked vertex colors. There are no dynamic shadows, bloom or volumetric lights. Controls, collider map, routes and mission mechanics are unchanged.

- Forward sight fans and the existing 1.1 m close-awareness zone are clipped using the same eye heights and line-of-sight checks as detection. They update at 10 Hz and disappear while the player is protected or visors are disabled. This is a conservative sampled **same-floor slice**, not a pixel-perfect 3D frustum or a replacement for the actual detection check.
- A brass inlay matches the existing public-refuge boundary on walkable floor; it becomes muted after theft.
- The curator no longer overlaps a decorative guest. Their head/catalogue poses, text states and look-up warning make the unchanged reading cycle clearer.
- Stair markers are snapped to real authored surfaces. Gold indicates the prize approach; green marks optional service/roof access.
- Recovery names the destination and shows remaining grace seconds. Prep and loot retention rules are unchanged.
- Six purposeful, non-colliding gala actors replace earlier static silhouettes: a tray-carrying server on a short table circuit, conversing guests, an admirer, photographer, and a glancing patron. There is no free-form crowd navigation.

## Character and gala pass

The original weasel now has bespoke lofted forms, an articulated continuous tapered tail, a muzzle and expressive face, plum jacket, gloves, boots and a cross-body satchel. A visual-only hierarchical rig blends walk/run/sneak, airborne/landing, ledge pull-up, tether hang, pickpocket reach, prize lift/stash, and protective loot-carrying poses. Inputs, movement physics, map, detection and mission rules are unchanged. The rig is procedural, not a downloaded or hand-sculpted production asset; reaching is local-space rather than full environment-contact IK.

The server follows a deterministic table circuit with pauses. Guests chat, toast, examine art and raise a camera. Nearby civilians glance at equipment disruptions; after theft, conversations pause and people turn toward the emptied display. Ambient subtitles are local and sparse, with mission dialogue taking priority. Security has walking, visor-check and radio gestures. These activities do not create mandatory timing puzzles or block routes.

The prize remains silent. There is **no singing-bird sequence**, no new gadget, and no forced chase. The thief stashes the loot; the existing display/security response and the gala's reactions provide the payoff.

Lighting now emphasizes the warm prize and inhabited gala against cooler service circulation. Architecture uses static spatial vertex lighting; characters receive matching live fill/key/rim and localized prize light. No additional shadow-map or full-screen postprocessing passes are required.

## Development

Node.js 20+ recommended.

```sh
npm ci
npm test
npm run build
```

The standalone development build is `museum.html`.

## Vercel deployment

Vercel is linked to **pbzona/glasshouse** and deploys main-branch pushes. The checked-in `vercel.json` configures:

- Framework: Other
- Install: `npm ci`
- Build: `npm test && npm run build:vercel`
- Output directory: `dist`

`build-vercel.mjs` builds the game and writes `dist/index.html`. No environment variables are needed. Tests run before deployment. Once the repository is connected to a Vercel project, Git pushes can trigger deployments through Vercel's Git integration.

To reproduce the production build locally:

```sh
npm ci
npm test
npm run build:vercel
```

## Structure

- `src/main.js` — museum geometry, procedural art, baked static lighting
- `src/world.js` — collision map and fixed-timestep character physics
- `src/heist.js` — pure mission state, guards, interactions, recovery
- `src/controls.js` — movement vectors, camera-follow policy, ledge selection, context priority
- `src/runtime.js` — input, camera, animation, HUD and mission integration
- `src/finishings.js` — atlas signage, botanical panels, material details and grounded inlays
- `src/readability.js` — refuge, marker, curator cue and checkpoint presentation helpers
- `src/visibility.js` — reusable sampled visibility overlay buffers
- `src/thief.js` — bespoke weasel rig, animation blending and pose events
- `src/gala.js` — authored social schedules, gestures and localized reactions
- `src/lighting.js` — spatial static-light bake and matching actor lights
- `index.template.html` — shared base styles (its legacy body is not used by the build)
- `heist.body.html`, `heist.extra.css` — current game interface
- `build.mjs`, `build-vercel.mjs` — bundling and hosting output
- `test-physics.mjs`, `test-heist.mjs`, `test-controls.mjs`, `test-layout.mjs` — traversal, 25 mission tests, 11 control tests and multi-phase stealth/layout regressions
- `test-visibility.mjs`, `test-readability.mjs`, `test-scene.mjs` — 17 visibility checks, 6 readability checks and a headless geometry-construction budget smoke test
- `test-thief.mjs`, `test-gala.mjs`, `test-lighting.mjs` — rig topology, animation/root invariance, pause/reset, civilian route clearance, reactions and light hierarchy

## Current limitations

This is not final art or a polished chapter. Civilian life uses short authored loops rather than an unrestricted social simulation. The character remains a procedural rig, and the curator uses its existing timed opportunity. Guards investigate on authored surfaces rather than performing full navigation/pursuit, and decorative props are not all collidable. There are no mobile controls, gamepad support, persistent saves, or production soundtrack.

Rendering remains a known issue. A same-session pre-pass baseline at the initial position, 1280×1280 viewport and 50% render scale was approximately 16–17 fps. It must be compared with this pass under matching conditions; measurements from other remote browser sessions are not hardware benchmarks or a 60 fps guarantee.

Third-party license notices are retained under `licenses/`. No license for the original game code or assets has been assigned here.
