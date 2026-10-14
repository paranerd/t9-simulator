import { describe, expect, it } from 'vitest';
import { initialState, parseState } from '../src/storage';
describe('Local state restoration', () => {
  it('restores active text, settings, drafts and learned words', () => {
    const state = initialState(); state.active = { text: 'Hallo', sequence: '999999' };
    state.settings.language = 'en'; state.settings.mode = 'abc'; state.learned.en.good = 12;
    state.custom.de = ['kevin']; state.drafts = [{ id: 'one', text: 'Hallo', date: 42 }];
    expect(parseState(JSON.stringify(state))).toEqual(state);
  });
  it('recovers from malformed storage and filters invalid records', () => {
    expect(parseState('{broken')).toEqual(initialState());
    const result = parseState(JSON.stringify({ version: 1, settings: { language: 'xx' }, drafts: [{ text: 'bad' }], learned: { de: { '<script>': 7, hallo: 5 } } }));
    expect(result.settings.language).toBe('de'); expect(result.drafts).toEqual([]); expect(result.learned.de).toEqual({ hallo: 5 });
  });
});
