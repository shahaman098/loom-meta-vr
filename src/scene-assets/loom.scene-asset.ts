/**
 * Loom — procedural set pieces.
 *
 * Everything here is built from primitives so the experience ships with no
 * external models or textures. Pegs are created at runtime by LoomSystem so
 * each one can be its own grabbable entity.
 */

import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
} from '@iwsdk/core';

const walnut = new MeshStandardMaterial({
  color: 0x2a1c17,
  roughness: 0.52,
  metalness: 0.05,
});

const walnutDark = new MeshStandardMaterial({
  color: 0x1a120f,
  roughness: 0.68,
  metalness: 0.02,
});

const brass = new MeshStandardMaterial({
  color: 0x7d5f34,
  roughness: 0.3,
  metalness: 0.72,
  emissive: 0x2a1c08,
  emissiveIntensity: 0.35,
});

const felt = new MeshStandardMaterial({
  color: 0x0b1424,
  roughness: 0.98,
  metalness: 0,
});

const warp = new MeshStandardMaterial({
  color: 0x4b6180,
  roughness: 0.65,
  metalness: 0.1,
  emissive: 0x16283f,
  emissiveIntensity: 0.5,
});

const floorMat = new MeshStandardMaterial({
  color: 0x070b13,
  roughness: 0.96,
  metalness: 0,
});

const cardFrame = new MeshStandardMaterial({
  color: 0x141b2d,
  roughness: 0.5,
  metalness: 0.35,
});

export const PEG_TIP_COLOR = 0xffc06a;

function addBox(
  root: Group,
  size: [number, number, number],
  position: [number, number, number],
  material: MeshStandardMaterial,
): Mesh {
  const mesh = new Mesh(new BoxGeometry(size[0], size[1], size[2]), material);
  mesh.position.set(position[0], position[1], position[2]);
  root.add(mesh);
  return mesh;
}

/** Round walnut table, origin at the tabletop surface. */
export function createLoomTable(): Group {
  const root = new Group();

  addBox(root, [1.06, 0.042, 0.64], [0, -0.021, 0], walnut);
  addBox(root, [0.98, 0.075, 0.56], [0, -0.075, 0], walnutDark);

  const legGeometry = new CylinderGeometry(0.02, 0.026, 0.66, 12);
  const legPositions: Array<[number, number]> = [
    [-0.44, -0.24],
    [0.44, -0.24],
    [-0.44, 0.24],
    [0.44, 0.24],
  ];
  for (const [x, z] of legPositions) {
    const leg = new Mesh(legGeometry, walnut);
    leg.position.set(x, -0.4, z);
    root.add(leg);
  }

  // A brass rail along the player-facing edge gives the table a workbench feel.
  addBox(root, [0.86, 0.012, 0.012], [0, -0.004, 0.316], brass);
  return root;
}

/**
 * The loom board. Origin at the centre of the backing; the front face points
 * along +Z. Pegs are placed on a 5x5 grid by the system at these local points.
 */
export function createLoomBoard(): Group {
  const root = new Group();

  addBox(root, [0.68, 0.54, 0.036], [0, 0, 0], walnutDark);
  addBox(root, [0.62, 0.48, 0.012], [0, 0, 0.024], felt);

  // Frame bars.
  addBox(root, [0.74, 0.045, 0.062], [0, 0.272, 0], walnut);
  addBox(root, [0.74, 0.045, 0.062], [0, -0.272, 0], walnut);
  addBox(root, [0.045, 0.545, 0.062], [-0.347, 0, 0], walnut);
  addBox(root, [0.045, 0.545, 0.062], [0.347, 0, 0], walnut);

  // Warp: 13 evenly spaced vertical threads behind the pegs.
  const warpGeometry = new CylinderGeometry(0.0013, 0.0013, 0.44, 5);
  for (let i = 0; i < 13; i += 1) {
    const thread = new Mesh(warpGeometry, warp);
    thread.position.set(-0.24 + i * 0.04, 0, 0.032);
    root.add(thread);
  }

  // Glowing entry rail at the bottom edge.
  const entryRail = new Mesh(
    new BoxGeometry(0.6, 0.008, 0.008),
    new MeshStandardMaterial({
      color: 0x8a6a3a,
      emissive: PEG_TIP_COLOR,
      emissiveIntensity: 1.1,
      roughness: 0.35,
      metalness: 0.4,
    }),
  );
  entryRail.position.set(0, -0.247, 0.034);
  root.add(entryRail);

  // Brass corner caps.
  const capGeometry = new BoxGeometry(0.05, 0.018, 0.02);
  for (const [x, y] of [
    [-0.318, 0.252],
    [0.318, 0.252],
    [-0.318, -0.252],
    [0.318, -0.252],
  ]) {
    const cap = new Mesh(capGeometry, brass);
    cap.position.set(x, y, 0.045);
    root.add(cap);
  }

  return root;
}

/**
 * One grabbable peg: a brass pin, a glowing tip, and a soft halo that widens
 * the pinch target without feeling like a button.
 */
export function createPeg(): Group {
  const root = new Group();
  root.name = 'peg';

  const halo = new Mesh(
    new SphereGeometry(0.028, 16, 10),
    new MeshStandardMaterial({
      color: PEG_TIP_COLOR,
      emissive: PEG_TIP_COLOR,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.09,
      depthWrite: false,
      roughness: 1,
    }),
  );
  halo.position.z = 0.028;
  root.add(halo);

  const pin = new Mesh(new CylinderGeometry(0.0055, 0.0065, 0.03, 10), brass);
  pin.rotation.x = Math.PI / 2;
  pin.position.z = 0.031;
  root.add(pin);

  const collar = new Mesh(new TorusGeometry(0.0105, 0.0018, 6, 18), brass);
  collar.position.z = 0.018;
  root.add(collar);

  const tip = new Mesh(
    new SphereGeometry(0.0115, 16, 12),
    new MeshStandardMaterial({
      color: PEG_TIP_COLOR,
      emissive: PEG_TIP_COLOR,
      emissiveIntensity: 1.2,
      roughness: 0.3,
      metalness: 0.1,
    }),
  );
  tip.name = 'peg-tip';
  tip.position.z = 0.049;
  root.add(tip);

  return root;
}

/** A framed pattern card; the face texture is painted at runtime. */
export function createLoomCard(): Group {
  const root = new Group();

  const frame = new Mesh(new BoxGeometry(0.34, 0.44, 0.014), cardFrame);
  root.add(frame);

  const face = new Mesh(
    new PlaneGeometry(0.31, 0.41),
    new MeshStandardMaterial({ color: 0x0a1020, roughness: 0.9 }),
  );
  face.name = 'card-face';
  face.position.z = 0.0085;
  root.add(face);

  const clip = new Mesh(new BoxGeometry(0.06, 0.016, 0.022), brass);
  clip.position.set(0, 0.224, 0.014);
  root.add(clip);

  return root;
}

/** Dark studio floor that fades into the dome. */
export function createLoomFloor(size = 30): Group {
  const root = new Group();
  const plane = new Mesh(new PlaneGeometry(size, size), floorMat);
  plane.rotation.x = -Math.PI / 2;
  root.add(plane);
  return root;
}
