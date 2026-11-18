import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LatheGeometry,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  MeshBasicMaterial,
  ShaderMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from '@iwsdk/core';
import type { Material } from '@iwsdk/core';
import { makeRandom } from './lib/hardsurface.js';

const TAU = Math.PI * 2;
const dye = (color: string) =>
  new MeshBasicMaterial({ color, side: DoubleSide, toneMapped: false });
// Painted local shading keeps the station silhouettes legible in the unlit end
// of the harbor. Grain and brushed highlights are evaluated in object space.
function finish(color: string, grain = 0, metal = 0) {
  return new ShaderMaterial({
    side: DoubleSide,
    uniforms: {
      base: { value: new Color(color) },
      grain: { value: grain },
      metal: { value: metal },
    },
    vertexShader: `
      varying vec2 tex;varying vec3 face,worldPoint;
      void main(){tex=uv;face=normalize(mat3(modelMatrix)*normal);
        worldPoint=(modelMatrix*vec4(position,1.)).xyz;
        gl_Position=projectionMatrix*viewMatrix*vec4(worldPoint,1.);}
    `,
    fragmentShader: `
      varying vec2 tex;varying vec3 face,worldPoint;
      uniform vec3 base;uniform float grain,metal;
      void main(){
        vec3 n=normalize(face),l=normalize(vec3(-.5,.82,.57));
        float diffuse=.55+.45*max(0.,dot(l,n));
        float rings=sin(tex.y*131.+2.5*sin(tex.x*7.+tex.y*18.)+.55*sin(tex.x*31.));
        float comb=.5+.5*cos(tex.y*390.+4.*sin(tex.x*8.));
        float line=1.-smoothstep(.01,.11,abs(rings));
        float fiber=1.-grain*(.19*line+.12*comb)*(1.-smoothstep(.001,.014,fwidth(tex.y)));
        float gloss=pow(max(0.,dot(reflect(-l,n),normalize(cameraPosition-worldPoint))),19.);
        gl_FragColor=vec4(base*diffuse*fiber+metal*gloss*vec3(.9,.59,.23),1.);
        #include <colorspace_fragment>
      }`,
  });
}
const walnut = finish('#785144', 1),
  pale = finish('#cba47b', 1),
  brass = finish('#d8a75e', 0, 1),
  iron = finish('#46565b', 0, 0.6);
const azur = finish('#337985'),
  linen = finish('#f0d7ab'),
  coral = finish('#c56654');
const unitBox = new BoxGeometry(1, 1, 1);
function add(
  parent: Group,
  name: string,
  geometry: BufferGeometry,
  material: Material,
  x: number,
  y: number,
  z: number,
) {
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}
function box(
  g: Group,
  n: string,
  m: Material,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
) {
  const mesh = add(g, n, unitBox, m, x, y, z);
  mesh.scale.set(w, h, d);
  return mesh;
}
function post(
  g: Group,
  n: string,
  m: Material,
  x: number,
  y: number,
  z: number,
  r: number,
  h: number,
) {
  return add(g, n, new CylinderGeometry(r, r * 1.06, h, 12), m, x, y, z);
}
function crossbar(
  g: Group,
  n: string,
  m: Material,
  x: number,
  y: number,
  z: number,
  r: number,
  length: number,
) {
  const axle = post(g, n, m, x, y, z, r, length);
  axle.rotation.z = Math.PI / 2;
  return axle;
}

export function createBellLanding() {
  const g = new Group();
  g.name = 'Sounding frame';
  for (const x of [-0.56, 0.56]) {
    post(g, 'Oak upright', walnut, x, 0.84, 0, 0.053, 1.75);
    post(g, 'Brass ferrule', brass, x, 0.19, 0, 0.058, 0.14);
  }
  crossbar(g, 'Lintel', pale, 0, 1.66, 0, 0.057, 1.3);
  const bells = new Group();
  bells.name = 'Sounding bells';
  bells.position.y = 1.6;
  g.add(bells);
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 0.3,
      y = -0.3 - i * 0.07;
    post(bells, 'Hanger', brass, x, y / 2, 0, 0.009, -y);
    const shape = [
      [0.025, 0],
      [0.058, -0.018],
      [0.067, -0.068],
      [0.083, -0.13],
      [0.115, -0.16],
      [0.11, -0.175],
      [0.092, -0.165],
    ];
    const bell = add(
      bells,
      'Bell bronze',
      new LatheGeometry(
        shape.map(([a, b]) => new Vector2(a, b)),
        24,
      ),
      i === 1 ? coral : brass,
      x,
      y,
      0,
    );
    const clapper = add(
      bells,
      'Iron clapper',
      new SphereGeometry(0.025, 8, 6),
      iron,
      x,
      y - 0.176,
      0,
    );
    clapper.scale.y = 1.4;
    bell.scale.setScalar(0.88 + i * 0.12);
  }
  return g;
}

export function createPools() {
  const g = new Group();
  g.name = 'Basalt tide pools';
  const random = makeRandom(315);
  const rockMat = new MeshBasicMaterial({
    vertexColors: true,
    side: DoubleSide,
    toneMapped: false,
  });
  const pos: number[] = [],
    colors: number[] = [];
  const tint = (hex: string, amount = 1) =>
    new Color(hex).multiplyScalar(amount * (0.82 + 0.18 * random()));
  const tri = (a: number[], b: number[], c: number[], color: Color) => {
    pos.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) colors.push(color.r, color.g, color.b);
  };
  const quad = (
    a: number[],
    b: number[],
    c: number[],
    d: number[],
    color: Color,
  ) => {
    tri(a, b, c, color);
    tri(a, c, d, color);
  };

  // One continuous, asymmetric intertidal shelf. The basin waters stay at
  // their original local coordinates; the rock now reads as one outcrop.
  const N = 40;
  const outer = Array.from({ length: N }, (_, i) => {
    const a = (i / N) * TAU;
    const wobble =
      1 + 0.12 * Math.sin(a * 3 + 0.7) + 0.07 * Math.sin(a * 7 + 1.4);
    const x = Math.cos(a) * 1.03 * wobble;
    const z = Math.sin(a) * 0.79 * wobble;
    const y =
      0.27 +
      0.035 * Math.sin(a * 2 + 0.4) +
      (x < 0 ? -0.025 : 0.03) +
      0.018 * random();
    return [x, y, z] as number[];
  });
  const baseTop = tint('#4b5a58');
  const baseSide = tint('#2e4048');
  for (let i = 0; i < N; i++) {
    const a = outer[i],
      b = outer[(i + 1) % N];
    tri(
      [0, 0.315, 0],
      a,
      b,
      tint(
        i % 3 === 0 ? '#596966' : i % 3 === 1 ? '#455654' : '#526260',
        0.96 + 0.08 * random(),
      ),
    );
    quad(
      [a[0], a[1], a[2]],
      [b[0], b[1], b[2]],
      [b[0], -0.3, b[2]],
      [a[0], -0.3, a[2]],
      baseSide,
    );
  }

  // Low broad left shoulder and taller stepped right shoulder.
  const terrace = (
    cx: number,
    cz: number,
    rx: number,
    rz: number,
    top: number,
    bottom: number,
    seed: number,
  ) => {
    const r = makeRandom(seed);
    const ring = Array.from({ length: 9 }, (_, i) => {
      const a = (i / 9) * TAU;
      const k = 0.84 + 0.22 * r();
      return [
        cx + Math.cos(a) * rx * k,
        top + 0.035 * Math.sin(a * 3 + seed) + 0.018 * r(),
        cz + Math.sin(a) * rz * k,
      ] as number[];
    });
    const c = tint(seed % 2 ? '#79837a' : '#687572');
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      tri(
        [cx, top + 0.01, cz],
        a,
        b,
        tint(
          i % 3 === 0 ? '#7f8a7f' : i % 3 === 1 ? '#5d6c6a' : '#6f7c74',
          0.94 + 0.08 * r(),
        ),
      );
      quad(
        a,
        b,
        [b[0], bottom, b[2]],
        [a[0], bottom, a[2]],
        tint('#354851'),
      );
    }
  };
  terrace(-0.86, 0.12, 0.55, 0.48, 0.19, -0.1, 41);
  terrace(-0.73, -0.14, 0.34, 0.38, 0.255, 0.08, 43);
  terrace(0.82, 0.06, 0.32, 0.5, 0.33, 0.02, 47);
  terrace(0.69, -0.24, 0.18, 0.24, 0.43, 0.2, 53);
  // Seaward apron: a wet ramp that reads as a connection to the water, not a
  // third drum sitting on the deck.
  const apron = [
    [-0.72, 0.22, -0.58],
    [0.72, 0.22, -0.58],
    [0.92, -0.19, -0.94],
    [-0.9, -0.19, -0.94],
  ];
  quad(
    apron[0],
    apron[1],
    [apron[1][0], -0.2, apron[1][2]],
    [apron[0][0], -0.2, apron[0][2]],
    tint('#3b4b4c'),
  );
  quad(
    apron[2],
    apron[3],
    [apron[3][0], -0.22, apron[3][2]],
    [apron[2][0], -0.22, apron[2][2]],
    tint('#2d4148'),
  );
  quad(apron[0], apron[3], [apron[3][0], -0.2, apron[3][2]], [apron[0][0], -0.2, apron[0][2]], tint('#33464a'));

  // A raised, irregular collar around each original water circle. The inner
  // radius stays at 0.252 so the playable water surface and hit volume remain.
  const basinX = [ -0.53, 0, 0.53 ];
  const basinZ = [ 0.05, -0.12, 0.05 ];
  for (let p = 0; p < 3; p++) {
    const bx = basinX[p],
      bz = basinZ[p];
    const M = 36;
    const topR = 0.335 + 0.022 * random();
    const rimTop: number[][] = [];
    const rimOuter: number[][] = [];
    const rimInner: number[][] = [];
    for (let i = 0; i < M; i++) {
      const a = (i / M) * TAU;
      const k = 0.93 + 0.11 * Math.sin(a * 5 + p) + 0.035 * random();
      const notch =
        (p < 2 && Math.cos(a) > 0.9) || (p > 0 && Math.cos(a) < -0.9);
      const y =
        0.402 +
        0.025 * Math.sin(a * 3 + p * 1.7) +
        0.012 * random() -
        (notch ? 0.035 : 0);
      rimInner.push([bx + Math.cos(a) * 0.252, y - 0.012, bz + Math.sin(a) * 0.218]);
      rimTop.push([bx + Math.cos(a) * 0.252 * k, y, bz + Math.sin(a) * 0.218 * k]);
      rimOuter.push([bx + Math.cos(a) * topR, 0.302, bz + Math.sin(a) * 0.218 * (topR / 0.252)]);
    }
    for (let i = 0; i < M; i++) {
      const j = (i + 1) % M;
      quad(rimInner[i], rimTop[i], rimTop[j], rimInner[j], tint('#7d8982'));
      quad(rimTop[i], rimOuter[i], rimOuter[j], rimTop[j], tint('#596b6d'));
      quad(rimOuter[i], [rimOuter[i][0], 0.27, rimOuter[i][2]], [rimOuter[j][0], 0.27, rimOuter[j][2]], rimOuter[j], tint('#354b52'));
    }
    // A shallow, slightly darker shelf immediately inside the outer shoulder.
    quad(
      [bx - 0.48, 0.31, bz + 0.42],
      [bx + 0.48, 0.31, bz + 0.42],
      [bx + 0.48, 0.31, bz - 0.5],
      [bx - 0.48, 0.31, bz - 0.5],
      tint('#4b5a58'),
    );
  }
  // Merge all rock into one mesh: one draw call for the outcrop.
  const land = new BufferGeometry();
  land.setAttribute('position', new Float32BufferAttribute(pos, 3));
  land.setAttribute('color', new Float32BufferAttribute(colors, 3));
  land.computeVertexNormals();
  add(g, 'Intertidal outcrop', land, rockMat, 0, 0, 0);

  // Visible tide lines: dark wet band, then a lighter salt line.
  for (const [y, color] of [
    [0.312, '#204b51'],
    [0.334, '#a9b39d'],
  ] as const) {
    const line = new LineLoop(
      new BufferGeometry().setFromPoints(
        outer.map((v) => new Vector3(v[0], y, v[2])),
      ),
      new LineBasicMaterial({ color, toneMapped: false }),
    );
    line.name = 'Tide line';
    g.add(line);
  }

  // Shallow runnels between basins, sitting just above the wet shelf.
  const runnelMat = new MeshBasicMaterial({
    color: '#2d6b70',
    transparent: true,
    opacity: 0.84,
    side: DoubleSide,
    toneMapped: false,
  });
  const runnelPositions: number[] = [];
  const strip = (
    x: number,
    z: number,
    w: number,
    d: number,
    rotation: number,
    level = 0.305,
  ) => {
    const c = Math.cos(rotation),
      sn = Math.sin(rotation);
    const corners = [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, d / 2],
      [-w / 2, d / 2],
    ].map(([cx, cz]) => [
      x + cx * c - cz * sn,
      level,
      z + cx * sn + cz * c,
    ]);
    for (const index of [0, 1, 2, 0, 2, 3])
      runnelPositions.push(...corners[index]);
  };
  strip(-0.265, 0.005, 0.1, 0.08, -0.08, 0.35);
  strip(0.265, 0.005, 0.1, 0.08, 0.06, 0.35);
  for (let p = 0; p < 3; p++)
    strip(basinX[p], 0.33, 0.075, 0.18, (p - 1) * 0.05);
  strip(0, 0.43, 1.28, 0.055, 0);
  const runnelGeo = new BufferGeometry();
  runnelGeo.setAttribute(
    'position',
    new Float32BufferAttribute(runnelPositions, 3),
  );
  runnelGeo.computeVertexNormals();
  const runnelMesh = new Mesh(runnelGeo, runnelMat);
  runnelMesh.name = 'Shallow tide runnels';
  g.add(runnelMesh);

  // Small wet stones in the apron; one instanced draw call.
  const wetStone = new InstancedMesh(
    new IcosahedronGeometry(1, 0),
    dye('#40585a'),
    8,
  );
  wetStone.name = 'Wet apron stones';
  const pose = new Object3D();
  for (let i = 0; i < wetStone.count; i++) {
    const a = -2.55 + random() * 1.1;
    const r = 0.55 + random() * 0.38;
    pose.position.set(Math.cos(a) * r, -0.12 + random() * 0.1, -0.58 - random() * 0.25);
    pose.scale.set(0.06 + random() * 0.06, 0.025 + random() * 0.025, 0.05 + random() * 0.06);
    pose.rotation.set(random(), random() * TAU, random());
    pose.updateMatrix();
    wetStone.setMatrixAt(i, pose.matrix);
  }
  g.add(wetStone);

  // Barnacle/pebble speckle breaks up the broad wet shelf without adding
  // another material or draw-call family.
  const pebbles = new InstancedMesh(
    new IcosahedronGeometry(1, 0),
    dye('#94a096'),
    36,
  );
  pebbles.name = 'Barnacle speckle';
  for (let i = 0; i < pebbles.count; i++) {
    const a = random() * TAU;
    const r = 0.56 + random() * 0.3;
    const size = 0.007 + random() * 0.012;
    pose.position.set(
      Math.cos(a) * r,
      0.322 + random() * 0.018,
      Math.sin(a) * r * 0.76,
    );
    pose.scale.set(size, size * 0.5, size * 0.8);
    pose.rotation.set(random(), random() * TAU, random());
    pose.updateMatrix();
    pebbles.setMatrixAt(i, pose.matrix);
  }
  g.add(pebbles);

  // Kelp crevices: a few blades clustered between the shoulders and rims.
  const kelp = new InstancedMesh(
    new PlaneGeometry(0.018, 0.13, 1, 3),
    dye('#4c6b42'),
    20,
  );
  kelp.name = 'Kelp crevices';
  for (let i = 0; i < kelp.count; i++) {
    const cluster = i % 4;
    const a = cluster * 1.55 + random() * 0.55;
    const r = 0.41 + random() * 0.14;
    pose.position.set(Math.cos(a) * r, 0.33 + random() * 0.05, Math.sin(a) * r * 0.8);
    pose.rotation.set(0, random() * TAU, -0.18 + random() * 0.36);
    pose.scale.setScalar(0.75 + random() * 0.55);
    pose.updateMatrix();
    kelp.setMatrixAt(i, pose.matrix);
  }
  g.add(kelp);

  // Preserve the three playable water surfaces and their exact local positions.
  for (let p = 0; p < 3; p++) {
    const x = basinX[p],
      z = basinZ[p];
    const water = add(
      g,
      'Basin ' + p,
      new CircleGeometry(0.257, 48),
      dye('#317b78'),
      x,
      0.377,
      z,
    );
    water.rotation.x = -Math.PI / 2;
    water.scale.y = 0.86;
    // Limpets sit in clusters above the waterline.
    const shells = new InstancedMesh(
      new IcosahedronGeometry(1, 0),
      dye('#e6d5b4'),
      24,
    );
    shells.name = 'Limpets ' + p;
    for (let i = 0; i < shells.count; i++) {
      const a = 0.25 + random() * 1.65 + (i % 2) * 2.9;
      const r = 0.26 + random() * 0.023;
      const size = 0.009 + random() * 0.01;
      pose.position.set(x + Math.cos(a) * r, 0.435, z + Math.sin(a) * r * 0.86);
      pose.scale.set(size, size * 0.46, size * 0.81);
      pose.rotation.set(0, a, 0);
      pose.updateMatrix();
      shells.setMatrixAt(i, pose.matrix);
    }
    g.add(shells);
    const star: number[] = [];
    for (let j = 0; j < 10; j++) {
      const r = j % 2 ? 0.024 : 0.067;
      star.push(
        Math.cos((j / 10) * TAU) * r,
        0.003,
        Math.sin((j / 10) * TAU) * r,
      );
    }
    const geo = new BufferGeometry();
    geo.setAttribute(
      'position',
      new Float32BufferAttribute([...star, 0, 0.014, 0], 3),
    );
    geo.setIndex(
      Array.from({ length: 10 }, (_, i) => [10, i, (i + 1) % 10]).flat(),
    );
    geo.computeVertexNormals();
    add(g, 'Ochre sea star', geo, coral, x - 0.11, 0.443, z + 0.187);
  }
  return g;
}
export function createDyeRack() {
  const g = new Group();
  g.name = 'Skein drying rack';
  for (const x of [-0.64, 0.64]) {
    box(g, 'Trestle foot', walnut, x, 0.08, 0, 0.14, 0.14, 0.49);
    post(g, 'Trestle leg', pale, x, 0.77, 0, 0.041, 1.44);
  }
  crossbar(g, 'Skein rod', walnut, 0, 1.47, 0, 0.039, 1.45);
  const cloth = new Group();
  cloth.name = 'Hanging skeins';
  cloth.position.y = 1.45;
  g.add(cloth);
  for (let i = 0; i < 8; i++) {
    const mesh = add(
      cloth,
      'Dyed loop',
      new TorusGeometry(0.16, 0.026, 6, 32),
      [azur, brass, coral, linen][i % 4],
      (i - 3.5) * 0.14,
      -0.38,
      0,
    );
    mesh.scale.set(0.32, 2.4, 1);
    mesh.rotation.y = 0.42;
  }
  return g;
}

export function createCabinet() {
  const g = new Group();
  g.name = 'Conservation cabinet';
  for (const x of [-0.49, 0.49])
    for (const z of [-0.22, 0.22])
      box(g, 'Stile', walnut, x, 0.46, z, 0.063, 0.92, 0.063);
  box(g, 'Specimen chest', walnut, 0, 0.77, 0, 1.03, 0.54, 0.5);
  box(g, 'Work surface', pale, 0, 1.056, 0, 1.13, 0.046, 0.6);
  for (let i = 0; i < 3; i++) {
    const drawer = new Group();
    drawer.name = 'Specimen drawer ' + i;
    drawer.position.set(0, 0.6 + i * 0.15, 0.265);
    g.add(drawer);
    box(
      drawer,
      'Drawer face',
      i % 2 ? pale : walnut,
      0,
      0,
      0,
      0.91,
      0.125,
      0.055,
    );
    box(drawer, 'Label holder', brass, -0.23, 0, 0.032, 0.14, 0.052, 0.015);
    box(drawer, 'Paper label', linen, -0.23, 0, 0.041, 0.11, 0.028, 0.008);
    crossbar(drawer, 'Handle', brass, 0.17, 0, 0.068, 0.015, 0.17);
  }
  const mount = new Group();
  mount.name = 'Archive mount';
  mount.position.set(0, 1.3, 0.055);
  mount.rotation.x = -0.36;
  g.add(mount);
  box(mount, 'Mount frame', brass, 0, 0, 0, 0.66, 0.43, 0.038);
  box(mount, 'Conservation board', linen, 0, 0, 0.021, 0.625, 0.402, 0.009);
  add(
    mount,
    'Archive photograph',
    new PlaneGeometry(0.56, 0.33),
    linen,
    0,
    0,
    0.029,
  );
  const lamp = new Group();
  lamp.name = 'Inspection lamp';
  lamp.position.set(0.45, 1.077, -0.13);
  g.add(lamp);
  post(lamp, 'Lamp foot', brass, 0, 0.025, 0, 0.093, 0.05);
  post(lamp, 'Lamp stem', iron, 0, 0.245, 0, 0.018, 0.45);
  crossbar(lamp, 'Lamp arm', brass, -0.065, 0.47, 0, 0.014, 0.17);
  const shade = add(
    lamp,
    'Reflector',
    new CylinderGeometry(0.034, 0.089, 0.13, 20),
    azur,
    -0.16,
    0.455,
    0,
  );
  shade.rotation.z = -0.72;
  // A conservation bay frames a view to the sea. Instruments, folios and
  // specimen jars give the player a second reading at arm's length.
  for (const x of [-0.82, 0.82]) {
    box(g, 'Window jamb', walnut, x, 1.27, -0.43, 0.07, 2.5, 0.085);
    box(
      g,
      'Gilt jamb fillet',
      brass,
      x + 0.024,
      1.27,
      -0.379,
      0.008,
      2.46,
      0.012,
    );
  }
  for (let i = 0; i < 7; i++)
    box(
      g,
      'Lower weatherboard',
      i % 2 ? walnut : pale,
      0,
      0.1 + i * 0.12,
      -0.44,
      1.68,
      0.118,
      0.047,
    );
  for (const y of [0.88, 1.94, 2.38])
    box(g, 'Window beam', walnut, 0, y, -0.43, 1.72, 0.062, 0.095);
  for (const x of [-0.47, 0, 0.47])
    box(g, 'Window glazing bar', brass, x, 1.64, -0.44, 0.018, 1.43, 0.028);
  // Copper loupe on a tether and a pair of specimen spools on the tabletop.
  const lens = add(
    g,
    'Brass loupe',
    new TorusGeometry(0.079, 0.012, 8, 40),
    brass,
    -0.41,
    1.09,
    0.14,
  );
  lens.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 2; i++) {
    const x = -0.5 + i * 0.12;
    post(g, 'Spool core', pale, x, 1.115, -0.15, 0.045, 0.11);
    post(g, 'Thread winding', i ? azur : coral, x, 1.117, -0.15, 0.051, 0.078);
  }
  box(g, 'Specimen shelf', pale, 0.6, 1.46, -0.28, 0.41, 0.032, 0.2);
  const jarGlass = new MeshBasicMaterial({
    color: '#a9dcd2',
    transparent: true,
    opacity: 0.37,
    depthWrite: false,
  });
  for (let i = 0; i < 3; i++) {
    const x = 0.45 + i * 0.13;
    post(g, 'Sample vessel', jarGlass, x, 1.56, -0.28, 0.046, 0.15);
    post(g, 'Cork stopper', walnut, x, 1.65, -0.28, 0.033, 0.03);
    add(
      g,
      'Dye sample',
      new IcosahedronGeometry(0.03, 0),
      [azur, coral, brass][i],
      x,
      1.512,
      -0.28,
    );
  }
  const canopyGeo = new BufferGeometry();
  const awning: number[] = [],
    awningColors: number[] = [];
  for (let i = 0; i < 22; i++) {
    const x = -0.91 + i * 0.083,
      next = x + 0.083,
      c = new Color(i % 4 < 2 ? '#297780' : '#dbc69b');
    const corners = [
      [x, 2.39, -0.55],
      [next, 2.39, -0.55],
      [x, 2.24, 0.4],
      [next, 2.39, -0.55],
      [next, 2.24, 0.4],
      [x, 2.24, 0.4],
      [x, 2.24, 0.4],
      [next, 2.24, 0.4],
      [(x + next) / 2, 2.15, 0.41],
    ];
    for (const v of corners) {
      awning.push(...v);
      awningColors.push(c.r, c.g, c.b);
    }
  }
  canopyGeo.setAttribute('position', new Float32BufferAttribute(awning, 3));
  canopyGeo.setAttribute('color', new Float32BufferAttribute(awningColors, 3));
  add(
    g,
    'Striped canvas awning',
    canopyGeo,
    new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }),
    0,
    0,
    0,
  );
  return g;
}

export function createWestPier() {
  const g = new Group();
  g.name = 'West quay extension';
  const boards = new InstancedMesh(unitBox, dye('#b79c78'), 46),
    pose = new Object3D();
  boards.name = 'Salt bleached planks';
  for (let i = 0; i < 46; i++) {
    pose.position.set(-i * 0.174, -0.055, 0);
    pose.scale.set(0.167, 0.095, 1.45);
    pose.updateMatrix();
    boards.setMatrixAt(i, pose.matrix);
    boards.setColorAt(
      i,
      new Color().setScalar(0.68 + 0.17 * Math.sin(i * 4.35) ** 2),
    );
  }
  g.add(boards);
  for (let i = 0; i < 8; i++)
    for (const z of [-0.69, 0.69])
      post(g, 'Pier pile', walnut, -i * 1.1, -0.14, z, 0.053, 0.58);
  return g;
}

export function createListeningPost() {
  const g = new Group();
  g.name = 'Listening post';
  box(g, 'Plinth', walnut, 0, 0.055, 0, 0.52, 0.11, 0.52);
  post(g, 'Post', walnut, 0, 0.6, 0, 0.045, 1.12);
  const horn = add(
    g,
    'Brass listening horn',
    new CylinderGeometry(0.035, 0.17, 0.38, 20, 1, true),
    brass,
    0,
    1.34,
    0,
  );
  horn.rotation.x = Math.PI / 2;
  const mouth = add(
    g,
    'Horn mouth',
    new CircleGeometry(0.165, 24),
    azur,
    0,
    1.34,
    0.195,
  );
  mouth.rotation.y = 0;
  const rim = add(
    g,
    'Horn rim',
    new TorusGeometry(0.17, 0.014, 6, 24),
    brass,
    0,
    1.34,
    0.195,
  );
  rim.name = 'Horn rim';
  box(g, 'Chime bar', walnut, 0, 1.82, 0, 0.56, 0.04, 0.05);
  const chimes = new Group();
  chimes.name = 'Listening chimes';
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 0.18;
    post(chimes, 'Chime cord', iron, x, 1.74, 0, 0.006, 0.16);
    const bell = add(
      chimes,
      'Shell chime',
      new CylinderGeometry(0.018, 0.052, 0.17, 9),
      i === 1 ? brass : linen,
      x,
      1.61,
      0,
    );
    bell.rotation.z = (i - 1) * 0.08;
  }
  g.add(chimes);
  return g;
}

export function createRubbingTable() {
  const g = new Group();
  g.name = 'Rubbing table';
  box(g, 'Rubbing table top', pale, 0, 0.8, 0, 0.62, 0.06, 0.46);
  for (const x of [-0.25, 0.25])
    for (const z of [-0.17, 0.17])
      box(g, 'Rubbing table leg', walnut, x, 0.4, z, 0.05, 0.76, 0.05);
  box(g, 'Rubbing plate', azur, 0, 0.835, 0, 0.38, 0.018, 0.28);
  const roll = add(
    g,
    'Paper roll',
    new CylinderGeometry(0.05, 0.05, 0.3, 12),
    linen,
    -0.38,
    0.86,
    0,
  );
  roll.rotation.z = Math.PI / 2;
  box(g, 'Rubbing paper', linen, 0.12, 0.84, 0.02, 0.22, 0.008, 0.3);
  for (const x of [-0.34, 0.34])
    post(g, 'Awning post', walnut, x, 1.1, -0.19, 0.024, 1.4);
  const awning = box(
    g,
    'Red rubbing awning',
    coral,
    0,
    1.61,
    -0.02,
    0.82,
    0.025,
    0.56,
  );
  awning.rotation.x = -0.14;
  box(g, 'Paper tray', walnut, 0.4, 0.89, 0.04, 0.2, 0.035, 0.32);
  return g;
}

export function createBoardwalkLoop() {
  const g = new Group();
  g.name = 'Boardwalk loop';
  const boards = new InstancedMesh(unitBox, dye('#b79c78'), 50);
  boards.name = 'Loop planks';
  const pose = new Object3D();
  let index = 0;
  // Seaward outer leg runs clear of both exhibit footprints.
  for (let i = 0; i < 32; i++) {
    const x = -2.3 - (i * 5.9) / 31;
    pose.position.set(x, -0.055, -1.3);
    pose.scale.set(0.184, 0.095, 1.06);
    pose.updateMatrix();
    boards.setMatrixAt(index, pose.matrix);
    boards.setColorAt(
      index,
      new Color().setScalar(0.68 + 0.17 * Math.sin(i * 4.35) ** 2),
    );
    index++;
  }
  // East and west connectors to the existing west quay.
  for (const x of [-2.25, -8.15])
    for (let i = 0; i < 9; i++) {
      pose.position.set(x, -0.055, -0.5 - i * 0.14);
      pose.scale.set(0.55, 0.095, 0.137);
      pose.updateMatrix();
      boards.setMatrixAt(index, pose.matrix);
      boards.setColorAt(
        index,
        new Color().setScalar(0.66 + 0.15 * Math.sin(i * 3.1) ** 2),
      );
      index++;
    }
  g.add(boards);
  const posts = new InstancedMesh(
    new CylinderGeometry(0.045, 0.052, 0.82, 8),
    walnut,
    16,
  );
  posts.name = 'Loop rail posts';
  for (let i = 0; i < posts.count; i++) {
    const x = -2.3 - (i * 5.9) / 15;
    pose.position.set(x, 0.37, -1.92);
    pose.scale.set(1, 1, 1);
    pose.rotation.set(0, 0, 0);
    pose.updateMatrix();
    posts.setMatrixAt(i, pose.matrix);
  }
  g.add(posts);
  for (const y of [0.42, 0.73])
    box(g, 'Loop rail', walnut, -5.25, y, -1.92, 5.9, 0.035, 0.04);
  return g;
}
