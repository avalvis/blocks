import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, loadStoredData, saveStoredData, STORAGE_KEY } from '../../src/lib/storage';

describe('storage', () => {
  it('uses safe defaults for malformed data', () => {
    const storage = { getItem: () => '{not-json' };
    expect(loadStoredData(storage)).toEqual({
      version: 1,
      highScore: 0,
      preferences: DEFAULT_PREFERENCES,
    });
  });

  it('sanitizes persisted values', () => {
    const storage = {
      getItem: () => JSON.stringify({
        version: 1,
        highScore: -10,
        preferences: {
          musicEnabled: false,
          effectsEnabled: true,
          volume: 8,
          helpDismissed: true,
        },
      }),
    };
    const data = loadStoredData(storage);
    expect(data.highScore).toBe(0);
    expect(data.preferences.volume).toBe(1);
    expect(data.preferences.musicEnabled).toBe(false);
  });

  it('writes a versioned save payload', () => {
    const writes: Record<string, string> = {};
    const storage = { setItem: (key: string, value: string) => { writes[key] = value; } };
    saveStoredData({ version: 1, highScore: 900, preferences: DEFAULT_PREFERENCES }, storage);
    expect(JSON.parse(writes[STORAGE_KEY]).highScore).toBe(900);
  });
});
