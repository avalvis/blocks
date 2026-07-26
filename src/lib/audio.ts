import type { InputAction, ScoreEvent } from '../engine/types';
import type { Preferences } from './storage';

export class ArcadeAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicTimer: number | null = null;
  private step = 0;
  private preferences: Preferences;

  constructor(preferences: Preferences) {
    this.preferences = preferences;
  }

  async unlock(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
      this.applyVolume();
    }
    if (this.context.state === 'suspended') await this.context.resume();
    this.syncMusic();
  }

  update(preferences: Preferences): void {
    this.preferences = preferences;
    this.applyVolume();
    this.syncMusic();
  }

  playAction(action: InputAction): void {
    if (!this.preferences.effectsEnabled) return;
    const map: Partial<Record<InputAction, [number, number, OscillatorType]>> = {
      moveLeft: [160, 0.025, 'square'],
      moveRight: [180, 0.025, 'square'],
      rotateCW: [330, 0.055, 'triangle'],
      rotateCCW: [280, 0.055, 'triangle'],
      hold: [440, 0.09, 'sine'],
      hardDrop: [95, 0.1, 'sawtooth'],
    };
    const sound = map[action];
    if (sound) this.tone(...sound, 0.08);
  }

  playScore(event: ScoreEvent): void {
    if (!this.preferences.effectsEnabled) return;
    const notes = event.kind === 'tetris' || event.kind === 'backToBack'
      ? [392, 523, 659, 784]
      : event.kind.startsWith('tSpin')
        ? [330, 494, 660]
        : event.kind === 'drop'
          ? []
          : [392, 523];
    notes.forEach((frequency, index) => {
      window.setTimeout(() => this.tone(frequency, 0.12, 'triangle', 0.13), index * 55);
    });
  }

  playGameOver(): void {
    if (!this.preferences.effectsEnabled) return;
    [220, 174, 130, 98].forEach((frequency, index) => {
      window.setTimeout(() => this.tone(frequency, 0.22, 'sawtooth', 0.1), index * 130);
    });
  }

  dispose(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    void this.context?.close();
  }

  private syncMusic(): void {
    if (!this.context || !this.preferences.musicEnabled) {
      if (this.musicTimer !== null) {
        window.clearInterval(this.musicTimer);
        this.musicTimer = null;
      }
      return;
    }
    if (this.musicTimer !== null) return;
    const sequence = [110, 165, 220, 147, 196, 247, 165, 220];
    const playStep = () => {
      const root = sequence[this.step % sequence.length];
      this.tone(root, 0.16, 'triangle', 0.035);
      if (this.step % 2 === 0) this.tone(root * 2, 0.08, 'sine', 0.018);
      this.step += 1;
    };
    playStep();
    this.musicTimer = window.setInterval(playStep, 240);
  }

  private applyVolume(): void {
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this.preferences.volume, this.context.currentTime, 0.02);
    }
  }

  private tone(frequency: number, duration: number, type: OscillatorType, gainValue: number): void {
    if (!this.context || !this.master) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, this.context.currentTime);
    gain.gain.setValueAtTime(gainValue, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start();
    oscillator.stop(this.context.currentTime + duration);
  }
}
