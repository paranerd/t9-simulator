import './style.scss';
import german from './data/de.json';
import english from './data/en.json';
import { TextEngine, type InputMode } from './engine';
import { Dictionary, type Language } from './t9';
import { smsInfo } from './sms';
import { readState, saveState, SENT_LIMIT, type Message } from './storage';
import { registerSW } from 'virtual:pwa-register';

const icons = {
  navigation: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m6 15 6-6 6 6"/></svg>',
  call: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m7 3 3 5-3 3a16 16 0 0 0 6 6l3-3 5 3-1 4C10 22 2 14 3 4Z"/></svg>',
  hangup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 13c5-6 15-6 20 0l-2 4-5-2v-4a12 12 0 0 0-6 0v4l-5 2Z"/></svg>',
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
type PhoneView = 'write' | 'menu' | 'sent' | 'message' | 'settings' | 'word' | 'credits';
let view: PhoneView = 'write';
let menuIndex = 0;
let sentIndex = 0;
let settingsIndex = 0;
let wordReturnView: PhoneView = 'write';
let wordResolvesSequence = false;
const wordEngine = new TextEngine(dictionaries[state.settings.language]);
wordEngine.mode = 'abc';
wordEngine.casing = 'lower';
const menuItems = ['Schreiben', 'Gesendet', 'Einstellungen'];

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="stage">
    <section class="phone-area" aria-label="Retro-Handy">
      <div class="phone" id="phone">
        <div class="speaker" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
        <div class="phone-brand" aria-hidden="true">T<span>9</span> <b>·</b> 2000</div>
        <div class="screen-surround">
          <div class="lcd">
            <div class="status-bar"><span class="signal" aria-label="Simulierter Empfang"><i></i><i></i><i></i><i></i></span><span id="lcd-mode">T9 · Abc</span><span class="battery" aria-label="Simulierter voller Akku"></span></div>
            <div class="screen-heading"><span id="screen-title">Nachricht schreiben</span><span id="screen-language">DE</span></div>
            <div class="message-screen" id="message-screen" role="textbox" aria-label="Nachricht. Eingabe über die Handytasten oder Zahlentasten." aria-readonly="true" aria-multiline="true" tabindex="0"></div>
            <div class="lcd-status"><span id="phone-status" role="status" aria-live="polite"></span><span id="lcd-candidates"></span></div>
            <div class="screen-footer"><span id="sms-count">160 frei · 1 SMS</span><span id="character-count">0</span></div>
            <div class="lcd-soft-labels" aria-hidden="true"><span id="left-soft-label">Senden</span><span id="right-soft-label">Löschen</span></div>
          </div>
        </div>
        <div class="navigation-keys">
          <div class="soft-column"><button class="soft-key" id="send-button" aria-label="Senden"><span></span></button><button class="call-key" id="call-button" aria-label="Anruf annehmen">${icons.call}</button></div>
          <div class="rocker" aria-label="Navigation">
            <button class="rocker-up" data-action="next" aria-label="Nächster T9-Vorschlag">${icons.navigation}</button>
            <button class="rocker-left" data-action="left" aria-label="Cursor nach links">${icons.navigation}</button>
            <button class="rocker-center" data-action="confirm" aria-label="Wort bestätigen">●</button>
            <button class="rocker-right" data-action="right" aria-label="Cursor nach rechts">${icons.navigation}</button>
            <button class="rocker-down" data-action="previous" aria-label="Vorheriger T9-Vorschlag">${icons.navigation}</button>
          </div>
          <div class="soft-column"><button class="soft-key" id="delete-button" aria-label="Letztes Zeichen löschen"><span></span></button><button class="end-key" id="hangup-button" aria-label="Auflegen – Hauptmenü öffnen">${icons.hangup}</button></div>
        </div>
        <div class="keypad" aria-label="Handytastatur">
          ${[['1', '.,?!'], ['2', 'abc'], ['3', 'def'], ['4', 'ghi'], ['5', 'jkl'], ['6', 'mno'], ['7', 'pqrs'], ['8', 'tuv'], ['9', 'wxyz'], ['*', '+ / @'], ['0', '␣'], ['#', 'T9']].map(([key, letters]) => `<button class="number-key key-${key === '*' ? 'star' : key === '#' ? 'hash' : key}" data-key="${key}" aria-label="${key === '*' ? 'Stern: nächstes Wort oder Sonderzeichen' : key === '#' ? 'Raute: Groß- und Kleinschreibung; halten zum Ein- oder Ausschalten von T9' : key === '0' ? '0: Leerzeichen' : `${key}: ${letters}`}" aria-keyshortcuts="${key}"><span class="key-number">${key}</span><span class="key-letters">${letters}</span></button>`).join('')}
        </div>
        <div class="phone-bottom" aria-hidden="true"><span></span><i></i><span></span></div>
      </div>
    </section>
  </main>
`;

const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
function fitPhone(): void {
  const stage = $('.stage');
  const area = $('.phone-area');
  const phone = $('#phone');
  const padding = getComputedStyle(stage);
  const width = stage.clientWidth - parseFloat(padding.paddingLeft) - parseFloat(padding.paddingRight);
  const height = window.innerHeight - parseFloat(padding.paddingTop) - parseFloat(padding.paddingBottom);
  // Scale the complete design; keep 48px keys at least 44px tall on short screens.
  const scale = Math.min(width / 320, Math.max(44 / 48, Math.min(height / phone.offsetHeight, 1.125)));
  area.style.setProperty('--phone-height', `${phone.offsetHeight}px`);
  area.style.setProperty('--phone-scale', String(scale));
}
fitPhone();
window.addEventListener('resize', fitPhone);
new ResizeObserver(fitPhone).observe($('#phone'));

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
  const writing = view === 'write';
  const screen = $('#message-screen');
  screen.classList.toggle('lcd-reading', view === 'credits');
  screen.setAttribute('role', writing ? 'textbox' : ['message', 'word', 'credits'].includes(view) ? 'region' : 'menu');
  if (writing) {
    screen.setAttribute('aria-readonly', 'true');
    screen.setAttribute('aria-multiline', 'true');
  } else {
    screen.removeAttribute('aria-readonly');
    screen.removeAttribute('aria-multiline');
  }
  const titles: Record<PhoneView, string> = { write: 'Nachricht schreiben', menu: 'Hauptmenü', sent: 'Gesendet', message: 'Gesendet', settings: 'Einstellungen', word: 'Eigenes Wort', credits: 'Lizenzen' };
  $('#screen-title').textContent = titles[view];
  $('#left-soft-label').textContent = writing ? 'Senden' : 'OK';
  $('#send-button').setAttribute('aria-label', writing ? 'Senden' : 'OK');
  $('#right-soft-label').textContent = writing || view === 'word' ? 'Löschen' : 'Zurück';
  $('#delete-button').setAttribute('aria-label', writing || view === 'word' ? 'Letztes Zeichen löschen' : 'Zurück');
  const writingLabels: Record<string, string> = { next: 'Nächster T9-Vorschlag', previous: 'Vorheriger T9-Vorschlag', left: 'Cursor nach links', right: 'Cursor nach rechts', confirm: 'Wort bestätigen' };
  for (const [action, label] of Object.entries({ next: 'Vorheriger Eintrag', previous: 'Nächster Eintrag', left: 'Vorheriger Eintrag', right: 'Nächster Eintrag', confirm: 'Auswahl öffnen' })) {
    $(`[data-action="${action}"]`).setAttribute('aria-label', writing || view === 'word' ? writingLabels[action] : label);
  }
  if (writing) {
    const characters = Array.from(engine.text);
    const before = characters.slice(0, engine.cursor).join('');
    const after = characters.slice(engine.cursor).join('');
    $('#message-screen').innerHTML = `${escapeHtml(before)}<span class="pending-word${engine.isUnknown ? ' unknown' : ''}">${escapeHtml(engine.pendingText)}</span><span class="cursor" aria-hidden="true"></span>${escapeHtml(after)}`;
    $('#message-screen').setAttribute('aria-label', `Nachricht: ${engine.value || 'leer'}. Eingabe über die Handytasten oder Zahlentasten.`);
    $('.cursor').scrollIntoView({ block: 'nearest', inline: 'nearest' });
  } else if (view === 'menu') {
    screen.setAttribute('aria-label', 'Hauptmenü');
    screen.innerHTML = menuItems.map((item, index) => `<button role="menuitem" class="lcd-menu-item${menuIndex === index ? ' selected' : ''}" data-menu-index="${index}"${menuIndex === index ? ' aria-current="true"' : ''}>${escapeHtml(item)}</button>`).join('');
    screen.querySelector('.selected')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  } else if (view === 'sent') {
    screen.setAttribute('aria-label', 'Gesendete Nachrichten');
    screen.innerHTML = state.sent.length ? state.sent.map((message, index) => `<button role="menuitem" class="lcd-menu-item${sentIndex === index ? ' selected' : ''}" data-sent-index="${index}"${sentIndex === index ? ' aria-current="true"' : ''}>${index + 1}. ${escapeHtml(message.text.replace(/\s+/g, ' '))}</button>`).join('') : '<span class="lcd-empty">Keine Nachrichten.</span>';
    screen.querySelector('.selected')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  } else if (view === 'settings') {
    screen.setAttribute('aria-label', 'Einstellungen');
    const items = settingItems();
    settingsIndex = Math.min(settingsIndex, items.length - 1);
    screen.innerHTML = items.map((item, index) => `<button role="menuitem" class="lcd-menu-item${settingsIndex === index ? ' selected' : ''}" data-settings-index="${index}"${settingsIndex === index ? ' aria-current="true"' : ''}>${escapeHtml(item.label)}</button>`).join('');
    screen.querySelector('.selected')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  } else if (view === 'word') {
    screen.setAttribute('aria-label', 'Eigenes Wort hinzufügen');
    if (!screen.querySelector('#new-word')) screen.innerHTML = '<form id="word-form"><label for="new-word">Wort eingeben:</label><input id="new-word" type="text" maxlength="24" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="Eigenes Wort"><button type="submit" hidden>Wort hinzufügen</button></form>';
    $<HTMLInputElement>('#new-word').value = wordEngine.value;
  } else if (view === 'credits') {
    screen.setAttribute('aria-label', 'Wörterbücher und Lizenzen');
    screen.innerHTML = `<p>25.000 Wörter je Sprache aus <a href="https://github.com/rspeer/wordfreq" target="_blank" rel="noopener noreferrer">wordfreq 3.1.1</a> von Robyn Speer.</p><p>Bearbeitete Wortlisten: CC BY-SA 4.0. App-Code: MIT.</p><p>Quellen: Wikipedia, Leeds Internet Corpus, ParaCrawl, Google Books, OpenSubtitles und SUBTLEX von Marc Brysbaert et al.</p><a href="${import.meta.env.BASE_URL}licenses/wordfreq-notice.txt" target="_blank" rel="noopener noreferrer">Datenlizenz & Hinweise ↗</a>`;
  } else {
    screen.setAttribute('aria-label', 'Gesendete Nachricht');
    screen.textContent = state.sent[sentIndex]?.text ?? '';
  }
  const sms = smsInfo(engine.value);
  $('#sms-count').textContent = writing ? `${sms.remaining} frei · ${sms.parts} SMS` : view === 'menu' || view === 'settings' ? '↑ ↓ Auswählen · OK' : view === 'sent' ? `${state.sent.length} / ${SENT_LIMIT} Nachrichten` : view === 'word' ? wordResolvesSequence && engine.sequence ? `Wort zu ${engine.sequence}` : 'ABC · Mehrfach tippen' : view === 'credits' ? '↑ ↓ Scrollen' : state.sent[sentIndex] ? new Intl.DateTimeFormat('de', { dateStyle: 'short', timeStyle: 'short' }).format(state.sent[sentIndex].date) : '';
  $('#sms-count').title = writing ? `${sms.encoding}, ${sms.units} SMS-Einheiten` : '';
  $('#character-count').textContent = writing ? String(Array.from(engine.value).length) : '';
  const inputEngine = view === 'word' ? wordEngine : engine;
  $('#lcd-mode').textContent = `${inputEngine.mode === 't9' ? 'T9' : 'ABC'} · ${inputEngine.casing === 'auto' ? 'Abc' : inputEngine.casing === 'upper' ? 'ABC' : 'abc'}`;
  $('#screen-language').textContent = state.settings.language.toUpperCase();
  $('#lcd-candidates').textContent = writing ? engine.isUnknown ? '?' : engine.sequence ? `${engine.candidateIndex + 1}/${engine.candidates.length}` : '' : '';
  clearTimeout(timer);
  const expires = Math.min(engine.expires ?? Infinity, view === 'word' ? wordEngine.expires ?? Infinity : Infinity);
  if (Number.isFinite(expires)) timer = setTimeout(() => { engine.expire(Date.now()); wordEngine.expire(Date.now()); render(); }, Math.max(0, expires - Date.now()) + 5);
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

function result(ok: boolean): void { if (!ok) openWordView(); render(); }
function press(key: string, held = false): void {
  feedback(key);
  if (view === 'word') {
    if (held && /^[0-9]$/.test(key)) wordEngine.digit(key);
    else wordEngine.tap(key);
    render(); return;
  }
  if (view !== 'write') {
    const index = Number(key) - 1;
    if (!held && /^[1-9]$/.test(key) && view === 'menu' && index < menuItems.length) { menuIndex = index; activateSelection(); }
    else if (!held && /^[1-9]$/.test(key) && view === 'sent' && index < state.sent.length) { sentIndex = index; activateSelection(); }
    else if (!held && /^[1-9]$/.test(key) && view === 'settings' && index < settingItems().length) { settingsIndex = index; activateSelection(); }
    return;
  }
  if (held && key === '#') setMode(engine.mode === 't9' ? 'abc' : 't9');
  else if (held && /^[0-9]$/.test(key)) result(engine.digit(key));
  else { engine.tap(key) || openWordView(); render(); }
}
function setMode(mode: InputMode): void {
  if (!engine.setMode(mode)) { openWordView(); return; }
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
function moveSelection(direction: number): void {
  if (view === 'message' || view === 'credits') { $('#message-screen').scrollBy({ top: direction * 30 }); return; }
  if (view === 'menu') menuIndex = (menuIndex + direction + menuItems.length) % menuItems.length;
  else if (view === 'sent' && state.sent.length) sentIndex = (sentIndex + direction + state.sent.length) % state.sent.length;
  else if (view === 'settings') settingsIndex = (settingsIndex + direction + settingItems().length) % settingItems().length;
  render();
}
function activateSelection(): void {
  if (view === 'menu') {
    if (menuIndex === 0) view = 'write';
    else if (menuIndex === 1) { view = 'sent'; sentIndex = 0; }
    else { openSettings(); return; }
  } else if (view === 'sent' && state.sent.length) { view = 'message'; $('#message-screen').scrollTop = 0; }
  else if (view === 'message') view = 'sent';
  else if (view === 'settings') { void activateSetting(); return; }
  else if (view === 'word') { saveWord(); return; }
  else if (view === 'credits') view = 'settings';
  render();
}
function goBack(): void {
  view = view === 'message' ? 'sent' : view === 'menu' ? 'write' : view === 'word' ? wordReturnView : view === 'credits' ? 'settings' : 'menu';
  render();
}
$('#message-screen').addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (button?.dataset.menuIndex !== undefined) { menuIndex = Number(button.dataset.menuIndex); activateSelection(); }
  else if (button?.dataset.sentIndex !== undefined) { sentIndex = Number(button.dataset.sentIndex); activateSelection(); }
  else if (button?.dataset.settingsIndex !== undefined) { settingsIndex = Number(button.dataset.settingsIndex); activateSelection(); }
});
$('#delete-button').addEventListener('click', () => { if (view === 'write') { engine.backspace(); render(); } else if (view === 'word') { wordEngine.backspace(); render(); } else goBack(); feedback(); });
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action]')) button.addEventListener('click', () => {
  const action = button.dataset.action;
  if (view === 'word') {
    if (action === 'left') wordEngine.moveCursor(-1);
    else if (action === 'right') wordEngine.moveCursor(1);
    else if (action === 'confirm') wordEngine.commit();
    feedback(); render(); return;
  }
  if (view !== 'write') { if (action === 'confirm') activateSelection(); else moveSelection(action === 'next' || action === 'left' ? -1 : 1); feedback(); return; }
  if (action === 'next') engine.nextCandidate();
  else if (action === 'previous') engine.nextCandidate(-1);
  else if (action === 'left') result(engine.moveCursor(-1));
  else if (action === 'right') result(engine.moveCursor(1));
  else result(engine.commit());
  feedback(); render();
});
function openWordView(resolveSequence = engine.isUnknown): void {
  wordReturnView = view;
  wordResolvesSequence = resolveSequence;
  wordEngine.setText('');
  wordEngine.casing = 'lower';
  view = 'word';
  render();
}
function saveWord(): void {
  try {
    if (wordResolvesSequence) engine.addWord(wordEngine.value.trim());
    else engine.dictionary.add(wordEngine.value.trim());
    view = wordReturnView;
    render();
    toast('Neues Wort gespeichert.');
    $('#send-button').focus();
  } catch (error) { toast((error as Error).message); }
}
$('#message-screen').addEventListener('submit', event => { event.preventDefault(); saveWord(); });
$('#message-screen').addEventListener('input', event => {
  if ((event.target as HTMLElement).id !== 'new-word') return;
  wordEngine.setText((event.target as HTMLInputElement).value);
});

function createMessage(): Message { return { id: crypto.randomUUID(), text: engine.value, date: Date.now() }; }
function sendMessage(): void {
  if (!engine.commit()) { openWordView(); return; }
  if (!engine.value.trim()) { toast('Schreibe zuerst eine Nachricht.'); return; }
  const text = engine.value;
  const previous = state.sent;
  state.sent = [createMessage(), ...previous].slice(0, SENT_LIMIT);
  engine.setText('');
  if (!persist()) {
    state.sent = previous;
    engine.setText(text);
    render();
    toast('Die Nachricht konnte nicht gespeichert werden. Dein Text bleibt erhalten.');
    return;
  }
  render();
  toast('Nachricht gesendet');
}
$('#send-button').addEventListener('click', () => {
  feedback();
  if (view === 'write') sendMessage();
  else activateSelection();
});
$('#call-button').addEventListener('click', () => { feedback(); toast('Kein eingehender Anruf.'); });
$('#hangup-button').addEventListener('click', () => { view = 'menu'; menuIndex = 0; feedback(); render(); });

type SettingAction = 'sound' | 'vibration' | 'language' | 'word' | 'credits' | 'install';
function settingItems(): { action: SettingAction; label: string }[] {
  return [
    { action: 'sound', label: `Tastentöne: ${state.settings.sound ? 'An' : 'Aus'}` },
    { action: 'vibration', label: `Vibration: ${state.settings.vibration ? 'An' : 'Aus'}` },
    { action: 'language', label: `Wörterbuch: ${state.settings.language === 'de' ? 'DE' : 'EN'}` },
    { action: 'word', label: 'Eigenes Wort' },
    { action: 'credits', label: 'Wörterbücher & Lizenzen' },
    ...(updateReady || installEvent ? [{ action: 'install' as const, label: updateReady ? 'Update laden' : 'App installieren' }] : [])
  ];
}
function openSettings(): void { view = 'settings'; settingsIndex = 0; render(); }
async function activateSetting(): Promise<void> {
  const action = settingItems()[settingsIndex]?.action;
  if (action === 'sound') state.settings.sound = !state.settings.sound;
  else if (action === 'vibration') state.settings.vibration = !state.settings.vibration;
  else if (action === 'language') {
    if (!engine.commit()) { openWordView(); return; }
    state.settings.language = state.settings.language === 'de' ? 'en' : 'de';
    engine.dictionary = dictionaries[state.settings.language];
  } else if (action === 'word') { openWordView(false); return; }
  else if (action === 'credits') { view = 'credits'; $('#message-screen').scrollTop = 0; }
  else if (action === 'install') {
    if (updateReady) { persist(); await updateServiceWorker(true); }
    else if (installEvent) {
      const event = installEvent;
      await event.prompt(); await event.userChoice;
      installEvent = undefined;
    }
  }
  render();
  feedback();
}

const keyboard = new Map<string, { start: number; key: string; held: boolean; timer: ReturnType<typeof setTimeout> }>();
window.addEventListener('keydown', event => {
  if (view === 'word' && event.key === 'Escape') { event.preventDefault(); goBack(); return; }
  if (event.ctrlKey || event.metaKey || event.altKey || (event.target as HTMLElement).matches('input, select, textarea')) return;
  const key = event.key;
  if (view !== 'write' && view !== 'word') {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Backspace', 'Escape'].includes(key)) {
      // Focused LCD entries and physical buttons keep their native activation.
      if ((key === 'Enter' || key === ' ') && (event.target as HTMLElement).closest('button, a')) return;
      event.preventDefault();
      if (key === 'Backspace' || key === 'Escape') goBack();
      else if (key === 'Enter' || key === ' ') activateSelection();
      else moveSelection(key === 'ArrowUp' || key === 'ArrowLeft' ? -1 : 1);
    } else if (/^[0-9*#]$/.test(key)) { event.preventDefault(); if (!event.repeat) press(key); }
    return;
  }
  if (/^[0-9*#]$/.test(key)) {
    event.preventDefault();
    if (keyboard.has(event.code)) return;
    const record = { start: Date.now(), key, held: false, timer: setTimeout(() => { record.held = true; press(key, true); }, 500) };
    keyboard.set(event.code, record);
    document.querySelector(`[data-key="${key}"]`)?.classList.add('pressed');
    return;
  }
  const inputEngine = view === 'word' ? wordEngine : engine;
  if (key === 'Backspace') { event.preventDefault(); inputEngine.backspace(); render(); }
  else if (key === ' ' && !(event.target as HTMLElement).closest('button')) { event.preventDefault(); result(inputEngine.tap(' ')); }
  else if (key === 'ArrowUp' || key === 'ArrowDown') { event.preventDefault(); inputEngine.nextCandidate(key === 'ArrowUp' ? 1 : -1); render(); }
  else if (key === 'ArrowLeft' || key === 'ArrowRight') { event.preventDefault(); result(inputEngine.moveCursor(key === 'ArrowLeft' ? -1 : 1)); }
  else if (key === 'Enter' && !(event.target as HTMLElement).closest('button, a')) { event.preventDefault(); if (view === 'word') saveWord(); else result(event.shiftKey ? engine.newline() : engine.commit()); }
});
window.addEventListener('keyup', event => {
  const record = keyboard.get(event.code);
  if (!record) return;
  clearTimeout(record.timer); keyboard.delete(event.code);
  document.querySelector(`[data-key="${record.key}"]`)?.classList.remove('pressed');
  if (!record.held) press(record.key);
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
function syncPwaAction(): void { if (view === 'settings') render(); }
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
