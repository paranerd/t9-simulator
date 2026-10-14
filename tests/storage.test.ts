import { describe, expect, it } from 'vitest';
import { initialState, parseState } from '../src/storage';
describe('Local state restoration', () => {
  it('restores active text, settings, sent messages and learned words', () => {
    const state = initialState(); state.active = { text: 'Hallo', sequence: '999999' };
    state.settings.language = 'en'; state.settings.mode = 'abc'; state.learned.en.good = 12;
    state.custom.de = ['kevin']; state.sent = [{ id: 'one', text: 'Hallo', date: 42 }];
    expect(parseState(JSON.stringify(state))).toEqual(state);
  });
  it('recovers from malformed storage and filters invalid records', () => {
    expect(parseState('{broken')).toEqual(initialState());
    const result = parseState(JSON.stringify({ version: 1, settings: { language: 'xx' }, sent: [{ text: 'bad' }], learned: { de: { '<script>': 7, hallo: 5 } } }));
    expect(result.settings.language).toBe('de'); expect(result.sent).toEqual([]); expect(result.learned.de).toEqual({ hallo: 5 });
  });
  it('migrates existing storage to five sent messages and removes legacy drafts', () => {
    const sent = Array.from({ length: 100 }, (_, index) => ({ id: String(index), text: `Nachricht ${index}`, date: 100 - index }));
    const restored = parseState(JSON.stringify({ ...initialState(), sent, drafts: [{ id: 'old', text: 'Entwurf', date: 1 }] }));
    expect(restored.sent).toEqual(sent.slice(0, 5));
    expect(restored).not.toHaveProperty('drafts');
  });
});
