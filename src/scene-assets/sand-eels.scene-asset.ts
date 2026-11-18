import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  ShaderMaterial,
  Vector3,
} from '@iwsdk/core';
import { makeRandom } from './lib/hardsurface.js';

/** Sixty-four fish reuse one fork-tailed body. Three voices surface in time
 * with the player's phrase. Instance translations carry the schooling offsets. */
export function createShoal() {
  const positions: number[] = [],
    colors: number[] = [];
  const p = (a: number[], b: number[], c: number[], color: string) => {
    const k = new Color(color);
    positions.push(...a, ...b, ...c);
    for (let j = 0; j < 3; j++) colors.push(k.r, k.g, k.b);
  };
  const sections = [
    [0.13, 0.004, 0.006],
    [0.088, 0.024, 0.03],
    [0.018, 0.03, 0.043],
    [-0.072, 0.015, 0.025],
    [-0.112, 0.006, 0.008],
  ];
  for (let i = 0; i < sections.length - 1; i++) {
    const [x, r, h] = sections[i],
      [nx, nr, nh] = sections[i + 1];
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4,
        b = ((k + 1) * Math.PI) / 4;
      const v = [x, Math.sin(a) * h, Math.cos(a) * r],
        w = [x, Math.sin(b) * h, Math.cos(b) * r];
      const u = [nx, Math.sin(a) * nh, Math.cos(a) * nr],
        z = [nx, Math.sin(b) * nh, Math.cos(b) * nr];
      const color = [
        '#cae4ce',
        '#638c92',
        '#54858b',
        '#b8dbcc',
        '#dfcea5',
        '#efdeb0',
        '#e7e4c9',
        '#e9f3d5',
      ][k];
      p(v, w, u, color);
      p(w, z, u, color);
    }
  }
  p([-0.108, 0, 0], [-0.161, 0.048, 0.004], [-0.148, 0.005, 0], '#c5bb8d');
  p([-0.108, 0, 0], [-0.148, 0.005, 0], [-0.161, -0.04, 0.004], '#e6d9a4');
  p([0.01, 0.035, 0], [-0.037, 0.07, 0], [-0.055, 0.027, 0], '#879fa0');
  for (const z of [-0.024, 0.024])
    p([0.074, 0.016, z], [0.085, 0.023, z], [0.09, 0.009, z], '#24383a');
  const shape = new BufferGeometry();
  shape.setAttribute('position', new Float32BufferAttribute(positions, 3));
  shape.setAttribute('color', new Float32BufferAttribute(colors, 3));
  const mat = new ShaderMaterial({
    vertexColors: true,
    side: DoubleSide,
    uniforms: { ages: { value: new Vector3(10, 10, 10) }, clock: { value: 0 } },
    vertexShader: `
    uniform vec3 ages;uniform float clock;varying vec3 tint;
    void main(){
      tint=color;
      vec3 seed=instanceMatrix[3].xyz;
      int voice=int(mod(float(gl_InstanceID),3.));
      float age=ages[voice],phase=clamp((age-seed.y*.19)/1.28,0.,1.);
      float arc=sin(phase*3.14159);
      float pitch=cos(phase*3.14159)*.72;
      vec3 fish=position;
      fish.z+=sin(clock*15.+seed.x*3.+position.x*48.)*(1.-smoothstep(-.13,.06,position.x))*.022;
      fish.xy=mat2(cos(pitch),sin(pitch),-sin(pitch),cos(pitch))*fish.xy;
      vec3 pen=vec3(seed.x+(phase-.5)*1.12, -.26+arc*(.38+.16*float(voice)),-.25+seed.z);
      pen.y-=.17*(1.-smoothstep(0.,.08,arc));
      gl_Position=projectionMatrix*modelViewMatrix*vec4(pen+fish,1.);
    }`,
    fragmentShader: `varying vec3 tint;void main(){gl_FragColor=vec4(tint,1.);
      #include <colorspace_fragment>
    }`,
  });
  const fish = new InstancedMesh(shape, mat, 64);
  fish.name = 'Silver shoal';
  const rng = makeRandom(639);
  for (let i = 0; i < fish.count; i++)
    fish.setMatrixAt(
      i,
      new Matrix4().makeTranslation(
        (rng() - 0.5) * 2.7,
        rng(),
        (rng() - 0.5) * 0.8,
      ),
    );
  fish.frustumCulled = false;
  return fish;
}
