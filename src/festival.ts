import {
  BufferAttribute,
  CanvasTexture,
  NormalBlending,
  BufferGeometry,
  Color,
  Points,
  PointsMaterial,
} from '@iwsdk/core';
import type { World } from '@iwsdk/core';

const BURSTS = 10;
const PER_BURST = 110;
const COUNT = BURSTS * PER_BURST;
const PALETTE = ['#ffb020', '#ff3b5c', '#2fb8ff', '#a64dff', '#22e07a', '#ff7a1a'];

/** Harbor Festival fireworks: one pooled point cloud, no per-frame allocation. */
export class Festival {
  private readonly points: Points;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly base: Float32Array;
  private readonly velocity = new Float32Array(COUNT * 3);
  private readonly life = new Float32Array(COUNT);
  private readonly color = new Color();
  private nextBurst = 0;
  private timer = 0;
  private remaining = 0;
  private room = false;
  private seed = 1;

  constructor(world: World) {
    const geometry = new BufferGeometry();
    this.positions = new Float32Array(COUNT * 3);
    this.colors = new Float32Array(COUNT * 4);
    this.base = new Float32Array(COUNT * 3);
    geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new BufferAttribute(this.colors, 4));
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 64;
    const g = sprite.getContext('2d')!;
    const glow = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    glow.addColorStop(0, 'rgba(255,255,255,1)');
    glow.addColorStop(0.35, 'rgba(255,255,255,0.85)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, 64, 64);
    const material = new PointsMaterial({
      size: 0.2,
      map: new CanvasTexture(sprite),
      vertexColors: true,
      transparent: true,
      blending: NormalBlending,
      depthWrite: false,
    });
    this.points = new Points(geometry, material);
    this.points.name = 'Harbor festival fireworks';
    this.points.frustumCulled = false;
    this.points.visible = false;
    world.createTransformEntity(this.points);
  }

  get active(): boolean {
    return this.remaining > 0;
  }

  /** Start the finale. In room mode the bursts are small and stay near the loom. */
  start(seconds: number, room: boolean): void {
    this.room = room;
    this.remaining = seconds;
    this.timer = 0;
    (this.points.material as PointsMaterial).size = room ? 0.03 : 0.2;
    this.points.visible = true;
  }

  private random(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  private burst(): void {
    const slot = this.nextBurst;
    this.nextBurst = (this.nextBurst + 1) % BURSTS;
    const r = () => this.random();
    const cx = this.room ? (r() - 0.5) * 1.3 : 0.8 + (r() - 0.5) * 6;
    const cy = this.room ? 1.45 + r() * 0.35 : 2.6 + r() * 1.8;
    const cz = this.room ? -0.85 - r() * 0.35 : -5.5 - r() * 2.5;
    const speed = this.room ? 0.42 : 3.4;
    this.color.set(PALETTE[Math.floor(r() * PALETTE.length)]);
    for (let i = 0; i < PER_BURST; i++) {
      const p = slot * PER_BURST + i;
      const u = r() * 2 - 1;
      const a = r() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const v = speed * (0.75 + r() * 0.35);
      this.positions[p * 3] = cx;
      this.positions[p * 3 + 1] = cy;
      this.positions[p * 3 + 2] = cz;
      this.velocity[p * 3] = s * Math.cos(a) * v;
      this.velocity[p * 3 + 1] = u * v;
      this.velocity[p * 3 + 2] = s * Math.sin(a) * v;
      this.base[p * 3] = this.color.r;
      this.base[p * 3 + 1] = this.color.g;
      this.base[p * 3 + 2] = this.color.b;
      this.life[p] = 1.6 + r() * 0.5;
    }
  }

  /** Returns true when a new burst fired this frame (for a sound cue). */
  update(delta: number): boolean {
    if (!this.points.visible) return false;
    const dt = Math.min(delta, 0.05);
    let fired = false;
    if (this.remaining > 0) {
      this.remaining -= dt;
      this.timer -= dt;
      if (this.timer <= 0) {
        this.burst();
        fired = true;
        this.timer = 0.55 + this.random() * 0.45;
      }
    }
    const gravity = this.room ? 0.35 : 1.6;
    let alive = false;
    for (let p = 0; p < COUNT; p++) {
      if (this.life[p] <= 0) {
        this.colors[p * 4 + 3] = 0;
        continue;
      }
      alive = true;
      this.life[p] -= dt;
      this.velocity[p * 3 + 1] -= gravity * dt;
      this.velocity[p * 3] *= 0.985;
      this.velocity[p * 3 + 2] *= 0.985;
      this.positions[p * 3] += this.velocity[p * 3] * dt;
      this.positions[p * 3 + 1] += this.velocity[p * 3 + 1] * dt;
      this.positions[p * 3 + 2] += this.velocity[p * 3 + 2] * dt;
      const fade = Math.max(0, Math.min(1, this.life[p] / 1.2));
      // Vertex alpha (4-component colour) fades sparks out instead of to black.
      this.colors[p * 4] = this.base[p * 3];
      this.colors[p * 4 + 1] = this.base[p * 3 + 1];
      this.colors[p * 4 + 2] = this.base[p * 3 + 2];
      this.colors[p * 4 + 3] = fade;
    }
    const geometry = this.points.geometry;
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    if (!alive && this.remaining <= 0) this.points.visible = false;
    return fired;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as PointsMaterial).map?.dispose();
    (this.points.material as PointsMaterial).dispose();
  }
}
