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
  PlaneGeometry,
  Quaternion,
  RayInteractable,
  SRGBColorSpace,
  TorusGeometry,
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
  id: string;
  title: string;
  source: string;
  date: string;
  institution: string;
  license: string;
  image?: string;
  edges: Array<[number, number]>;
};

const archiveImage = (file: string): string =>
  `${import.meta.env.BASE_URL}archive/${file}`;

const CARDS: CardDef[] = [
  {
    id: 'coptic',
    title: 'COPTIC KNOT',
    source: 'Coptic textile fragment',
    date: 'late 3rd–5th century',
    institution: 'The Metropolitan Museum of Art',
    license: 'CC0',
    image: archiveImage('coptic.jpg'),
    edges: [
      [ENTRY_PEG, 0 * COLS + 0],
      [0 * COLS + 0, 2 * COLS + 0],
      [2 * COLS + 0, 2 * COLS + 2],
    ],
  },
  {
    id: 'ogival',
    title: 'OGIVAL',
    source: 'Ottoman silk fragment',
    date: '1570–1580',
    institution: 'Aga Khan Museum',
    license: 'Public domain',
    image: archiveImage('ottoman.jpg'),
    edges: [
      [ENTRY_PEG, 0 * COLS + 4],
      [0 * COLS + 4, 2 * COLS + 4],
      [2 * COLS + 4, 4 * COLS + 2],
      [4 * COLS + 2, 2 * COLS + 0],
      [2 * COLS + 0, ENTRY_PEG],
    ],
  },
  {
    id: 'flowering',
    title: 'FLOWERING',
    source: 'Kimono sleeve, red silk crepe',
    date: '17th century',
    institution: 'Cooper Hewitt',
    license: 'Public domain',
    image: archiveImage('japan.jpg'),
    edges: [
      [ENTRY_PEG, 0 * COLS + 4],
      [0 * COLS + 4, 2 * COLS + 3],
      [2 * COLS + 3, 4 * COLS + 4],
      [4 * COLS + 4, 2 * COLS + 1],
      [2 * COLS + 1, 0 * COLS + 0],
    ],
  },
  {
    id: 'bizarre',
    title: 'BIZARRE',
    source: 'Woven silk, bizarre design',
    date: 'c. 1700–1705',
    institution: 'Google Art Project',
    license: 'Public domain',
    image: archiveImage('italy.jpg'),
    edges: [
      [ENTRY_PEG, 0 * COLS + 4],
      [0 * COLS + 4, 4 * COLS + 4],
      [4 * COLS + 4, 2 * COLS + 2],
      [2 * COLS + 2, 4 * COLS + 0],
      [4 * COLS + 0, ENTRY_PEG],
    ],
  },
  {
    id: 'wholecloth',
    title: 'WHOLE CLOTH',
    source: 'Whole cloth quilt',
    date: 'c. 1885',
    institution: 'The Metropolitan Museum of Art',
    license: 'CC0',
    image: archiveImage('quilt2.jpg'),
    edges: [
      [ENTRY_PEG, 0 * COLS + 0],
      [0 * COLS + 0, 4 * COLS + 0],
      [4 * COLS + 0, 4 * COLS + 4],
      [4 * COLS + 4, 0 * COLS + 4],
      [0 * COLS + 4, 0 * COLS + 0],
      [0 * COLS + 0, 2 * COLS + 2],
    ],
  },
  {
    id: 'andean',
    title: 'ANDEAN STRIPE',
    source: 'Cotton and wool textile',
    date: '18th century',
    institution: 'Cooper Hewitt',
    license: 'Public domain',
    image: archiveImage('peru2.jpg'),
    edges: [
      [ENTRY_PEG, 0 * COLS + 0],
      [0 * COLS + 0, 0 * COLS + 1],
      [0 * COLS + 1, 1 * COLS + 1],
      [1 * COLS + 1, 1 * COLS + 0],
      [1 * COLS + 0, 2 * COLS + 0],
      [2 * COLS + 0, ENTRY_PEG],
    ],
  },
];

const STORAGE_KEY = 'loom.progress.v1';

const dateKey = (date: Date): string => {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const todayKey = (): string => dateKey(new Date());

const yesterdayKey = (): string => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return dateKey(date);
};

const formatTime = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
};

type SavedProgress = {
  completed: string[];
  dailyDate: string;
  bestTimes: Record<string, number>;
  streak: number;
  lastDailyDate: string;
};

const emptySaved = (): SavedProgress => ({
  completed: [],
  dailyDate: '',
  bestTimes: {},
  streak: 0,
  lastDailyDate: '',
});

const loadSaved = (): SavedProgress => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) {
      return emptySaved();
    }
    const parsed = JSON.parse(raw) as Partial<SavedProgress>;
    const bestTimes: Record<string, number> = {};
    if (parsed.bestTimes != null && typeof parsed.bestTimes === 'object') {
      for (const [id, value] of Object.entries(parsed.bestTimes)) {
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
          bestTimes[id] = value;
        }
      }
    }
    return {
      completed: Array.isArray(parsed.completed)
        ? parsed.completed.filter((id): id is string => typeof id === 'string')
        : [],
      dailyDate: typeof parsed.dailyDate === 'string' ? parsed.dailyDate : '',
      bestTimes,
      streak:
        typeof parsed.streak === 'number' && Number.isFinite(parsed.streak)
          ? Math.max(0, Math.floor(parsed.streak))
          : 0,
      lastDailyDate:
        typeof parsed.lastDailyDate === 'string'
          ? parsed.lastDailyDate
          : '',
    };
  } catch {
    return emptySaved();
  }
};

const saveSaved = (progress: SavedProgress): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // A private-mode/denied-storage browser still plays; it just forgets.
  }
};

type PegInfo = {
  entity: Entity;
  index: number;
  row: number;
  col: number;
  position: Vector3;
  tip: Mesh;
  tipMaterial: MeshStandardMaterial;
  hintRing: Mesh | null;
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
  private completedCards = new Set<string>();
  private dailyMode = false;
  private freeMode = false;
  private dailyCard: CardDef | null = null;
  private saved: SavedProgress = emptySaved();
  private cardImages = new Map<string, HTMLImageElement>();
  private progressTiles: Mesh[] = [];
  private progressTextures: CanvasTexture[] = [];
  private assistTimer = 0;
  private missStreak = 0;
  private idleTimer = 0;
  private cardStart = 0;
  private lastTime = 0;
  private lastBest = 0;
  private highContrast = false;
  private hintMesh!: Mesh;
  private hintMaterial!: MeshStandardMaterial;
  private hintPegA = -1;
  private hintPegB = -1;
  private drawnKeys = new Set<string>();
  private segmentKeys: string[] = [];
  private segmentColors: number[] = [];

  private tmpWorld = new Vector3();
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
    try {
      this.highContrast =
        window.localStorage.getItem('loom.a11y.highContrast') === '1';
    } catch {
      this.highContrast = false;
    }

    this.loadProgress();
    this.createPegs();
    this.createThreads();
    this.createCard();
    this.createProgressStrip();

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
        let hintRing: Mesh | null = null;
        if (index === ENTRY_PEG) {
          hintRing = new Mesh(
            new TorusGeometry(0.027, 0.0022, 8, 32),
            new MeshBasicMaterial({
              color: 0xffe6b8,
              transparent: true,
              opacity: 0.8,
              depthWrite: false,
              toneMapped: false,
            }),
          );
          hintRing.position.z = 0.055;
          hintRing.name = 'peg-hint-ring';
          object.add(hintRing);
        }
        const info: PegInfo = {
          entity,
          index,
          row,
          col,
          position,
          tip,
          tipMaterial,
          hintRing,
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
          emissiveIntensity: this.highContrast ? 4.6 : 3.2,
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
      emissiveIntensity: this.highContrast ? 5 : 3.6,
      toneMapped: false,
      roughness: 0.23,
      metalness: 0,
    });
    this.liveMesh = new Mesh(geometry, this.liveMaterial);
    this.liveMesh.scale.set(0, 0, 0);
    this.world.createTransformEntity(this.liveMesh, {
      parent: this.boardEntity,
    });

    this.hintMaterial = new MeshStandardMaterial({
      color: '#ffe6b8',
      emissive: '#ffe6b8',
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      toneMapped: false,
      roughness: 0.4,
      metalness: 0,
    });
    this.hintMesh = new Mesh(geometry, this.hintMaterial);
    this.hintMesh.scale.set(0, 0, 0);
    this.world.createTransformEntity(this.hintMesh, {
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

    for (const card of CARDS) {
      if (card.image == null) {
        continue;
      }
      const image = new Image();
      image.onload = () => {
        this.cardDirty = true;
      };
      image.src = card.image;
      this.cardImages.set(card.id, image);
    }
  }

  private loadProgress(): void {
    try {
      if (new URLSearchParams(window.location.search).has('reset')) {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Storage may be unavailable in a sandboxed preview; the game still runs.
    }
    this.saved = loadSaved();
    this.completedCards = new Set(this.saved.completed);
    const firstIncomplete = CARDS.findIndex(
      (card) => !this.completedCards.has(card.id),
    );
    if (firstIncomplete >= 0) {
      this.cardIndex = firstIncomplete;
      this.dailyMode = false;
      this.freeMode = false;
      this.cardStart = performance.now();
      return;
    }

    this.cardIndex = CARDS.length;
    const freshDaily = this.saved.dailyDate !== todayKey();
    this.dailyMode = freshDaily;
    this.freeMode = !freshDaily;
    if (freshDaily) {
      this.dailyCard = this.createDailyCard();
    }
    this.cardStart = performance.now();
  }

  private saveProgress(): void {
    this.saved = {
      completed: Array.from(this.completedCards),
      dailyDate: this.saved.dailyDate,
      bestTimes: this.saved.bestTimes,
      streak: this.saved.streak,
      lastDailyDate: this.saved.lastDailyDate,
    };
    saveSaved(this.saved);
  }

  private activeCard(): CardDef | null {
    if (this.cardIndex < CARDS.length) {
      return CARDS[this.cardIndex];
    }
    if (this.dailyMode) {
      return this.dailyCard;
    }
    return null;
  }

  private markCompleted(card: CardDef): void {
    const elapsed = Math.max(
      0.1,
      (performance.now() - this.cardStart) / 1000,
    );
    this.lastTime = elapsed;
    const best = this.saved.bestTimes[card.id];
    if (best == null || elapsed < best) {
      this.saved.bestTimes[card.id] = elapsed;
      this.lastBest = elapsed;
    } else {
      this.lastBest = best;
    }

    if (card.id.startsWith('daily-')) {
      this.saved.dailyDate = todayKey();
      this.recordDaily();
      this.saveProgress();
      return;
    }
    this.completedCards.add(card.id);
    this.saveProgress();
    this.renderProgressTiles();
  }

  private recordDaily(): void {
    const today = todayKey();
    if (this.saved.lastDailyDate === today) {
      return;
    }
    this.saved.streak =
      this.saved.lastDailyDate === yesterdayKey()
        ? Math.max(1, this.saved.streak) + 1
        : 1;
    this.saved.lastDailyDate = today;
  }

  private createDailyCard(): CardDef {
    let state = Number(todayKey().replace(/-/g, '')) >>> 0;
    const random = (): number => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const start = ENTRY_PEG;
    const used = new Set<string>();
    const edges: Array<[number, number]> = [];
    const moves: Array<[number, number]> = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    let row = Math.floor(start / COLS);
    let col = start % COLS;
    for (let step = 0; step < 12 && edges.length < 6; step += 1) {
      const options: Array<[number, number, number]> = [];
      for (const [dr, dc] of moves) {
        const nextRow = row + dr;
        const nextCol = col + dc;
        if (nextRow < 0 || nextRow >= ROWS || nextCol < 0 || nextCol >= COLS) {
          continue;
        }
        const next = nextRow * COLS + nextCol;
        const key = edgeKey(row * COLS + col, next);
        if (!used.has(key)) {
          options.push([nextRow, nextCol, next]);
        }
      }
      if (options.length === 0) {
        break;
      }
      const [nextRow, nextCol, next] = options[
        Math.floor(random() * options.length)
      ];
      const key = edgeKey(row * COLS + col, next);
      used.add(key);
      edges.push([row * COLS + col, next]);
      row = nextRow;
      col = nextCol;
    }

    if (edges.length < 4) {
      return {
        id: `daily-${todayKey()}`,
        title: 'DAILY WEAVE',
        source: 'A new pattern each day',
        date: todayKey(),
        institution: 'Loom',
        license: 'Today only',
        edges: CARDS[2].edges,
      };
    }

    return {
      id: `daily-${todayKey()}`,
      title: 'DAILY WEAVE',
      source: 'A new pattern each day',
      date: todayKey(),
      institution: 'Loom',
      license: 'Today only',
      edges,
    };
  }

  private createProgressStrip(): void {
    const geometry = new PlaneGeometry(0.062, 0.062);
    for (let i = 0; i < CARDS.length; i += 1) {
      const material = new MeshBasicMaterial({
        color: 0x0b1424,
        toneMapped: false,
      });
      const mesh = new Mesh(geometry, material);
      mesh.position.set(-0.225 + i * 0.09, 0.272, 0.036);
      this.world.createTransformEntity(mesh, { parent: this.boardEntity });
      this.progressTiles.push(mesh);
    }
    this.renderProgressTiles();
  }

  private renderProgressTiles(): void {
    for (let index = 0; index < CARDS.length; index += 1) {
      const mesh = this.progressTiles[index];
      if (mesh == null) {
        continue;
      }
      const card = CARDS[index];
      const completed = this.completedCards.has(card.id);
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const context = canvas.getContext('2d');
      if (context == null) {
        continue;
      }
      context.fillStyle = completed ? '#0b1730' : '#070d18';
      context.fillRect(0, 0, 128, 128);
      context.strokeStyle = completed ? '#3b5d94' : '#1d2b44';
      context.lineWidth = 6;
      context.strokeRect(6, 6, 116, 116);
      const gx = (col: number): number => 20 + (col / (COLS - 1)) * 88;
      const gy = (row: number): number => 108 - (row / (ROWS - 1)) * 88;
      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          context.beginPath();
          context.arc(gx(col), gy(row), 2.4, 0, Math.PI * 2);
          context.fillStyle = completed ? '#7896c6' : '#1b2940';
          context.fill();
        }
      }
      if (completed) {
        card.edges.forEach(([a, b], edgeIndex) => {
          context.beginPath();
          context.moveTo(gx(a % COLS), gy(Math.floor(a / COLS)));
          context.lineTo(gx(b % COLS), gy(Math.floor(b / COLS)));
          context.strokeStyle =
            THREAD_COLORS[edgeIndex % THREAD_COLORS.length];
          context.lineWidth = 6;
          context.stroke();
        });
      }
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      const previous = this.progressTextures[index];
      if (previous != null) {
        previous.dispose();
      }
      this.progressTextures[index] = texture;
      (mesh.material as MeshBasicMaterial).map = texture;
      (mesh.material as MeshBasicMaterial).color.setHex(0xffffff);
      (mesh.material as MeshBasicMaterial).needsUpdate = true;
    }
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
    this.idleTimer = 0;
    this.hideHint();
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
    this.idleTimer = 0;
    this.hideHint();
    this.lastFrom = from;
    this.lastTo = to;

    if (to >= 0 && to !== from && this.celebrating === 0) {
      this.addSegment(from, to);
    } else if (to < 0) {
      this.missStreak += 1;
      if (this.missStreak >= 2) {
        this.assistTimer = 8;
      }
    }
    this.cardDirty = true;
    this.syncStatus();
  }

  private syncStatus(): void {
    if (!this.boardEntity.hasComponent(LoomStatus)) {
      return;
    }
    this.boardEntity.setValue(LoomStatus, 'cardIndex', this.cardIndex);
    this.boardEntity.setValue(LoomStatus, 'totalCards', CARDS.length);
    this.boardEntity.setValue(
      LoomStatus,
      'completedCards',
      this.completedCards.size,
    );
    this.boardEntity.setValue(
      LoomStatus,
      'mode',
      this.freeMode ? 'free' : this.dailyMode ? 'daily' : 'card',
    );
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
    const active = this.activeCard();
    this.boardEntity.setValue(
      LoomStatus,
      'requiredEdges',
      active != null
        ? active.edges.map(([a, b]) => `${a}:${b}`).join(',')
        : '',
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

    const active = this.activeCard();
    if (
      active != null &&
      !this.freeMode &&
      this.isCardComplete(active) &&
      this.celebrating === 0 &&
      this.activePegIndex < 0
    ) {
      this.markCompleted(active);
      this.celebrating = 3.6;
      this.playChord();
      this.cardDirty = true;
    }
    this.missStreak = 0;
    this.assistTimer = 0;
    this.idleTimer = 0;
    this.syncStatus();
  }

  private isCardComplete(card: CardDef): boolean {
    for (const [a, b] of card.edges) {
      if (!this.drawnKeys.has(edgeKey(a, b))) {
        return false;
      }
    }
    return true;
  }

  private advanceCard(): void {
    this.celebrating = 0;
    const keepTapestry = this.dailyMode && this.cardIndex >= CARDS.length;
    if (this.cardIndex < CARDS.length) {
      this.cardIndex += 1;
      while (
        this.cardIndex < CARDS.length &&
        this.completedCards.has(CARDS[this.cardIndex].id)
      ) {
        this.cardIndex += 1;
      }
      if (this.cardIndex >= CARDS.length) {
        const freshDaily = this.saved.dailyDate !== todayKey();
        this.dailyMode = freshDaily;
        this.freeMode = !freshDaily;
        if (freshDaily) {
          this.dailyCard = this.createDailyCard();
        }
      }
    } else if (this.dailyMode) {
      this.dailyMode = false;
      this.freeMode = true;
      this.dailyCard = null;
    }
    if (!keepTapestry) {
      this.drawnKeys.clear();
      this.segmentKeys.length = 0;
      this.segmentColors.length = 0;
      for (const segment of this.segments) {
        segment.key = '';
        segment.mesh.scale.set(0, 0, 0);
      }
    }
    this.cardStart = performance.now();
    this.lastTime = 0;
    this.lastBest = 0;
    this.idleTimer = 0;
    this.hideHint();
    this.cardDirty = true;
    this.syncStatus();
  }

  private hideHint(): void {
    this.hintMesh.scale.set(0, 0, 0);
    this.hintPegA = -1;
    this.hintPegB = -1;
  }

  private updateHint(time: number): void {
    const card = this.activeCard();
    if (card == null) {
      this.hideHint();
      return;
    }
    let next: [number, number] | null = null;
    for (const [a, b] of card.edges) {
      if (!this.drawnKeys.has(edgeKey(a, b))) {
        next = [a, b];
        break;
      }
    }
    if (next == null) {
      this.hideHint();
      return;
    }
    const from = this.pegByIndex.get(next[0]);
    const to = this.pegByIndex.get(next[1]);
    if (from == null || to == null) {
      this.hideHint();
      return;
    }
    this.hintPegA = next[0];
    this.hintPegB = next[1];
    this.setSegmentBetween(this.hintMesh, from.position, to.position);
    this.hintMaterial.opacity = 0.42 + 0.14 * Math.sin(time * 2.4);
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
    const isHand = this.world.input.xr.isPrimary('hand', hand);
    // Hands aim with the index fingertip; controller fallback aims from the
    // grip pose so a denied hand-tracking permission still has a usable path.
    const space = isHand
      ? this.player.indexTipSpaces[hand]
      : this.player.gripSpaces[hand];
    if (space == null) {
      return false;
    }
    space.getWorldPosition(this.tmpTip);
    this.tmpWorld.copy(this.tmpTip);
    this.board.worldToLocal(this.tmpWorld);
    out.copy(this.tmpWorld);
    return true;
  }

  private nearestPeg(position: Vector3, exclude: number): number {
    let best = -1;
    let bestDistance = this.assistTimer > 0 ? 0.15 : 0.1;
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
    if (this.assistTimer > 0) {
      this.assistTimer -= delta;
    }
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
      this.idleTimer = 0;
      this.hideHint();
    } else {
      this.updateIdleHover();
      if (this.celebrating > 0 || this.world.session == null) {
        this.idleTimer = 0;
        this.hideHint();
      } else {
        this.idleTimer += delta;
        if (this.idleTimer > 12) {
          this.updateHint(time);
        } else {
          this.hideHint();
        }
      }
    }
    if (this.targetIndex !== this.statusTarget) {
      this.syncStatus();
    }

    for (const peg of this.pegs) {
      let intensity = this.highContrast
        ? 1.6 + 0.4 * Math.sin(time * 2.2 + peg.index * 0.65)
        : 0.85 + 0.3 * Math.sin(time * 2.2 + peg.index * 0.65);
      let color = PEG_TIP_COLOR;
      if (peg.index === this.activePegIndex) {
        intensity = 4.4;
        color = 0xffffff;
      } else if (peg.index === this.targetIndex) {
        intensity = 4.0;
        color = 0xfff2d0;
      } else if (peg.index === this.hintPegA || peg.index === this.hintPegB) {
        intensity = 2.9 + 0.5 * Math.sin(time * 4);
        color = 0xfff2d0;
      } else if (this.celebrating > 0) {
        intensity = 2.2 + 1.9 * Math.sin(time * 11 + peg.index);
      }
      peg.tipMaterial.emissiveIntensity = intensity;
      peg.tipMaterial.emissive.setHex(color);
      const hint =
        this.cardIndex === 0 &&
        this.drawnKeys.size === 0 &&
        this.activePegIndex < 0 &&
        peg.index === ENTRY_PEG;
      peg.tip.scale.setScalar(
        hint ? 1.35 + 0.18 * Math.sin(time * 5) : 1,
      );
      if (peg.hintRing != null) {
        peg.hintRing.visible = hint;
        if (hint) {
          const pulse = 1 + 0.2 * Math.sin(time * 4.2);
          peg.hintRing.scale.setScalar(pulse);
          (peg.hintRing.material as MeshBasicMaterial).opacity =
            0.5 + 0.35 * Math.sin(time * 4.2);
        }
      }
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

  private drawImageCover(
    context: CanvasRenderingContext2D,
    image: HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const iw = image.naturalWidth || image.width;
    const ih = image.naturalHeight || image.height;
    if (iw <= 0 || ih <= 0) {
      return;
    }
    const imageRatio = iw / ih;
    const targetRatio = width / height;
    let sx = 0;
    let sy = 0;
    let sw = iw;
    let sh = ih;
    if (imageRatio > targetRatio) {
      sw = ih * targetRatio;
      sx = (iw - sw) / 2;
    } else {
      sh = iw / targetRatio;
      sy = (ih - sh) / 2;
    }
    context.drawImage(image, sx, sy, sw, sh, x, y, width, height);
  }

  private drawCard(): void {
    const context = this.cardContext;
    const width = 600;
    const height = 800;
    const card = this.activeCard();
    const free = this.freeMode;
    const daily = this.dailyMode;
    const image = card?.image ? this.cardImages.get(card.id) : undefined;
    const hc = this.highContrast;
    const ink = hc ? '#ffffff' : '#f4e6c9';
    const sub = hc ? '#ffffff' : '#8ea6c9';
    const line = hc ? '#ffffff' : '#33486d';
    const dot = hc ? '#ffffff' : '#48648e';
    const bodyInk = hc ? '#ffffff' : '#7f95ba';
    const quiet = hc ? '#ffffff' : '#6f84a8';
    const border = hc ? '#ffffff' : '#263a5e';

    if (hc) {
      context.fillStyle = '#000000';
      context.fillRect(0, 0, width, height);
    } else {
      const background = context.createLinearGradient(0, 0, 0, height);
      background.addColorStop(0, '#0c1730');
      background.addColorStop(1, '#060b16');
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);
    }

    if (!hc && image != null && image.complete && image.naturalWidth > 0) {
      context.globalAlpha = 0.58;
      this.drawImageCover(context, image, 0, 0, width, height);
      context.globalAlpha = 1;
      const veil = context.createLinearGradient(0, 0, 0, height);
      veil.addColorStop(0, 'rgba(5, 10, 20, 0.55)');
      veil.addColorStop(0.45, 'rgba(5, 10, 20, 0.42)');
      veil.addColorStop(1, 'rgba(5, 10, 20, 0.9)');
      context.fillStyle = veil;
      context.fillRect(0, 0, width, height);
    }

    context.strokeStyle = border;
    context.lineWidth = 4;
    context.strokeRect(14, 14, width - 28, height - 28);

    context.fillStyle = sub;
    context.font = '600 18px ui-sans-serif, system-ui, sans-serif';
    context.fillText('META LOOM', 42, 56);
    context.textAlign = 'right';
    context.fillText(
      free ? 'FREE WEAVE' : daily ? 'DAILY WEAVE' : `CARD ${this.cardIndex + 1} / ${CARDS.length}`,
      width - 42,
      56,
    );
    context.textAlign = 'left';

    context.fillStyle = ink;
    context.font = '700 42px Georgia, serif';
    context.fillText(
      card?.title ?? (free ? 'THE LOOM IS FULL' : 'FREE WEAVE'),
      42,
      112,
      500,
    );

    context.fillStyle = sub;
    context.font = '400 15px ui-sans-serif, system-ui, sans-serif';
    context.fillText(
      card != null
        ? `${card.date} · ${card.institution}`
        : 'All six archive patterns woven.',
      42,
      144,
      516,
    );

    context.strokeStyle = line;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(42, 162);
    context.lineTo(width - 42, 162);
    context.stroke();

    const left = 70;
    const right = width - 70;
    const top = 212;
    const bottom = 582;
    const gx = (col: number): number =>
      left + (col / (COLS - 1)) * (right - left);
    const gy = (row: number): number =>
      bottom - (row / (ROWS - 1)) * (bottom - top);

    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        context.beginPath();
        context.arc(gx(col), gy(row), 5.5, 0, Math.PI * 2);
        context.fillStyle = dot;
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
    context.fillStyle = hc ? '#ffffff' : '#d7e6ff';
    context.font = '600 26px ui-sans-serif, system-ui, sans-serif';
    context.fillText(
      free
        ? `${this.segmentKeys.length} threads woven`
        : `${done} / ${required.length} threads`,
      42,
      636,
    );

    context.fillStyle = bodyInk;
    context.font = '400 15px ui-sans-serif, system-ui, sans-serif';
    if (free) {
      context.fillText(
        'All six archive patterns woven — keep going.',
        42,
        672,
        516,
      );
    } else if (daily) {
      const streak =
        this.saved.streak > 0
          ? `Daily weave · ${this.saved.streak}-day streak`
          : 'Daily weave · Today only';
      context.fillText(streak, 42, 672, 516);
    } else if (card != null) {
      context.fillText(`${card.source} · ${card.license}`, 42, 672, 516);
    }

    context.fillStyle = quiet;
    context.font = '400 18px ui-sans-serif, system-ui, sans-serif';
    if (free) {
      context.fillText('Free Weave. No card. No timer.', 42, 724);
      context.fillText('Keep pulling threads through the pegs.', 42, 752);
    } else if (daily) {
      context.fillText('Pinch a brass peg.', 42, 724);
      context.fillText('Pull to another peg, then release.', 42, 752);
    } else {
      context.fillText('Pinch a brass peg.', 42, 724);
      context.fillText('Pull to another peg, then release.', 42, 752);
    }

    if (this.celebrating > 0) {
      context.fillStyle = hc ? 'rgba(0, 0, 0, 0.92)' : 'rgba(5, 10, 20, 0.76)';
      context.fillRect(0, 0, width, height);
      context.fillStyle = hc ? '#ffffff' : '#ffe6b8';
      context.font = '700 76px Georgia, serif';
      context.textAlign = 'center';
      context.fillText('WOVEN', width / 2, 360);
      context.fillStyle = hc ? '#ffffff' : '#9fb6d8';
      context.font = '500 24px ui-sans-serif, system-ui, sans-serif';
      context.fillText(card?.title ?? '', width / 2, 412);
      context.fillStyle = quiet;
      context.font = '400 17px ui-sans-serif, system-ui, sans-serif';
      context.fillText(
        daily
          ? 'A new pattern each day'
          : card != null
            ? `${card.source} · ${card.institution}`
            : 'Archive pattern complete',
        width / 2,
        446,
        540,
      );
      if (!daily && this.lastTime > 0) {
        const bestLine =
          this.lastBest > 0 && this.lastBest + 0.5 < this.lastTime
            ? `  ·  best ${formatTime(this.lastBest)}`
            : '';
        context.fillStyle = hc ? '#ffffff' : '#d7e6ff';
        context.font = '500 19px ui-sans-serif, system-ui, sans-serif';
        context.fillText(
          `Woven in ${formatTime(this.lastTime)}${bestLine}`,
          width / 2,
          480,
        );
      }
      context.textAlign = 'left';
    }

    this.cardTexture.needsUpdate = true;
  }
}
