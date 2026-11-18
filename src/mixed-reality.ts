import type { World } from '@iwsdk/core';

// In a passthrough (immersive-ar) session the player's real room replaces the
// harbor: only the loom on its table, the pattern card and the lights stay.
const KEEP = new Set([
  'loom-table',
  'loom-board',
  'loom-card',
  'loom-key-light',
  'loom-rim-light',
  'loom-fill-light',
]);
const HIDE = [
  'selvedge-harbor',
  'loom-floor',
  'west-pier',
  'boardwalk-loop',
  'bell-landing',
  'tide-pools',
  'dye-rack',
  'listening-post',
  'rubbing-table',
  'conservation-cabinet',
  'silver-shoal',
];

let mixedReality = false;

export const isMixedReality = (): boolean => mixedReality;

export function enterMixedReality(world: World): void {
  world.launchXR({ sessionMode: 'immersive-ar' as never });
}

export function installMixedReality(world: World): void {
  const renderer = world.renderer;
  const hidden: Array<{ object: { visible: boolean }; was: boolean }> = [];
  let background: unknown = null;

  const apply = () => {
    const session = renderer.xr.getSession();
    const mode = session?.environmentBlendMode;
    if (session == null || mode == null || mode === 'opaque') return;
    // apply() runs at sessionstart and again shortly after; hide only once so
    // restore() never re-hides what it should show.
    if (mixedReality) return;
    mixedReality = true;
    document.documentElement.dataset.loomMode = 'mr';
    for (const id of HIDE) {
      if (KEEP.has(id)) continue;
      try {
        const object = world.requireSceneEntity(id).object3D;
        if (object != null) {
          hidden.push({ object, was: object.visible });
          object.visible = false;
        }
      } catch {
        // Node missing from this scene; nothing to hide.
      }
    }
    // The gradient dome is drawn as scene children outside the authored nodes.
    world.scene.traverse((object) => {
      if (/dome|sky/i.test(object.name) && object.visible) {
        hidden.push({ object, was: true });
        object.visible = false;
      }
    });
    background = world.scene.background;
    world.scene.background = null;
    renderer.setClearAlpha(0);
  };

  const restore = () => {
    if (!mixedReality) return;
    mixedReality = false;
    delete document.documentElement.dataset.loomMode;
    for (const { object, was } of hidden.splice(0)) object.visible = was;
    world.scene.background = background as typeof world.scene.background;
    renderer.setClearAlpha(1);
  };

  renderer.xr.addEventListener('sessionstart', () => {
    // environmentBlendMode is readable once the session exists.
    apply();
    window.setTimeout(apply, 250);
  });
  renderer.xr.addEventListener('sessionend', restore);
}
