import { haptics } from '../utils/haptics';
import type { HapticEvent } from '../utils/haptics';
import {
  HAPTIC_COOLDOWN,
  HAPTIC_JELLY_INTENSITY,
  HAPTIC_JELLY_MS,
  HAPTIC_JELLY_SHARPNESS,
  HAPTIC_NUDGE_INTENSITY,
  HAPTIC_SHARPNESS,
  HAPTIC_STAR_INTENSITY,
  type HapticSurface,
  type LandFeel,
} from './hapticFeel';

const lastAt: Record<string, number> = {};

function cooled(key: string, ms: number, now = performance.now()): boolean {
  if (now - (lastAt[key] ?? 0) < ms) return false;
  lastAt[key] = now;
  return true;
}

function playLand(feel: LandFeel): void {
  if (feel.jelly) {
    const dur = HAPTIC_JELLY_MS / 1000;
    const events: HapticEvent[] = [
      {
        type: 'transient',
        relativeTime: 0,
        intensity: feel.intensity,
        sharpness: feel.sharpness,
      },
      {
        type: 'continuous',
        relativeTime: 0,
        duration: dur,
        intensity: HAPTIC_JELLY_INTENSITY,
        sharpness: HAPTIC_JELLY_SHARPNESS,
      },
    ];
    void haptics.playPattern(events, [
      {
        parameterID: 'hapticIntensity',
        relativeTime: 0,
        controlPoints: [
          { relativeTime: 0, parameterValue: 1 },
          { relativeTime: dur, parameterValue: 0 },
        ],
      },
    ]);
    return;
  }
  void haptics.stackImpact(feel.intensity, feel.sharpness);
}

export const gameHaptics = {
  land(feel: LandFeel) {
    if (!cooled('land', HAPTIC_COOLDOWN.land)) return;
    playLand(feel);
  },

  nudge() {
    if (!cooled('nudge', HAPTIC_COOLDOWN.nudge)) return;
    void haptics.stackImpact(HAPTIC_NUDGE_INTENSITY, HAPTIC_SHARPNESS.nudge);
  },

  star() {
    if (!cooled('star', HAPTIC_COOLDOWN.star)) return;
    void haptics.stackImpact(HAPTIC_STAR_INTENSITY, HAPTIC_SHARPNESS.star);
  },

  clear() {
    if (!cooled('clear', HAPTIC_COOLDOWN.clear)) return;
    void haptics.notification('success');
  },
};

export type { HapticSurface };
