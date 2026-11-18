/**
 * 2D entry screen. WebXR requires a user gesture before an immersive session
 * can start. The entry screen also opens the desktop weaving experience.
 */

import './harbor.css';
import { VisibilityState } from '@iwsdk/core';
import type { World } from '@iwsdk/core';

export function installEntryOverlay(world: World): void {
  const menuCamera = () => {
    if (world.session) return;
    world.camera.position.set(-1.55, 1.38, 1.85);
    world.camera.lookAt(.38, 1.18, -3.8);
  };

  const overlay = document.createElement('div');
  overlay.id = 'loom-entry';
  overlay.innerHTML = `
    <main class="entry-card">
      <p class="entry-place">Selvedge Harbor</p>
      <h1>Loom</h1>
      <p class="subtitle">The tapestry that sings</p>
      <p class="tagline">Weave a score from brass peg to brass peg. Light the beacon, send the cutters to sea, and listen as the harbor sings your pattern.</p>
      <div class="entry-actions">
        <button id="loom-preview" type="button">Play on this screen</button>
        <button id="loom-enter" type="button">Enter VR</button>
      </div>
      <p class="status" id="loom-entry-status" role="status"></p>
      <p class="streak" id="loom-streak"></p>
      <div class="entry-settings">
        <button id="loom-contrast" type="button">High contrast</button>
        <button id="loom-demo" type="button" hidden>Free Weave demo</button>
        <button id="loom-reset" type="button">Reset progress</button>
      </div>
    </main>
  `;
  document.body.appendChild(overlay);

  const enter = overlay.querySelector<HTMLButtonElement>('#loom-enter')!;
  const preview = overlay.querySelector<HTMLButtonElement>('#loom-preview')!;
  const contrast = overlay.querySelector<HTMLButtonElement>('#loom-contrast')!;
  const reset = overlay.querySelector<HTMLButtonElement>('#loom-reset')!;
  const demo = overlay.querySelector<HTMLButtonElement>('#loom-demo')!;
  const status = overlay.querySelector<HTMLDivElement>('#loom-entry-status')!;
  if (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) {
    demo.hidden = false;
  }
  const streakEl = overlay.querySelector<HTMLDivElement>('#loom-streak')!;
  try {
    const raw = window.localStorage.getItem('loom.progress.v1');
    if (raw != null) {
      const saved = JSON.parse(raw) as { streak?: unknown };
      if (
        typeof saved.streak === 'number' &&
        Number.isFinite(saved.streak) &&
        saved.streak > 1
      ) {
        streakEl.textContent = `${Math.floor(saved.streak)}-day weave streak`;
      }
    }
  } catch {
    // The streak is a bonus; failure to read it should not block entry.
  }
  const highContrastKey = 'loom.a11y.highContrast';
  const contrastOn = (): boolean => {
    try {
      return window.localStorage.getItem(highContrastKey) === '1';
    } catch {
      return false;
    }
  };
  contrast.textContent = contrastOn()
    ? 'High contrast: on'
    : 'High contrast: off';

  let hideTimer: number | null = null;

  const hide = () => {
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    if (hideTimer != null) {
      window.clearTimeout(hideTimer);
    }
    hideTimer = window.setTimeout(() => {
      overlay.style.display = 'none';
      hideTimer = null;
    }, 340);
  };

  const show = () => {
    if (hideTimer != null) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
    overlay.style.display = '';
    menuCamera();
    overlay.style.pointerEvents = 'auto';
    overlay.style.opacity = '1';
  };

  // XR support depends on the device even when navigator.xr exists.
  enter.hidden = true;
  if (world.xrEnabled && navigator.xr) {
    void navigator.xr.isSessionSupported('immersive-vr').then(supported => {
      enter.hidden = !supported;
      if (supported) enter.parentElement!.prepend(enter);
    }).catch(() => {});
  }

  enter.addEventListener('click', () => {
    status.textContent = '';
    try {
      world.launchXR();
    } catch (error) {
      status.textContent = 'Could not start VR. Open this page in Meta Quest Browser.';
      console.warn('[loom] launchXR failed', error);
    }
  });

  preview.addEventListener('click', () => {
    hide();
    window.dispatchEvent(new Event('loom-play'));
  });

  contrast.addEventListener('click', () => {
    try {
      window.localStorage.setItem(
        highContrastKey,
        contrastOn() ? '0' : '1',
      );
    } catch {
      // The card still renders; only the preference cannot be saved.
    }
    window.location.reload();
  });

  demo.addEventListener('click', () => {
    window.location.search = '?demo=free';
  });

  reset.addEventListener('click', () => {
    try {
      window.localStorage.removeItem('loom.progress.v1');
    } catch {
      // Storage may be unavailable; reloading still starts a fresh session.
    }
    window.location.reload();
  });

  window.addEventListener('loom-menu', () => { show(); preview.focus(); });
  const onVisibility = (visibilityState: VisibilityState) => {
    if (visibilityState === VisibilityState.NonImmersive) {
      show();
    } else {
      window.dispatchEvent(new Event('loom-close-walk'));
      hide();
    }
  };

  onVisibility(world.visibilityState.value);
  world.visibilityState.subscribe(onVisibility);
}
