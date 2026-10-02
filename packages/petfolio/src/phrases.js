/**
 * phrases.js — Cute one-liners the pet says (SayHi greeting + random chatter).
 * Keep them short: they have to fit in a small speech bubble.
 */
export const DEFAULT_PHRASES = [
  'Hi hi! 💕', 'Hehe~', 'Boop! 🐾', 'You got this! 💪', 'Yay! 🎉',
  'You look great today ✨', 'Psst… I like you 💗', 'La la la~ 🎵', 'Snack time? 🍪',
  'Drink some water! 💧', 'Take a little break? ☕', 'Need a hug? 🤗', 'Stay curious! 🌟',
  'Be kind today 🌸', 'Look at me go!', 'So happy you\'re here!', 'Pet me! …please? 🥺',
  'Wheee~!', 'Nyaa~ 😺', 'Believe in yourself! 🌈', 'Sparkle sparkle ✨', 'Tee hee!',
  'Don\'t forget to smile 😊', 'You\'re doing great!', 'Hello, friend! 👋', 'Cuteness overload 💖',
  'Time to stretch! 🧘', 'Let\'s have fun! 🎈', 'Hmm hmm hmm~ 🎶', 'Best day ever!',
];

/**
 * Random picker that never repeats the previous phrase back to back.
 * @param {string[]} [list]
 * @returns {() => string}
 */
export function phrasePicker(list = DEFAULT_PHRASES) {
  const phrases = list.length ? list : DEFAULT_PHRASES;
  let last = -1;
  return () => {
    if (phrases.length === 1) return phrases[0];
    let i;
    do { i = Math.floor(Math.random() * phrases.length); } while (i === last);
    last = i;
    return phrases[i];
  };
}
