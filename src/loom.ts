/**
 * Loom — hands-only thread weaving.
 *
 * Pinch a brass peg, pull a glowing thread to another peg, release. Every
 * completed thread stays on the board. Finish the pattern card to make the
 * tapestry flash and chime; the next card is harder.
 */

import {
  CanvasTexture,
  CylinderGeometry,
  Grabbed,
  GrabSystem,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OneHandGrabbable,
  Quaternion,
  RayInteractable,
  SRGBColorSpace,
  Vector3,
  createSystem,
} from '@iwsdk/core';
import type { Entity, Object3D } from '@iwsdk/core';
import { LoomStatus, Peg } from './components.js';
import { PEG_TIP_COLOR, createPeg } from './scene-assets/loom.scene-asset.js';

const ROWS = 5;
const COLS = 5;
const GRID_LEFT = -0.24;
const GRID_BOTTOM = -0.18;
const GRID_STEP_X = 0.12;
const GRID_STEP_Y = 0.09;
const THREAD_Z = 0.054;
const ENTRY_PEG = 0 * COLS + 2;

const THREAD_COLORS = [
  '#ffb35c',
  '#5ce1e6',
  '#ff5c8a',
  '#b8ff5c',
  '#a98cff',
  '#ff7a59',
  '#9fd8ff',
  '#ffd166',
];

const UP = new Vector3(0, 1, 0);

type CardDef = {
  title: string;
  edges: Array<[number, number]>;
};

const CARDS: CardDef[] = [
  {
    title: 'FIRST THREAD',
    edges: [
      [ENTRY_PEG, 0 * COLS + 0],
      [0 * COLS + 0, 2 * COLS + 0],
      [2 * COLS + 0, 2 * COLS + 2],
    ],
  },
  {
    title: 'CROWN',
    edges: [
      [ENTRY_PEG, 0 * COLS + 4],
      [0 * COLS + 4, 2 * COLS + 4],
      [2 * COLS + 4, 4 * COLS + 2],
      [4 * COLS + 2, 2 * COLS + 0],
      [2 * COLS + 0, 0 * COLS + 0],
      [0 * COLS + 0, ENTRY_PEG],
    ],
  },
  {
    title: 'GEM',
    edges: [
      [ENTRY_PEG, 0 * COLS + 4],
      [0 * COLS + 4, 4 * COLS + 4],
      [4 * COLS + 4, 2 * COLS + 2],
      [2 * COLS + 2, 4 * COLS + 0],
      [4 * COLS + 0, 0 * COLS + 0],
      [0 * COLS + 0, ENTRY_PEG],
    ],
  },
];

type PegInfo = {
  entity: Entity;
  index: number;
  row: number;
  col: number;
  position: Vector3;
  tipMaterial: MeshStandardMaterial;
};

const edgeKey = (a: number, b: number): string =>
  a < b ? `${a}:${b}` : `${b}:${a}`;

type Segment = {
  mesh: Mesh;
  key: string;
  color: number;
};

export class LoomSystem extends createSystem({
  held: { required: [Peg, Grabbed] },
}) {
  private board!: Object3D;
  private boardEntity!: Entity;
  private cardFace!: Mesh;
  private cardCanvas!: HTMLCanvasElement;
  private cardContext!: CanvasRenderingContext2D;
  private cardTexture!: CanvasTexture;
  private cardDirty = true;

  private grab: GrabSystem | null = null;
  private pegs: PegInfo[] = [];
  private pegByIndex = new Map<number, PegInfo>();
  private pegByEntity = new Map<number, PegInfo>();
  private segments: Segment[] = [];
  private liveMesh!: Mesh;
  private liveMaterial!: MeshStandardMaterial;
  private threadMaterials: MeshStandardMaterial[] = [];

  private activePegIndex = -1;
  private activePegEntity: Entity | null = null;
  private activeHand: 'left' | 'right' | null = null;
  private targetIndex = -1;
  private statusTarget = -1;
  private statusActive = -1;
  private lastFrom = -1;
  private lastTo = -1;
  private celebrating = 0;
  private cardIndex = 0;
  private drawnKeys = new Set<string>();
  private segmentKeys: string[] = [];
  private segmentColors: number[] = [];

  private tmpWorld = new Vector3();
  private tmpLocal = new Vector3();
  private tmpHand = new Vector3();
  private tmpDirection = new Vector3();
  private tmpMidpoint = new Vector3();
  private tmpA = new Vector3();
  private tmpB = new Vector3();
  private tmpQuaternion = new Quaternion();
  private tmpTip = new Vector3();

  private audio: AudioContext | null = null;

  init(): void {
    this.boardEntity = this.world.requireSceneEntity('loom-board');
    this.board = this.boardEntity.object3D!;
    this.board.updateWorldMatrix(true, false);
    this.boardEntity.addComponent(LoomStatus, {});

    this.grab =
      (this.world.getSystem(GrabSystem) as GrabSystem | undefined) ?? null;

    this.createPegs();
    this.createThreads();
    this.createCard();

    const offGrab = this.queries.held.subscribe('qualify', (entity) => {
      this.onGrab(entity);
    });
    const offRelease = this.queries.held.subscribe('disqualify', (entity) => {
      this.onRelease(entity);
    });
    this.cleanupFuncs.push(offGrab, offRelease, () => {
      this.cardTexture.dispose();
      if (this.audio != null) {
        void this.audio.close();
        this.audio = null;
      }
    });

    this.drawCard();
  }

  private createPegs(): void {
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const object = createPeg();
        object.name = `peg-${row}-${col}`;
        const tip = object.getObjectByName('peg-tip') as Mesh;
        const tipMaterial = (
          tip.material as MeshStandardMaterial
        ).clone() as MeshStandardMaterial;
        tip.material = tipMaterial;

        const position = new Vector3(
          GRID_LEFT + col * GRID_STEP_X,
          GRID_BOTTOM + row * GRID_STEP_Y,
          0,
        );
        object.position.copy(position);

        const entity = this.world.createTransformEntity(object, {
          parent: this.boardEntity,
        });
        entity.addComponent(Peg, { row, col });
        entity.addComponent(RayInteractable, {});
        // translate/rotate off: the peg is a pinch anchor, not a movable prop.
        entity.addComponent(OneHandGrabbable, {
          translate: false,
          rotate: false,
        });

        const index = row * COLS + col;
        const info: PegInfo = {
          entity,
          index,
          row,
          col,
          position,
          tipMaterial,
        };
        this.pegs.push(info);
        this.pegByIndex.set(index, info);
        this.pegByEntity.set(entity.index, info);
      }
    }
  }

  private createThreads(): void {
    const geometry = new CylinderGeometry(1, 1, 1, 6, 1, true);
    this.threadMaterials = THREAD_COLORS.map(
      (hex) =>
        new MeshStandardMaterial({
          color: hex,
          emissive: hex,
          emissiveIntensity: 3.2,
          toneMapped: false,
          roughness: 0.35,
          metalness: 0,
        }),
    );

    for (let i = 0; i < 72; i += 1) {
      const mesh = new Mesh(geometry, this.threadMaterials[0]);
      mesh.scale.set(0, 0, 0);
      this.world.createTransformEntity(mesh, { parent: this.boardEntity });
      this.segments.push({ mesh, key: '', color: 0 });
    }

    this.liveMaterial = new MeshStandardMaterial({
      color: '#fff4dd',
      emissive: '#fff4dd',
      emissiveIntensity: 3.6,
      toneMapped: false,
      roughness: 0.23,
      metalness: 0,
    });
    this.liveMesh = new Mesh(geometry, this.liveMaterial);
    this.liveMesh.scale.set(0, 0, 0);
    this.world.createTransformEntity(this.liveMesh, {
      parent: this.boardEntity,
    });
  }

  private createCard(): void {
    const card = this.world.requireSceneObject('loom-card');
    const face = card.getObjectByName('card-face') as Mesh;
    this.cardFace = face;

    this.cardCanvas = document.createElement('canvas');
    this.cardCanvas.width = 600;
    this.cardCanvas.height = 800;
    const context = this.cardCanvas.getContext('2d');
    if (context == null) {
      throw new Error('Loom card requires a 2D canvas context');
    }
    this.cardContext = context;

    this.cardTexture = new CanvasTexture(this.cardCanvas);
    this.cardTexture.colorSpace = SRGBColorSpace;
    this.cardTexture.anisotropy = 8;
    this.cardFace.material = new MeshBasicMaterial({
      map: this.cardTexture,
      toneMapped: false,
    });
  }

  private onGrab(entity: Entity): void {
    if (this.activePegIndex >= 0 || this.celebrating > 0) {
      return;
    }
    const peg = this.pegByEntity.get(entity.index);
    if (peg == null) {
      return;
    }
    this.activePegEntity = entity;
    this.activeHand = this.grab?.getHolderHand(entity) ?? null;
    const hand = this.activeHand ?? 'right';
    let chosen = peg.index;
    if (this.handLocal(hand, this.tmpHand)) {
      const aimed = this.nearestPeg(this.tmpHand, -1);
      if (aimed >= 0) {
        chosen = aimed;
      }
    }
    this.activePegIndex = chosen;
    this.ensureAudio();
    this.playPluck(chosen, 0.05);
    this.cardDirty = true;
    this.syncStatus();
  }

  private onRelease(entity: Entity): void {
    if (this.activePegEntity !== entity) {
      return;
    }
    this.finalizeRelease();
  }

  private finalizeRelease(): void {
    if (this.activePegIndex < 0) {
      return;
    }
    const from = this.activePegIndex;
    const to = this.targetIndex;
    this.activePegIndex = -1;
    this.activePegEntity = null;
    this.activeHand = null;
    this.targetIndex = -1;
    this.liveMesh.scale.set(0, 0, 0);
    this.lastFrom = from;
    this.lastTo = to;

    if (to >= 0 && to !== from && this.celebrating === 0) {
      this.addSegment(from, to);
    }
    this.cardDirty = true;
    this.syncStatus();
  }

  private syncStatus(): void {
    if (!this.boardEntity.hasComponent(LoomStatus)) {
      return;
    }
    this.boardEntity.setValue(LoomStatus, 'cardIndex', this.cardIndex);
    this.boardEntity.setValue(
      LoomStatus,
      'drawnEdges',
      this.segmentKeys.length,
    );
    this.boardEntity.setValue(LoomStatus, 'celebrating', this.celebrating > 0);
    this.boardEntity.setValue(
      LoomStatus,
      'edges',
      Array.from(this.drawnKeys).join(','),
    );
    this.boardEntity.setValue(LoomStatus, 'lastFrom', this.lastFrom);
    this.boardEntity.setValue(LoomStatus, 'lastTo', this.lastTo);
    if (this.statusActive !== this.activePegIndex) {
      this.statusActive = this.activePegIndex;
      this.boardEntity.setValue(LoomStatus, 'activePeg', this.statusActive);
    }
    if (this.statusTarget !== this.targetIndex) {
      this.statusTarget = this.targetIndex;
      this.boardEntity.setValue(LoomStatus, 'targetPeg', this.statusTarget);
    }
  }

  private addSegment(from: number, to: number): void {
    const key = edgeKey(from, to);
    if (this.drawnKeys.has(key)) {
      this.playPluck(to, 0.035);
      return;
    }
    const slot = this.segments.find((segment) => segment.key === '');
    if (slot == null) {
      return;
    }

    const color =
      (this.cardIndex * 2 + this.segmentKeys.length) % THREAD_COLORS.length;
    slot.key = key;
    slot.color = color;
    slot.mesh.material = this.threadMaterials[color];
    this.setSegmentBetween(
      slot.mesh,
      this.pegByIndex.get(from)!.position,
      this.pegByIndex.get(to)!.position,
    );

    this.drawnKeys.add(key);
    this.segmentKeys.push(key);
    this.segmentColors.push(color);
    this.playPluck(to, 0.06);

    if (
      this.cardIndex < CARDS.length &&
      this.isCardComplete(this.cardIndex) &&
      this.celebrating === 0 &&
      this.activePegIndex < 0
    ) {
      this.celebrating = 3.6;
      this.playChord();
      this.cardDirty = true;
    }
    this.syncStatus();
  }

  private isCardComplete(cardIndex: number): boolean {
    const card = CARDS[cardIndex];
    if (card == null) {
      return false;
    }
    for (const [a, b] of card.edges) {
      if (!this.drawnKeys.has(edgeKey(a, b))) {
        return false;
      }
    }
    return true;
  }

  private advanceCard(): void {
    this.celebrating = 0;
    this.cardIndex += 1;
    this.drawnKeys.clear();
    this.segmentKeys.length = 0;
    this.segmentColors.length = 0;
    for (const segment of this.segments) {
      segment.key = '';
      segment.mesh.scale.set(0, 0, 0);
    }
    this.cardDirty = true;
    this.syncStatus();
  }

  private setSegmentBetween(mesh: Mesh, a: Vector3, b: Vector3): void {
    // Lift peg endpoints in front of the peg tips so the woven cords read
    // against the felt instead of disappearing inside the board.
    this.tmpA.copy(a);
    this.tmpB.copy(b);
    if (this.tmpA.z < THREAD_Z) {
      this.tmpA.z = THREAD_Z;
    }
    if (this.tmpB.z < THREAD_Z) {
      this.tmpB.z = THREAD_Z;
    }
    this.tmpDirection.subVectors(this.tmpB, this.tmpA);
    const length = this.tmpDirection.length();
    if (length < 0.0005) {
      mesh.scale.set(0, 0, 0);
      return;
    }
    this.tmpDirection.multiplyScalar(1 / length);
    this.tmpQuaternion.setFromUnitVectors(UP, this.tmpDirection);
    this.tmpMidpoint
      .copy(this.tmpA)
      .add(this.tmpB)
      .multiplyScalar(0.5);
    mesh.position.copy(this.tmpMidpoint);
    mesh.quaternion.copy(this.tmpQuaternion);
    mesh.scale.set(0.0045, length, 0.0045);
  }

  private handLocal(hand: 'left' | 'right', out: Vector3): boolean {
    const tip = this.player.indexTipSpaces[hand];
    if (tip == null) {
      return false;
    }
    // The index fingertip is the point a person aims with when pinching a peg.
    tip.getWorldPosition(this.tmpTip);
    this.tmpWorld.copy(this.tmpTip);
    this.board.worldToLocal(this.tmpWorld);
    out.copy(this.tmpWorld);
    return true;
  }

  private nearestPeg(position: Vector3, exclude: number): number {
    let best = -1;
    let bestDistance = 0.1;
    for (const peg of this.pegs) {
      if (peg.index === exclude) {
        continue;
      }
      const dx = position.x - peg.position.x;
      const dy = position.y - peg.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = peg.index;
      }
    }
    return best;
  }

  private updateHeld(): void {
    const hand = this.activeHand ?? 'right';
    if (!this.handLocal(hand, this.tmpHand)) {
      this.liveMesh.scale.set(0, 0, 0);
      this.targetIndex = -1;
      return;
    }
    const peg = this.pegByIndex.get(this.activePegIndex);
    if (peg == null) {
      return;
    }
    const inFront = this.tmpHand.z > -0.03 && this.tmpHand.z < 0.6;
    this.targetIndex = inFront
      ? this.nearestPeg(this.tmpHand, this.activePegIndex)
      : -1;
    this.setSegmentBetween(this.liveMesh, peg.position, this.tmpHand);
  }

  private updateIdleHover(): void {
    this.liveMesh.scale.set(0, 0, 0);
    this.targetIndex = -1;
    if (this.world.session == null || this.celebrating > 0) {
      return;
    }
    let best = -1;
    let bestDepth = 0.6;
    for (const hand of ['right', 'left'] as const) {
      if (!this.handLocal(hand, this.tmpHand)) {
        continue;
      }
      if (this.tmpHand.z <= -0.03 || this.tmpHand.z >= bestDepth) {
        continue;
      }
      const candidate = this.nearestPeg(this.tmpHand, -1);
      if (candidate >= 0) {
        best = candidate;
        bestDepth = this.tmpHand.z;
      }
    }
    this.targetIndex = best;
  }

  update(delta: number, time: number): void {
    if (this.celebrating > 0) {
      this.celebrating -= delta;
      if (this.celebrating <= 0) {
        this.advanceCard();
      }
    }

    if (
      this.activePegEntity != null &&
      !this.activePegEntity.hasComponent(Grabbed)
    ) {
      this.finalizeRelease();
    }

    if (this.activePegIndex >= 0 && this.world.session != null) {
      this.updateHeld();
    } else {
      this.updateIdleHover();
    }
    if (this.targetIndex !== this.statusTarget) {
      this.syncStatus();
    }

    for (const peg of this.pegs) {
      let intensity = 0.85 + 0.3 * Math.sin(time * 2.2 + peg.index * 0.65);
      let color = PEG_TIP_COLOR;
      if (peg.index === this.activePegIndex) {
        intensity = 3.4;
        color = 0xffffff;
      } else if (peg.index === this.targetIndex) {
        intensity = 3.1;
        color = 0xfff2d0;
      } else if (this.celebrating > 0) {
        intensity = 2.2 + 1.9 * Math.sin(time * 11 + peg.index);
      }
      peg.tipMaterial.emissiveIntensity = intensity;
      peg.tipMaterial.emissive.setHex(color);
    }

    if (this.cardDirty) {
      this.cardDirty = false;
      this.drawCard();
    }
  }

  private ensureAudio(): void {
    if (this.audio != null) {
      if (this.audio.state === 'suspended') {
        void this.audio.resume();
      }
      return;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (Ctor != null) {
      this.audio = new Ctor();
    }
  }

  private playPluck(pegIndex: number, volume: number): void {
    const context = this.audio;
    if (context == null) {
      return;
    }
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
    const semitone = scale[pegIndex % scale.length];
    const frequency = 196 * Math.pow(2, semitone / 12);
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.58);
  }

  private playChord(): void {
    const context = this.audio;
    if (context == null) {
      return;
    }
    const now = context.currentTime;
    const notes = [0, 7, 12, 16];
    notes.forEach((semitone, index) => {
      const frequency = 261.63 * Math.pow(2, semitone / 12);
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index % 2 === 0 ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.045);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.055, now + 0.03 + index * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now + index * 0.045);
      oscillator.stop(now + 1.6);
    });
  }

  private drawCard(): void {
    const context = this.cardContext;
    const width = 600;
    const height = 800;
    const free = this.cardIndex >= CARDS.length;
    const card = free ? null : CARDS[this.cardIndex];

    const background = context.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, '#0c1730');
    background.addColorStop(1, '#060b16');
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    context.strokeStyle = '#263a5e';
    context.lineWidth = 4;
    context.strokeRect(14, 14, width - 28, height - 28);

    context.fillStyle = '#7e93b6';
    context.font = '600 20px ui-sans-serif, system-ui, sans-serif';
    context.fillText('META LOOM', 42, 60);
    context.textAlign = 'right';
    context.fillText(
      free ? 'FREE WEAVE' : `CARD ${this.cardIndex + 1} / ${CARDS.length}`,
      width - 42,
      60,
    );
    context.textAlign = 'left';

    context.fillStyle = '#f4e6c9';
    context.font = '700 44px Georgia, serif';
    context.fillText(card?.title ?? 'FREE WEAVE', 42, 118);

    context.strokeStyle = '#33486d';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(42, 142);
    context.lineTo(width - 42, 142);
    context.stroke();

    const left = 70;
    const right = width - 70;
    const top = 205;
    const bottom = 610;
    const gx = (col: number): number => left + (col / (COLS - 1)) * (right - left);
    const gy = (row: number): number => bottom - (row / (ROWS - 1)) * (bottom - top);

    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        context.beginPath();
        context.arc(gx(col), gy(row), 5.5, 0, Math.PI * 2);
        context.fillStyle = '#3d5478';
        context.fill();
      }
    }

    const required = card?.edges ?? [];
    required.forEach(([a, b], index) => {
      const drawn = this.drawnKeys.has(edgeKey(a, b));
      const rowA = Math.floor(a / COLS);
      const colA = a % COLS;
      const rowB = Math.floor(b / COLS);
      const colB = b % COLS;
      const hex = THREAD_COLORS[index % THREAD_COLORS.length];
      context.beginPath();
      context.moveTo(gx(colA), gy(rowA));
      context.lineTo(gx(colB), gy(rowB));
      context.strokeStyle = hex;
      context.globalAlpha = drawn ? 1 : 0.38;
      context.lineWidth = drawn ? 8 : 4;
      context.setLineDash(drawn ? [] : [9, 9]);
      context.stroke();
      context.setLineDash([]);
      context.globalAlpha = 1;
    });

    if (free) {
      this.segmentKeys.forEach((key, index) => {
        const [a, b] = key.split(':').map(Number);
        context.beginPath();
        context.moveTo(gx(a % COLS), gy(Math.floor(a / COLS)));
        context.lineTo(gx(b % COLS), gy(Math.floor(b / COLS)));
        context.strokeStyle =
          THREAD_COLORS[this.segmentColors[index] % THREAD_COLORS.length];
        context.lineWidth = 7;
        context.stroke();
      });
    }

    const done = required.filter(([a, b]) => this.drawnKeys.has(edgeKey(a, b)))
      .length;
    context.fillStyle = '#d7e6ff';
    context.font = '600 26px ui-sans-serif, system-ui, sans-serif';
    context.fillText(
      free ? `${this.segmentKeys.length} threads woven` : `${done} / ${required.length} threads`,
      42,
      682,
    );

    context.fillStyle = '#6f84a8';
    context.font = '400 20px ui-sans-serif, system-ui, sans-serif';
    context.fillText('Pinch a brass peg.', 42, 728);
    context.fillText('Pull to another peg, then release.', 42, 760);

    if (this.celebrating > 0) {
      context.fillStyle = 'rgba(5, 10, 20, 0.72)';
      context.fillRect(0, 0, width, height);
      context.fillStyle = '#ffe6b8';
      context.font = '700 76px Georgia, serif';
      context.textAlign = 'center';
      context.fillText('WOVEN', width / 2, 370);
      context.fillStyle = '#9fb6d8';
      context.font = '500 24px ui-sans-serif, system-ui, sans-serif';
      context.fillText(card?.title ?? '', width / 2, 420);
      context.textAlign = 'left';
    }

    this.cardTexture.needsUpdate = true;
  }
}
