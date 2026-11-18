import {
  BoxGeometry,
  CanvasTexture,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RayInteractable,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
} from '@iwsdk/core';
import type { World, Entity, Object3D } from '@iwsdk/core';
import { HarborDiscovery, HarborSpot } from './components.js';

type Fragment = {
  id: string;
  source: string;
  date: string;
  institution: string;
  license: string;
};
type Note = { pool: number; pitch: number };
const noteNames = ['Low pool', 'Middle pool', 'High pool'];
const dyes = ['Madder', 'Indigo', 'Weld'];
const rubbingNames = ['Wave', 'Knot', 'Compass'];
export const flagDyes = ['#783e3a', '#294b65', '#695c32'];
const FIELD_SAVE = 'loom.harbor.field.v1';
const vertex = `varying vec2 tex; void main(){tex=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
function basinMaterial(pool: number, ages: Vector3) {
  return new ShaderMaterial({
    uniforms: {
      ages: { value: ages },
      basin: { value: pool },
      clock: { value: 0 },
    },
    vertexShader: vertex,
    fragmentShader: `
      varying vec2 tex;uniform vec3 ages;uniform float basin,clock;
      float noise(vec2 p){return fract(sin(dot(p,vec2(43.12,76.23)))*4375.85);}
      float segment(vec2 p,vec2 a,vec2 b){vec2 d=b-a;return length(p-a-d*clamp(dot(p-a,d)/dot(d,d),0.,1.));}
      void main(){
        vec2 p=(tex-.5)*2.;float r=length(p);
        float sand=.5+.5*sin(20.*p.x+sin(17.*p.y)+sin(12.*p.x-10.*p.y));
        vec3 c=mix(vec3(.011,.115,.14),vec3(.12,.42,.32),pow(r,1.8));
        c+=vec3(.032,.047,.018)*sand;
        // The water reveals three different tide-pool habitats. Distort the
        // view beneath its surface while keeping the strike ripple independent.
        vec2 q=p+vec2(sin(p.y*13.+clock),cos(p.x*14.-clock))*.014;
        float fleck=noise(floor(q*89.));
        c+=vec3(.09,.078,.045)*smoothstep(.81,.99,fleck)*smoothstep(.25,.91,r);
        if(basin<.5){
          for(int j=0;j<5;j++){
            float k=float(j);vec2 center=vec2(sin(k*4.1)*.38,cos(k*4.4)*.44);
            vec2 v=q-center;float d=length(v),a=atan(v.y,v.x);
            float tentacle=.115+.030*sin(a*16.+sin(clock*.7+k));
            float fringe=1.-smoothstep(tentacle-.01,tentacle+.012,d);
            vec3 crimson=mix(vec3(.19,.043,.026),vec3(.73,.29,.14),.5+.5*cos(a*16.-d*12.));
            c=mix(c,crimson,fringe*.94);c=mix(c,vec3(.078,.022,.016),1.-smoothstep(.024,.054,d));
          }
        }else if(basin<1.5){
          for(int j=0;j<7;j++){
            float k=float(j);vec2 a=vec2(-.64+k*.19,-.73+.11*sin(k*2.));
            vec2 b=a+vec2(.09*sin(clock*.55+k*2.5),.49+.22*cos(k*2.1));
            c=mix(c,vec3(.26,.40,.17),1.-smoothstep(.012,.025,segment(q,a,b)));
            for(int t=1;t<5;t++){
              vec2 base=mix(a,b,float(t)*.2);
              float turn=t%2==0?1.:-1.;
              vec2 blade=base+vec2(turn*.096,.101);
              c=mix(c,vec3(.16,.37,.19),1.-smoothstep(.014,.031,segment(q,base,blade)));
            }
          }
        }else{
          for(int j=0;j<4;j++){
            float k=float(j); vec2 v=q-vec2(.39*sin(k*3.7),.42*cos(k*4.2));
            v.y*=.81;float d=length(v),a=atan(v.y,v.x);
            float fan=(1.-smoothstep(.131,.151,d))*(1.-smoothstep(1.14,1.40,abs(a)));
            float rib=.53+.47*cos(a*31.);
            c=mix(c,mix(vec3(.36,.16,.088),vec3(.83,.61,.38),rib),fan);
          }
        }
        float caustic=abs(sin(q.x*14.+1.45*sin(q.y*8.+clock*.51))+sin(q.y*13.-clock*.76));
        c+=vec3(.065,.112,.085)*(1.-smoothstep(.04,.17,caustic));

        for(int i=0;i<3;i++){
          float age=ages[i];float dist=length(p+vec2((basin-float(i))*1.85,0.));
          float crest=dist-age*2.7;
          float wave=exp(-crest*crest*6.)*(.5+.5*cos(crest*27.))*exp(-age*.7);
          c+=wave*vec3(.50,.72,.56);
        }
        gl_FragColor=vec4(c,1.);
        #include <colorspace_fragment>
      }`,
  });
}

export class FieldStations {
  private readonly ages = new Vector3(10, 10, 10);
  private readonly shoal: Object3D;
  private readonly shoalMaterial: ShaderMaterial;
  private readonly waters: ShaderMaterial[] = [];
  private readonly cabinet: Object3D;
  private readonly listening: Object3D;
  private readonly chimes: Object3D;
  private readonly rubbingRoot: Object3D;
  private readonly rubbingCanvas = document.createElement('canvas');
  private readonly rubbingTexture: CanvasTexture;
  private readonly rubbingMaterial: MeshBasicMaterial;
  private readonly rubbingCardCanvas = document.createElement('canvas');
  private readonly rubbingCardTexture: CanvasTexture;
  private readonly rubbingCardMaterial: MeshBasicMaterial;
  private readonly drawer: Object3D;
  private readonly mount: Object3D;
  private readonly lamp: Object3D;
  private readonly bells: Object3D;
  private readonly skeins: Object3D;
  private readonly photo = document.createElement('canvas');
  private readonly photoTexture: CanvasTexture;
  private readonly photoMaterial: ShaderMaterial;
  private readonly seen = new Set<string>();
  private readonly phrase: Note[] = [];
  private selected = 0;
  private open = false;
  private raking = false;
  private zoom = false;
  private dye = -1;
  private noteCount = 0;
  private challenge: 'idle'|'listen'|'attempt'|'success' = 'idle';
  private motif: number[] = [];
  private attempt: number[] = [];
  private tideSuccess = 0;
  private tideVariation = 0;
  private challengeTimer = 0;
  private rubbingChoice = 0;
  private rubbingIndex = -1;
  private listeningAge = 0;
  private challengeMessage = '';
  private challengeMessageTimer = 0;
  private bellAge = 8;
  private dyeAge = 8;
  private lastReplay = -100;
  private playbackAge = 10;
  private playback: Note[] = [];
  private playhead = 0;
  private reported = '';
  private pendingPhoto: HTMLImageElement | null = null;
  private station = 0;
  private targets: {
    entity: Entity;
    station: number;
    action: number;
    name: string;
  }[] = [];
  private hitMaterial = new MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false,
  });
  onChange = () => {};

  constructor(
    world: World,
    private board: Entity,
    private archive: Fragment[],
    private images: Map<string, HTMLImageElement>,
    private basePitch: () => number,
    private sound: (
      pitch: number,
      volume: number,
      when?: number,
      duration?: number,
    ) => void,
    private colorFlag: (color: string) => void,
    private challengeWin: () => void,
    private reducedMotion: boolean,
  ) {
    board.addComponent(HarborDiscovery, {});
    this.shoal = world.requireSceneObject('silver-shoal');
    const fish = (this.shoal.getObjectByName('Silver shoal') ??
      this.shoal) as Mesh;
    this.shoalMaterial = (fish.material as ShaderMaterial).clone();
    this.shoalMaterial.uniforms.ages.value = this.ages;
    fish.material = this.shoalMaterial;
    this.shoal.visible = false;
    const pools = world.requireSceneObject('tide-pools');
    for (let i = 0; i < 3; i++) {
      const mat = basinMaterial(i, this.ages);
      this.waters.push(mat);
      (pools.getObjectByName('Basin ' + i) as Mesh).material = mat;
    }
    this.cabinet = world.requireSceneObject('conservation-cabinet');
    this.listening = world.requireSceneObject('listening-post');
    this.chimes = this.listening.getObjectByName('Listening chimes')!;
    this.rubbingRoot = world.requireSceneObject('rubbing-table');
    this.rubbingCanvas.width = 256;
    this.rubbingCanvas.height = 192;
    this.rubbingTexture = new CanvasTexture(this.rubbingCanvas);
    this.rubbingTexture.colorSpace = SRGBColorSpace;
    this.rubbingMaterial = new MeshBasicMaterial({
      map: this.rubbingTexture,
      side: DoubleSide,
      toneMapped: false,
    });
    this.rubbingCardCanvas.width = 256;
    this.rubbingCardCanvas.height = 176;
    this.rubbingCardTexture = new CanvasTexture(this.rubbingCardCanvas);
    this.rubbingCardTexture.colorSpace = SRGBColorSpace;
    this.rubbingCardMaterial = new MeshBasicMaterial({
      map: this.rubbingCardTexture,
      side: DoubleSide,
      toneMapped: false,
    });
    const rubbingFace = new Mesh(
      new PlaneGeometry(0.36, 0.26),
      this.rubbingMaterial,
    );
    rubbingFace.name = 'Rubbing face';
    rubbingFace.rotation.x = -Math.PI / 2;
    rubbingFace.position.set(0, 0.848, 0);
    this.rubbingRoot.add(rubbingFace);
    const cardBack = new Mesh(
      new BoxGeometry(0.35, 0.25, 0.012),
      new MeshBasicMaterial({ color: '#3d2f27', toneMapped: false }),
    );
    cardBack.name = 'Rubbing card back';
    cardBack.position.set(-0.36, 1.3, 0.17);
    this.cabinet.add(cardBack);
    const card = new Mesh(
      new PlaneGeometry(0.32, 0.22),
      this.rubbingCardMaterial,
    );
    card.name = 'Your rubbing card';
    card.position.set(-0.36, 1.3, 0.195);
    this.cabinet.add(card);
    this.drawer = this.cabinet.getObjectByName('Specimen drawer 2')!;
    this.mount = this.cabinet.getObjectByName('Archive mount')!;
    this.lamp = this.cabinet.getObjectByName('Inspection lamp')!;
    this.bells = world
      .requireSceneObject('bell-landing')
      .getObjectByName('Sounding bells')!;
    this.skeins = world
      .requireSceneObject('dye-rack')
      .getObjectByName('Hanging skeins')!;
    this.photo.width = 640;
    this.photo.height = 376;
    this.photoTexture = new CanvasTexture(this.photo);
    this.photoTexture.colorSpace = SRGBColorSpace;
    this.photoMaterial = new ShaderMaterial({
      side: DoubleSide,
      uniforms: { photo: { value: this.photoTexture }, rake: { value: 0 } },
      vertexShader: vertex,
      fragmentShader: `
      varying vec2 tex;uniform sampler2D photo;uniform float rake;
      void main(){
        vec3 c=texture2D(photo,tex).rgb;
        float a=dot(c,vec3(.299,.587,.114));
        float b=dot(texture2D(photo,clamp(tex+vec2(.003,.002),0.,1.)).rgb,vec3(.299,.587,.114));
        float wash=.65+.62*(1.-tex.x);
        c=mix(c,c*vec3(wash,wash*.92,wash*.78)+clamp((a-b)*1.5,-.13,.13),rake);
        gl_FragColor=vec4(c,1.);
        #include <colorspace_fragment>
      }`,
    });
    (this.mount.getObjectByName('Archive photograph') as Mesh).material =
      this.photoMaterial;
    const hit = (
      station: number,
      action: number,
      name: string,
      center: number[],
      size: number[],
    ) => {
      const shape = new Mesh(
        new BoxGeometry(size[0], size[1], size[2]),
        this.hitMaterial,
      );
      shape.name = name;
      shape.position.fromArray(center);
      const entity = world.createTransformEntity(shape);
      entity.addComponent(HarborSpot, { station, action });
      this.targets.push({ entity, station, action, name });
    };
    for (let i = 0; i < 3; i++)
      hit(
        4,
        i,
        noteNames[i] + ' water',
        [-3.76 + (i - 1) * 0.53, 0.38, -4.21 + (i === 1 ? -0.12 : 0.05)],
        [0.45, 0.14, 0.4],
      );
    hit(3, 0, 'Bronze bells', [-1.65, 1.12, -4.24], [1, 0.65, 0.17]);
    hit(5, 0, 'Skein wheel', [-5.55, 1.04, -4.28], [1.16, 0.72, 0.19]);
    hit(6, 0, 'Listening horn', [-4.75, 1.26, -5.0], [0.65, 0.9, 0.25]);
    hit(7, 0, 'Rubbing plate', [-6.0, 0.86, -5.0], [0.5, 0.25, 0.35]);
    hit(7, 1, 'Rubbing paper', [-6.0, 0.9, -4.75], [0.4, 0.2, 0.3]);
    hit(8, 0, 'Drawer pull', [-6.93, 0.9, -3.86], [0.3, 0.13, 0.18]);
    hit(8, 3, 'Mounted photograph', [-7.1, 1.3, -4.15], [0.57, 0.34, 0.08]);
    this.restore();
    this.updateRubbingVisuals();
    this.mount.visible = false;
    this.sync();
  }

  private restore() {
    try {
      const data = JSON.parse(localStorage.getItem(FIELD_SAVE) ?? 'null');
      if (!data) return;
      if (Array.isArray(data.phrase))
        for (const n of data.phrase.slice(-8)) {
          if (
            n &&
            Number.isInteger(n.pool) &&
            n.pool >= 0 &&
            n.pool < 3 &&
            Number.isInteger(n.pitch) &&
            n.pitch >= 36 &&
            n.pitch <= 96
          )
            this.phrase.push({ pool: n.pool, pitch: n.pitch });
        }
      if (Array.isArray(data.seen))
        for (const card of this.archive)
          if (data.seen.includes(card.id)) this.seen.add(card.id);
      if (
        Number.isInteger(data.dye) &&
        data.dye >= 0 &&
        data.dye < dyes.length
      ) {
        this.dye = data.dye;
        this.colorFlag(flagDyes[this.dye]);
      }
      if (Number.isInteger(data.tideSuccess) && data.tideSuccess >= 0)
        this.tideSuccess = data.tideSuccess;
      if (Number.isInteger(data.tideVariation) && data.tideVariation >= 0)
        this.tideVariation = data.tideVariation;
      if (
        Number.isInteger(data.rubbing) &&
        data.rubbing >= 0 &&
        data.rubbing < rubbingNames.length
      ) {
        this.rubbingIndex = data.rubbing;
        this.rubbingChoice = data.rubbing;
      }
    } catch {}
  }

  private save() {
    try {
      localStorage.setItem(
        FIELD_SAVE,
        JSON.stringify({
          phrase: this.phrase,
          seen: [...this.seen],
          dye: this.dye,
          tideSuccess: this.tideSuccess,
          tideVariation: this.tideVariation,
          rubbing: this.rubbingIndex,
        }),
      );
    } catch {}
  }

  private drawRubbingPattern(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    index: number,
    color: string,
  ) {
    const cx = width / 2,
      cy = height / 2;
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (index === 0) {
      for (let row = -1; row <= 1; row++) {
        ctx.beginPath();
        for (let x = -100; x <= 100; x += 4) {
          const y = cy + row * 32 + Math.sin((x + 100) * 0.055 + row) * 15;
          if (x === -100) ctx.moveTo(cx + x, y);
          else ctx.lineTo(cx + x, y);
        }
        ctx.stroke();
      }
    } else if (index === 1) {
      for (const offset of [-18, 18]) {
        ctx.beginPath();
        ctx.ellipse(cx + offset, cy, 58, 38, Math.PI / 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(cx - offset, cy, 58, 38, -Math.PI / 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(cx - 60, cy - 50);
      ctx.lineTo(cx + 60, cy + 50);
      ctx.moveTo(cx + 60, cy - 50);
      ctx.lineTo(cx - 60, cy + 50);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(cx, cy - 54);
      ctx.lineTo(cx + 54, cy);
      ctx.lineTo(cx, cy + 54);
      ctx.lineTo(cx - 54, cy);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - 68);
      ctx.lineTo(cx, cy + 68);
      ctx.moveTo(cx - 68, cy);
      ctx.lineTo(cx + 68, cy);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 72, cy + Math.sin(a) * 72);
        ctx.lineTo(cx + Math.cos(a) * 84, cy + Math.sin(a) * 84);
        ctx.stroke();
      }
    }
  }

  private updateRubbingVisuals() {
    const plate = this.rubbingCanvas.getContext('2d')!;
    plate.fillStyle = '#1b3c42';
    plate.fillRect(0, 0, 256, 192);
    plate.strokeStyle = '#d8a75e';
    plate.lineWidth = 5;
    plate.strokeRect(8, 8, 240, 176);
    this.drawRubbingPattern(plate, 256, 160, this.rubbingChoice, '#f1d49a');
    plate.fillStyle = '#f6e6c4';
    plate.textAlign = 'center';
    plate.font = '600 18px system-ui';
    plate.fillText(
      'RUBBING PLATE · ' + rubbingNames[this.rubbingChoice].toUpperCase(),
      128,
      180,
    );
    this.rubbingTexture.needsUpdate = true;

    const card = this.rubbingCardCanvas.getContext('2d')!;
    card.fillStyle = '#f2e3c8';
    card.fillRect(0, 0, 256, 176);
    card.strokeStyle = '#2b5360';
    card.lineWidth = 5;
    card.strokeRect(7, 7, 242, 162);
    card.fillStyle = '#2b5360';
    card.textAlign = 'left';
    card.font = '700 15px system-ui';
    card.fillText('YOUR RUBBING', 18, 29);
    if (this.rubbingIndex >= 0) {
      this.drawRubbingPattern(
        card,
        256,
        120,
        this.rubbingIndex,
        '#9c5b47',
      );
      card.fillStyle = '#2b5360';
      card.font = '600 17px system-ui';
      card.fillText(
        rubbingNames[this.rubbingIndex].toUpperCase() + ' · HAND RUBBING',
        18,
        158,
      );
    } else {
      card.strokeStyle = '#9a8d76';
      card.setLineDash([8, 7]);
      card.strokeRect(34, 45, 188, 84);
      card.setLineDash([]);
      card.fillStyle = '#746b5b';
      card.font = '500 14px system-ui';
      card.fillText('Not taken yet.', 50, 82);
      card.fillText('Visit the Rubbing Table', 50, 103);
    }
    this.rubbingCardTexture.needsUpdate = true;
  }

  private sync() {
    this.board.setValue(HarborDiscovery, 'poolNotes', this.noteCount);
    this.board.setValue(HarborDiscovery, 'inspectedFragments', this.seen.size);
    this.board.setValue(HarborDiscovery, 'cabinetOpen', this.open);
    this.board.setValue(HarborDiscovery, 'rakingLight', this.raking);
    this.board.setValue(HarborDiscovery, 'magnified', this.zoom);
    this.board.setValue(
      HarborDiscovery,
      'phrase',
      this.phrase.map((n) => n.pool + 1).join('·'),
    );
    this.onChange();
  }
  visit(station: number) {
    if (this.station === station) return;
    this.station = station;
    this.board.setValue(HarborDiscovery, 'station', station);
    this.reported = '';
    for (const target of this.targets) {
      if (
        target.station === station &&
        !target.entity.hasComponent(RayInteractable)
      )
        target.entity.addComponent(RayInteractable, {});
      else if (
        target.station !== station &&
        target.entity.hasComponent(RayInteractable)
      )
        target.entity.removeComponent(RayInteractable);
    }
  }
  hitTargets(station: number) {
    return this.targets.filter(
      (t) =>
        t.station === station && (t.name !== 'Mounted photograph' || this.open),
    );
  }
  press(e: Entity) {
    if (e.getValue(HarborSpot, 'station') === this.station)
      this.activate(this.station, e.getValue(HarborSpot, 'action')!);
  }

  actions(station: number): string[] {
    switch (station) {
      case 2:
        return this.phrase.length ? ['Replay tide song'] : [];
      case 3:
        return ['Ring the bells'];
      case 4: {
        const out = [...noteNames];
        if (this.challenge === 'idle' || this.challenge === 'success') {
          if (this.phrase.length) out.push('Replay tide song');
          out.push(
            this.challenge === 'success' || this.tideSuccess > 0
              ? 'New tide variation'
              : 'Start tide challenge',
          );
        } else {
          out.push('Replay motif', 'Stop tide challenge');
        }
        return out;
      }
      case 5:
        return ['Turn dye rack'];
      case 6:
        return [
          this.phrase.length
            ? 'Listen to your tide phrase'
            : 'Hear the harbor welcome',
        ];
      case 7:
        return ['Next pattern', 'Take rubbing'];
      case 8:
        return [
          this.open ? 'Close drawer' : 'Open drawer',
          ...(this.open
            ? [
                'Next textile',
                this.raking ? 'Even light' : 'Raking light',
                this.zoom ? 'Whole textile' : 'Inspect detail',
              ]
            : []),
        ];
      default:
        return [];
    }
  }

  description(station: number) {
    if (station === 3)
      return (
        this.reported ||
        'Three bronze bells mark the entrance to the west quay.'
      );
    if (station === 4) {
      if (this.challengeMessage !== '') return this.challengeMessage;
      if (this.challenge === 'listen')
        return 'Listen to the motif: three pools, four notes.';
      if (this.challenge === 'attempt')
        return `${this.attempt.length}/${this.motif.length} notes. Echo the motif; a wrong note resets the attempt.`;
      if (this.challenge === 'success')
        return 'Motif matched. The harbor remembers. Start a new variation or return to free play.';
      if (this.phrase.length)
        return 'Tide song · ' + this.phrase.map((n) => n.pool + 1).join(' · ');
      return 'Strike a pool to compose, or start the optional tide challenge.';
    }
    if (station === 5)
      return this.dye < 0
        ? 'Choose a dye for your signal flag.'
        : dyes[this.dye] + ' dye on the signal flag.';
    if (station === 6)
      return this.phrase.length
        ? 'Your tide phrase will answer across the boardwalk.'
        : 'The post answers with the harbor welcome. Strike the tide pools to leave your own phrase.';
    if (station === 7) {
      const name = rubbingNames[this.rubbingChoice];
      return this.rubbingIndex >= 0
        ? `Pattern: ${name}. Your ${rubbingNames[this.rubbingIndex]} rubbing is waiting at the cabinet.`
        : `Pattern: ${name}. Take a rubbing, then find it at the cabinet.`;
    }
    if (station === 8) {
      if (!this.open)
        return 'Open the specimen drawer to inspect a mounted textile photograph or your own rubbing.';
      const a = this.archive[this.selected];
      const credit = [
        a.source,
        a.date,
        a.institution,
        a.license,
        this.raking ? 'Simulated raking light' : 'Even light',
        this.zoom ? 'Detail crop' : 'Whole image',
      ].join(' · ');
      return this.rubbingIndex >= 0
        ? `Your ${rubbingNames[this.rubbingIndex]} rubbing · ${credit}`
        : credit;
    }
    return this.reported;
  }
  hasTideSuccess(): boolean {
    return this.tideSuccess > 0;
  }

  private startChallenge(): void {
    this.challenge = 'listen';
    this.challengeMessage = '';
    this.challengeMessageTimer = 0;
    this.attempt = [];
    const motifs = [
      [0, 2, 1, 2],
      [2, 1, 0, 1],
      [1, 0, 2, 0],
      [0, 1, 2, 1],
    ];
    this.motif = motifs[this.tideVariation % motifs.length].slice();
    this.playMotif();
  }

  private playMotif(): void {
    this.challenge = 'listen';
    this.challengeMessage = '';
    this.challengeMessageTimer = 0;
    this.attempt = [];
    this.playback = this.motif.map((pool) => ({
      pool,
      pitch: this.basePitch() + [0, 4, 7][pool],
    }));
    this.playbackAge = 0;
    this.playhead = 0;
    this.playback.forEach((note, index) =>
      this.sound(note.pitch, 0.082, index * 0.26, 0.9),
    );
    this.challengeTimer = this.motif.length * 0.26 + 0.55;
    this.reported =
      'Listen and watch the pools. Then echo the motif on the same three pools.';
    this.sync();
  }

  private checkAttempt(): void {
    const index = this.attempt.length - 1;
    if (this.attempt[index] !== this.motif[index]) {
      this.attempt = [];
      this.challenge = 'attempt';
      this.challengeMessage =
        'Not quite — the attempt resets. Press Replay motif to hear it again.';
      this.challengeMessageTimer = 4;
      this.reported = this.challengeMessage;
      this.sound(this.basePitch() + 1, 0.05, 0, 0.3);
      this.sync();
      return;
    }
    if (this.attempt.length === this.motif.length) {
      this.challenge = 'success';
      this.tideSuccess += 1;
      this.tideVariation += 1;
      this.save();
      this.challengeMessage = '';
    this.challengeMessageTimer = 0;
    this.reported =
      'Motif matched. The harbor remembers. Start a new variation or return to free play.';
      this.ages.set(0, 0, 0);
      [0, 4, 7, 12].forEach((step, i) =>
        this.sound(this.basePitch() + step, 0.07, i * 0.13, 1.0),
      );
      this.challengeWin();
      this.sync();
      return;
    }
    this.reported = `${this.attempt.length}/${this.motif.length} notes matched. Keep going.`;
    this.sync();
  }

  activate(station: number, index: number) {
    if (index < 0 || index >= this.actions(station).length) return;
    if (station === 4) {
      const action = this.actions(4)[index];
      if (index < 3) {
        const note = {
          pool: index,
          pitch: this.basePitch() + [0, 4, 7][index],
        };
        this.ages.setComponent(index, 0);
        this.sound(note.pitch, 0.09, 0, 1.1);
        if (this.challenge === 'listen') {
          this.reported = 'Listen first — the motif is still playing.';
          this.sync();
          return;
        }
        if (this.challenge === 'attempt') {
          this.challengeMessage = '';
          this.challengeMessageTimer = 0;
          this.attempt.push(index);
          this.checkAttempt();
          return;
        }
        if (this.challenge === 'success') {
          // A free strike is the player leaving the success card and returning
          // to composition; show the phrase immediately, not the old win text.
          this.challenge = 'idle';
          this.challengeMessage = '';
          this.challengeMessageTimer = 0;
        }
        this.phrase.push(note);
        if (this.phrase.length > 8) this.phrase.shift();
        this.noteCount++;
        this.save();
      } else if (action === 'Replay tide song') {
        if (this.challenge === 'success') this.challenge = 'idle';
        if (
          performance.now() - this.lastReplay <
          260 * this.playback.length + 600
        )
          return;
        this.lastReplay = performance.now();
        this.playback = this.phrase.slice();
        this.playbackAge = 0;
        this.playhead = 0;
        this.playback.forEach((n, i) =>
          this.sound(n.pitch, 0.074, i * 0.26, 0.8),
        );
        this.reported =
          'Your tide song is playing. Watch the silver shoal surface on each note.';
      } else if (action === 'Replay motif') {
        this.playMotif();
      } else if (
        action === 'Start tide challenge' ||
        action === 'New tide variation'
      ) {
        this.startChallenge();
      } else if (action === 'Stop tide challenge') {
        this.challenge = 'idle';
        this.attempt = [];
        this.challengeTimer = 0;
        this.reported = 'Free play: strike the pools to compose.';
      }
    } else if (station === 2) {
      if (
        performance.now() - this.lastReplay <
        260 * this.playback.length + 600
      )
        return;
      this.lastReplay = performance.now();
      this.playback = this.phrase.slice();
      this.playbackAge = 0;
      this.playhead = 0;
      this.playback.forEach((n, i) =>
        this.sound(n.pitch, 0.074, i * 0.26, 0.8),
      );
      this.reported =
        'Your tide song is playing. Watch the silver shoal surface on each note.';
    } else if (station === 3) {
      this.bellAge = 0;
      [67, 74, 79].forEach((n, i) => this.sound(n, 0.067, i * 0.14, 1.28));
      this.reported = 'The three bells sound across the inlet.';
    } else if (station === 5) {
      this.dye = (this.dye + 1) % dyes.length;
      this.dyeAge = 0;
      this.colorFlag(flagDyes[this.dye]);
      this.save();
    } else if (station === 6) {
      const notes = this.phrase.length
        ? this.phrase.slice()
        : [
            { pool: 0, pitch: this.basePitch() },
            { pool: 2, pitch: this.basePitch() + 7 },
            { pool: 1, pitch: this.basePitch() + 4 },
            { pool: 0, pitch: this.basePitch() },
          ];
      notes.forEach((note, i) =>
        this.sound(note.pitch, 0.082, i * 0.26, 0.9),
      );
      this.listeningAge = 0;
      this.reported = this.phrase.length
        ? 'Your tide phrase answers across the boardwalk.'
        : 'The post answers with the harbor welcome. Strike the tide pools to leave your own phrase.';
    } else if (station === 7) {
      if (index === 0) {
        this.rubbingChoice = (this.rubbingChoice + 1) % rubbingNames.length;
        this.reported = 'Pattern selected: ' + rubbingNames[this.rubbingChoice] + '.';
      } else {
        this.rubbingIndex = this.rubbingChoice;
        this.reported =
          'You take a ' +
          rubbingNames[this.rubbingIndex] +
          ' rubbing. It is waiting at the cabinet.';
        this.save();
      }
      this.updateRubbingVisuals();
    } else if (station === 8) {
      if (index === 0) this.open = !this.open;
      if (index === 1) {
        this.selected = (this.selected + 1) % this.archive.length;
        this.zoom = false;
      }
      if (index === 2) this.raking = !this.raking;
      if (index === 3) this.zoom = !this.zoom;
      this.mount.visible = this.open;
      this.drawer.position.z = this.open ? 0.425 : 0.265;
      this.lamp.rotation.y = this.raking ? 1.04 : -0.15;
      this.photoMaterial.uniforms.rake.value = this.raking ? 1 : 0;
      if (this.open) {
        this.seen.add(this.archive[this.selected].id);
        this.drawPhoto();
        this.save();
      }
    }
    this.sync();
  }

  private drawPhoto() {
    const img = this.images.get(this.archive[this.selected].id);
    const ctx = this.photo.getContext('2d')!;
    ctx.fillStyle = '#e7d7b8';
    ctx.fillRect(0, 0, 640, 376);
    this.pendingPhoto = null;
    if (img && img.naturalWidth > 0) {
      let w = img.naturalWidth,
        h = img.naturalHeight;
      if (this.zoom) {
        w *= 0.42;
        h *= 0.42;
      }
      const scale = Math.min(620 / w, 358 / h);
      ctx.drawImage(
        img,
        (img.naturalWidth - w) / 2,
        (img.naturalHeight - h) / 2,
        w,
        h,
        (640 - w * scale) / 2,
        (376 - h * scale) / 2,
        w * scale,
        h * scale,
      );
    } else if (img) {
      this.pendingPhoto = img;
    }
    this.photoTexture.needsUpdate = true;
  }
  update(dt: number) {
    if (this.challengeMessageTimer > 0) {
      this.challengeMessageTimer -= dt;
      if (this.challengeMessageTimer <= 0) {
        this.challengeMessage = '';
        this.sync();
      }
    }
    if (this.challengeTimer > 0) {
      this.challengeTimer -= dt;
      if (this.challengeTimer <= 0 && this.challenge === 'listen') {
        this.challenge = 'attempt';
        this.reported = 'Your turn: echo the motif on the same three pools.';
        this.sync();
      }
    }
    if (this.pendingPhoto?.naturalWidth) this.drawPhoto();
    const step = Math.min(0.12, dt);
    this.playbackAge += dt;
    while (
      this.playhead < this.playback.length &&
      this.playbackAge >= this.playhead * 0.26
    ) {
      this.ages.setComponent(this.playback[this.playhead++].pool, 0);
    }
    for (let i = 0; i < 3; i++)
      this.ages.setComponent(i, Math.min(10, this.ages.getComponent(i) + step));
    if (!this.reducedMotion)
      for (const water of this.waters) water.uniforms.clock.value += step;
    this.shoal.visible = Math.min(this.ages.x, this.ages.y, this.ages.z) < 1.65;
    if (this.shoal.visible) this.shoalMaterial.uniforms.clock.value += step;
    this.bellAge += step;
    this.dyeAge += step;
    this.listeningAge += step;
    if (this.listeningAge < 4)
      this.chimes.rotation.z =
        Math.sin(this.listeningAge * 8) *
        Math.exp(-this.listeningAge * 1.2) *
        0.22;
    if (!this.reducedMotion) {
      if (this.bellAge < 5)
        this.bells.rotation.z =
          Math.sin(this.bellAge * 9) * Math.exp(-this.bellAge * 1.6) * 0.2;
      if (this.dyeAge < 5)
        this.skeins.rotation.x =
          Math.sin(this.dyeAge * 6) * Math.exp(-this.dyeAge) * 0.32;
    }
  }
  dispose() {
    this.shoalMaterial.dispose();
    this.hitMaterial.dispose();
    this.waters.forEach((m) => m.dispose());
    this.photoTexture.dispose();
    this.photoMaterial.dispose();
    this.rubbingTexture.dispose();
    this.rubbingMaterial.dispose();
    this.rubbingCardTexture.dispose();
    this.rubbingCardMaterial.dispose();
  }
}
