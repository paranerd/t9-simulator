import './style.scss';
import german from './data/de.json';
import english from './data/en.json';
import { TextEngine, type InputMode } from './engine';
import { Dictionary, type Language } from './t9';
import { smsInfo } from './sms';
import { readState, saveState, type Message } from './storage';
import { registerSW } from 'virtual:pwa-register';

const icons = {
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3" fill="currentColor" stroke="none"/><circle cx="16" cy="17" r="3" fill="currentColor" stroke="none"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>',
  backspace: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m9 5-7 7 7 7h12V5Z"/><path d="m12 9 6 6m0-6-6 6"/></svg>',
  envelope: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></svg>'
};
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const state = readState();
const dictionaries: Record<Language, Dictionary> = {
  de: new Dictionary(german, state.learned.de, state.custom.de),
  en: new Dictionary(english, state.learned.en, state.custom.en)
};
const engine = new TextEngine(dictionaries[state.settings.language]);
engine.mode = state.settings.mode;
engine.casing = state.settings.casing;
engine.setText(state.active.text);
for (const digit of state.active.sequence) engine.tap(digit);
let timer: ReturnType<typeof setTimeout> | undefined;
let storageAvailable = true;
let toastTimer: ReturnType<typeof setTimeout>;
let updateServiceWorker: (reload?: boolean) => Promise<void>;

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <button class="settings-button" id="settings-button" aria-label="Einstellungen">${icons.settings}</button>
  <main class="stage">
    <section class="phone-area" aria-label="Retro-Handy">
      <div class="phone" id="phone">
        <div class="speaker" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
        <div class="phone-brand" aria-hidden="true">T<span>9</span> <b>·</b> 2000</div>
        <div class="screen-surround">
          <div class="lcd">
            <div class="status-bar"><span class="signal" aria-label="Simulierter Empfang"><i></i><i></i><i></i><i></i></span><span id="lcd-mode">T9 · Abc</span><span class="battery" aria-label="Simulierter voller Akku"></span></div>
            <div class="screen-heading"><span>Nachricht schreiben</span><span id="screen-language">DE</span></div>
            <div class="message-screen" id="message-screen" role="textbox" aria-label="Nachricht. Eingabe über die Handytasten oder Zahlentasten." aria-readonly="true" aria-multiline="true" tabindex="0"></div>
            <div class="lcd-status"><span id="phone-status" role="status" aria-live="polite"></span><span id="lcd-candidates"></span></div>
            <div class="screen-footer"><span id="sms-count">160 frei · 1 SMS</span><span id="character-count">0</span></div>
            <div class="lcd-soft-labels" aria-hidden="true"><span>Speichern</span><span>Löschen</span></div>
          </div>
        </div>
        <div class="navigation-keys">
          <div class="soft-column"><button class="soft-key" id="save-button" aria-label="Als Entwurf speichern"><span></span></button><button class="call-key" id="send-button" aria-label="Nachricht simuliert senden">${icons.envelope}</button></div>
          <div class="rocker" aria-label="Navigation">
            <button class="rocker-up" data-action="next" aria-label="Nächster T9-Vorschlag">▴</button>
            <button class="rocker-left" data-action="left" aria-label="Cursor nach links">‹</button>
            <button class="rocker-center" data-action="confirm" aria-label="Wort bestätigen">●</button>
            <button class="rocker-right" data-action="right" aria-label="Cursor nach rechts">›</button>
            <button class="rocker-down" data-action="previous" aria-label="Vorheriger T9-Vorschlag">▾</button>
          </div>
          <div class="soft-column"><button class="soft-key" id="delete-button" aria-label="Letztes Zeichen löschen"><span></span></button><button class="end-key" id="new-button" aria-label="Neue Nachricht beginnen">${icons.backspace}</button></div>
        </div>
        <div class="keypad" aria-label="Handytastatur">
          ${[['1', '.,?!'], ['2', 'abc'], ['3', 'def'], ['4', 'ghi'], ['5', 'jkl'], ['6', 'mno'], ['7', 'pqrs'], ['8', 'tuv'], ['9', 'wxyz'], ['*', '+ / @'], ['0', '␣'], ['#', 'T9']].map(([key, letters]) => `<button class="number-key key-${key === '*' ? 'star' : key === '#' ? 'hash' : key}" data-key="${key}" aria-label="${key === '*' ? 'Stern: nächstes Wort oder Sonderzeichen' : key === '#' ? 'Raute: Groß- und Kleinschreibung; halten zum Ein- oder Ausschalten von T9' : key === '0' ? '0: Leerzeichen' : `${key}: ${letters}`}" aria-keyshortcuts="${key}"><span class="key-number">${key}</span><span class="key-letters">${letters}</span></button>`).join('')}
        </div>
        <div class="phone-bottom" aria-hidden="true"><span></span><i></i><span></span></div>
      </div>
    </section>
  </main>
  <dialog id="dialog" class="dialog"><div class="dialog-top"><span class="eyebrow">T9 SIMULATOR</span><button id="close-dialog" aria-label="Dialog schließen">×</button></div><div id="dialog-content"></div></dialog>
`;

const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
function toast(message: string): void {
  $('#phone-status').textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#phone-status').textContent = ''; }, 3800);
}

function persist(): boolean {
  state.settings.mode = engine.mode;
  state.settings.casing = engine.casing;
  state.active = { text: engine.isUnknown ? engine.text : engine.value, sequence: engine.isUnknown ? engine.sequence : '' };
  const saved = saveState(state);
  if (!saved && storageAvailable) toast('Speichern ist hier nicht möglich. Bitte kopiere deinen Text vor dem Schließen.');
  storageAvailable = saved;
  return saved;
}

function render(): void {
  const characters = Array.from(engine.text);
  const before = characters.slice(0, engine.cursor).join('');
  const after = characters.slice(engine.cursor).join('');
  $('#message-screen').innerHTML = `${escapeHtml(before)}<span class="pending-word${engine.isUnknown ? ' unknown' : ''}">${escapeHtml(engine.pendingText)}</span><span class="cursor" aria-hidden="true"></span>${escapeHtml(after)}`;
  $('#message-screen').setAttribute('aria-label', `Nachricht: ${engine.value || 'leer'}. Eingabe über die Handytasten oder Zahlentasten.`);
  $('.cursor').scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const sms = smsInfo(engine.value);
  $('#sms-count').textContent = `${sms.remaining} frei · ${sms.parts} SMS`;
  $('#sms-count').title = `${sms.encoding}, ${sms.units} SMS-Einheiten`;
  $('#character-count').textContent = String(Array.from(engine.value).length);
  $('#lcd-mode').textContent = `${engine.mode === 't9' ? 'T9' : 'ABC'} · ${engine.casing === 'auto' ? 'Abc' : engine.casing === 'upper' ? 'ABC' : 'abc'}`;
  $('#screen-language').textContent = state.settings.language.toUpperCase();
  $('#lcd-candidates').textContent = engine.isUnknown ? '?' : engine.sequence ? `${engine.candidateIndex + 1}/${engine.candidates.length}` : '';
  clearTimeout(timer);
  if (engine.expires !== null) timer = setTimeout(() => { engine.expire(Date.now()); render(); }, Math.max(0, engine.expires - Date.now()) + 5);
  persist();
}

let audio: AudioContext | undefined;
function feedback(key = '2'): void {
  if (state.settings.vibration) navigator.vibrate?.(12);
  if (!state.settings.sound) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
    const index = '123456789*0#'.indexOf(key);
    for (const frequency of [[697, 770, 852, 941][Math.floor(Math.max(index, 0) / 3)], [1209, 1336, 1477][Math.max(index, 0) % 3]]) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.035, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.075);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(); oscillator.stop(audio.currentTime + 0.08);
    }
  } catch { /* Devices without audio still support all writing features. */ }
}

function result(ok: boolean): void { if (!ok) openWordDialog(); render(); }
function press(key: string, held = false): void {
  feedback(key);
  if (held && key === '#') setMode(engine.mode === 't9' ? 'abc' : 't9');
  else if (held && /^[0-9]$/.test(key)) result(engine.digit(key));
  else { engine.tap(key) || openWordDialog(); render(); }
}
function setMode(mode: InputMode): void {
  if (!engine.setMode(mode)) { openWordDialog(); return; }
  render();
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-key]')) {
  let holdTimer: ReturnType<typeof setTimeout>;
  let held = false;
  let activePointer = false;
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    activePointer = true;
    held = false;
    button.setPointerCapture(event.pointerId);
    button.classList.add('pressed');
    holdTimer = setTimeout(() => { if (activePointer) { held = true; press(button.dataset.key!, true); } }, 500);
  });
  const release = () => { activePointer = false; clearTimeout(holdTimer); button.classList.remove('pressed'); };
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', () => { held = true; release(); });
  button.addEventListener('lostpointercapture', release);
  button.addEventListener('click', () => { if (!held) press(button.dataset.key!); held = false; });
}
$('#delete-button').addEventListener('click', () => { engine.backspace(); feedback(); render(); });
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action]')) button.addEventListener('click', () => {
  const action = button.dataset.action;
  if (action === 'next') engine.nextCandidate();
  else if (action === 'previous') engine.nextCandidate(-1);
  else if (action === 'left') result(engine.moveCursor(-1));
  else if (action === 'right') result(engine.moveCursor(1));
  else result(engine.commit());
  feedback(); render();
});
const dialog = $<HTMLDialogElement>('#dialog');
let priorFocus: HTMLElement | null = null;
function openDialog(content: string): void {
  if (!dialog.open) priorFocus = document.activeElement as HTMLElement;
  $('#dialog-content').innerHTML = content;
  if (!dialog.open) dialog.showModal();
}
$('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => priorFocus?.focus());
dialog.addEventListener('click', event => {
  const rect = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
});

function openWordDialog(): void {
  openDialog(`<h2>Ein neues Wort.</h2><p>${engine.sequence ? `Welches Wort gehört zu <strong>${escapeHtml(engine.sequence)}</strong>?` : 'Bring deinem T9 einen Namen oder ein Lieblingswort bei.'}</p><form id="word-form"><label for="new-word">Wort (${state.settings.language === 'de' ? 'Deutsch' : 'English'})</label><input id="new-word" type="text" maxlength="24" autocomplete="off" autocapitalize="none" spellcheck="false" required autofocus><p id="word-error" class="form-error" role="alert"></p><button class="primary-button" type="submit">Wort hinzufügen ${icons.arrow}</button></form><p class="dialog-note">Umlaute und ß sind erlaubt. Dein Wort wird nur auf diesem Gerät gespeichert.</p>`);
  $('#word-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      engine.addWord($<HTMLInputElement>('#new-word').value.trim());
      render(); dialog.close(); toast('Dein T9 hat ein neues Wort gelernt.');
    } catch (error) { $('#word-error').textContent = (error as Error).message; }
  });
  $<HTMLInputElement>('#new-word').focus();
}

function createMessage(): Message { return { id: crypto.randomUUID(), text: engine.value, date: Date.now() }; }
function saveDraft(showToast = true): boolean {
  if (!engine.commit()) { openWordDialog(); return false; }
  if (!engine.value.trim()) { if (showToast) toast('Schreibe zuerst eine Nachricht.'); return false; }
  if (!state.drafts.some(message => message.text === engine.value)) {
    state.drafts.unshift(createMessage());
    state.drafts = state.drafts.slice(0, 100);
  }
  render();
  if (showToast) toast(storageAvailable ? 'Entwurf gespeichert.' : 'Entwurf nur für diese Sitzung gespeichert.');
  return true;
}
$('#save-button').addEventListener('click', () => saveDraft());
$('#new-button').addEventListener('click', () => {
  if (engine.value.trim() && !saveDraft(false)) return;
  engine.setText(''); render(); toast('Neue Nachricht. Dein bisheriger Text liegt in den Entwürfen.');
});
$('#send-button').addEventListener('click', () => {
  if (!engine.commit()) { openWordDialog(); return; }
  if (!engine.value.trim()) { toast('Schreibe zuerst eine Nachricht.'); return; }
  openDialog(`<div class="dialog-icon">${icons.envelope}</div><h2>Ab in den Postausgang?</h2><p>Die Nachricht wird hier auf deinem Gerät abgelegt. Das Senden ist simuliert.</p><blockquote class="message-preview">${escapeHtml(engine.value)}</blockquote><button class="primary-button" id="confirm-send">Simuliert senden ${icons.arrow}</button>`);
  $('#confirm-send').addEventListener('click', () => {
    const previous = state.sent;
    state.sent = [createMessage(), ...previous].slice(0, 100);
    if (!persist()) { state.sent = previous; toast('Der Postausgang konnte nicht gespeichert werden. Dein Text bleibt erhalten.'); return; }
    engine.setText(''); render(); dialog.close(); toast('Nachricht im Postausgang. Wie früher — nur ohne SMS-Kosten.');
  });
});

function openFolder(folder: 'drafts' | 'sent'): void {
  const title = folder === 'drafts' ? 'Deine Entwürfe.' : 'Dein Postausgang.';
  const messages = state[folder];
  openDialog(`<h2>${title}</h2><p>${folder === 'drafts' ? 'Hier warten deine unfertigen Gedanken.' : 'Alle Nachrichten wurden nur simuliert gesendet.'}</p><div class="message-list">${messages.length ? messages.map(message => `<article class="saved-message"><time>${new Intl.DateTimeFormat('de', { dateStyle: 'medium', timeStyle: 'short' }).format(message.date)}</time><p>${escapeHtml(message.text)}</p><div><button class="text-button" data-load="${escapeHtml(message.id)}">${folder === 'drafts' ? 'Weiter schreiben' : 'Als neue Nachricht öffnen'} →</button><button class="text-button delete-message" data-remove="${escapeHtml(message.id)}">Löschen</button></div></article>`).join('') : '<div class="folder-empty">Noch keine Nachrichten.<br>Zeit für die erste.</div>'}</div>`);
  $('.message-list').addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button) return;
    if (button.dataset.load) {
      const message = state[folder].find(message => message.id === button.dataset.load);
      if (!message) return;
      if (engine.value.trim() && !saveDraft(false)) return;
      engine.setText(message.text); render(); dialog.close();
    } else if (button.dataset.remove) {
      const id = button.dataset.remove;
      openDialog('<h2>Nachricht löschen?</h2><p>Dieser Eintrag wird aus deinem lokalen Speicher entfernt.</p><button class="primary-button" id="confirm-delete">Nachricht löschen</button>');
      $('#confirm-delete').addEventListener('click', () => { state[folder] = state[folder].filter(message => message.id !== id); render(); openFolder(folder); });
    }
  });
}

function openSettings(): void {
  openDialog(`<h2>Einstellungen</h2>
    <label class="setting-row"><span><strong>Tastentöne</strong></span><input type="checkbox" id="sound" ${state.settings.sound ? 'checked' : ''}></label>
    <label class="setting-row"><span><strong>Vibration</strong></span><input type="checkbox" id="vibration" ${state.settings.vibration ? 'checked' : ''}></label>
    <label class="setting-row"><span><strong>Wörterbuch</strong></span><select id="language" aria-label="T9-Wörterbuch"><option value="de">Deutsch</option><option value="en">English</option></select></label>
    <div class="settings-actions">
      <button class="setting-action" id="drafts-button">Entwürfe <span>${state.drafts.length}</span></button>
      <button class="setting-action" id="sent-button">Postausgang <span>${state.sent.length}</span></button>
      <button class="setting-action" id="add-word-button">Eigenes Wort hinzufügen ${icons.arrow}</button>
      <button class="setting-action" id="install-button" hidden></button>
    </div>
    <details class="credits"><summary>Wörterbücher & Lizenzen</summary><p>25.000 Wörter je Sprache, aus <a href="https://github.com/rspeer/wordfreq" target="_blank" rel="noopener noreferrer">wordfreq 3.1.1</a> von Robyn Speer. Die bearbeiteten Wortlisten stehen unter CC BY-SA 4.0; der App-Code unter MIT.</p><p>Quellen: Wikipedia, Leeds Internet Corpus, ParaCrawl, Google Books, OpenSubtitles und die frei verfügbaren SUBTLEX-Daten von Marc Brysbaert et al.</p><a href="${import.meta.env.BASE_URL}licenses/wordfreq-notice.txt" target="_blank" rel="noopener noreferrer">Vollständige Hinweise & Datenlizenz ↗</a></details>`);
  $('#sound').addEventListener('change', () => { state.settings.sound = $<HTMLInputElement>('#sound').checked; persist(); feedback(); });
  $('#vibration').addEventListener('change', () => { state.settings.vibration = $<HTMLInputElement>('#vibration').checked; persist(); feedback(); });
  $<HTMLSelectElement>('#language').value = state.settings.language;
  $('#language').addEventListener('change', () => {
    if (!engine.commit()) { $<HTMLSelectElement>('#language').value = state.settings.language; openWordDialog(); return; }
    state.settings.language = $<HTMLSelectElement>('#language').value as Language;
    engine.dictionary = dictionaries[state.settings.language];
    render();
  });
  $('#drafts-button').addEventListener('click', () => openFolder('drafts'));
  $('#sent-button').addEventListener('click', () => openFolder('sent'));
  $('#add-word-button').addEventListener('click', openWordDialog);
  $('#install-button').addEventListener('click', async () => {
    if (updateReady) { persist(); await updateServiceWorker(true); }
    else if (installEvent) {
      await installEvent.prompt(); await installEvent.userChoice;
      installEvent = undefined; syncPwaAction();
    }
  });
  syncPwaAction();
}
$('#settings-button').addEventListener('click', openSettings);

const keyboard = new Map<string, { start: number; key: string; held: boolean; timer: ReturnType<typeof setTimeout> }>();
window.addEventListener('keydown', event => {
  if (dialog.open || event.ctrlKey || event.metaKey || event.altKey || (event.target as HTMLElement).matches('input, select, textarea')) return;
  const key = event.key;
  if (/^[0-9*#]$/.test(key)) {
    event.preventDefault();
    if (keyboard.has(event.code)) return;
    const record = { start: Date.now(), key, held: false, timer: setTimeout(() => { record.held = true; press(key, true); }, 500) };
    keyboard.set(event.code, record);
    document.querySelector(`[data-key="${key}"]`)?.classList.add('pressed');
    return;
  }
  if (key === 'Backspace') { event.preventDefault(); engine.backspace(); render(); }
  else if (key === ' ' && !(event.target as HTMLElement).closest('button')) { event.preventDefault(); result(engine.tap(' ')); }
  else if (key === 'ArrowUp' || key === 'ArrowDown') { event.preventDefault(); engine.nextCandidate(key === 'ArrowUp' ? 1 : -1); render(); }
  else if (key === 'ArrowLeft' || key === 'ArrowRight') { event.preventDefault(); result(engine.moveCursor(key === 'ArrowLeft' ? -1 : 1)); }
  else if (key === 'Enter' && !(event.target as HTMLElement).closest('button, a')) { event.preventDefault(); result(event.shiftKey ? engine.newline() : engine.commit()); }
});
window.addEventListener('keyup', event => {
  const record = keyboard.get(event.code);
  if (!record) return;
  clearTimeout(record.timer); keyboard.delete(event.code);
  document.querySelector(`[data-key="${record.key}"]`)?.classList.remove('pressed');
  if (!record.held && !dialog.open) press(record.key);
});
window.addEventListener('blur', () => {
  for (const record of keyboard.values()) clearTimeout(record.timer);
  keyboard.clear();
  for (const button of document.querySelectorAll('.pressed')) button.classList.remove('pressed');
  persist();
});
window.addEventListener('pagehide', persist);

let updateReady = false;
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let installEvent: InstallEvent | undefined;
function syncPwaAction(): void {
  const button = document.querySelector<HTMLButtonElement>('#install-button');
  if (!button) return;
  button.hidden = !updateReady && !installEvent;
  button.innerHTML = `${updateReady ? 'Update laden' : 'App installieren'} ${icons.download}`;
}
if ('serviceWorker' in navigator) {
  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() { updateReady = true; syncPwaAction(); },
    onRegisterError() { toast('Offline-Funktion nicht verfügbar.'); }
  });
}
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); installEvent = event as InstallEvent; syncPwaAction();
});
window.addEventListener('appinstalled', () => { installEvent = undefined; syncPwaAction(); });

render();
