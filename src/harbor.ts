import {
  CanvasTexture,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  ShaderMaterial,
  SRGBColorSpace,
} from '@iwsdk/core';
import type { Object3D } from '@iwsdk/core';

/** Animation uses only the placed scene instance. One correct stitch lights the
 * beacon, the second launches the cutters, and a finished score calls the terns. */
export class Harbor {
  private readonly beacon: Object3D;
  private readonly boats: Object3D[];
  private readonly birds: Object3D;
  private readonly windows: Object3D;
  private readonly sea: ShaderMaterial;
  private readonly flagCanvas = document.createElement('canvas');
  private readonly flagMaterial: MeshBasicMaterial;
  private readonly flagTexture: CanvasTexture;
  private sailing = 0;
  private flying = 0;
  private tide = 0;
  private correct = 0;
  private finished = false;

  constructor(
    root: Object3D,
    private reducedMotion: boolean,
  ) {
    this.flagCanvas.width = 384;
    this.flagCanvas.height = 224;
    this.flagTexture = new CanvasTexture(this.flagCanvas);
    this.flagTexture.colorSpace = SRGBColorSpace;
    this.flagMaterial = new MeshBasicMaterial({
      map: this.flagTexture,
      side: DoubleSide,
      toneMapped: false,
    });
    (root.getObjectByName('Woven signal flag') as Mesh).material =
      this.flagMaterial;
    this.beacon = root.getObjectByName('Beacon sweep')!;
    this.boats = [0, 1, 2].map((i) => root.getObjectByName('Cutter ' + i)!);
    this.birds = root.getObjectByName('Returning terns')!;
    this.windows = root.getObjectByName('Harbor windows')!;
    const water = root.getObjectByName('Woven water') as Mesh;
    this.sea = (water.material as ShaderMaterial).clone();
    water.material = this.sea;
    this.setScore(0, false);
  }

  stitchFlag(edges: Iterable<[number, number]>) {
    const ctx = this.flagCanvas.getContext('2d')!;
    ctx.fillStyle = '#19424c';
    ctx.fillRect(0, 0, 384, 224);
    ctx.strokeStyle = '#d6ac73';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, 364, 204);
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1;
    ctx.strokeRect(16, 16, 352, 192);
    ctx.setLineDash([]);
    // Peg coordinates are identical to the board grid, including its bottom-up numbering.
    ctx.lineCap = 'round';
    const colors = ['#ffe6a7', '#84dfd3', '#edab9d'];
    let i = 0;
    for (const [a, b] of edges) {
      ctx.strokeStyle = colors[i++ % colors.length];
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(89 + (a % 5) * 51, 181 - Math.floor(a / 5) * 34);
      ctx.lineTo(89 + (b % 5) * 51, 181 - Math.floor(b / 5) * 34);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffe2a4';
    for (let j = 0; j < 25; j++) {
      ctx.beginPath();
      ctx.arc(
        89 + (j % 5) * 51,
        181 - Math.floor(j / 5) * 34,
        2.4,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(8,29,38,.16)';
    for (let y = 0; y < 224; y += 4) ctx.fillRect(0, y, 384, 1);
    this.flagTexture.needsUpdate = true;
  }

  setScore(correct: number, finished: boolean) {
    this.correct = correct;
    this.finished = finished;
    this.beacon.visible = correct >= 1;
    this.birds.visible = finished;
    this.windows.visible = correct >= 1;
    this.sea.uniforms.signal.value = Math.min(correct, 3);
  }

  update(dt: number) {
    if (this.reducedMotion) return;
    this.tide += Math.min(dt, 0.1);
    this.sea.uniforms.tide.value = this.tide;
    if (this.beacon.visible)
      this.beacon.rotation.y = Math.sin(this.tide * 0.68) * 1.05;
    if (this.correct >= 2) this.sailing += Math.min(dt, 0.1) * 0.33;
    if (this.finished) this.flying += Math.min(dt, 0.1) * 0.6;
    for (let i = 0; i < this.boats.length; i++) {
      const boat = this.boats[i];
      boat.position.x = -2.4 + i * 1.45 + Math.sin(this.sailing) * 0.89;
      boat.position.y = -0.25 + Math.sin(this.tide * 1.21 + i) * 0.028;
      boat.rotation.z = Math.sin(this.tide * 0.76 + i) * 0.039;
    }
    this.birds.position.x = -1 + Math.sin(this.flying) * 1.75;
    this.birds.position.y = 2.21 + Math.sin(this.flying * 1.6) * 0.14;
  }

  dispose() {
    this.sea.dispose();
    this.flagMaterial.dispose();
    this.flagTexture.dispose();
  }
}
