export const BOARD_WIDTH = 10;
export const VISIBLE_HEIGHT = 20;
export const HIDDEN_ROWS = 2;
export const BOARD_HEIGHT = VISIBLE_HEIGHT + HIDDEN_ROWS;

export type Tetromino = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';
export type Rotation = 0 | 1 | 2 | 3;
export type Cell = Tetromino | null;
export type Board = Cell[][];
export type GameStatus = 'ready' | 'playing' | 'paused' | 'clearing' | 'gameOver';

export interface Point {
  x: number;
  y: number;
}

export interface ActivePiece {
  type: Tetromino;
  rotation: Rotation;
  x: number;
  y: number;
}

export type InputAction =
  | 'moveLeft'
  | 'moveRight'
  | 'softDrop'
  | 'hardDrop'
  | 'rotateCW'
  | 'rotateCCW'
  | 'hold'
  | 'pause';

export type ScoreEventKind =
  | 'single'
  | 'double'
  | 'triple'
  | 'tetris'
  | 'tSpin'
  | 'tSpinSingle'
  | 'tSpinDouble'
  | 'tSpinTriple'
  | 'combo'
  | 'backToBack'
  | 'drop';

export interface ScoreEvent {
  kind: ScoreEventKind;
  points: number;
  label: string;
}

export interface GameState {
  status: GameStatus;
  board: Board;
  active: ActivePiece | null;
  ghostY: number | null;
  hold: Tetromino | null;
  queue: Tetromino[];
  canHold: boolean;
  score: number;
  level: number;
  lines: number;
  combo: number;
  backToBack: boolean;
  clearingRows: number[];
  lastScoreEvent: ScoreEvent | null;
  eventId: number;
}

export interface EngineOptions {
  random?: () => number;
  clearDelayMs?: number;
  lockDelayMs?: number;
}

export interface GameEngineApi {
  start(): void;
  restart(): void;
  tick(deltaMs: number): void;
  dispatch(action: InputAction): void;
  pause(force?: boolean): void;
  getState(): GameState;
  subscribe(listener: (state: GameState) => void): () => void;
}
