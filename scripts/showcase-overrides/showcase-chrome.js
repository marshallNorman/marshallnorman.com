// Showcase-only adjustments to the Design Studio mirror's chrome, for every
// prototype:
// - The floating header keeps only the "Showcase" back button and the title;
//   the icon buttons on its right (docs, settings, link, tools, theme, close)
//   are replaced by a "Reset prototype" button.
// - On DPM Notifications, the settings sidebar opens by default and its close
//   (X) button is hidden, so the controls are always visible. Its card's
//   collapse chevron is hidden too (the toggle itself is removed by the
//   upload script's patches).

const style = document.createElement('style');
style.textContent = `
  .d-uxes-component-settings-menu .d-btn--icon-only { display: none !important; }
  .uxe-studio-settings-sidebar .d-btn--icon-only:has(.d-icon--close) { display: none !important; }
  .uxe-studio-settings-sidebar .lead-details-header { cursor: default !important; }
  .uxe-studio-settings-sidebar .lead-details-header .d-icon { display: none !important; }
`;
document.head.append(style);

const OPEN_SETTINGS_ROUTES = [/^#\/DpmNotifications(?:[/?]|$)/];

// The header renders after the prototype loads, so poll briefly for its
// (hidden) settings button and click it once
function openSettingsIfNeeded() {
  if (!OPEN_SETTINGS_ROUTES.some((route) => route.test(location.hash))) return;
  let tries = 0;
  const timer = setInterval(() => {
    if (document.querySelector('.uxe-studio-settings-sidebar') || ++tries > 100) {
      clearInterval(timer);
      return;
    }
    document.querySelector('.d-btn--icon-only:has(.d-icon--sliders-horizontal)')?.click();
  }, 150);
}

window.addEventListener('hashchange', openSettingsIfNeeded);
openSettingsIfNeeded();

// Prototype state lives in memory and its settings in the hash query
// (#/Route?setting=value), so dropping the query and reloading restores the
// prototype's starting state
const resetButton = document.createElement('button');
resetButton.type = 'button';
resetButton.className = 'base-button__button d-btn d-btn--muted d-btn--inverted';
resetButton.innerHTML = '<span class="base-button__label d-btn__label">Reset prototype</span>';
resetButton.addEventListener('click', () => {
  history.replaceState(null, '', location.pathname + location.hash.split('?')[0]);
  location.reload();
});

// The header mounts (and can re-render) after load; keep the button in its
// right-hand column
new MutationObserver(() => {
  const right = document.querySelector('.d-uxes-component-settings-menu > :last-child');
  if (right && resetButton.parentElement !== right) right.append(resetButton);
}).observe(document.body, { childList: true, subtree: true });
