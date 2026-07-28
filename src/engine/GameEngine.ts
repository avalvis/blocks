import { getCells } from './pieces';
import { getKickTests } from './srs';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  HIDDEN_ROWS,
  LINE_CLEAR_DELAY_MS,
  type ActivePiece,
  type Board,
  type EngineOptions,
  type GameEngineApi,
  type GameState,
  type GameStatus,
  type InputAction,
  type Rotation,
  type ScoreEvent,
  type Tetromino,
} from './types';

const PIECE_TYPES: Tetromino[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

function emptyBoard(): Board {
  return Array.from({ length: BOARD_HEIGHT }, () => Array.from({ length: BOARD_WIDTH }, () => null));
}

function initialState(): GameState {
  return {
    status: 'ready',
    board: emptyBoard(),
    active: null,
    aimTarget: null,
    ghostY: null,
    hold: null,
    queue: [],
    canHold: true,
    score: 0,
    level: 1,
    lines: 0,
    combo: -1,
    backToBack: false,
    clearingRows: [],
    lastScoreEvent: null,
    eventId: 0,
  };
}

export class GameEngine implements GameEngineApi {
  private state: GameState = initialState();
  private readonly listeners = new Set<(state: GameState) => void>();
  private readonly random: () => number;
  private readonly clearDelayMs: number;
  private readonly lockDelayMs: number;
  private gravityAccumulator = 0;
  private lockAccumulator = 0;
  private clearAccumulator = 0;
  private lockResets = 0;
  private lastMoveWasRotation = false;
  private pendingTSpin = false;
  private pausedFrom: GameStatus = 'playing';

  constructor(options: EngineOptions = {}) {
    this.random = options.random ?? Math.random;
    this.clearDelayMs = options.clearDelayMs ?? LINE_CLEAR_DELAY_MS;
    this.lockDelayMs = options.lockDelayMs ?? 500;
    this.fillQueue();
  }

  start(): void {
    if (this.state.status === 'ready' || this.state.status === 'gameOver') {
      this.restart();
    }
  }

  restart(): void {
    this.state = initialState();
    this.gravityAccumulator = 0;
    this.lockAccumulator = 0;
    this.clearAccumulator = 0;
    this.lockResets = 0;
    this.lastMoveWasRotation = false;
    this.pendingTSpin = false;
    this.fillQueue();
    this.state.status = 'playing';
    this.spawnNextPiece();
    this.emit();
  }

  tick(deltaMs: number): void {
    const delta = Math.max(0, Math.min(deltaMs, 100));
    if (this.state.status === 'clearing') {
      this.clearAccumulator += delta;
      if (this.clearAccumulator >= this.clearDelayMs) this.finishClear();
      return;
    }
    if (this.state.status !== 'playing' || !this.state.active) return;

    if (this.isGrounded(this.state.active)) {
      this.lockAccumulator += delta;
      if (this.lockAccumulator >= this.lockDelayMs) {
        this.lockPiece();
        return;
      }
    } else {
      this.lockAccumulator = 0;
    }

    this.gravityAccumulator += delta;
    const interval = this.gravityInterval();
    let changed = false;
    while (this.gravityAccumulator >= interval && this.state.active) {
      this.gravityAccumulator -= interval;
      if (this.tryMove(0, 1, false)) {
        changed = true;
      } else {
        break;
      }
    }
    if (changed) this.emit();
  }

  dispatch(action: InputAction): void {
    if (action === 'pause') {
      this.pause();
      return;
    }
    if (this.state.status !== 'playing' || !this.state.active) return;
    this.state.aimTarget = null;

    let changed = false;
    switch (action) {
      case 'moveLeft':
        changed = this.tryMove(-1, 0, true);
        break;
      case 'moveRight':
        changed = this.tryMove(1, 0, true);
        break;
      case 'softDrop':
        changed = this.tryMove(0, 1, true);
        if (changed) {
          this.state.score += 1;
          this.setScoreEvent({ kind: 'drop', points: 1, label: '+1 soft drop' });
        }
        break;
      case 'hardDrop':
        this.hardDrop();
        return;
      case 'rotateCW':
        changed = this.tryRotate(1);
        break;
      case 'rotateCCW':
        changed = this.tryRotate(-1);
        break;
      case 'hold':
        this.holdPiece();
        return;
    }
    if (changed) {
      this.updateGhost();
      this.emit();
    }
  }

  aimAt(boardX: number, boardY: number): void {
    const active = this.state.active;
    if (this.state.status !== 'playing' || !active) return;

    const targetX = Math.max(0, Math.min(BOARD_WIDTH - 1, boardX));
    const targetY = Math.max(HIDDEN_ROWS, Math.min(BOARD_HEIGHT - 1, boardY));
    const previousTarget = this.state.aimTarget;
    const reference = previousTarget ?? active;
    let best: { piece: ActivePiece; score: number } | null = null;
    let stable: { piece: ActivePiece; score: number } | null = null;

    for (let rotationIndex = 0; rotationIndex < 4; rotationIndex += 1) {
      const rotation = rotationIndex as Rotation;
      const cells = getCells(active.type, rotation);
      const minX = Math.min(...cells.map((cell) => cell.x));
      const maxX = Math.max(...cells.map((cell) => cell.x));

      for (let x = -minX; x < BOARD_WIDTH - maxX; x += 1) {
        for (let y = 0; y < BOARD_HEIGHT; y += 1) {
          const candidate: ActivePiece = { type: active.type, rotation, x, y };
          if (this.collides(candidate) || !this.isGrounded(candidate)) continue;

          const landingCells = cells.map((cell) => ({
            x: x + cell.x,
            y: y + cell.y,
          }));
          const pointerDistance = Math.min(...landingCells.map((cell) => (
            Math.pow(cell.x - targetX, 2) + Math.pow((cell.y - targetY) * 0.68, 2)
          )));
          const horizontalCenter = landingCells.reduce((sum, cell) => sum + cell.x, 0)
            / landingCells.length;
          const horizontalDistance = Math.abs(horizontalCenter - targetX);
          const rotationDistance = Math.min(
            Math.abs(rotation - reference.rotation),
            4 - Math.abs(rotation - reference.rotation),
          );
          const movementDistance = Math.abs(x - reference.x);
          const score = pointerDistance * 36
            + horizontalDistance * 4
            + rotationDistance * 2.6
            + movementDistance * 0.12;
          const result = { piece: candidate, score };

          if (
            previousTarget
            && previousTarget.x === x
            && previousTarget.y === y
            && previousTarget.rotation === rotation
          ) stable = result;
          if (!best || score < best.score) best = result;
        }
      }
    }

    if (!best) return;
    if (stable && stable.score <= best.score + 9) best = stable;

    const targetChanged = !previousTarget
      || best.piece.x !== previousTarget.x
      || best.piece.y !== previousTarget.y
      || best.piece.rotation !== previousTarget.rotation;
    const preview = { ...active, x: best.piece.x, rotation: best.piece.rotation };
    const canPreview = !this.collides(preview);
    const activeChanged = canPreview
      && (preview.x !== active.x || preview.rotation !== active.rotation);
    const changed = targetChanged || activeChanged;
    if (!changed) return;

    this.state.aimTarget = best.piece;
    if (activeChanged) {
      this.state.active = preview;
      this.lastMoveWasRotation = preview.rotation !== active.rotation;
      this.updateGhost();
      this.resetGroundLock();
    }
    this.emit();
  }

  commitAim(): void {
    const active = this.state.active;
    const target = this.state.aimTarget;
    if (
      this.state.status !== 'playing'
      || !active
      || !target
      || target.type !== active.type
      || target.y < active.y
      || this.collides(target)
      || !this.isGrounded(target)
    ) {
      this.state.aimTarget = null;
      this.hardDrop();
      return;
    }

    const distance = target.y - active.y;
    const points = Math.max(0, distance) * 2;
    this.lastMoveWasRotation = target.rotation !== active.rotation;
    this.state.active = { ...target };
    this.state.aimTarget = null;
    this.state.ghostY = target.y;
    if (points > 0) {
      this.state.score += points;
      this.setScoreEvent({ kind: 'drop', points, label: `+${points} hard drop` });
    }
    this.lockPiece();
  }

  pause(force?: boolean): void {
    if (force === true) {
      if (this.state.status === 'playing' || this.state.status === 'clearing') {
        this.pausedFrom = this.state.status;
        this.state.status = 'paused';
        this.emit();
      }
      return;
    }
    if (this.state.status === 'playing' || this.state.status === 'clearing') {
      this.pausedFrom = this.state.status;
      this.state.status = 'paused';
      this.emit();
    } else if (this.state.status === 'paused') {
      this.state.status = this.pausedFrom;
      this.emit();
    }
  }

  getState(): GameState {
    return {
      ...this.state,
      board: this.state.board.map((row) => [...row]),
      active: this.state.active ? { ...this.state.active } : null,
      aimTarget: this.state.aimTarget ? { ...this.state.aimTarget } : null,
      queue: [...this.state.queue],
      clearingRows: [...this.state.clearingRows],
      lastScoreEvent: this.state.lastScoreEvent ? { ...this.state.lastScoreEvent } : null,
    };
  }

  subscribe(listener: (state: GameState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private fillQueue(): void {
    while (this.state.queue.length < 7) {
      const bag = [...PIECE_TYPES];
      for (let i = bag.length - 1; i > 0; i -= 1) {
        const j = Math.floor(this.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      this.state.queue.push(...bag);
    }
  }

  private spawnNextPiece(type?: Tetromino): void {
    this.fillQueue();
    const nextType = type ?? this.state.queue.shift()!;
    this.fillQueue();
    const piece: ActivePiece = { type: nextType, rotation: 0, x: 3, y: 0 };
    this.state.active = piece;
    this.state.aimTarget = null;
    this.state.canHold = true;
    this.gravityAccumulator = 0;
    this.lockAccumulator = 0;
    this.lockResets = 0;
    this.lastMoveWasRotation = false;
    if (this.collides(piece)) {
      this.endGame();
      return;
    }
    this.updateGhost();
  }

  private holdPiece(): void {
    const active = this.state.active;
    if (!active || !this.state.canHold) return;
    const held = this.state.hold;
    this.state.hold = active.type;
    this.state.active = null;
    this.spawnNextPiece(held ?? undefined);
    this.state.canHold = false;
    this.emit();
  }

  private tryMove(dx: number, dy: number, playerMove: boolean): boolean {
    const active = this.state.active;
    if (!active) return false;
    const candidate = { ...active, x: active.x + dx, y: active.y + dy };
    if (this.collides(candidate)) return false;
    this.state.active = candidate;
    if (playerMove) {
      this.lastMoveWasRotation = false;
      this.resetGroundLock();
    }
    return true;
  }

  private tryRotate(direction: 1 | -1): boolean {
    const active = this.state.active;
    if (!active) return false;
    const nextRotation = ((active.rotation + direction + 4) % 4) as Rotation;
    for (const kick of getKickTests(active.type, active.rotation, nextRotation)) {
      const candidate = {
        ...active,
        rotation: nextRotation,
        x: active.x + kick.x,
        y: active.y + kick.y,
      };
      if (!this.collides(candidate)) {
        this.state.active = candidate;
        this.lastMoveWasRotation = true;
        this.resetGroundLock();
        return true;
      }
    }
    return false;
  }

  private resetGroundLock(): void {
    if (this.state.active && this.isGrounded(this.state.active) && this.lockResets < 15) {
      this.lockAccumulator = 0;
      this.lockResets += 1;
    }
  }

  private hardDrop(): void {
    if (!this.state.active) return;
    let distance = 0;
    while (this.tryMove(0, 1, false)) distance += 1;
    const points = distance * 2;
    if (points > 0) {
      this.state.score += points;
      this.setScoreEvent({ kind: 'drop', points, label: `+${points} hard drop` });
    }
    this.lockPiece();
  }

  private lockPiece(): void {
    const active = this.state.active;
    if (!active) return;
    this.state.aimTarget = null;
    const tSpin = this.detectTSpin(active);
    for (const cell of getCells(active.type, active.rotation)) {
      const x = active.x + cell.x;
      const y = active.y + cell.y;
      if (y >= 0 && y < BOARD_HEIGHT) this.state.board[y][x] = active.type;
    }
    const fullRows: number[] = [];
    for (let y = 0; y < BOARD_HEIGHT; y += 1) {
      if (this.state.board[y].every(Boolean)) fullRows.push(y);
    }
    this.state.active = null;
    this.pendingTSpin = tSpin;
    if (fullRows.length > 0) {
      this.state.clearingRows = fullRows;
      this.state.status = 'clearing';
      this.clearAccumulator = 0;
      this.emit();
      return;
    }
    this.applyScore(0, tSpin);
    this.state.combo = -1;
    if (this.hasHiddenBlocks()) {
      this.endGame();
    } else {
      this.spawnNextPiece();
      this.emit();
    }
  }

  private finishClear(): void {
    const rows = new Set(this.state.clearingRows);
    const remaining = this.state.board.filter((_, index) => !rows.has(index));
    while (remaining.length < BOARD_HEIGHT) {
      remaining.unshift(Array.from({ length: BOARD_WIDTH }, () => null));
    }
    this.state.board = remaining;
    const lineCount = this.state.clearingRows.length;
    this.state.clearingRows = [];
    this.clearAccumulator = 0;
    this.applyScore(lineCount, this.pendingTSpin);
    this.state.lines += lineCount;
    this.state.level = Math.floor(this.state.lines / 10) + 1;
    this.pendingTSpin = false;
    if (this.hasHiddenBlocks()) {
      this.endGame();
      return;
    }
    this.state.status = 'playing';
    this.spawnNextPiece();
    this.emit();
  }

  private applyScore(lines: number, tSpin: boolean): void {
    let base = 0;
    let kind: ScoreEvent['kind'] = 'single';
    let label = '';
    if (tSpin) {
      const values = [400, 800, 1200, 1600];
      base = values[lines] ?? 0;
      kind = lines === 0 ? 'tSpin' : (`tSpin${['', 'Single', 'Double', 'Triple'][lines]}` as ScoreEvent['kind']);
      label = lines === 0 ? 'T-SPIN' : `T-SPIN ${['', 'SINGLE', 'DOUBLE', 'TRIPLE'][lines]}`;
    } else if (lines > 0) {
      const values = [0, 100, 300, 500, 800];
      base = values[lines];
      kind = (['', 'single', 'double', 'triple', 'tetris'][lines] ?? 'single') as ScoreEvent['kind'];
      label = lines === 4 ? 'FOUR LINES' : `${['', 'SINGLE', 'DOUBLE', 'TRIPLE'][lines]}`;
    }
    if (lines > 0) this.state.combo += 1;
    const difficult = lines === 4 || (tSpin && lines > 0);
    const b2bBonus = difficult && this.state.backToBack;
    if (b2bBonus) base = Math.floor(base * 1.5);
    if (difficult) this.state.backToBack = true;
    else if (lines > 0) this.state.backToBack = false;

    const comboPoints = lines > 0 && this.state.combo > 0 ? 50 * this.state.combo * this.state.level : 0;
    const points = base * this.state.level + comboPoints;
    if (points > 0) {
      this.state.score += points;
      const suffix = [
        b2bBonus ? 'BACK-TO-BACK' : '',
        this.state.combo > 0 ? `${this.state.combo + 1} COMBO` : '',
      ].filter(Boolean).join(' · ');
      this.setScoreEvent({
        kind: b2bBonus ? 'backToBack' : kind,
        points,
        label: suffix ? `${label} · ${suffix}` : label,
      });
    }
  }

  private detectTSpin(piece: ActivePiece): boolean {
    if (piece.type !== 'T' || !this.lastMoveWasRotation) return false;
    const pivotX = piece.x + 1;
    const pivotY = piece.y + 1;
    const corners = [
      { x: pivotX - 1, y: pivotY - 1 },
      { x: pivotX + 1, y: pivotY - 1 },
      { x: pivotX - 1, y: pivotY + 1 },
      { x: pivotX + 1, y: pivotY + 1 },
    ];
    return corners.filter(({ x, y }) => (
      x < 0 || x >= BOARD_WIDTH || y < 0 || y >= BOARD_HEIGHT || Boolean(this.state.board[y][x])
    )).length >= 3;
  }

  private collides(piece: ActivePiece): boolean {
    return getCells(piece.type, piece.rotation).some((cell) => {
      const x = piece.x + cell.x;
      const y = piece.y + cell.y;
      return x < 0 || x >= BOARD_WIDTH || y >= BOARD_HEIGHT || (y >= 0 && Boolean(this.state.board[y][x]));
    });
  }

  private isGrounded(piece: ActivePiece): boolean {
    return this.collides({ ...piece, y: piece.y + 1 });
  }

  private updateGhost(): void {
    const active = this.state.active;
    if (!active) {
      this.state.ghostY = null;
      return;
    }
    let y = active.y;
    while (!this.collides({ ...active, y: y + 1 })) y += 1;
    this.state.ghostY = y;
  }

  private gravityInterval(): number {
    const base = 0.8 - (this.state.level - 1) * 0.007;
    return Math.max(20, Math.pow(Math.max(base, 0.05), this.state.level - 1) * 1000);
  }

  private hasHiddenBlocks(): boolean {
    return this.state.board.slice(0, HIDDEN_ROWS).some((row) => row.some(Boolean));
  }

  private endGame(): void {
    this.state.status = 'gameOver';
    this.state.active = null;
    this.state.aimTarget = null;
    this.state.ghostY = null;
    this.emit();
  }

  private setScoreEvent(event: ScoreEvent): void {
    this.state.lastScoreEvent = event;
    this.state.eventId += 1;
  }

  private emit(): void {
    const snapshot = this.getState();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
