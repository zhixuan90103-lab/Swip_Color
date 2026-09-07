/**
 * Boot: adapt + WebGPU stage. 玩法尚未接入（规范见 docs/ICE-PUZZLE.md）。
 */

import * as THREE from 'three';
import { Capacitor } from '@capacitor/core';
import {
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  applyStageTransform,
  computeStageLayout,
  watchStageLayout,
  type StageLayout,
} from './adapt/design';
import { mountDevicePreview } from './adapt/devicePreview';
import { applyNativeClass, applySafeAreaCssVars } from './adapt/safeArea';
import { audio } from './audio/AudioManager';
import { createRenderer, resizeToDesign } from './create-renderer';
import { haptics } from './utils/haptics';

async function boot(): Promise<void> {
  applyNativeClass();

  const shell = document.getElementById('shell')!;
  const viewportEl = document.getElementById('viewport')!;
  const stage = document.getElementById('stage')!;
  const uiRoot = document.getElementById('ui-root')!;

  const renderer = await createRenderer({ container: stage });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xfaf8ef);
  const camera = new THREE.OrthographicCamera(
    0,
    DESIGN_WIDTH,
    DESIGN_HEIGHT,
    0,
    -1,
    1,
  );

  const onLayout = (layout: StageLayout) => {
    applyStageTransform(stage, layout);
    applySafeAreaCssVars(Capacitor.isNativePlatform());
    renderer.setSize(DESIGN_WIDTH, DESIGN_HEIGHT, false);
    resizeToDesign(renderer);
  };

  const preview = mountDevicePreview(shell, viewportEl, () => {
    const size = preview.getViewSize();
    onLayout(computeStageLayout(size.width, size.height, 'contain'));
  });

  const unwatch = watchStageLayout(onLayout, {
    mode: 'contain',
    getViewSize: () => preview.getViewSize(),
  });

  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock, { once: true, capture: true });
  void audio.preload();

  uiRoot.innerHTML = `
    <div class="panel shell-hud">
      <p class="status" id="haptic-status">plugin: ${String(haptics.isPluginAvailable())}</p>
      <button type="button" class="haptic-primary" id="haptic-tap">点我震动</button>
    </div>
  `;
  uiRoot.querySelector('#haptic-tap')!.addEventListener('click', () => {
    void haptics.impact('medium').then((r) => {
      const el = document.getElementById('haptic-status');
      if (el) {
        el.textContent = `plugin: ${String(haptics.isPluginAvailable())} ${r.ok ? 'ok' : (r.reason ?? '')}`;
      }
    });
  });

  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });

  window.addEventListener(
    'pagehide',
    () => {
      audio.dispose();
      unwatch();
      preview.dispose();
      renderer.setAnimationLoop(null);
      renderer.dispose();
    },
    { once: true },
  );
}

boot().catch((err) => {
  console.error(err);
});
