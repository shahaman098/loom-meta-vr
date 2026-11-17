/**
 * 2D entry screen. WebXR requires a user gesture before an immersive session
 * can start, and the experience itself has no 2D controls, so the page needs
 * one clear "Enter VR" action before handing over to the loom.
 */

import { VisibilityState } from '@iwsdk/core';
import type { World } from '@iwsdk/core';

const STYLE_ID = 'loom-entry-style';

function injectStyle(): void {
  if (document.getElementById(STYLE_ID) != null) {
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #loom-entry {
      position: fixed;
      inset: 0;
      z-index: 20;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 22px;
      background:
        radial-gradient(circle at 50% 42%, rgba(46, 78, 128, 0.38), transparent 58%),
        radial-gradient(circle at 50% 100%, rgba(255, 176, 92, 0.10), transparent 46%),
        #05080f;
      color: #f4e6c9;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      text-align: center;
      padding: 32px;
      transition: opacity 320ms ease;
    }
    #loom-entry .eyebrow {
      font-size: 12px;
      letter-spacing: 0.34em;
      text-transform: uppercase;
      color: #7e93b6;
    }
    #loom-entry h1 {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      font-size: clamp(64px, 14vw, 132px);
      line-height: 0.9;
      letter-spacing: 0.02em;
      color: #f4e6c9;
      text-shadow: 0 0 42px rgba(255, 192, 106, 0.18);
    }
    #loom-entry .tagline {
      margin: 0;
      max-width: 520px;
      font-size: 17px;
      line-height: 1.55;
      color: #a9bbd6;
    }
    #loom-entry .rule {
      width: min(320px, 60vw);
      height: 1px;
      background: linear-gradient(90deg, transparent, #5ce1e6, #ffc06a, transparent);
      opacity: 0.7;
    }
    #loom-entry button {
      appearance: none;
      border: 1px solid rgba(255, 192, 106, 0.65);
      background: rgba(255, 192, 106, 0.08);
      color: #ffe6b8;
      font: 600 16px/1 ui-sans-serif, system-ui, sans-serif;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: 18px 38px;
      border-radius: 999px;
      cursor: pointer;
      transition: background 160ms ease, transform 160ms ease, box-shadow 160ms ease;
    }
    #loom-entry button:hover {
      background: rgba(255, 192, 106, 0.18);
      transform: translateY(-1px);
      box-shadow: 0 10px 34px rgba(255, 176, 92, 0.16);
    }
    #loom-entry button:active {
      transform: translateY(0);
    }
    #loom-entry .quiet {
      appearance: none;
      border: 0;
      background: transparent;
      color: #6f84a8;
      font: 500 13px/1 ui-sans-serif, system-ui, sans-serif;
      letter-spacing: 0.08em;
      text-transform: none;
      padding: 6px 10px;
      cursor: pointer;
      text-decoration: underline;
      text-underline-offset: 4px;
    }
    #loom-entry .foot {
      font-size: 12px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #54688a;
    }
    #loom-entry .status {
      min-height: 18px;
      font-size: 13px;
      color: #ffb35c;
    }
  `;
  document.head.appendChild(style);
}

export function installEntryOverlay(world: World): void {
  injectStyle();

  const overlay = document.createElement('div');
  overlay.id = 'loom-entry';
  overlay.innerHTML = `
    <div class="eyebrow">Meta VR Start 2026</div>
    <h1>LOOM</h1>
    <p class="tagline">
      Pinch a brass peg. Pull a glowing thread. Release.
      Weave a living tapestry with your hands — no controllers, no menus.
    </p>
    <div class="rule"></div>
    <button id="loom-enter" type="button">Enter VR</button>
    <div class="status" id="loom-entry-status"></div>
    <div class="foot">Seated &middot; Hands only &middot; 5&ndash;10 minutes</div>
    <button class="quiet" id="loom-preview" type="button">Preview on this screen</button>
  `;
  document.body.appendChild(overlay);

  const enter = overlay.querySelector<HTMLButtonElement>('#loom-enter')!;
  const preview = overlay.querySelector<HTMLButtonElement>('#loom-preview')!;
  const status = overlay.querySelector<HTMLDivElement>('#loom-entry-status')!;

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
    overlay.style.display = 'flex';
    overlay.style.pointerEvents = 'auto';
    overlay.style.opacity = '1';
  };

  const hasXR =
    typeof navigator !== 'undefined' &&
    'xr' in navigator &&
    (navigator as Navigator & { xr?: unknown }).xr != null;

  if (!world.xrEnabled || !hasXR) {
    enter.textContent = 'Open on Meta Quest';
    status.textContent = hasXR
      ? 'This build has XR disabled.'
      : 'VR needs Meta Quest Browser or another WebXR browser.';
    preview.textContent = 'Preview the loom on this screen';
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
  });

  const onVisibility = (visibilityState: VisibilityState) => {
    if (visibilityState === VisibilityState.NonImmersive) {
      show();
    } else {
      hide();
    }
  };

  onVisibility(world.visibilityState.value);
  world.visibilityState.subscribe(onVisibility);
}
