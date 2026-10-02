/**
 * main.js — Sandbox entry-point (npm run dev).
 *
 * The pet starts in auto-pilot. Right-click it for the menu
 * (avatar · chat · settings · exit). Chat answers from
 * /petfolio-knowledgeBase.json — generate yours with `petfolio-cli`.
 */
import { Petfolio } from './Petfolio.js';

const pet = new Petfolio(document.getElementById('canvas'), {
  ai: { knowledge: '/petfolio-knowledgeBase.json' },
});
window.pet = pet;
pet.startAuto();
