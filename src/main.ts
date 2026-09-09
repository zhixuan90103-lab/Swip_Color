/**
 * Boot: adapt + WebGPU stage + ice puzzle on #ui-root.
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
import { startIceGame } from './game/iceGame';

async function boot(): Promise<void> {
  applyNativeClass();

  const shell = document.getElementById('shell')!;
  const viewportEl = document.getElementById('viewport')!;
  const stage = document.getElementById('stage')!;
  const uiRoot = document.getElementById('ui-root')!;

  const renderer = await createRenderer({ container: stage, antialias: false });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf3eadc);
  const camera = new THREE.OrthographicCamera(
    0,
    DESIGN_WIDTH,
    DESIGN_HEIGHT,
    0,
    -1,
    1,
  );

  const paintStage = () => {
    renderer.render(scene, camera);
  };

  const onLayout = (layout: StageLayout) => {
    applyStageTransform(stage, layout);
    applySafeAreaCssVars(Capacitor.isNativePlatform());
    renderer.setSize(DESIGN_WIDTH, DESIGN_HEIGHT, false);
    resizeToDesign(renderer);
    paintStage();
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

  const game = startIceGame({ uiRoot, stage });
  paintStage();

  window.addEventListener(
    'pagehide',
    () => {
      game.dispose();
      audio.dispose();
      unwatch();
      preview.dispose();
      renderer.dispose();
    },
    { once: true },
  );
}

boot().catch((err) => {
  console.error(err);
});
