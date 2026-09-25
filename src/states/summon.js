/**
 * states/summon.js — Summon (fall-from-sky entrance) physics.
 */
import { AIR_DRAG } from '../constants.js';

export function updateSummon(self) {
  if (!self._summonFalling) return; // landed phase plays via AnimatedSprite

  const pet = self.sprite;

  // Gravity (slightly heavier than drag-fall for more impact)
  self._summonFallVel += 0.8;
  pet.y += self._summonFallVel;
  self._summonFallVel *= AIR_DRAG;

  // Floor collision
  const floor = window.innerHeight;
  if (pet.y >= floor) {
    pet.y = floor;
    self._summonFallVel = 0;
    self._summonFalling = false;
    self._summonStage   = 'landed';

    // Play the full landed+wave sequence as a SINGLE one-shot.
    pet.textures       = self.animations.summon_landed;
    pet.loop           = false;
    pet.animationSpeed = 0.08;
    pet.gotoAndPlay(0);

    // Show the wave bubble as soon as landing starts
    self.waveBubble.setText('Hi Meow! 👋');
    self.waveBubble.show();
  }
}
