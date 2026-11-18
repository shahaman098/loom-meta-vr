import { Vector3 } from '@iwsdk/core';
import type { World } from '@iwsdk/core';
import { route } from './harbor-route.js';

// The two connected deck footprints share the same dimensions as the authored planks.
// Camera movement stays on the piers. The worktable occupies the middle of the first.
function onDeck(x: number, z: number) {
  const main = x >= -0.89 && x <= 0.89 && z >= -4.14 && z <= 1.07;
  const west = x >= -7.84 && x <= 0.6 && z >= -4.15 && z <= -3.14;
  // Optional seaward loop between the Tide Pools and the Cabinet, plus its
  // two short connectors to the existing west quay.
  const loop = x >= -8.15 && x <= -2.35 && z >= -5.2 && z <= -4.5;
  const eastLink = x >= -2.5 && x <= -2.0 && z >= -4.65 && z <= -3.1;
  const westLink = x >= -8.4 && x <= -7.85 && z >= -4.65 && z <= -3.1;
  const listeningPost =
    x > -5.08 && x < -4.42 && z > -5.3 && z < -4.74;
  const rubbingTable =
    x > -6.38 && x < -5.62 && z > -5.3 && z < -4.74;
  return (
    (main || west || loop || eastLink || westLink) &&
    !(Math.abs(x) < 0.63 && z > -0.99 && z < -0.13) &&
    !listeningPost &&
    !rubbingTable
  );
}
const directions: Record<string, string> = {
  KeyW: 'forward',
  KeyS: 'back',
  KeyA: 'left',
  KeyD: 'right',
  KeyQ: 'turnLeft',
  KeyE: 'turnRight',
  ArrowUp: 'forward',
  ArrowDown: 'back',
  ArrowLeft: 'turnLeft',
  ArrowRight: 'turnRight',
};

export class QuayFootpath {
  active = false;
  private yaw = 0;
  private pitch = -0.05;
  private readonly inputs = new Set<string>();
  private readonly target = new Vector3();
  private readonly cleanup = new AbortController();
  private pointer = -1;
  private pointerX = 0;
  private pointerY = 0;
  private station = -1;
  private readonly surface: HTMLElement;
  private readonly pad: HTMLElement;

  constructor(
    private world: World,
    root: HTMLElement,
    private arrive: (n: number) => void,
  ) {
    this.surface = document.createElement('div');
    this.surface.className = 'footpath-surface';
    this.surface.hidden = true;
    root.prepend(this.surface);
    this.pad = document.createElement('div');
    this.pad.className = 'footpath-pad';
    this.pad.hidden = true;
    const commands = [
      ['turnLeft', 'Turn left'],
      ['forward', 'Forward'],
      ['back', 'Back'],
      ['turnRight', 'Turn right'],
    ];
    const signal = this.cleanup.signal;
    for (const [intent, title] of commands) {
      const b = document.createElement('button');
      b.textContent = title;
      b.setAttribute('aria-label', 'Walk control: ' + title);
      b.onpointerdown = (e) => {
        b.setPointerCapture(e.pointerId);
        this.inputs.add(intent);
      };
      b.onlostpointercapture = () => this.inputs.delete(intent);
      this.pad.append(b);
    }
    root.querySelector('footer')!.append(this.pad);
    window.addEventListener(
      'keydown',
      (e) => {
        if (!this.active || e.ctrlKey || e.altKey || e.metaKey) return;
        if ((e.target as HTMLElement)?.matches('input,select')) return;
        const dir = directions[e.code];
        if (dir) {
          e.preventDefault();
          this.inputs.add(dir);
        }
      },
      { signal },
    );
    window.addEventListener(
      'keyup',
      (e) => this.inputs.delete(directions[e.code]),
      { signal },
    );
    window.addEventListener('blur', () => this.inputs.clear(), { signal });
    this.surface.onpointerdown = (e) => {
      this.pointer = e.pointerId;
      this.pointerX = e.clientX;
      this.pointerY = e.clientY;
      this.surface.setPointerCapture(e.pointerId);
    };
    this.surface.onpointermove = (e) => {
      if (e.pointerId !== this.pointer) return;
      this.yaw -= (e.clientX - this.pointerX) * 0.005;
      this.pitch = Math.max(
        -1.24,
        Math.min(1.14, this.pitch - (e.clientY - this.pointerY) * 0.004),
      );
      this.pointerX = e.clientX;
      this.pointerY = e.clientY;
      this.aim();
    };
    this.surface.onlostpointercapture = () => {
      this.pointer = -1;
    };
  }
  start(n: number) {
    this.active = true;
    this.pad.hidden = false;
    this.surface.hidden = false;
    this.station = -1;
    const camera = this.world.camera;
    const stop = route[n];
    camera.position.fromArray(stop.eye);
    if (n === 0) camera.position.set(0.78, 1.32, 0.53);
    if (n >= 2 && n <= 5) camera.position.z = -3.29;
    this.yaw =
      n === 0
        ? 0
        : Math.atan2(
            -(stop.look[0] - camera.position.x),
            -(stop.look[2] - camera.position.z),
          );
    this.pitch = n === 4 ? -0.52 : n === 7 ? -0.12 : -0.1;
    this.aim();
    this.nearest();
  }
  stop() {
    this.active = false;
    this.inputs.clear();
    this.pad.hidden = true;
    this.surface.hidden = true;
    this.pointer = -1;
  }
  private aim() {
    const p = this.world.camera.position,
      c = Math.cos(this.pitch);
    this.target.set(
      p.x - Math.sin(this.yaw) * c,
      p.y + Math.sin(this.pitch),
      p.z - Math.cos(this.yaw) * c,
    );
    this.world.camera.lookAt(this.target);
    this.world.camera.updateMatrixWorld();
  }
  private nearest() {
    const p = this.world.camera.position;
    let best = 0,
      dist = Infinity;
    for (let i = 0; i < route.length; i++) {
      const eye = route[i].eye,
        dx = p.x - eye[0],
        dz = p.z - eye[2],
        d = dx * dx + dz * dz;
      if (d < dist) {
        dist = d;
        best = i;
      }
    }
    if (best !== this.station) {
      this.station = best;
      this.arrive(best);
    }
  }
  update(delta: number) {
    if (!this.active || this.inputs.size === 0) return;
    const dt = Math.min(0.1, delta);
    const step =
      Number(this.inputs.has('forward')) - Number(this.inputs.has('back'));
    const side =
      Number(this.inputs.has('right')) - Number(this.inputs.has('left'));
    const turn =
      Number(this.inputs.has('turnLeft')) -
      Number(this.inputs.has('turnRight'));
    this.yaw += turn * dt * 1.48;
    const speed = (0.95 * dt) / Math.max(1, Math.hypot(side, step));
    const p = this.world.camera.position;
    const x =
      p.x + speed * (Math.cos(this.yaw) * side - Math.sin(this.yaw) * step);
    const z =
      p.z + speed * (-Math.sin(this.yaw) * side - Math.cos(this.yaw) * step);
    if (onDeck(x, p.z)) p.x = x;
    if (onDeck(p.x, z)) p.z = z;
    this.aim();
    this.nearest();
  }
  dispose() {
    this.stop();
    this.cleanup.abort();
    this.pad.remove();
    this.surface.remove();
  }
}
