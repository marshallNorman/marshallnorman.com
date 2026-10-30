// Showcase-only addition to the Design Studio mirror: on DPM Notifications,
// add an explanatory card under the settings sidebar's Settings card. The
// sidebar card's styles are component-scoped, so they're matched inline.

const card = document.createElement('div');
card.id = 'showcase-dpm-notes';
card.className = 'lead-details-card';
card.style.cssText = [
  'margin-top:12px', 'background:#fff', 'border:1px solid rgba(28,28,28,0.11)', 'border-radius:8px',
].join(';');

const heading = document.createElement('div');
heading.className = 'd-headline--md d-fc-primary d-px16 d-pt16';
heading.textContent = 'Dialpad notification system';

const body = document.createElement('p');
body.className = 'd-fs-200 d-fc-secondary d-px16 d-pt4 d-pb16';
body.textContent =
  'Dialpad has different notification types depending on the source of the information. ' +
  'Notification types stack up on the right side of the UI, user can hover the stack to expose ' +
  'individual cards before they auto-dismiss. Clicking on a card would take the user to the ' +
  'respective source for action.';

card.append(heading, body);

// The sidebar opens after load (see showcase-chrome.js) and can re-render;
// keep the card right after the Settings card while on this route
new MutationObserver(() => {
  const onDpm = /^#\/DpmNotifications(?:[/?]|$)/.test(location.hash);
  const settingsCard = document.querySelector('.uxe-studio-settings-sidebar .lead-details-card:not(#showcase-dpm-notes)');
  if (onDpm && settingsCard) {
    if (settingsCard.nextElementSibling !== card) settingsCard.after(card);
  } else if (card.isConnected) {
    card.remove();
  }
}).observe(document.body, { childList: true, subtree: true });
