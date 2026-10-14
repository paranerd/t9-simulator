import type { InputMode, LetterCase } from './engine';
import type { Language, LearnedWords } from './t9';

export type Message = { id: string; text: string; date: number };
export type Settings = { language: Language; mode: InputMode; casing: LetterCase; sound: boolean; vibration: boolean };
export type State = {
  version: 1;
  settings: Settings;
  active: { text: string; sequence: string };
  drafts: Message[];
  sent: Message[];
  learned: Record<Language, LearnedWords>;
  custom: Record<Language, string[]>;
};
export const STORAGE_KEY = 't9-simulator:v1';
export const initialState = (): State => ({
  version: 1,
  settings: { language: 'de', mode: 't9', casing: 'auto', sound: false, vibration: false },
  active: { text: '', sequence: '' }, drafts: [], sent: [],
  learned: { de: {}, en: {} }, custom: { de: [], en: [] }
});

export function parseState(raw: string | null): State {
  const state = initialState();
  if (!raw) return state;
  try {
    const data = JSON.parse(raw);
    if (data?.version !== 1) return state;
    if (data.settings?.language === 'en') state.settings.language = 'en';
    if (data.settings?.mode === 'abc') state.settings.mode = 'abc';
    if (['lower', 'upper'].includes(data.settings?.casing)) state.settings.casing = data.settings.casing;
    state.settings.sound = data.settings?.sound === true;
    state.settings.vibration = data.settings?.vibration === true;
    state.active.text = typeof data.active?.text === 'string' ? data.active.text.slice(0, 100000) : '';
    state.active.sequence = /^[2-9]{1,100}$/.test(data.active?.sequence) ? data.active.sequence : '';
    for (const folder of ['drafts', 'sent'] as const) {
      if (Array.isArray(data[folder])) state[folder] = data[folder].filter((message: Message) =>
        message && typeof message.id === 'string' && typeof message.text === 'string' &&
        typeof message.date === 'number' && Number.isFinite(message.date)
      ).slice(0, 100);
    }
    for (const language of ['de', 'en'] as const) {
      if (Array.isArray(data.custom?.[language])) state.custom[language] = data.custom[language]
        .filter((word: unknown) => typeof word === 'string' && /^[a-zäöüß]{1,24}$/.test(word)).slice(0, 5000);
      const learned = data.learned?.[language];
      if (learned && typeof learned === 'object') {
        for (const [word, count] of Object.entries(learned)) {
          if (/^[a-zäöüß]{1,24}$/.test(word) && typeof count === 'number' && Number.isFinite(count)) {
            state.learned[language][word] = Math.max(0, Math.min(1000, count));
          }
        }
      }
    }
  } catch { /* A corrupt or older value starts a fresh session. */ }
  return state;
}

export function readState(): State {
  try { return parseState(localStorage.getItem(STORAGE_KEY)); }
  catch { return initialState(); }
}

export function saveState(state: State): boolean {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
  catch { return false; }
}
