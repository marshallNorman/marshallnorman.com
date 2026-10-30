// Showcase-only addition to the Design Studio mirror: on the Playbook route,
// pin the prototype's settings (normally in the hidden settings drawer) as an
// always-visible "Controls" card in the top right, below the floating header.
// Uses Dialtone classes from the app's own stylesheet so it matches the
// drawer card. The header's settings (sliders) button is hidden on this route
// since the card replaces the drawer.
//
// Imports the same state module the Playbook prototype uses, so the buttons
// drive the prototype exactly like the drawer's buttons do. The hashed filename
// changes if the mirror is rebuilt; update it here if so.
import { s as state } from '../assets/state-hVE1kBls.js';

const TASKS = [
  ['Budget', () => state.setTask1(true)],
  ['Authority', () => state.setTask2(true)],
  ['Need', () => state.setTask3(true)],
];

function buildCard() {
  const card = document.createElement('div');
  card.id = 'showcase-playbook-controls';
  card.style.cssText = [
    'position:fixed', 'top:84px', 'right:24px', 'z-index:50', 'width:299px',
    'background:#fff', 'border:1px solid rgba(28,28,28,0.11)', 'border-radius:8px',
  ].join(';');

  const heading = document.createElement('div');
  heading.className = 'd-headline--md d-fc-primary d-px16 d-pt16';
  heading.textContent = 'Controls';

  const description = document.createElement('p');
  description.className = 'd-fs-200 d-fc-secondary d-px16 d-pt4 d-pb12';
  description.textContent = 'Simulate real-time AI detection of topic completion';

  const list = document.createElement('div');
  list.className = 'd-stack d-stack--gap-400 d-pb16 d-px16';
  for (const [label, run] of TASKS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'base-button__button d-btn d-btn--outlined d-btn--sm';
    button.innerHTML = '<span class="base-button__label d-btn__label"></span>';
    button.firstChild.textContent = label;
    button.addEventListener('click', run);
    list.append(button);
  }

  card.append(heading, description, list);
  return card;
}

const card = buildCard();

const hideSettingsButton = document.createElement('style');
hideSettingsButton.textContent = '.d-btn--icon-only:has(.d-icon--sliders-horizontal) { display: none !important; }';

function sync() {
  const onPlaybook = /^#\/Playbook(?:[/?]|$)/.test(location.hash);
  if (onPlaybook && !card.isConnected) document.body.append(card, hideSettingsButton);
  else if (!onPlaybook && card.isConnected) {
    card.remove();
    hideSettingsButton.remove();
  }
}

window.addEventListener('hashchange', sync);
sync();
