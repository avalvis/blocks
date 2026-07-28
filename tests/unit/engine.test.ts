import { describe, expect, it } from 'vitest';
import { GameEngine } from '../../src/engine/GameEngine';
import { getCells } from '../../src/engine/pieces';
import { getKickTests } from '../../src/engine/srs';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  type ActivePiece,
  type GameState,
  type Tetromino,
} from '../../src/engine/types';

type EngineInternals = {
  state: GameState;
  lastMoveWasRotation: boolean;
  detectTSpin: (piece: ActivePiece) => boolean;
};

function internals(engine: GameEngine): EngineInternals {
  return engine as unknown as EngineInternals;
}

function occupiedCount(state: GameState): number {
  return state.board.flat().filter(Boolean).length;
}

function tickFor(engine: GameEngine, durationMs: number): void {
  let remaining = durationMs;
  while (remaining > 0) {
    const frame = Math.min(100, remaining);
    engine.tick(frame);
    remaining -= frame;
  }
}

describe('GameEngine', () => {
  it('starts with a valid seven-bag and active piece', () => {
    const engine = new GameEngine({ random: () => 0.42 });
    engine.start();
    const state = engine.getState();
    const firstSeven = [state.active!.type, ...state.queue.slice(0, 6)];

    expect(state.status).toBe('playing');
    expect(new Set(firstSeven).size).toBe(7);
    expect(state.ghostY).not.toBeNull();
  });

  it('allows hold once per piece and resets it after locking', () => {
    const engine = new GameEngine({ random: () => 0.2, clearDelayMs: 0 });
    engine.start();
    const first = engine.getState().active!.type;
    engine.dispatch('hold');
    const afterHold = engine.getState();

    expect(afterHold.hold).toBe(first);
    expect(afterHold.canHold).toBe(false);
    const activeAfterHold = afterHold.active!.type;
    engine.dispatch('hold');
    expect(engine.getState().active!.type).toBe(activeAfterHold);

    engine.dispatch('hardDrop');
    expect(engine.getState().canHold).toBe(true);
  });

  it('awards hard-drop points and locks exactly four cells', () => {
    const engine = new GameEngine({ random: () => 0.5 });
    engine.start();
    engine.dispatch('hardDrop');
    const state = engine.getState();

    expect(state.score).toBeGreaterThan(0);
    expect(occupiedCount(state)).toBe(4);
    expect(state.active).not.toBeNull();
  });

  it('pauses simulation without accumulating elapsed time', () => {
    const engine = new GameEngine({ random: () => 0.4 });
    engine.start();
    const y = engine.getState().active!.y;
    engine.pause();
    engine.tick(10_000);

    expect(engine.getState().status).toBe('paused');
    expect(engine.getState().active!.y).toBe(y);

    engine.pause();
    tickFor(engine, 999);
    expect(engine.getState().active!.y).toBe(y);
    engine.tick(1);
    expect(engine.getState().active!.y).toBe(y + 1);
  });

  it('respects the 500ms lock delay and resets it after a grounded move', () => {
    const engine = new GameEngine({ random: () => 0.1, lockDelayMs: 500 });
    engine.start();
    const data = internals(engine);
    data.state.active = { type: 'O', rotation: 0, x: 3, y: BOARD_HEIGHT - 2 };
    data.state.ghostY = BOARD_HEIGHT - 2;

    tickFor(engine, 499);
    expect(occupiedCount(engine.getState())).toBe(0);
    engine.dispatch('moveLeft');
    tickFor(engine, 499);
    expect(occupiedCount(engine.getState())).toBe(0);
    engine.tick(1);
    expect(occupiedCount(engine.getState())).toBe(4);
  });

  it('clears a line, scores it, and advances the line count', () => {
    const engine = new GameEngine({ random: () => 0.3, clearDelayMs: 100 });
    engine.start();
    const data = internals(engine);
    data.state.board[BOARD_HEIGHT - 1] = Array.from(
      { length: BOARD_WIDTH },
      (_, x) => (x >= 3 && x <= 6 ? null : 'J'),
    );
    data.state.active = { type: 'I', rotation: 0, x: 3, y: BOARD_HEIGHT - 2 };
    data.state.ghostY = BOARD_HEIGHT - 2;

    engine.dispatch('hardDrop');
    expect(engine.getState().status).toBe('clearing');
    engine.tick(100);
    const state = engine.getState();

    expect(state.lines).toBe(1);
    expect(state.score).toBe(100);
    expect(state.lastScoreEvent?.kind).toBe('single');
  });

  it('scores a four-line clear and marks it back-to-back eligible', () => {
    const engine = new GameEngine({ random: () => 0.3, clearDelayMs: 0 });
    engine.start();
    const data = internals(engine);
    for (let y = BOARD_HEIGHT - 4; y < BOARD_HEIGHT; y += 1) {
      data.state.board[y] = Array.from({ length: BOARD_WIDTH }, (_, x) => (x === 5 ? null : 'L'));
    }
    data.state.active = { type: 'I', rotation: 1, x: 3, y: BOARD_HEIGHT - 4 };
    data.state.ghostY = BOARD_HEIGHT - 4;

    engine.dispatch('hardDrop');
    engine.tick(0);
    const state = engine.getState();
    expect(state.lines).toBe(4);
    expect(state.score).toBe(800);
    expect(state.backToBack).toBe(true);
    expect(state.lastScoreEvent?.kind).toBe('tetris');
  });

  it('detects a T-spin from three occupied pivot corners', () => {
    const engine = new GameEngine({ random: () => 0.4 });
    engine.start();
    const data = internals(engine);
    const piece: ActivePiece = { type: 'T', rotation: 0, x: 3, y: 10 };
    data.state.board[10][3] = 'J';
    data.state.board[10][5] = 'J';
    data.state.board[12][3] = 'J';
    data.lastMoveWasRotation = true;

    expect(data.detectTSpin(piece)).toBe(true);
  });

  it('supports rotations and publishes SRS kick candidates for every piece family', () => {
    const types: Tetromino[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
    for (const type of types) {
      expect(getCells(type, 0)).toHaveLength(4);
      expect(getCells(type, 1)).toHaveLength(4);
      expect(getCells(type, 2)).toHaveLength(4);
      expect(getCells(type, 3)).toHaveLength(4);
      expect(getKickTests(type, 0, 1).length).toBe(type === 'O' ? 1 : 5);
    }
  });

  it('aims a piece toward the mouse target and selects a legal landing', () => {
    const engine = new GameEngine({ random: () => 0.2 });
    engine.start();
    const data = internals(engine);
    data.state.active = { type: 'T', rotation: 0, x: 3, y: 0 };
    data.state.ghostY = 19;

    engine.aimAt(9, BOARD_HEIGHT - 1);
    const right = engine.getState();
    const rightCells = getCells(right.active!.type, right.active!.rotation)
      .map((cell) => right.active!.x + cell.x);
    expect(Math.max(...rightCells)).toBeGreaterThanOrEqual(8);
    expect(right.aimTarget).not.toBeNull();
    expect(right.ghostY).not.toBeNull();

    engine.aimAt(0, BOARD_HEIGHT - 1);
    const left = engine.getState();
    const leftCells = getCells(left.active!.type, left.active!.rotation)
      .map((cell) => left.active!.x + cell.x);
    expect(Math.min(...leftCells)).toBeLessThanOrEqual(1);

    engine.commitAim();
    expect(occupiedCount(engine.getState())).toBe(4);
    expect(engine.getState().aimTarget).toBeNull();
  });

  it('wall-kicks a T piece away from an obstructed boundary', () => {
    const engine = new GameEngine({ random: () => 0.2 });
    engine.start();
    const data = internals(engine);
    data.state.active = { type: 'T', rotation: 1, x: -1, y: 8 };
    data.state.ghostY = 18;

    engine.dispatch('rotateCCW');
    const active = engine.getState().active!;
    expect(active.rotation).toBe(0);
    expect(active.x).toBeGreaterThanOrEqual(0);
  });
});
