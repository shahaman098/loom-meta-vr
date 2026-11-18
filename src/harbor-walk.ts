import { Vector3 } from '@iwsdk/core';
import type { Object3D, World } from '@iwsdk/core';

import { QuayFootpath } from './quay-footpath.js';
import { route as STOPS } from './harbor-route.js';
import type { FieldStations } from './field-stations.js';
const titles = STOPS.map((stop) => stop.name);

export class HarborWalk {
  private readonly root = document.createElement('section');
  private readonly buttons: HTMLButtonElement[] = [];
  private readonly range: HTMLInputElement;
  private readonly output: HTMLElement;
  private readonly footpath: QuayFootpath;
  private readonly walking: HTMLButtonElement;
  private readonly pickLayer: HTMLElement;
  private readonly actionBar: HTMLElement;
  private readonly destinations: HTMLSelectElement;
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
  private nextPair: [number, number] | null = null;
  private celebration = '';
  private concertTimer = 0;
  private active = false;

  get isOpen(): boolean {
    return this.active;
  }

  constructor(
    private world: World,
    private tips: Object3D[],
    private weave: (a: number, b: number) => void,
    private replay: () => number,
    private field: FieldStations,
  ) {
    const camera = world.camera;
    this.savedRotation = camera.quaternion.clone();
    this.root.id = 'harbor-walk';
    this.root.hidden = true;
    this.root.innerHTML = `
      <header><div><small>Selvedge Harbor</small><h2></h2></div><button data-menu>Menu</button></header>
      <div class="peg-layer" aria-label="Weaving pegs"></div>
      <div class="field-picks"></div><footer><div class="walk-note" aria-live="polite"></div>
      <div class="field-actions"></div>
      <button class="replay" hidden></button>
      <div class="walk-route"><button data-home>Table</button>
      <label>Walk the quay<input aria-label="Walk the quay" type="range" min="0" max="${(STOPS.length - 1) * 100}" step="1" value="0"></label>
      <button data-point>Signal point</button><button data-walk>Walk freely</button><label>Visit a landing<select aria-label="Visit a landing"></select></label></div></footer>`;
    document.body.append(this.root);
    this.pickLayer = this.root.querySelector('.field-picks')!;
    this.actionBar = this.root.querySelector('.field-actions')!;
    this.destinations = this.root.querySelector('select')!;
    STOPS.forEach((s, i) =>
      this.destinations.add(new Option(s.name, String(i))),
    );
    this.destinations.onchange = () => this.go(Number(this.destinations.value));
    this.actionBar.onclick = (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
        'button[data-field-action]',
      );
      if (button)
        this.field.activate(
          Math.round(this.distance),
          Number(button.dataset.fieldAction),
        );
    };
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
    this.footpath = new QuayFootpath(world, this.root, (n) => {
      this.distance = n;
      this.field.visit(n);
      this.range.value = String(n * 100);
      this.destinations.value = String(n);
      this.describe();
    });
    this.walking = this.root.querySelector('button[data-walk]')!;
    this.walking.onclick = () => {
      if (this.footpath.active) {
        this.go(Math.round(this.distance));
        return;
      }
      this.pegLayer.hidden = true;
      this.pickLayer.hidden = true;
      this.selected = -1;
      this.walking.textContent = 'Stop walking';
      this.footpath.start(Math.round(this.distance));
    };
    this.resizeObserver = new ResizeObserver(() => {
      if (this.active && !this.footpath.active) this.frame();
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
    this.footpath.stop();
    this.root.hidden = true;
    this.world.camera.position.copy(this.savedPosition);
    this.world.camera.quaternion.copy(this.savedRotation);
    this.world.camera.updateMatrixWorld();
  };

  private go(value: number) {
    this.footpath.stop();
    this.walking.textContent = 'Walk freely';
    this.pickLayer.hidden = false;
    this.distance = value;
    this.field.visit(Math.round(value));
    this.destinations.value = String(Math.round(value));
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
    const i = Math.min(STOPS.length - 2, Math.floor(this.distance)),
      f = this.distance - i;
    const a = STOPS[i],
      b = STOPS[i + 1],
      t = f * f * (3 - 2 * f);
    this.eye.fromArray(a.eye).lerp(this.point.fromArray(b.eye), t);
    this.target.fromArray(a.look).lerp(this.point.fromArray(b.look), t);
    // Fit the loom and the two harbor landmarks into narrow portrait views.
    this.eye.z +=
      Math.max(0, 1.12 - bounds.width / bounds.height) *
      (this.distance > 2.5 ? 1.25 : 1.5 + 2.5 * Math.max(0, this.distance - 1));
    const camera = this.world.camera;
    camera.position.copy(this.eye);
    camera.lookAt(this.target);
    camera.updateMatrixWorld();
    this.positionTargets();
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
    celebration = '',
  ) {
    for (let i = 0; i < this.buttons.length; i++)
      this.buttons[i].classList.toggle('next-peg', !!next?.includes(i));
    this.pattern = pattern;
    this.melody = melody;
    this.score = score;
    this.nextPair = next ?? null;
    this.celebration = celebration;
    if (this.active) this.describe();
  }

  private positionTargets() {
    const station = Math.round(this.distance);
    const desired = this.field.hitTargets(station);
    if (
      this.pickLayer.dataset.targets !== desired.map((t) => t.name).join('|')
    ) {
      this.pickLayer.dataset.targets = desired.map((t) => t.name).join('|');
      this.pickLayer.replaceChildren();
      for (const t of desired) {
        const button = document.createElement('button');
        button.className = 'field-pick';
        button.setAttribute('aria-label', t.name);
        button.title = t.name;
        button.onclick = () => this.field.activate(station, t.action);
        this.pickLayer.append(button);
      }
    }
    const bounds = this.world.renderer.domElement.getBoundingClientRect();
    desired.forEach((t, i) => {
      const b = this.pickLayer.children[i] as HTMLButtonElement;
      t.entity
        .object3D!.getWorldPosition(this.point)
        .project(this.world.camera);
      b.style.left =
        bounds.left + ((this.point.x + 1) * bounds.width) / 2 + 'px';
      b.style.top =
        bounds.top + ((1 - this.point.y) * bounds.height) / 2 + 'px';
      b.hidden =
        Math.abs(this.point.x) > 1 ||
        Math.abs(this.point.y) > 1 ||
        Math.abs(this.point.z) > 1;
    });
  }
  update(dt: number) {
    this.footpath.update(dt);
  }
  refresh() {
    if (this.active) {
      this.positionTargets();
      this.describe();
    }
  }

  private describe() {
    const weaving = this.distance === 0;
    const station = Math.round(this.distance);
    this.concert.hidden = station !== 2 || !this.melody;
    const actions = this.field.actions(station);
    if (this.actionBar.dataset.labels !== actions.join('|')) {
      this.actionBar.dataset.labels = actions.join('|');
      this.actionBar.replaceChildren();
      actions.forEach((label, i) => {
        const button = document.createElement('button');
        button.textContent = label;
        button.dataset.fieldAction = String(i);
        this.actionBar.append(button);
      });
    }
    this.concert.textContent =
      (this.concert.disabled ? 'Playing ' : 'Replay ') + this.melody;
    this.title.textContent = weaving
      ? this.pattern
      : titles[Math.round(this.distance)];
    const selectedLabel = this.selected + 1;
    const selectedPrompt =
      this.nextPair == null
        ? 'Select the partner peg.'
        : selectedLabel === this.nextPair[0] + 1
          ? `Now select peg ${this.nextPair[1] + 1}.`
          : selectedLabel === this.nextPair[1] + 1
            ? `Now select peg ${this.nextPair[0] + 1}.`
            : 'Select the glowing pair.';
    this.output.textContent = weaving
      ? this.celebration ||
        (this.selected >= 0 ? selectedPrompt : this.score)
      : this.field.description(station) ||
        (this.distance >= 1.65 && !this.melody
          ? 'Complete a pattern to hear it from Signal Point.'
          : this.distance < 1.65
            ? 'The cottages overlook the west inlet.'
            : 'Your latest woven melody carries across the water.');
    if (this.footpath.active) {
      if (station === 0) this.output.textContent = 'Return to Table to weave.';
      this.output.textContent += ' · W/S walk, A/D sidestep, drag to look.';
    }
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
    this.footpath.dispose();
    this.resizeObserver.disconnect();
    this.root.remove();
  }
}
