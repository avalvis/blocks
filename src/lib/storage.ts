export interface Preferences {
  musicEnabled: boolean;
  effectsEnabled: boolean;
  volume: number;
  helpDismissed: boolean;
  inputMode: 'keyboard' | 'mouse';
}

export interface StoredData {
  version: 1;
  highScore: number;
  preferences: Preferences;
}

const STORAGE_KEY = 'blocks:save';

export const DEFAULT_PREFERENCES: Preferences = {
  musicEnabled: true,
  effectsEnabled: true,
  volume: 0.65,
  helpDismissed: false,
  inputMode: 'keyboard',
};

export function loadStoredData(storage: Pick<Storage, 'getItem'> = localStorage): StoredData {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) throw new Error('No save');
    const parsed = JSON.parse(raw) as Partial<StoredData>;
    if (parsed.version !== 1 || typeof parsed.highScore !== 'number' || !parsed.preferences) {
      throw new Error('Invalid save');
    }
    return {
      version: 1,
      highScore: Math.max(0, Math.floor(parsed.highScore)),
      preferences: {
        musicEnabled: parsed.preferences.musicEnabled !== false,
        effectsEnabled: parsed.preferences.effectsEnabled !== false,
        volume: Math.min(1, Math.max(0, Number(parsed.preferences.volume) || 0)),
        helpDismissed: parsed.preferences.helpDismissed === true,
        inputMode: parsed.preferences.inputMode === 'mouse' ? 'mouse' : 'keyboard',
      },
    };
  } catch {
    return { version: 1, highScore: 0, preferences: { ...DEFAULT_PREFERENCES } };
  }
}

export function saveStoredData(data: StoredData, storage: Pick<Storage, 'setItem'> = localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage may be unavailable in private browsing; gameplay remains functional.
  }
}

export { STORAGE_KEY };
