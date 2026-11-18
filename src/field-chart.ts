import { isMixedReality } from './mixed-reality.js';
import {
  BoxGeometry,
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  OneHandGrabbable,
  Quaternion,
  RayInteractable,
  SRGBColorSpace,
  Vector3,
} from '@iwsdk/core';
import type { World, Entity } from '@iwsdk/core';
import { HarborControl } from './components.js';
import { route } from './harbor-route.js';
import type { FieldStations } from './field-stations.js';

function label(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const material = new MeshBasicMaterial({ map: texture, toneMapped: false });
  return { canvas, texture, material };
}
function drawLabel(face: ReturnType<typeof label>, s: string, small = false) {
  const c = face.canvas,
    ctx = c.getContext('2d')!;
  ctx.fillStyle = '#153d46';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#c6a070';
  ctx.lineWidth = 5;
  ctx.strokeRect(4, 4, c.width - 8, c.height - 8);
  ctx.fillStyle = '#fff2d9';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = (small ? '26' : 'bold 36') + 'px system-ui';
  const lines: string[] = [];
  let line = '';
  for (const word of s.split(' ')) {
    if (line && ctx.measureText(line + ' ' + word).width > c.width - 24) {
      lines.push(line);
      line = word;
    } else line += (line ? ' ' : '') + word;
  }
  lines.push(line);
  const leading = small ? 31 : 41;
  lines.forEach((l, i) =>
    ctx.fillText(
      l,
      c.width / 2,
      c.height / 2 + (i - (lines.length - 1) / 2) * leading,
      c.width - 18,
    ),
  );
  face.texture.needsUpdate = true;
}

/** The chart stays within reach at each landing. Travel occurs only on release. */
export class FieldChart {
  private readonly keys: Entity[] = [];
  private readonly faces: ReturnType<typeof label>[] = [];
  private readonly legend = label(860, 200);
  private readonly legendMesh: Mesh;
  private readonly origin = new Vector3();
  private readonly head = new Vector3();
  private readonly up = new Vector3(0, 1, 0);
  private readonly chartCenter = new Vector3();
  private readonly chartForward = new Vector3(0, 0, -1);
  private readonly chartRight = new Vector3(1, 0, 0);
  private readonly chartQuaternion = new Quaternion();
  private station = 0;
  private immersed = false;
  private count = 0;
  constructor(
    private world: World,
    private field: FieldStations,
  ) {
    const edgeMaterial = new MeshBasicMaterial({ color: '#957c59' });
    for (let i = 0; i < 8; i++) {
      const face = label(256, 104);
      this.faces.push(face);
      const key = new Mesh(new BoxGeometry(0.139, 0.058, 0.034), [
        edgeMaterial,
        edgeMaterial,
        edgeMaterial,
        edgeMaterial,
        face.material,
        edgeMaterial,
      ]);
      key.name = 'Chart key ' + i;
      key.visible = false;
      const entity = world.createTransformEntity(key);
      entity.addComponent(HarborControl, { index: i });
      this.keys.push(entity);
    }
    this.legendMesh = new Mesh(
      new BoxGeometry(0.48, 0.114, 0.013),
      this.legend.material,
    );
    this.legendMesh.name = 'Harbor chart legend';
    this.legendMesh.visible = false;
    world.createTransformEntity(this.legendMesh);
  }
  private mixed = false;
  update() {
    const active = !!this.world.session;
    const mr = isMixedReality();
    if (active === this.immersed && mr === this.mixed) return;
    this.mixed = mr;
    if (active === this.immersed) { this.refresh(); return; }
    this.immersed = active;
    if (active) {
      this.origin.copy(this.world.player.position);
      this.station = 0;
      this.setTableChart();
    } else {
      this.world.player.position.copy(this.origin);
      this.world.player.updateMatrixWorld(true);
      this.station = 0;
      this.setTableChart();
    }
    this.field.visit(0);
    this.refresh();
  }
  released(e: Entity) {
    if (!this.immersed || !this.world.session || !e.object3D?.visible) return;
    const i = e.getValue(HarborControl, 'index')!;
    if (i < 2) {
      const n =
        (this.station + (i === 0 ? -1 : 1) + route.length) % route.length;
      this.go(n);
    } else this.field.activate(this.station, i - 2);
  }
  private setTableChart() {
    this.chartCenter.set(
      this.origin.x + 0.37,
      1.01 + this.origin.y,
      this.origin.z - 0.36,
    );
    this.chartForward.set(0, 0, -1);
    this.chartRight.set(1, 0, 0);
    this.chartQuaternion.identity();
  }

  private go(n: number) {
    this.station = n;
    const rig = this.world.player;
    if (n === 0) {
      rig.position.copy(this.origin);
      rig.updateMatrixWorld(true);
      this.setTableChart();
    } else {
      this.world.camera.getWorldPosition(this.head);
      const dest = route[n].eye;
      rig.position.x += dest[0] - this.head.x;
      rig.position.z += dest[2] - this.head.z;
      rig.updateMatrixWorld(true);
      // Read the eye after relocation. The old head position was the source
      // of the chart drifting back to the previous landing.
      this.world.camera.getWorldPosition(this.head);
      this.world.camera.getWorldDirection(this.chartForward);
      this.chartForward.y = 0;
      if (this.chartForward.lengthSq() < 1e-6)
        this.chartForward.set(0, 0, -1);
      this.chartForward.normalize();
      this.chartRight.crossVectors(this.chartForward, this.up).normalize();
      const yaw = Math.atan2(-this.chartForward.x, -this.chartForward.z);
      this.chartQuaternion.setFromAxisAngle(this.up, yaw);
      // Destination first, measured eye height second, then a fixed
      // left/low offset. The snapshot does not follow a turning head.
      this.chartCenter
        .set(dest[0], this.head.y, dest[2])
        .addScaledVector(this.chartForward, 0.62)
        .addScaledVector(this.chartRight, -0.22);
    }
    this.field.visit(n);
    this.refresh();
  }
  refresh() {
    const buttons = ['Previous', 'Next', ...this.field.actions(this.station)];
    this.count = buttons.length;
    const atTable = this.station === 0;
    const x = this.chartCenter.x;
    const y = this.chartCenter.y;
    const z = this.chartCenter.z;
    this.legendMesh.visible = this.immersed && !this.mixed;
    this.legendMesh.position.set(
      x + (atTable ? 0 : this.chartRight.x * 0),
      y + 0.12,
      z - (atTable ? 0.025 : 0),
    );
    this.legendMesh.quaternion.copy(
      atTable ? this.chartQuaternion.clone().identity() : this.chartQuaternion,
    );
    this.legendMesh.scale.setScalar(atTable ? 0.52 : 0.6);
    const text = atTable
      ? 'Harbor chart · Pinch a key to visit a landing'
      : route[this.station].name +
        ' · ' +
        (this.field.description(this.station) || 'Pinch a key to travel');
    drawLabel(this.legend, text, true);
    for (let i = 0; i < this.keys.length; i++) {
      const e = this.keys[i],
        key = e.object3D!;
      const enabled = this.immersed && !this.mixed && i < this.count;
      key.visible = enabled;
      if (enabled) {
        if (!e.hasComponent(OneHandGrabbable)) {
          e.addComponent(RayInteractable, {});
          e.addComponent(OneHandGrabbable, { translate: false, rotate: false });
        }
        // Up to eight controls can appear at the pools. Use three columns
        // once there are more than four, so seven keys stay legible and
        // reachable in three rows instead of a cramped four-row strip.
        const columns = this.count > 4 ? 3 : 2;
        const row = Math.floor(i / columns),
          col = i % columns;
        const cols = Math.min(columns, this.count - row * columns);
        const colStep = atTable ? 0.149 : columns === 3 ? 0.17 : 0.125;
        const rowStep = atTable ? 0.082 : 0.095;
        key.scale.setScalar(atTable ? 1 : columns === 3 ? 0.98 : 0.9);
        const dx = (col - (cols - 1) / 2) * colStep;
        key.position.set(
          x + (atTable ? dx : this.chartRight.x * dx + this.chartForward.x * 0.014 * row),
          y - row * rowStep,
          z + (atTable ? 0.014 * row : this.chartRight.z * dx + this.chartForward.z * 0.014 * row),
        );
        key.quaternion.copy(
          atTable ? this.chartQuaternion.clone().identity() : this.chartQuaternion,
        );
        key.name = 'Chart ' + buttons[i];
        drawLabel(this.faces[i], buttons[i]);
      } else if (e.hasComponent(OneHandGrabbable)) {
        e.removeComponent(OneHandGrabbable);
        e.removeComponent(RayInteractable);
      }
    }
  }
  dispose() {
    if (this.immersed) this.world.player.position.copy(this.origin);
    for (const face of [...this.faces, this.legend]) {
      face.texture.dispose();
      face.material.dispose();
    }
  }
}
