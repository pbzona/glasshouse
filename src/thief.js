/**
 * Sable — an original long-bodied museum thief. Visual rig only; +Z is forward.
 * No renderer, DOM, external assets, random numbers, gameplay or root-motion.
 * createThief(THREE) => {root, update(dt, pose), reset(), stats}.
 * Named joints / meshes are available through root.getObjectByName for inspection.
 * All rigid details on a joint are vertex-colour batched into one Lambert draw.
 * dt: seconds (clamped 0..0.1); speed: world units/s; turnRate: signed radians/s.
 * Progress inputs are normalized 0..1; null means no traversal / interaction.
 * Missing pose fields use idle defaults. paused freezes clocks, events and geometry.
 * reset restores the exact neutral rig, preserving caller-owned root transforms.
 * update returns {state, footstep, landed}; events are visual hints, never mechanics.
 */
export function createThief(T) {
  const TAU = Math.PI * 2, clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const palette = {
    fur: '#8e4d2f', lightFur: '#ad6842', darkFur: '#603622', cream: '#eccea0',
    muzzle: '#f5dfb7', ear: '#c48a70', plum: '#503248', lapel: '#754960',
    seam: '#9c7380', leather: '#49342c', edge: '#956b47', glove: '#27282b',
    sole: '#151e23', brass: '#bf995d', eye: '#f5e9cf', iris: '#b9944b', ink: '#231b1b'
  };
  const colors = Object.fromEntries(Object.entries(palette).map(([k, c]) => [k, new T.Color(c)]));
  const material = new T.MeshLambertMaterial({ vertexColors: true });
  material.name = 'Sable / matte vertex-colour cloth, fur and leather';
  const root = new T.Group(); root.name = 'Sable';
  root.userData.character = 'Original chestnut weasel / Sable';
  const joints = [], parts = new Map();
  function joint(name, parent, x = 0, y = 0, z = 0) {
    const g = new T.Group(); g.name = name; g.position.set(x, y, z); parent.add(g);
    g.userData.bindPosition = [x, y, z];
    const j = { g, base: g.position.clone(), p: g.position.clone(), q: new T.Quaternion(), s: new T.Vector3(1, 1, 1) };
    joints.push(j); parts.set(g, []); return j;
  }
  const hip = joint('hip', root, 0, .61, 0);
  const spine = joint('spine', hip.g, 0, .05, 0);
  const head = joint('head', spine.g, 0, .69, .012);
  const eyes = [], brows = [], arms = [], legs = [];
  const tempMatrix = new T.Matrix4(), tempQ = new T.Quaternion(), tempEuler = new T.Euler();
  function add(g, geometry, color, p = [0, 0, 0], s = [1, 1, 1], r = [0, 0, 0]) {
    tempQ.setFromEuler(tempEuler.set(...r));
    tempMatrix.compose(new T.Vector3(...p), tempQ, new T.Vector3(...s));
    let geo = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geo.applyMatrix4(tempMatrix);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const c = colors[color] || new T.Color(color), n = geo.attributes.position.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[3 * i] = c.r; a[3 * i + 1] = c.g; a[3 * i + 2] = c.b; }
    geo.setAttribute('color', new T.BufferAttribute(a, 3)); parts.get(g).push(geo);
    geometry.dispose();
  }
  // Elliptical / rounded-rectangular loft: [height, halfWidth, halfDepth, centreZ, centreX].
  // Explicit stations, not scaled spheres, give the long waist, skull and folded clothing.
  function loft(rows, sides = 12, boxy = false) {
    const pos = [], idx = [];
    for (const [y, rx, rz, z = 0, x = 0] of rows) for (let j = 0; j < sides; j++) {
      const a = j / sides * TAU, co = Math.cos(a), si = Math.sin(a);
      const u = boxy ? Math.sign(co) * Math.abs(co) ** .45 : co;
      const v = boxy ? Math.sign(si) * Math.abs(si) ** .45 : si;
      pos.push(x + rx * u, y, z + rz * v);
    }
    for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < sides; j++) {
      const a = i * sides + j, b = i * sides + (j + 1) % sides, c = a + sides, d = b + sides;
      idx.push(a, c, b, b, c, d);
    }
    for (const top of [false, true]) {
      const row = rows[top ? rows.length - 1 : 0], center = pos.length / 3, offset = top ? (rows.length - 1) * sides : 0;
      pos.push(row[4] || 0, row[0], row[3] || 0);
      for (let j = 0; j < sides; j++) {
        const a = offset + j, b = offset + (j + 1) % sides;
        idx.push(...(top ? [center, b, a] : [center, a, b]));
      }
    }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); return geo;
  }
  function ellipsoid(g, color, p, s, r = [0, 0, 0]) {
    add(g, loft([[-1, .10, .10], [-.78, .63, .63], [-.3, .95, .95], [.3, .95, .95], [.78, .63, .63], [1, .10, .10]], 10), color, p, s, r);
  }
  function box(g, color, p, s, r = [0, 0, 0]) { add(g, new T.BoxGeometry(1, 1, 1), color, p, s, r); }
  function stroke(g, color, points, radius = .006, sides = 5) {
    const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
    add(g, new T.TubeGeometry(curve, Math.max(2, points.length * 2), radius, sides, false), color);
  }
  function panel(g, color, vertices, depth = .008) {
    const p = [], count = vertices.length, index = [];
    vertices.forEach(v => p.push(...v)); vertices.forEach(v => p.push(v[0], v[1], v[2] - depth));
    for (let i = 1; i < count - 1; i++) index.push(0, i, i + 1, count, count + i + 1, count + i);
    for (let i = 0; i < count; i++) { const j = (i + 1) % count; index.push(i, count + i, j, j, count + i, count + j); }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(p, 3)); geo.setIndex(index); geo.computeVertexNormals(); add(g, geo, color);
  }
  function rotate(j, x = 0, y = 0, z = 0) { j.q.setFromEuler(tempEuler.set(x, y, z)); }

  // A narrow, lengthy abdomen, interrupted by the high cropped jacket rather than a pear-shaped body.
  add(hip.g, loft([[-.07, .106, .096], [.01, .142, .112], [.12, .133, .10], [.25, .105, .093]], 12), 'fur');
  add(spine.g, loft([[-.015, .111, .086], [.15, .108, .089], [.34, .126, .094], [.50, .155, .094], [.57, .105, .083], [.65, .081, .071]], 12), 'fur');
  add(spine.g, loft([[.16, .123, .107], [.18, .135, .112], [.32, .135, .111], [.48, .169, .11], [.535, .132, .098]], 12), 'plum');
  // Continuous cream throat and shirt-like bib, not a floating circular medallion.
  add(spine.g, loft([[.255, .023, .018, .104], [.37, .064, .022, .112], [.52, .071, .025, .095], [.655, .047, .019, .068]], 10), 'cream');
  for (const s of [-1, 1]) {
    panel(spine.g, 'lapel', [[s * .052, .536, .122], [s * .137, .486, .123], [s * .098, .403, .145], [s * .055, .43, .147], [s * .031, .34, .143]]);
    stroke(spine.g, 'seam', [[s * .12, .472, .131], [s * .086, .408, .151], [s * .046, .355, .15]], .003);
    stroke(spine.g, 'darkFur', [[s * .107, .194, .076], [s * .122, .285, .071], [s * .15, .427, .063]], .0035);
  }
  stroke(spine.g, 'lapel', [[-.107, .175, .057], [0, .166, .112], [.107, .175, .057]], .008);
  box(spine.g, 'lapel', [-.091, .295, .102], [.05, .014, .015], [0, .18, -.13]);
  for (const y of [.24, .295]) ellipsoid(spine.g, 'brass', [.019, y, .118], [.009, .009, .005]);
  // Back yoke and a tiny triangular vent remain readable from the follow camera.
  stroke(spine.g, 'lapel', [[-.128, .438, -.075], [0, .455, -.113], [.128, .438, -.075]], .006);
  stroke(spine.g, 'lapel', [[0, .44, -.113], [0, .31, -.113], [0, .176, -.114]], .0035);

  // Slender cranial wedge, small ears, long tapered muzzle. The muzzle loft's Y axis is turned into +Z.
  add(head.g, loft([[-.14, .068, .065, -.012], [-.07, .10, .09], [.015, .139, .111, -.003], [.09, .133, .105, -.012], [.155, .10, .084, -.019], [.188, .047, .048, -.021]], 14), 'fur');
  add(head.g, loft([[-.14, .037, .017, .05], [-.07, .074, .025, .079], [-.01, .089, .024, .092]], 10), 'cream');
  add(head.g, loft([[.045, .099, .061], [.115, .094, .059], [.215, .061, .043], [.288, .037, .026], [.307, .032, .021]], 12), 'muzzle', [0, -.037, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
  // Small wedge nose, not a teddy's large sphere.
  add(head.g, loft([[-.015, .017, .014], [.005, .038, .027], [.027, .025, .022]], 8), 'ink', [0, -.032, .311], [1, 1, 1], [-.15, 0, 0]);
  stroke(head.g, 'darkFur', [[0, -.065, .303], [0, -.076, .263], [.039, -.074, .222], [.057, -.060, .204]], .0035);
  for (const s of [-1, 1]) {
    ellipsoid(head.g, 'fur', [s * .125, .181, -.027], [.052, .065, .035], [0, 0, -s * .24]);
    ellipsoid(head.g, 'ear', [s * .127, .184, .000], [.031, .040, .010], [0, 0, -s * .24]);
    ellipsoid(head.g, 'cream', [s * .131, .159, .007], [.031, .012, .011]);
    panel(head.g, 'lightFur', [[s * .114, -.045, .07], [s * .148, -.052, .04], [s * .125, .005, .068]]);
    for (let n = 0; n < 2; n++) stroke(head.g, 'edge', [[s * .061, -.033 - n * .023, .22], [s * .09, -.026 - n * .026, .17], [s * .121, -.013 - n * .031, .126]], .0018, 4);
    // Dark sockets stay attached to the skull; eye lenses blink and glance inside them.
    ellipsoid(head.g, 'darkFur', [s * .108, .068, .092], [.052, .045, .020], [0, s * .43, -s * .10]);
    const eye = joint(s < 0 ? 'eye.L' : 'eye.R', head.g, s * .11, .071, .106); eyes.push(eye);
    ellipsoid(eye.g, 'eye', [0, 0, 0], [.044, .031, .015], [0, s * .43, -s * .10]);
    ellipsoid(eye.g, 'iris', [-s * .006, .001, .014], [.022, .025, .011], [0, s * .43, 0]);
    ellipsoid(eye.g, 'ink', [-s * .008, .001, .024], [.010, .020, .007]);
    ellipsoid(eye.g, 'eye', [-s * .011 - .004, .011, .030], [.005, .006, .003]);
    const brow = joint(s < 0 ? 'brow.L' : 'brow.R', head.g, s * .108, .117, .111); brows.push(brow);
    add(brow.g, loft([[-.042, .004, .006], [-.023, .009, .009], [.022, .009, .008], [.042, .003, .003]], 6), 'darkFur', [0, 0, 0], [1, 1, 1], [0, 0, Math.PI / 2]);
  }

  for (const s of [-1, 1]) {
    const suffix = s < 0 ? '.L' : '.R';
    const upper = joint('upperArm' + suffix, spine.g, s * .163, .474, 0);
    const lower = joint('forearm' + suffix, upper.g, 0, -.225, 0);
    const paw = joint('paw' + suffix, lower.g, 0, -.205, 0);
    add(upper.g, loft([[-.235, .043, .046], [-.20, .052, .053], [-.04, .068, .065], [.035, .048, .048]], 10), 'plum');
    add(lower.g, loft([[-.196, .037, .041], [-.16, .040, .043], [-.018, .047, .049], [.02, .041, .043]], 10), 'plum');
    add(lower.g, loft([[-.206, .040, .044], [-.177, .042, .046]], 10), 'lapel');
    stroke(upper.g, 'lapel', [[s * .039, -.035, -.045], [s * .039, -.10, -.046], [s * .029, -.195, -.034]], .0035);
    ellipsoid(lower.g, 'brass', [s * .040, -.19, .012], [.006, .007, .006]);
    add(paw.g, loft([[-.085, .027, .025, .010], [-.058, .040, .031, .013], [-.005, .034, .032], [.015, .029, .029]], 10), 'glove');
    ellipsoid(paw.g, 'glove', [-s * .032, -.037, .032], [.015, .031, .017], [-.32, 0, -s * .20]);
    for (const x of [-.018, 0, .018]) stroke(paw.g, 'leather', [[x, -.032, .042], [x, -.064, .040]], .0025, 4);
    arms.push({ s, upper, lower, end: paw, a: .225, b: .205 });

    const thigh = joint('thigh' + suffix, hip.g, s * .101, -.035, 0);
    const shin = joint('shin' + suffix, thigh.g, 0, -.245, 0);
    const boot = joint('boot' + suffix, shin.g, 0, -.245, 0);
    add(thigh.g, loft([[-.257, .047, .048], [-.18, .053, .059, -.008], [-.04, .077, .080], [.033, .065, .063]], 10), 'fur');
    add(shin.g, loft([[-.249, .033, .039], [-.155, .036, .042, -.007], [-.015, .047, .051], [.018, .042, .044]], 10), 'fur');
    add(boot.g, loft([[-.079, .065, .108, .032], [-.053, .067, .115, .039], [-.015, .059, .103, .032], [.032, .045, .05], [.098, .044, .046]], 10, true), 'glove');
    add(boot.g, loft([[-.085, .066, .110, .033], [-.074, .067, .114, .036], [-.065, .065, .112, .036]], 10, true), 'sole');
    add(boot.g, loft([[.061, .046, .050], [.084, .046, .050]], 10, true), 'leather');
    stroke(boot.g, 'edge', [[-.037, -.014, .098], [0, -.005, .115], [.037, -.014, .098]], .003);
    box(boot.g, 'brass', [s * .047, .062, .012], [.007, .024, .022]);
    legs.push({ s, upper: thigh, lower: shin, end: boot, a: .245, b: .245 });
  }

  // A real cross-body strap runs around BOTH sides of the body and into a gusseted satchel.
  stroke(spine.g, 'leather', [[-.14, .513, .026], [-.115, .459, .132], [.005, .322, .151], [.13, .183, .127], [.226, .08, .056]], .023, 6);
  stroke(spine.g, 'edge', [[-.12, .461, .153], [-.005, .322, .175], [.116, .188, .153]], .003);
  stroke(spine.g, 'leather', [[-.14, .513, .026], [-.128, .47, -.091], [-.025, .315, -.13], [.104, .18, -.10], [.226, .08, -.052]], .022, 6);
  box(spine.g, 'brass', [-.067, .398, .165], [.042, .049, .012], [0, 0, -.72]);
  box(spine.g, 'leather', [-.067, .398, .173], [.024, .030, .008], [0, 0, -.72]);
  const bag = joint('satchel', spine.g, .225, .065, -.015);
  add(bag.g, loft([[-.142, .072, .072], [-.124, .097, .085], [.087, .099, .079], [.124, .082, .066]], 12, true), 'leather');
  stroke(bag.g, 'edge', [[-.080, .075, .084], [-.083, -.109, .089], [0, -.132, .089], [.083, -.109, .089], [.083, .075, .083]], .004);
  for (const s of [-1, 1]) box(bag.g, 'edge', [s * .098, -.014, 0], [.01, .195, .016]);
  const flap = joint('satchelFlap', bag.g, 0, .113, -.011);
  panel(flap.g, 'edge', [[-.091, 0, .01], [-.092, -.110, .112], [-.051, -.146, .123], [.071, -.142, .123], [.093, -.103, .111], [.091, 0, .01]], .011);
  panel(flap.g, 'leather', [[-.082, -.008, .019], [-.082, -.103, .12], [-.045, -.13, .131], [.065, -.127, .131], [.084, -.099, .12], [.081, -.008, .019]], .005);
  box(flap.g, 'brass', [.022, -.103, .131], [.033, .031, .009]);
  box(flap.g, 'glove', [.022, -.103, .137], [.017, .016, .006]);
  const parcel = joint('lootParcel', arms[1].end.g, 0, -.01, .064);
  add(parcel.g, loft([[-.06, .025, .025], [-.035, .052, .042], [.028, .048, .039], [.060, .025, .023]], 8, true), 'brass');
  box(parcel.g, 'leather', [0, 0, .04], [.018, .10, .008]);
  parcel.g.visible = false;
  // Stored loot is below the flap, never perched on the shoulder or animated as a bird.
  const stored = joint('storedLoot', bag.g, 0, .033, .01);
  add(stored.g, loft([[-.049, .030, .025], [.032, .036, .030], [.055, .023, .020]], 8), 'brass');
  stored.g.visible = false;

  for (const [g, geometries] of parts) {
    if (!geometries.length) continue;
    const count = geometries.reduce((n, geo) => n + geo.attributes.position.count, 0);
    const geo = new T.BufferGeometry();
    for (const key of ['position', 'normal', 'color']) {
      const a = new Float32Array(count * 3); let at = 0;
      for (const part of geometries) { a.set(part.attributes[key].array, at); at += part.attributes[key].array.length; }
      geo.setAttribute(key, new T.BufferAttribute(a, 3));
    }
    geo.computeBoundingSphere(); geo.computeBoundingBox();
    const mesh = new T.Mesh(geo, material); mesh.name = g.name + '.batch'; mesh.castShadow = mesh.receiveShadow = false; g.add(mesh);
    for (const part of geometries) part.dispose();
  }
  parts.clear();

  // One welded tube, 25 rings / 10 sides, cap vertices: topology never changes.
  // Tangent-aligned cross sections follow a continuous centreline, not separate tail beads.
  const rings = 25, sides = 10, tailGeo = new T.BufferGeometry();
  const tailPositions = new Float32Array((rings * sides + 2) * 3), tailColors = new Float32Array(tailPositions.length), tailIndices = [];
  for (let i = 0; i < rings - 1; i++) for (let j = 0; j < sides; j++) {
    const a = i * sides + j, b = i * sides + (j + 1) % sides;
    tailIndices.push(a, a + sides, b, b, a + sides, b + sides);
  }
  for (let j = 0; j < sides; j++) {
    tailIndices.push(rings * sides, j, (j + 1) % sides);
    tailIndices.push(rings * sides + 1, (rings - 1) * sides + (j + 1) % sides, (rings - 1) * sides + j);
  }
  const tailColor = new T.Color();
  for (let i = 0; i < rings * sides + 2; i++) {
    const u = Math.min(1, Math.floor(i / sides) / (rings - 1));
    tailColor.copy(colors.fur).lerp(colors.darkFur, smooth(.63, 1, u) * .8);
    tailColors.set([tailColor.r, tailColor.g, tailColor.b], i * 3);
  }
  tailGeo.setAttribute('position', new T.BufferAttribute(tailPositions, 3).setUsage(T.DynamicDrawUsage));
  tailGeo.setAttribute('color', new T.BufferAttribute(tailColors, 3)); tailGeo.setIndex(tailIndices);
  const tail = new T.Mesh(tailGeo, material); tail.name = 'tail.continuous'; tail.position.set(0, -.025, -.104); hip.g.add(tail);
  tail.userData = { topology: 'welded capped tapered tube', rings, sides, length: .98 };
  const centers = Array.from({ length: rings }, () => new T.Vector3());
  const tangent = new T.Vector3(), sideways = new T.Vector3(), up = new T.Vector3(), worldUp = new T.Vector3(0, 1, 0);
  function deformTail(clock, gait, motion, sneak, turn, airborne) {
    const amplitude = .025 + .050 * motion;
    for (let i = 0; i < rings; i++) {
      const u = i / (rings - 1);
      centers[i].set(.11 * u * u + Math.sin(clock * 1.6 - u * 3.6 + Math.sin(gait) * .20) * amplitude * u * u - turn * .028 * u * u,
        -.34 * Math.sin(u * Math.PI * .85) + .055 * u * u + .10 * sneak * u + .12 * airborne * u,
        -.98 * u + .10 * u * u * u);
    }
    for (let i = 0; i < rings; i++) {
      tangent.subVectors(centers[Math.min(rings - 1, i + 1)], centers[Math.max(0, i - 1)]).normalize();
      sideways.crossVectors(tangent, worldUp).normalize(); up.crossVectors(sideways, tangent).normalize();
      const u = i / (rings - 1), radius = .076 * (1 - u) ** .88 + .006;
      for (let j = 0; j < sides; j++) {
        const a = TAU * j / sides, co = Math.cos(a) * radius, si = Math.sin(a) * radius;
        const n = (i * sides + j) * 3;
        tailPositions[n] = centers[i].x + sideways.x * co + up.x * si;
        tailPositions[n + 1] = centers[i].y + sideways.y * co + up.y * si;
        tailPositions[n + 2] = centers[i].z + sideways.z * co + up.z * si;
      }
    }
    centers[0].toArray(tailPositions, rings * sides * 3); centers[rings - 1].toArray(tailPositions, (rings * sides + 1) * 3);
    tailGeo.attributes.position.needsUpdate = true; tailGeo.computeVertexNormals();
    // Conservative fixed culling bounds cover every deformation; no per-frame bounds scan.
  }
  tailGeo.boundingSphere = new T.Sphere(new T.Vector3(0, -.10, -.45), .83);
  tailGeo.boundingBox = new T.Box3(new T.Vector3(-.36, -.45, -1), new T.Vector3(.40, .23, .10));

  const down = new T.Vector3(0, -1, 0), target = new T.Vector3(), direction = new T.Vector3(), pole = new T.Vector3();
  const bend = new T.Vector3(), elbow = new T.Vector3(), lowerDirection = new T.Vector3(), inv = new T.Quaternion(), total = new T.Quaternion();
  function solve(limb, goal, poleVector, endOrientation = null) {
    target.copy(goal).sub(limb.upper.base); const actual = target.length();
    const length = clamp(actual, .022, limb.a + limb.b - .00015);
    direction.copy(target).normalize(); if (actual < .00001) direction.copy(down);
    pole.copy(poleVector); bend.copy(pole).addScaledVector(direction, -pole.dot(direction));
    if (bend.lengthSq() < .0001) bend.set(0, 0, 1).addScaledVector(direction, -direction.z);
    bend.normalize();
    const along = (limb.a * limb.a - limb.b * limb.b + length * length) / (2 * length);
    const height = Math.sqrt(Math.max(0, limb.a * limb.a - along * along));
    elbow.copy(direction).multiplyScalar(along).addScaledVector(bend, height);
    lowerDirection.copy(elbow).normalize(); limb.upper.q.setFromUnitVectors(down, lowerDirection);
    lowerDirection.copy(direction).multiplyScalar(length).sub(elbow).normalize();
    total.setFromUnitVectors(down, lowerDirection); inv.copy(limb.upper.q).invert(); limb.lower.q.copy(inv).multiply(total);
    limb.end.q.copy(total).invert(); if (endOrientation) limb.end.q.multiply(endOrientation);
  }
  const goal = new T.Vector3(), kneePole = new T.Vector3(0, 0, 1), armPole = new T.Vector3(), endQ = new T.Quaternion();
  const hipInverse = new T.Quaternion();
  let time = 0, phase = 0, velocity = 0, sneaking = 0, turn = 0, airborne = 0, carrying = 0, land = 0, previousGrounded = true, state = 'idle', wonAge = 0;
  const defaultPose = { speed: 0, turnRate: 0, grounded: true, vy: 0, slow: false, mantleProgress: null, tetherProgress: null, interactionId: null, interactionProgress: 0, loot: false, alert: 0, won: false, paused: false };
  function update(dt, pose = {}) { return animate(dt, pose, false); }
  function animate(dt, pose, snap) {
    if (pose.paused && !snap) return { state, footstep: false, landed: false };
    dt = clamp(finite(dt), 0, .1);
    const p = { ...defaultPose, ...pose }, speed = clamp(Math.abs(finite(p.speed)), 0, 9), grounded = !!p.grounded;
    const mantle = p.mantleProgress != null && Number.isFinite(p.mantleProgress), tether = p.tetherProgress != null && Number.isFinite(p.tetherProgress);
    const m = clamp(finite(p.mantleProgress), 0, 1), t = clamp(finite(p.tetherProgress), 0, 1), progress = clamp(finite(p.interactionProgress), 0, 1);
    const interacting = p.interactionId != null && progress > 0;
    const landed = !snap && grounded && !previousGrounded && !mantle && !tether;
    if (landed) land = 1;
    previousGrounded = grounded;
    const damp = snap ? 1 : 1 - Math.exp(-dt * 9);
    velocity = mix(velocity, speed, damp); sneaking = mix(sneaking, p.slow ? 1 : 0, damp);
    turn = mix(turn, clamp(finite(p.turnRate), -4, 4), damp);
    airborne = mix(airborne, grounded && !mantle && !tether ? 0 : 1, damp);
    carrying = mix(carrying, p.loot ? 1 : 0, damp);
    time += dt; // Deterministic clock; bounded trigonometric motion, no procedural randomness.
    wonAge = p.won ? wonAge + dt : 0;
    const move = clamp(velocity / 2.3, 0, 1), run = smooth(2.6, 5.0, velocity) * (1 - sneaking);
    const oldPhase = phase;
    phase += dt * velocity * mix(3.8, 5.2, sneaking);
    const contactBefore = Math.floor((oldPhase - Math.PI / 2) / Math.PI), contactAfter = Math.floor((phase - Math.PI / 2) / Math.PI);
    const footstep = !snap && grounded && !mantle && !tether && move > .15 && contactAfter !== contactBefore;
    phase %= TAU;
    state = p.won ? 'escape' : tether ? 'tether' : mantle ? 'mantle' : !grounded ? 'airborne' : land > .1 ? 'landing' : interacting ? (p.interactionId === 'relay' ? 'pickpocket' : p.interactionId === 'prize' ? 'stash' : 'interact') : p.slow ? 'sneak' : speed > 3 ? 'run' : speed > .12 ? 'walk' : p.loot ? 'carry' : 'idle';
    for (const j of joints) { j.p.copy(j.base); j.q.identity(); j.s.set(1, 1, 1); }
    const breath = Math.sin(time * 2.1), stride = mix(.12, .205, run) * move * mix(1, .65, sneaking);
    hip.p.y = .61 - .045 * move - .155 * sneaking - .093 * land + Math.cos(phase * 2) * .012 * move;
    hip.p.x = Math.sin(phase) * .009 * move;
    rotate(hip, 0, Math.sin(phase) * .035 * move, -turn * .017);
    rotate(spine, .035 + .14 * run + .29 * sneaking + .10 * land + breath * .006 * (1 - move), -Math.sin(phase) * .09 * move, -Math.sin(phase) * .025 * move);
    spine.p.y += breath * .004 * (1 - move);
    const glance = Math.sin(time * .68) * Math.sin(time * .23) * .24 * (1 - move);
    rotate(head, -.045 - .16 * sneaking - .07 * run, glance + turn * .042, -.03 + Math.sin(time * .41) * .018);
    const alert = clamp(finite(p.alert) / 100, 0, 1);
    const blinkClock = time % 4.7, blink = 1 - .94 * Math.max(0, 1 - Math.abs(blinkClock - 3.84) / .105);
    for (let i = 0; i < 2; i++) {
      eyes[i].s.y = blink * (1 - .15 * sneaking + .12 * alert);
      eyes[i].p.x += Math.sin(time * .68) * .003 * (1 - move);
      brows[i].p.y += .006 * alert + (i ? .003 : .008) * (1 - move);
      rotate(brows[i], 0, 0, (i ? -.13 : .20) + (i ? -.20 : .20) * alert);
    }
    rotate(bag, .03 + Math.sin(phase + .6) * .07 * move, 0, -.10 + Math.sin(phase) * .025 * move);
    bag.s.z = 1 + carrying * .10;
    const actionEnvelope = smooth(0, .14, progress);
    if (mantle) {
      hip.p.y -= .055 * Math.sin(m * Math.PI); rotate(spine, .18 + .28 * m); rotate(head, -.25);
    } else if (tether) {
      hip.p.y += .035; rotate(spine, -.07, .045 * Math.sin(t * Math.PI), 0); rotate(head, .08, -.10);
    } else if (!grounded) {
      rotate(spine, .08 + clamp(finite(p.vy), -8, 8) * .009, 0, -turn * .025); rotate(head, -.10);
    }
    hipInverse.copy(hip.q).invert();
    for (let i = 0; i < 2; i++) {
      const leg = legs[i], a = phase + i * Math.PI, lift = Math.max(0, Math.cos(a));
      goal.set(leg.s * (.101 + .014 * sneaking), .085 + lift ** 1.5 * mix(.065, .14, run) * move * (1 - .45 * sneaking), Math.sin(a) * stride);
      if (!grounded || mantle || tether) {
        goal.y = .18 + (i ? .09 : 0) + .025 * Math.sin(time * 3 + i);
        goal.z = (i ? -.11 : .13) + clamp(finite(p.vy), -5, 5) * .012;
      }
      if (mantle) { goal.y += Math.sin(m * Math.PI) * (i ? .10 : .19); goal.z = mix(.22, .06, m) * (i ? .6 : 1); }
      if (tether) { goal.y = i ? .25 : .14; goal.z = i ? .15 : -.09; }
      goal.sub(hip.p).applyQuaternion(hipInverse);
      endQ.copy(hipInverse);
      solve(leg, goal, kneePole, endQ);
    }
    for (let i = 0; i < 2; i++) {
      const arm = arms[i], s = arm.s, a = phase + i * Math.PI;
      goal.set(s * (.207 + .018 * run), .08 + .075 * run + .06 * sneaking, -.012 - Math.sin(a) * .13 * move + .10 * sneaking);
      if (i === 1 && carrying > .001) { goal.x = mix(goal.x, .22, carrying); goal.y = mix(goal.y, .065, carrying); goal.z = mix(goal.z, .157, carrying); }
      if (mantle) goal.set(s * .19, mix(.89, .65, m), mix(.22, .29, m));
      else if (tether) goal.set(s * .075, .876, .14 + Math.sin(t * Math.PI) * .045);
      else if (!grounded) goal.set(s * .24, .24 + (i ? .02 : 0), .16);
      else if (interacting && !p.won) {
        const e = actionEnvelope;
        if (p.interactionId === 'relay' && i === 1) {
          const withdraw = smooth(.78, 1, progress);
          goal.lerp(new T.Vector3(mix(.15, .22, withdraw), mix(.29, .08, withdraw), mix(.37, .14, withdraw)), e);
          rotate(head, -.09, -.16 * e); rotate(spine, .09, -.07 * e);
        } else if (p.interactionId === 'prize') {
          const lift = smooth(.16, .46, progress), stash = smooth(.55, .91, progress);
          const gx = mix(s * .125, i ? .224 : .08, stash), gy = mix(.32 + lift * .14, .065, stash), gz = mix(.37 - lift * .045, .154, stash);
          goal.lerp(new T.Vector3(gx, gy, gz), e);
          rotate(head, mix(.11, .27, stash), -.08 * stash); rotate(spine, .085 + .035 * stash);
          rotate(flap, -.65 * Math.sin(smooth(.4, 1, progress) * Math.PI));
        } else if (p.interactionId === 'anchor') {
          goal.lerp(new T.Vector3(s * .105, .24 + Math.sin(progress * TAU * 2 + i) * .026, .30), e); rotate(head, .20);
        } else if (p.interactionId.startsWith('exit') && i === 0) goal.lerp(new T.Vector3(-.22, .37, .30), e);
      }
      if (p.won && i === 0) {
        // One small lapel-tip / two-finger acknowledgement, not a looping victory dance.
        const salute = smooth(.10, .40, wonAge) * (1 - smooth(1.0, 1.65, wonAge));
        goal.lerp(new T.Vector3(-.12, .58, .24), salute); rotate(head, -.03, -.12 * salute, -.04 * salute);
      }
      armPole.set(s * .8, -.18, -.12);
      endQ.setFromEuler(tempEuler.set(-.12 - .3 * sneaking, 0, -s * .10));
      solve(arm, goal, armPole, endQ);
    }
    parcel.g.visible = p.interactionId === 'prize' && progress > .24 && progress < .83 && !p.loot;
    stored.g.visible = !!p.loot || (p.interactionId === 'prize' && progress >= .83);
    const alpha = snap ? 1 : 1 - Math.exp(-dt * 16);
    for (const j of joints) {
      if (snap) { j.g.position.copy(j.p); j.g.quaternion.copy(j.q); j.g.scale.copy(j.s); }
      else { j.g.position.lerp(j.p, alpha); j.g.quaternion.slerp(j.q, alpha); j.g.scale.lerp(j.s, alpha); }
    }
    deformTail(time, phase, move, sneaking, turn, airborne);
    land *= Math.exp(-dt * 13);
    root.updateMatrixWorld(true);
    return { state, footstep, landed };
  }
  function reset() {
    time = phase = velocity = sneaking = turn = airborne = carrying = land = wonAge = 0;
    previousGrounded = true; state = 'idle';
    animate(0, defaultPose, true);
    // root.position / rotation / scale deliberately remain owned by the runtime.
  }
  reset();
  let triangleCount = 0, draws = 0, vertices = 0;
  root.traverse(o => { if (o.isMesh) { draws++; vertices += o.geometry.attributes.position.count; triangleCount += (o.geometry.index?.count || o.geometry.attributes.position.count) / 3; } });
  const stats = Object.freeze({ triangles: triangleCount, drawCalls: draws, vertices, materials: 1, joints: joints.length, tailRings: rings, tailSides: sides, height: 1.598, forward: '+Z', feetY: 0 });
  root.userData.stats = stats;
  return { root, update, reset, stats };
}
