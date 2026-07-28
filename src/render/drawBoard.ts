import { getCells, PIECE_COLORS } from '../engine/pieces';
import {
  BOARD_WIDTH,
  HIDDEN_ROWS,
  LINE_CLEAR_DELAY_MS,
  VISIBLE_HEIGHT,
  type GameState,
  type Rotation,
  type Tetromino,
} from '../engine/types';

const LOGICAL_WIDTH = 300;
const LOGICAL_HEIGHT = 600;
const CELL_SIZE = LOGICAL_WIDTH / BOARD_WIDTH;
const SPRITE_PADDING = 9;

type TileVariant = 'solid' | 'ghost' | 'flash';

interface RenderCache {
  dpr: number;
  backdrop: HTMLCanvasElement;
  vignette: HTMLCanvasElement;
  tiles: Map<string, HTMLCanvasElement>;
  clearKey: string;
  clearStartedAt: number;
  visualX: number | null;
  visualType: Tetromino | null;
  visualRotation: Rotation | null;
  rotationStartedAt: number;
  lastFrameTime: number;
}

interface DrawBoardOptions {
  smoothMovement?: boolean;
}

const caches = new WeakMap<HTMLCanvasElement, RenderCache>();

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - clamp01(value), 3);
}

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

function createTileSprite(
  dpr: number,
  type: Tetromino,
  variant: TileVariant,
): HTMLCanvasElement {
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

  if (variant === 'ghost') {
    context.strokeStyle = color;
    context.lineWidth = 1.5;
    context.setLineDash([4, 3]);
    roundedRect(context, px + 2, px + 2, size - 4, 4);
    context.stroke();
    return canvas;
  }

  const gradient = context.createLinearGradient(px, px, px + size, px + size);
  if (variant === 'flash') {
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.48, '#eaffff');
    gradient.addColorStop(1, color);
    context.shadowColor = '#ffffff';
    context.shadowBlur = 12;
  } else {
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.06, color);
    gradient.addColorStop(0.72, color);
    gradient.addColorStop(1, '#5b174f');
    context.shadowColor = color;
    context.shadowBlur = 5;
  }
  context.fillStyle = gradient;
  roundedRect(context, px, px, size, 4);
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = variant === 'flash' ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.42)';
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
    clearKey: '',
    clearStartedAt: 0,
    visualX: null,
    visualType: null,
    visualRotation: null,
    rotationStartedAt: 0,
    lastFrameTime: 0,
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
  variant: TileVariant = 'solid',
  scale = 1,
): void {
  const py = (y - HIDDEN_ROWS) * CELL_SIZE;
  if (py + CELL_SIZE < 0 || py > LOGICAL_HEIGHT) return;

  const key = `${type}:${variant}`;
  let sprite = cache.tiles.get(key);
  if (!sprite) {
    sprite = createTileSprite(cache.dpr, type, variant);
    cache.tiles.set(key, sprite);
  }

  const logicalSize = CELL_SIZE + SPRITE_PADDING * 2;
  const scaledSize = logicalSize * scale;
  const centerOffset = (logicalSize - scaledSize) / 2;
  context.save();
  context.globalAlpha = alpha;
  context.drawImage(
    sprite,
    x * CELL_SIZE - SPRITE_PADDING + centerOffset,
    py - SPRITE_PADDING + centerOffset,
    scaledSize,
    scaledSize,
  );
  context.restore();
}

function drawLineClearEffects(
  context: CanvasRenderingContext2D,
  rows: number[],
  progress: number,
  time: number,
): void {
  if (rows.length === 0) return;
  const sweep = easeOutCubic((progress - 0.14) / 0.58);
  const sweepX = -35 + sweep * (LOGICAL_WIDTH + 70);
  const fade = 1 - easeOutCubic((progress - 0.7) / 0.3);

  context.save();
  context.globalCompositeOperation = 'lighter';
  for (const row of rows) {
    const y = (row - HIDDEN_ROWS) * CELL_SIZE;
    if (y + CELL_SIZE < 0 || y > LOGICAL_HEIGHT) continue;

    const beam = context.createLinearGradient(sweepX - 65, 0, sweepX + 65, 0);
    beam.addColorStop(0, 'rgba(34,230,227,0)');
    beam.addColorStop(0.42, `rgba(34,230,227,${0.26 * fade})`);
    beam.addColorStop(0.5, `rgba(255,255,255,${0.88 * fade})`);
    beam.addColorStop(0.58, `rgba(240,110,255,${0.34 * fade})`);
    beam.addColorStop(1, 'rgba(240,110,255,0)');
    context.fillStyle = beam;
    context.fillRect(0, y - 5, LOGICAL_WIDTH, CELL_SIZE + 10);

    const shardProgress = clamp01((progress - 0.46) / 0.54);
    if (shardProgress > 0 && shardProgress < 1) {
      for (let x = 0; x < BOARD_WIDTH; x += 1) {
        const direction = x < BOARD_WIDTH / 2 ? -1 : 1;
        const seed = (row * 37 + x * 19) % 11;
        const drift = direction * (8 + seed * 1.5) * shardProgress;
        const lift = (5 + (seed % 5) * 2) * Math.sin(shardProgress * Math.PI);
        const shardX = x * CELL_SIZE + CELL_SIZE / 2 + drift;
        const shardY = y + CELL_SIZE / 2 - lift;
        const size = 2 + (seed % 3);
        context.globalAlpha = (1 - shardProgress) * 0.8;
        context.fillStyle = x % 2 === 0 ? '#bfffff' : '#f7b8ff';
        context.fillRect(shardX, shardY, size, size);
      }
    }
  }

  const pulse = Math.max(0, Math.sin(clamp01((progress - 0.2) / 0.62) * Math.PI));
  context.globalAlpha = pulse * Math.min(0.2 + rows.length * 0.045, 0.38);
  context.fillStyle = `rgba(170,120,255,${0.32 + Math.sin(time / 24) * 0.05})`;
  context.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  context.restore();
}

export function drawBoard(
  canvas: HTMLCanvasElement,
  state: GameState,
  time: number,
  options: DrawBoardOptions = {},
): boolean {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const targetWidth = Math.round(LOGICAL_WIDTH * dpr);
  const targetHeight = Math.round(LOGICAL_HEIGHT * dpr);
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  const context = canvas.getContext('2d');
  if (!context) return false;
  const cache = getCache(canvas, dpr);
  const delta = cache.lastFrameTime > 0 ? Math.min(40, time - cache.lastFrameTime) : 16;
  cache.lastFrameTime = time;

  const clearKey = state.status === 'clearing' ? state.clearingRows.join(',') : '';
  if (clearKey && clearKey !== cache.clearKey) {
    cache.clearKey = clearKey;
    cache.clearStartedAt = time;
  } else if (!clearKey) {
    cache.clearKey = '';
    cache.clearStartedAt = 0;
  }
  const clearProgress = clearKey
    ? clamp01((time - cache.clearStartedAt) / LINE_CLEAR_DELAY_MS)
    : 0;

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, targetWidth, targetHeight);
  context.drawImage(cache.backdrop, 0, 0);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (clearKey) {
    const shake = Math.sin(time * 0.34) * Math.sin(clearProgress * Math.PI) * 1.15;
    context.translate(shake, 0);
  }

  state.board.forEach((row, y) => {
    row.forEach((type, x) => {
      if (!type) return;
      const clearing = state.clearingRows.includes(y);
      if (!clearing) {
        drawTile(context, cache, x, y, type);
        return;
      }

      const blink = clearProgress < 0.48 && Math.floor(clearProgress * 12) % 2 === 1;
      const dissolve = clamp01((clearProgress - 0.62) / 0.38);
      const alpha = 1 - easeOutCubic(dissolve) * 0.92;
      const scale = 1 + Math.sin(dissolve * Math.PI) * 0.12;
      drawTile(context, cache, x, y, type, alpha, blink ? 'flash' : 'solid', scale);
    });
  });

  let needsMoreFrames = false;
  const active = state.active;
  if (active) {
    if (cache.visualType !== active.type || cache.visualX === null || !options.smoothMovement) {
      cache.visualX = active.x;
      cache.visualType = active.type;
      cache.visualRotation = active.rotation;
      cache.rotationStartedAt = time;
    } else {
      const factor = 1 - Math.exp(-delta / 36);
      cache.visualX += (active.x - cache.visualX) * factor;
      if (Math.abs(active.x - cache.visualX) < 0.008) cache.visualX = active.x;
      else needsMoreFrames = true;

      if (cache.visualRotation !== active.rotation) {
        cache.visualRotation = active.rotation;
        cache.rotationStartedAt = time;
      }
    }

    const target = state.aimTarget;
    if (target) {
      getCells(target.type, target.rotation).forEach((offset) => {
        drawTile(
          context,
          cache,
          target.x + offset.x,
          target.y + offset.y,
          target.type,
          0.76,
          'ghost',
        );
      });
    } else if (state.ghostY !== null) {
      getCells(active.type, active.rotation).forEach((offset) => {
        drawTile(
          context,
          cache,
          (cache.visualX ?? active.x) + offset.x,
          state.ghostY! + offset.y,
          active.type,
          0.62,
          'ghost',
        );
      });
    }

    const rotationProgress = clamp01((time - cache.rotationStartedAt) / 82);
    if (rotationProgress < 1 && options.smoothMovement) needsMoreFrames = true;
    const activeScale = options.smoothMovement ? 0.9 + easeOutCubic(rotationProgress) * 0.1 : 1;
    const activeAlpha = options.smoothMovement ? 0.72 + easeOutCubic(rotationProgress) * 0.28 : 1;
    getCells(active.type, active.rotation).forEach((offset) => {
      drawTile(
        context,
        cache,
        (cache.visualX ?? active.x) + offset.x,
        active.y + offset.y,
        active.type,
        activeAlpha,
        'solid',
        activeScale,
      );
    });
  } else {
    cache.visualX = null;
    cache.visualType = null;
    cache.visualRotation = null;
  }

  if (clearKey) drawLineClearEffects(context, state.clearingRows, clearProgress, time);

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.drawImage(cache.vignette, 0, 0);
  return needsMoreFrames || Boolean(clearKey);
}
