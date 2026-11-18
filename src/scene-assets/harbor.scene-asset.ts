import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  BackSide,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
} from '@iwsdk/core';
import { LoftSurface, makeRandom } from './lib/hardsurface.js';

const ink = (color: string) =>
  new MeshBasicMaterial({ color, toneMapped: false, side: DoubleSide });
const navy = ink('#223748');
const gold = ink('#e6aa70');
const ivory = ink('#f9d9a1');
const red = ink('#b6544d');
const timber = ink('#573f40');
const TAU = 2 * Math.PI;

function part(
  parent: Group,
  name: string,
  geometry: BufferGeometry,
  material: MeshBasicMaterial | ShaderMaterial,
  x: number,
  y: number,
  z: number,
) {
  // Bake broad daylight into opaque solids so the facets and masonry stay
  // legible in stereo without extra lights or shadow-map passes.
  if (
    material instanceof MeshBasicMaterial &&
    !material.transparent &&
    geometry.attributes.normal
  ) {
    const normal = geometry.attributes.normal,
      rgb = new Float32Array(normal.count * 3);
    for (let i = 0; i < normal.count; i++) {
      const shade =
        0.64 +
        0.36 *
          Math.max(
            0,
            -0.72 * normal.getX(i) +
              0.51 * normal.getY(i) +
              0.46 * normal.getZ(i),
          );
      rgb.set([shade, shade * 0.99, 0.94 * shade + 0.06], i * 3);
    }
    geometry.setAttribute('color', new Float32BufferAttribute(rgb, 3));
    material.vertexColors = true;
  }
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

// Latitude bands on the tapered masonry keep the stripe edges flush with the tower.
function lighthouse() {
  const tower = new Group();
  tower.name = 'Signal tower';
  const lathe = (
    name: string,
    profile: number[][],
    material: MeshBasicMaterial,
  ) =>
    part(
      tower,
      name,
      new LatheGeometry(
        profile.map(([r, y]) => new Vector2(r, y)),
        32,
      ),
      material,
      0,
      0,
      0,
    );
  lathe(
    'Granite footing',
    [
      [0.53, 0],
      [0.53, 0.13],
      [0.42, 0.24],
    ],
    navy,
  );
  lathe(
    'Limewash',
    [
      [0.42, 0.23],
      [0.28, 1.99],
      [0.31, 2.04],
    ],
    ivory,
  );
  for (const y of [0.59, 1.27]) {
    const radius = (h: number) => 0.421 - (h - 0.23) * 0.0795;
    lathe(
      'Vermilion stripe',
      [
        [radius(y) + 0.003, y],
        [radius(y + 0.29) + 0.003, y + 0.29],
      ],
      red,
    );
  }
  lathe(
    'Watch gallery',
    [
      [0.28, 1.98],
      [0.46, 2.09],
      [0.46, 2.14],
      [0.28, 2.15],
    ],
    navy,
  );
  const ring = (radius: number, y: number) => {
    const rail = part(
      tower,
      'Gallery rail',
      new TorusGeometry(radius, 0.012, 5, 32),
      gold,
      0,
      y,
      0,
    );
    rail.rotation.x = Math.PI / 2;
  };
  ring(0.44, 2.36);
  for (let i = 0; i < 10; i++) {
    const angle = (TAU * i) / 10;
    part(
      tower,
      'Baluster',
      new CylinderGeometry(0.012, 0.012, 0.22, 5),
      navy,
      0.44 * Math.cos(angle),
      2.25,
      0.44 * Math.sin(angle),
    );
  }
  lathe(
    'Lantern glass',
    [
      [0.24, 2.14],
      [0.24, 2.56],
    ],
    gold,
  );
  for (let i = 0; i < 8; i++) {
    const a = (TAU * i) / 8;
    part(
      tower,
      'Lantern mullion',
      new BoxGeometry(0.025, 0.43, 0.025),
      navy,
      0.246 * Math.cos(a),
      2.35,
      0.246 * Math.sin(a),
    );
  }
  lathe(
    'Copper lantern roof',
    [
      [0.34, 2.55],
      [0.35, 2.59],
      [0.06, 2.78],
      [0.015, 2.89],
    ],
    navy,
  );
  for (const y of [0.45, 1.13, 1.78]) {
    part(
      tower,
      'Seaward window',
      new CircleGeometry(0.075, 16),
      navy,
      0,
      y,
      0.425 - (y - 0.23) * 0.0795,
    );
  }
  part(
    tower,
    'Door surround',
    new BoxGeometry(0.21, 0.35, 0.04),
    gold,
    0,
    0.395,
    0.407,
  );
  part(
    tower,
    'Keeper’s door',
    new BoxGeometry(0.15, 0.29, 0.048),
    navy,
    0,
    0.37,
    0.423,
  );
  part(
    tower,
    'Door latch',
    new BoxGeometry(0.035, 0.012, 0.014),
    gold,
    0.047,
    0.37,
    0.454,
  );
  const beacon = new Group();
  beacon.name = 'Beacon sweep';
  const beamGeo = new BufferGeometry();
  beamGeo.setAttribute(
    'position',
    new Float32BufferAttribute([0, 0, 0, 3.8, -0.14, 0, 3.8, 0.14, 0], 3),
  );
  const beam = ink('#ffdc8c');
  beam.transparent = true;
  beam.opacity = 0.22;
  beam.depthWrite = false;
  part(beacon, 'Light fan', beamGeo, beam, 0, 0, 0);
  beacon.position.y = 2.35;
  tower.add(beacon);
  return tower;
}

// A section-built hull, with its gunwale following the sheer towards both ends.
function cutter() {
  const boat = new Group();
  boat.name = 'Pilot cutter';
  const sections = [
    [-0.74, 0.014, 0.13],
    [-0.53, 0.19, 0.075],
    [-0.08, 0.24, 0.055],
    [0.41, 0.18, 0.085],
    [0.77, 0.012, 0.17],
  ];
  const hull = LoftSurface.tube(
    sections.map(([z, halfW, cy]) => ({
      z,
      halfW,
      cy,
      hUp: 0.025,
      hDown: 0.18,
      power: 0.75,
    })),
  );
  part(
    boat,
    'Painted hull',
    hull.build(
      sections.map((s) => s[0]),
      14,
      true,
    ),
    navy,
    0,
    0.14,
    0,
  );
  part(
    boat,
    'Mast',
    new CylinderGeometry(0.014, 0.022, 1.39, 8),
    timber,
    0,
    0.91,
    -0.1,
  );
  function sail(
    name: string,
    corners: number[][],
    material: MeshBasicMaterial,
  ) {
    const cloth = new BufferGeometry();
    const [a, b, c] = corners;
    const belly = [0.14, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    cloth.setAttribute(
      'position',
      new Float32BufferAttribute(
        [...a, ...b, ...belly, ...b, ...c, ...belly, ...c, ...a, ...belly],
        3,
      ),
    );
    cloth.computeVertexNormals();
    part(boat, name, cloth, material, 0, 0, 0);
  }
  sail(
    'Ochre mainsail',
    [
      [0, 1.52, -0.08],
      [0, 0.38, -0.07],
      [0, 0.43, 0.67],
    ],
    gold,
  );
  sail(
    'Cream jib',
    [
      [0, 1.35, -0.14],
      [0, 0.35, -0.68],
      [0, 0.38, -0.17],
    ],
    ivory,
  );
  boat.rotation.y = -1.04;
  return boat;
}

const vertex = `
  varying vec2 vUv;
  varying vec3 vLocal;
  void main(){
    vUv = uv;
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
  }`;

function water() {
  // Horizontal dashes break up into individual picks of yarn at close range.
  const sea = new ShaderMaterial({
    vertexShader: vertex,
    uniforms: { tide: { value: 0 }, signal: { value: 0 } },
    fragmentShader: `
      varying vec3 vLocal;
      uniform float tide,signal;
      float hash(vec2 p){return fract(sin(dot(p,vec2(31.73,73.31)))*437.58);}
      void main(){
        vec2 p=vLocal.xy;
        float row=floor(p.y*9.);
        float ripple=sin(p.x*1.7+p.y*1.1+tide*.38)*.12;
        float line=abs(fract(p.y*9.+ripple)-.5);
        float stroke=1.-smoothstep(.025,.085+fwidth(p.y)*4.,line);
        float cell=floor(p.x*2.2+sin(row*11.)+tide*.17);
        float dash=smoothstep(.52,.86,hash(vec2(cell,row)));
        float farSea=smoothstep(-8.,8.,p.y);
        float goldPath=exp(-abs(p.x+clamp((p.y+16.)*.19,0.,4.)+sin(row*.62)*.55)*.95);
        float stripe=.5+.5*sin(p.y*.94+sin(p.x*.7));
        vec3 base=mix(vec3(.015,.099,.126),vec3(.035,.18,.21),stripe);
        vec3 glint=mix(vec3(.12,.34,.36),vec3(.94,.52,.25),goldPath);
        float fine=1.-smoothstep(.024,.18,fwidth(p.y));
        vec3 waterColor=mix(base,vec3(.22,.325,.32),farSea*.61);
        waterColor+=glint*(stroke*dash*(.41+signal*.08)*fine + goldPath*.055);
        gl_FragColor=vec4(waterColor,1.);
        #include <colorspace_fragment>
      }`,
  });
  return sea;
}

function island(
  name: string,
  width: number,
  depth: number,
  height: number,
  seed: number,
) {
  const rand = makeRandom(seed);
  const n = 39,
    positions: number[] = [],
    colors: number[] = [];
  const outline = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU;
    const r = 0.87 + 0.11 * Math.cos(3 * a) + rand() * 0.13;
    return [Math.cos(a) * width * r, Math.sin(a) * depth * r, rand() * 0.085];
  });
  const bands = [
    [1.04, -0.15, '#364951'],
    [1, 0.1, '#cc9676'],
    [0.91, 0.31, '#96665d'],
    [0.85, 0.42, '#e0ac82'],
    [0.78, 0.55, '#a97768'],
    [0.71, 0.64, '#c98a6a'],
    [0.67, 0.74, '#647d72'],
    [0.54, 0.88, '#7e9581'],
    [0.28, 1, '#a5a780'],
    [0, 1.02, '#a5a780'],
  ] as const;
  function point(i: number, b: number) {
    const [x, z, dy] = outline[i % n],
      [radius, y] = bands[b];
    return [x * radius, height * (y + (radius === 0 ? 0 : dy)), z * radius];
  }
  for (let b = 0; b < bands.length - 1; b++)
    for (let i = 0; i < n; i++) {
      const color = new Color(bands[b][2]).multiplyScalar(0.79 + rand() * 0.21);
      const a = point(i, b),
        d = point(i + 1, b),
        c = point(i + 1, b + 1),
        e = point(i, b + 1);
      const face = b === bands.length - 2 ? [a, d, c] : [a, d, c, a, c, e];
      for (const p of face) {
        positions.push(...p);
        colors.push(color.r, color.g, color.b);
      }
    }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const relief = new ShaderMaterial({
    side: DoubleSide,
    vertexColors: true,
    vertexShader: `
      varying vec3 rock, dye;
      void main(){rock=position; dye=color;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
    `,
    fragmentShader: `
      varying vec3 rock, dye;
      void main(){
        vec2 p=vec2(rock.x+.61*rock.z,rock.y);
        float grain=p.y*63.+sin(p.x*7.6)+sin(p.x*14.+p.y)*.37;
        float edge=fwidth(grain);
        float seam=(1.-smoothstep(.03,.10+edge,abs(fract(grain)-.5)))*(1.-smoothstep(.12,.5,edge));
        float stress=p.x*4.1+p.y*1.55+sin(p.y*12.+p.x*3.)*.24;
        float crack=1.-smoothstep(.012,.028+fwidth(stress),abs(fract(stress)-.5));
        float vein=.5+.5*sin(p.x*9.+p.y*4.+sin(p.x*13.));
        vec3 face=dye*(.89+.11*vein-.27*seam-.29*crack*smoothstep(.16,.68,vein));
        gl_FragColor=vec4(face,1.);
        #include <colorspace_fragment>
      }`,
  });
  const model = new Mesh(geo, relief);
  model.name = name;
  return model;
}

function quayside(root: Group) {
  const boards = new InstancedMesh(
    new BoxGeometry(2.05, 0.095, 0.174),
    ink('#886b59'),
    30,
  );
  const transform = new Object3D();
  const tint = new Color();
  boards.name = 'Dock planking';
  for (let i = 0; i < 30; i++) {
    transform.position.set(0, -0.05, 1.15 - i * 0.181);
    transform.updateMatrix();
    boards.setMatrixAt(i, transform.matrix);
    boards.setColorAt(
      i,
      tint.setScalar(0.63 + 0.22 * Math.sin(i * 12.73) ** 2),
    );
  }
  root.add(boards);
  const posts = new InstancedMesh(
    new CylinderGeometry(0.065, 0.075, 0.59, 10),
    timber,
    10,
  );
  posts.name = 'Mooring posts';
  for (let i = 0; i < 10; i++) {
    posts.setMatrixAt(
      i,
      new Matrix4().makeTranslation(
        i % 2 === 0 ? -0.97 : 0.97,
        0.02,
        0.85 - Math.floor(i / 2) * 1.18,
      ),
    );
  }
  root.add(posts);
}

/** Coastal diorama. Origin is the workbench end of the quay, sea level is -0.28 m. */
export function createHarbor() {
  const harbor = new Group();
  harbor.name = 'Selvedge harbor';
  const sky = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    vertexShader: vertex,
    fragmentShader: `
      varying vec3 vLocal;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){
        vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                   mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
      }
      void main(){
        vec3 d=normalize(vLocal);
        float h=clamp(d.y,0.,1.);
        vec3 sky=mix(vec3(.91,.53,.38),vec3(.105,.235,.37),smoothstep(-.025,.62,h));
        float halo=dot(d,normalize(vec3(-4.,3.1,-19.3)));
        sky+=vec3(.32,.19,.055)*pow(max(halo,0.),32.);
        vec2 p=d.xz/(.18+max(.02,d.y));
        float cloud=.53*noise(p*vec2(2.3,6.3))+.29*noise(p*vec2(4.8,14.))+.18*noise(p*vec2(12.,31.));
        float cover=smoothstep(.47,.75,cloud)*smoothstep(.035,.18,h);
        sky=mix(sky,vec3(.91,.73,.64),cover*.72);
        gl_FragColor=vec4(sky,1.);
        #include <colorspace_fragment>
      }`,
  });
  const skyShell = part(
    harbor,
    'Evening cloudbank',
    new SphereGeometry(66, 48, 20),
    sky,
    0,
    1,
    0,
  );
  skyShell.renderOrder = -100;
  skyShell.userData.iwsdkPreviewBounds = 'exclude';
  const ocean = part(
    harbor,
    'Woven water',
    new PlaneGeometry(90, 64),
    water(),
    0,
    -0.28,
    -16,
  );
  ocean.rotation.x = -Math.PI / 2;
  quayside(harbor);
  const headland = island('Signal headland', 2.15, 1.58, 1.1, 82);
  headland.position.set(3.3, -0.3, -7);
  harbor.add(headland);
  const tower = lighthouse();
  tower.position.set(3.3, 0.82, -7);
  harbor.add(tower);
  // A timber landing and a flight of steps trace the actual approach from the water.
  const steps = new InstancedMesh(
    new BoxGeometry(0.31, 0.09, 0.19),
    ink('#c3ad90'),
    17,
  );
  const stepPose = new Object3D();
  steps.name = 'Keeper’s stair';
  for (let i = 0; i < steps.count; i++) {
    const t = i / (steps.count - 1),
      turn = -0.95 + 1.38 * t;
    const radius = 1.47 - 1.0 * t;
    stepPose.position.set(
      3.3 + Math.sin(turn) * radius * 1.17,
      -0.035 + t * 1.08,
      -7 + Math.cos(turn) * radius,
    );
    stepPose.rotation.y = turn - 0.75;
    stepPose.updateMatrix();
    steps.setMatrixAt(i, stepPose.matrix);
  }
  harbor.add(steps);
  part(
    harbor,
    'Boat landing',
    new BoxGeometry(0.9, 0.09, 0.4),
    timber,
    1.64,
    -0.085,
    -5.96,
  );
  for (const x of [1.28, 2.0])
    part(
      harbor,
      'Landing pile',
      new CylinderGeometry(0.035, 0.044, 0.39, 8),
      navy,
      x,
      -0.13,
      -5.8,
    );
  // A signal flag stands across the channel, readable from the end of the quay.
  part(
    harbor,
    'Signal post',
    new CylinderGeometry(0.026, 0.042, 2.07, 12),
    timber,
    -0.72,
    0.73,
    -5.75,
  );
  part(
    harbor,
    'Signal finial',
    new SphereGeometry(0.049, 12, 8),
    gold,
    -0.72,
    1.79,
    -5.75,
  );
  const flagGeo = new PlaneGeometry(0.9, 0.52, 24, 10);
  const coords = flagGeo.attributes.position;
  for (let i = 0; i < coords.count; i++) {
    const t = flagGeo.attributes.uv.getX(i);
    coords.setZ(i, Math.sin(t * 8.4) * t * 0.09);
    coords.setY(i, coords.getY(i) - t * t * 0.07);
  }
  flagGeo.computeVertexNormals();
  const flag = new Mesh(
    flagGeo,
    new MeshBasicMaterial({
      color: '#20474f',
      side: DoubleSide,
      toneMapped: false,
    }),
  );
  flag.name = 'Woven signal flag';
  flag.position.set(-0.25, 1.42, -5.75);
  harbor.add(flag);
  const village = island('West inlet', 4.6, 1.97, 1.12, 19);
  village.position.set(-5, -0.28, -8.8);
  harbor.add(village);
  const rand = makeRandom(47);
  const homes = new Group();
  homes.name = 'Harbor windows';
  for (let i = 0; i < 7; i++) {
    const x = -6.65 + i * 0.52,
      z = -8.8 + 0.24 * Math.sin(i * 2);
    const y = 0.84 - Math.abs(i - 3) * 0.044,
      h = 0.34 + rand() * 0.24;
    part(
      harbor,
      'Limewashed cottage',
      new BoxGeometry(0.43, h, 0.45),
      ivory,
      x,
      y + h * 0.42,
      z,
    );
    const roof = part(
      harbor,
      'Folded tile roof',
      new CylinderGeometry(0, 0.39, 0.28, 4),
      red,
      x,
      y + h * 0.9 + 0.125,
      z,
    );
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 1.06;
    for (const dx of [-0.11, 0.11]) {
      part(
        harbor,
        'Window casing',
        new BoxGeometry(0.085, 0.102, 0.012),
        navy,
        x + dx,
        y + h * 0.45,
        z + 0.23,
      );
      part(
        homes,
        'Lit pane',
        new BoxGeometry(0.065, 0.079, 0.013),
        gold,
        x + dx,
        y + h * 0.45,
        z + 0.24,
      );
    }
  }
  const pines = new InstancedMesh(
    new CylinderGeometry(0.012, 0.12, 0.72, 7),
    ink('#405953'),
    32,
  );
  pines.name = 'Windbreak';
  const trunk = new Object3D();
  for (let i = 0; i < pines.count; i++) {
    const a = rand() * TAU,
      radius = 0.56 + rand() * 0.19;
    const x = Math.cos(a) * 4.1 * radius,
      z = Math.sin(a) * 1.7 * radius;
    const scale = 0.65 + rand() * 0.78;
    trunk.position.set(-5 + x, 0.47 + 0.36 * scale, -8.8 + z);
    trunk.scale.set(scale, scale, scale);
    trunk.rotation.z = 0.06 + rand() * 0.12;
    trunk.updateMatrix();
    pines.setMatrixAt(i, trunk.matrix);
  }
  harbor.add(pines);
  harbor.add(homes);
  for (let i = 0; i < 3; i++) {
    const boat = cutter();
    boat.name = 'Cutter ' + i;
    boat.position.set(-2.4 + i * 1.45, -0.25, -4.4 - i * 0.78);
    boat.scale.setScalar(0.72 + i * 0.13);
    harbor.add(boat);
  }
  // Mountain silhouettes recede in value as well as in space.
  for (let layer = 0; layer < 3; layer++) {
    const ridge = new BufferGeometry(),
      pos: number[] = [];
    const peaks = Array.from(
      { length: 65 },
      (_, i) =>
        1 +
        layer * 0.55 +
        (1.1 + 0.55 * layer) * Math.abs(Math.sin(i * 0.36 + layer * 1.4)) +
        0.55 * Math.sin(i * 1.13) +
        rand() * 0.55,
    );
    for (let i = 0; i < 64; i++) {
      const x = (i - 32) * 1.55;
      pos.push(
        x,
        -0.4,
        0,
        x + 1.55,
        -0.4,
        0,
        x,
        peaks[i],
        0,
        x + 1.55,
        -0.4,
        0,
        x + 1.55,
        peaks[i + 1],
        0,
        x,
        peaks[i],
        0,
      );
    }
    ridge.setAttribute('position', new Float32BufferAttribute(pos, 3));
    ridge.computeVertexNormals();
    part(
      harbor,
      'Distant ridge ' + layer,
      ridge,
      ink(['#5a747a', '#9a8b88', '#caa59a'][layer]),
      0,
      0,
      -17 - layer * 4,
    );
  }
  const disc = new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: `
    varying vec2 vUv;
    void main(){
      float stitch=smoothstep(.14,.31,abs(fract(vUv.y*58.)-.5));
      vec3 c=mix(vec3(.83,.34,.16),vec3(1.,.84,.49),vUv.y);
      gl_FragColor=vec4(c*(.84+.16*stitch),1.);
      #include <colorspace_fragment>
    }`,
  });
  part(
    harbor,
    'Woven setting sun',
    new CircleGeometry(2.1, 96),
    disc,
    -4,
    4.25,
    -19.3,
  );
  for (let i = 0; i < 2; i++) {
    part(
      harbor,
      'Solar embroidery',
      new TorusGeometry(2.22 + i * 0.14, 0.012, 5, 100),
      gold,
      -4,
      4.25,
      -19.35,
    );
  }
  const flock = new Group();
  flock.name = 'Returning terns';
  const birds = new BufferGeometry(),
    wings: number[] = [];
  for (let i = 0; i < 13; i++) {
    const x = (i - 6) * 0.34,
      y = Math.abs(i - 6) * 0.087 + rand() * 0.18,
      z = rand() * 0.54;
    wings.push(
      x - 0.19,
      y + 0.064,
      z - 0.035,
      x,
      y,
      z,
      x - 0.058,
      y + 0.08,
      z + 0.015,
      x,
      y,
      z,
      x + 0.18,
      y + 0.085,
      z - 0.05,
      x + 0.055,
      y + 0.09,
      z + 0.015,
    );
  }
  birds.setAttribute('position', new Float32BufferAttribute(wings, 3));
  birds.computeVertexNormals();
  part(flock, 'Tern silhouettes', birds, navy, 0, 0, 0);
  flock.position.set(-1, 2.21, -6.4);
  harbor.add(flock);
  return harbor;
}
