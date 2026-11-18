import { Vector3 } from '@iwsdk/core';
import type { Object3D, World } from '@iwsdk/core';

// Eye and sightline along the planked quay. Movement is optional and screen-only.
const STOPS = [
  { eye: [0, 1.32, 0.65], look: [0, 1.1, -0.68] },
  { eye: [-0.25, 1.46, -1.5], look: [-4.2, 0.96, -8.3] },
  { eye: [0.18, 1.41, -3.12], look: [0.88, 1.56, -6.95] },
];
const titles = ['Weaving table', 'West inlet', 'Signal point'];

export class HarborWalk {
  private readonly root = document.createElement('section');
  private readonly buttons: HTMLButtonElement[] = [];
  private readonly range: HTMLInputElement;
  private readonly output: HTMLElement;
  private readonly concert: HTMLButtonElement;
  private readonly instructions: HTMLElement;
  private readonly title: HTMLElement;
  private readonly pegLayer: HTMLElement;
  private readonly eye = new Vector3();
  private readonly target = new Vector3();
  private readonly point = new Vector3();
  private readonly savedPosition = new Vector3();
  private readonly savedRotation;
  private readonly resizeObserver: ResizeObserver;
  private distance = 0;
  private selected = -1;
  private score = '';
  private pattern = '';
  private melody = '';
  private concertTimer = 0;
  private active = false;

  constructor(
    private world: World,
    private tips: Object3D[],
    private weave: (a: number, b: number) => void,
    private replay: () => number,
  ) {
    const camera = world.camera;
    this.savedRotation = camera.quaternion.clone();
    this.root.id = 'harbor-walk';
    this.root.hidden = true;
    this.root.innerHTML = `
      <header><div><small>Selvedge Harbor</small><h2></h2></div><button data-menu>Menu</button></header>
      <div class="peg-layer" aria-label="Weaving pegs"></div>
      <footer><div class="walk-note" aria-live="polite"></div>
      <button class="replay" hidden></button>
      <div class="walk-route"><button data-home>Table</button>
      <label>Walk the quay<input aria-label="Walk the quay" type="range" min="0" max="200" step="1" value="0"></label>
      <button data-point>Signal point</button></div></footer>`;
    document.body.append(this.root);
    this.range = this.root.querySelector('input')!;
    this.output = this.root.querySelector('.walk-note')!;
    this.title = this.root.querySelector('h2')!;
    this.pegLayer = this.root.querySelector('.peg-layer')!;
    this.instructions = this.root.querySelector('.walk-route')!;
    this.concert = this.root.querySelector('.replay')!;
    this.concert.onclick = () => {
      const duration = this.replay();
      if (duration <= 0) return;
      this.concert.disabled = true;
      this.describe();
      this.concertTimer = window.setTimeout(() => {
        this.concert.disabled = false;
        if (this.active) this.describe();
      }, duration * 1000);
    };
    this.range.oninput = () => this.go(Number(this.range.value) / 100);
    this.root.querySelector<HTMLButtonElement>('[data-home]')!.onclick = () =>
      this.go(0);
    this.root.querySelector<HTMLButtonElement>('[data-point]')!.onclick = () =>
      this.go(2);
    this.root.querySelector<HTMLButtonElement>('[data-menu]')!.onclick = () => {
      this.close();
      window.dispatchEvent(new Event('loom-menu'));
    };
    for (let i = 0; i < tips.length; i++) {
      const button = document.createElement('button');
      button.className = 'peg-target';
      button.setAttribute('aria-label', 'Peg ' + (i + 1));
      button.textContent = String(i + 1);
      button.onclick = () => this.pick(i);
      this.pegLayer.append(button);
      this.buttons.push(button);
    }
    this.resizeObserver = new ResizeObserver(() => {
      if (this.active) this.frame();
    });
    this.resizeObserver.observe(world.renderer.domElement);
    window.addEventListener('loom-play', this.open);
    window.addEventListener('loom-close-walk', this.close);
  }

  private open = () => {
    if (this.active || this.world.session) return;
    this.savedPosition.copy(this.world.camera.position);
    this.savedRotation.copy(this.world.camera.quaternion);
    this.root.hidden = false;
    this.active = true;
    this.go(0);
    this.buttons[2].focus({ preventScroll: true });
  };

  private close = () => {
    if (!this.active) return;
    this.active = false;
    this.root.hidden = true;
    this.world.camera.position.copy(this.savedPosition);
    this.world.camera.quaternion.copy(this.savedRotation);
    this.world.camera.updateMatrixWorld();
  };

  private go(value: number) {
    this.distance = value;
    this.range.value = String(Math.round(value * 100));
    this.selected = -1;
    this.pegLayer.hidden = value > 0;
    this.frame();
    this.describe();
  }

  private pick(index: number) {
    if (!this.active || this.distance !== 0 || this.world.session) return;
    if (this.selected === -1) {
      this.selected = index;
    } else {
      const from = this.selected;
      this.selected = -1;
      if (from !== index) this.weave(from, index);
    }
    this.describe();
  }

  private frame() {
    const canvas = this.world.renderer.domElement;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const i = Math.min(1, Math.floor(this.distance)),
      f = this.distance - i;
    const a = STOPS[i],
      b = STOPS[i + 1],
      t = f * f * (3 - 2 * f);
    this.eye.fromArray(a.eye).lerp(this.point.fromArray(b.eye), t);
    this.target.fromArray(a.look).lerp(this.point.fromArray(b.look), t);
    // Fit the loom and the two harbor landmarks into narrow portrait views.
    this.eye.z +=
      Math.max(0, 1.12 - bounds.width / bounds.height) *
      (1.5 + 2.5 * Math.max(0, this.distance - 1));
    const camera = this.world.camera;
    camera.position.copy(this.eye);
    camera.lookAt(this.target);
    camera.updateMatrixWorld();
    if (this.distance !== 0) return;
    for (let i = 0; i < this.tips.length; i++) {
      this.tips[i].getWorldPosition(this.point).project(camera);
      const btn = this.buttons[i];
      btn.style.left =
        bounds.left + ((this.point.x + 1) * bounds.width) / 2 + 'px';
      btn.style.top =
        bounds.top + ((1 - this.point.y) * bounds.height) / 2 + 'px';
    }
  }

  setScore(
    pattern: string,
    score: string,
    melody: string,
    next?: [number, number],
  ) {
    for (let i = 0; i < this.buttons.length; i++)
      this.buttons[i].classList.toggle('next-peg', !!next?.includes(i));
    this.pattern = pattern;
    this.melody = melody;
    this.score = score;
    if (this.active) this.describe();
  }

  private describe() {
    const weaving = this.distance === 0;
    this.concert.hidden = this.distance < 1.65 || !this.melody;
    this.concert.textContent =
      (this.concert.disabled ? 'Playing ' : 'Replay ') + this.melody;
    this.title.textContent = weaving
      ? this.pattern
      : titles[Math.round(this.distance)];
    const prompt =
      this.selected < 0 ? 'Choose two pegs.' : 'Choose the ending peg.';
    this.output.textContent = weaving
      ? this.score + ' · ' + prompt
      : this.distance >= 1.65 && !this.melody
        ? 'Complete a pattern to hear it from Signal Point.'
        : this.distance < 1.65
          ? 'The cottages overlook the west inlet.'
          : 'Your latest woven melody carries across the water.';
    this.instructions.setAttribute(
      'aria-label',
      titles[Math.round(this.distance)],
    );
    this.range.setAttribute(
      'aria-valuetext',
      titles[Math.round(this.distance)],
    );
    for (let i = 0; i < this.buttons.length; i++)
      this.buttons[i].setAttribute('aria-pressed', String(i === this.selected));
  }

  dispose() {
    this.close();
    window.removeEventListener('loom-play', this.open);
    window.removeEventListener('loom-close-walk', this.close);
    window.clearTimeout(this.concertTimer);
    this.resizeObserver.disconnect();
    this.root.remove();
  }
}
