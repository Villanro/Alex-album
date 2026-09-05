import * as store from './store.js';
import * as sync from './sync.js';
import * as ui from './ui.js';

store.init();
ui.mount();
sync.init();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW no registrado', err));
  });
}
