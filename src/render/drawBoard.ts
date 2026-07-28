import { getCells, PIECE_COLORS } from '../engine/pieces';
import { BOARD_WIDTH, HIDDEN_ROWS, VISIBLE_HEIGHT, type GameState, type Tetromino } from '../engine/types';

const LOGICAL_WIDTH = 300;
const LOGICAL_HEIGHT = 600;
const CELL_SIZE = LOGICAL_WIDTH / BOARD_WIDTH;
const SPRITE_PADDING = 7;

interface RenderCache {
  dpr: number;
  backdrop: HTMLCanvasElement;
  vignette: HTMLCanvasElement;
  tiles: Map<string, HTMLCanvasElement>;
}

const caches = new WeakMap<HTMLCanvasElement, RenderCache>();

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  radius: number,
): void {
  context.beginPath();
  context.roundRect(x, y, size, size, radius);
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function createBackdrop(dpr: number): HTMLCanvasElement {
  const canvas = createCanvas(
    Math.round(LOGICAL_WIDTH * dpr),
    Math.round(LOGICAL_HEIGHT * dpr),
  );
  const context = canvas.getContext('2d')!;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  const backdrop = context.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
  backdrop.addColorStop(0, '#120b25');
  backdrop.addColorStop(1, '#090713');
  context.fillStyle = backdrop;
  context.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  context.strokeStyle = 'rgba(192, 170, 255, .055)';
  context.lineWidth = 1;
  for (let x = 1; x < BOARD_WIDTH; x += 1) {
    context.beginPath();
    context.moveTo(x * CELL_SIZE + 0.5, 0);
    context.lineTo(x * CELL_SIZE + 0.5, LOGICAL_HEIGHT);
    context.stroke();
  }
  for (let y = 1; y < VISIBLE_HEIGHT; y += 1) {
    context.beginPath();
    context.moveTo(0, y * CELL_SIZE + 0.5);
    context.lineTo(LOGICAL_WIDTH, y * CELL_SIZE + 0.5);
    context.stroke();
  }

  return canvas;
}

function createVignette(dpr: number): HTMLCanvasElement {
  const canvas = createCanvas(
    Math.round(LOGICAL_WIDTH * dpr),
    Math.round(LOGICAL_HEIGHT * dpr),
  );
  const context = canvas.getContext('2d')!;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  const vignette = context.createRadialGradient(150, 300, 160, 150, 300, 390);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,.34)');
  context.fillStyle = vignette;
  context.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  return canvas;
}

function createTileSprite(dpr: number, type: Tetromino, ghost: boolean): HTMLCanvasElement {
  const logicalSize = CELL_SIZE + SPRITE_PADDING * 2;
  const canvas = createCanvas(
    Math.ceil(logicalSize * dpr),
    Math.ceil(logicalSize * dpr),
  );
  const context = canvas.getContext('2d')!;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  const inset = 1.5;
  const px = SPRITE_PADDING + inset;
  const size = CELL_SIZE - inset * 2;
  const color = PIECE_COLORS[type];

  if (ghost) {
    context.strokeStyle = color;
    context.lineWidth = 1.5;
    context.setLineDash([4, 3]);
    roundedRect(context, px + 2, px + 2, size - 4, 4);
    context.stroke();
    return canvas;
  }

  const gradient = context.createLinearGradient(px, px, px + size, px + size);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.06, color);
  gradient.addColorStop(0.72, color);
  gradient.addColorStop(1, '#5b174f');
  context.fillStyle = gradient;
  context.shadowColor = color;
  context.shadowBlur = 5;
  roundedRect(context, px, px, size, 4);
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = 'rgba(255,255,255,.42)';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(px + 5, px + 1.5);
  context.lineTo(px + size - 5, px + 1.5);
  context.stroke();
  return canvas;
}

function getCache(canvas: HTMLCanvasElement, dpr: number): RenderCache {
  const current = caches.get(canvas);
  if (current?.dpr === dpr) return current;
  const next: RenderCache = {
    dpr,
    backdrop: createBackdrop(dpr),
    vignette: createVignette(dpr),
    tiles: new Map(),
  };
  caches.set(canvas, next);
  return next;
}

function drawTile(
  context: CanvasRenderingContext2D,
  cache: RenderCache,
  x: number,
  y: number,
  type: Tetromino,
  alpha = 1,
  ghost = false,
): void {
  const py = (y - HIDDEN_ROWS) * CELL_SIZE;
  if (py + CELL_SIZE < 0 || py > LOGICAL_HEIGHT) return;

  const key = `${type}:${ghost ? 'ghost' : 'solid'}`;
  let sprite = cache.tiles.get(key);
  if (!sprite) {
    sprite = createTileSprite(cache.dpr, type, ghost);
    cache.tiles.set(key, sprite);
  }

  const logicalSize = CELL_SIZE + SPRITE_PADDING * 2;
  context.save();
  context.globalAlpha = alpha;
  context.drawImage(
    sprite,
    x * CELL_SIZE - SPRITE_PADDING,
    py - SPRITE_PADDING,
    logicalSize,
    logicalSize,
  );
  context.restore();
}

export function drawBoard(canvas: HTMLCanvasElement, state: GameState, time: number): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const targetWidth = Math.round(LOGICAL_WIDTH * dpr);
  const targetHeight = Math.round(LOGICAL_HEIGHT * dpr);
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  const context = canvas.getContext('2d');
  if (!context) return;
  const cache = getCache(canvas, dpr);
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, targetWidth, targetHeight);
  context.drawImage(cache.backdrop, 0, 0);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  state.board.forEach((row, y) => {
    row.forEach((type, x) => {
      if (type) {
        const clearing = state.clearingRows.includes(y);
        const pulse = clearing ? 0.35 + Math.abs(Math.sin(time / 35)) * 0.65 : 1;
        drawTile(context, cache, x, y, type, pulse);
      }
    });
  });

  if (state.active && state.ghostY !== null) {
    getCells(state.active.type, state.active.rotation).forEach((offset) => {
      drawTile(
        context,
        cache,
        state.active!.x + offset.x,
        state.ghostY! + offset.y,
        state.active!.type,
        0.62,
        true,
      );
    });
    getCells(state.active.type, state.active.rotation).forEach((offset) => {
      drawTile(
        context,
        cache,
        state.active!.x + offset.x,
        state.active!.y + offset.y,
        state.active!.type,
      );
    });
  }

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.drawImage(cache.vignette, 0, 0);
}
