import { Game } from './Game.js';
import { installFavicon } from './core/favicon.js';

window.addEventListener('DOMContentLoaded', () => {
  installFavicon();
  const game = new Game();
  game.start();
});
