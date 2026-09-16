# The Glasshouse Job

An original browser-based museum heist platformer: an agile weasel, a crowded gala, optional preparation, and a prize worth climbing for.

**Status:** early playable prototype, controls pass 0.3.0. The full recon–prepare–steal–escape loop is implemented. Art, animation, crowd behavior, and performance are still being refined.

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

Release E between different actions. Camera follow can be disabled in Pause. The menu also offers brighter lighting, simple sound cues, and rendering-resolution choices.

## The heist

1. Survey the museum from the planted terrace above the gala.
2. Optionally bypass the ground-floor security relay to keep the prize case unlocked.
3. Optionally climb the scaffolds and roof beams to prepare the return tether.
4. Approach through the gallery or descend from the roof. Use the scrambler if needed; hold E to take the bird.
5. Escape through the gala entrance or the prepared roof anchor.

Patrols build suspicion using sight cones, elevation and line of sight. Cover crates block vision. Capture retries preserve completed preparation and loot.

## Development

Node.js 20+ recommended.

```sh
npm ci
npm test
npm run build
```

The standalone development build is `museum.html`.

## Vercel deployment

Import **pbzona/glasshouse** into Vercel. The checked-in `vercel.json` configures:

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
- `index.template.html` — shared base styles (its legacy body is not used by the build)
- `heist.body.html`, `heist.extra.css` — current game interface
- `build.mjs`, `build-vercel.mjs` — bundling and hosting output
- `test-physics.mjs`, `test-heist.mjs`, `test-controls.mjs` — traversal plus 27 mission/control tests

## Current limitations

This is not final art or a polished chapter. Guests are static, guards follow authored routes rather than performing full navigation/pursuit, and decorative props are not all collidable. There are no mobile controls, gamepad support, persistent saves, or production soundtrack.

Rendering remains a known issue. Earlier remote-browser samples were around 11–18 fps at reduced resolution; these are diagnostic observations, not a guaranteed rate on another device. The controls update does not claim to solve the separate rendering bottleneck.

Third-party license notices are retained under `licenses/`. No license for the original game code or assets has been assigned here.
