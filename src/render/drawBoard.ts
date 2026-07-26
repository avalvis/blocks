import { getCells, PIECE_COLORS } from '../engine/pieces';
import { BOARD_WIDTH, HIDDEN_ROWS, VISIBLE_HEIGHT, type GameState, type Tetromino } from '../engine/types';

const LOGICAL_WIDTH = 300;
const LOGICAL_HEIGHT = 600;

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, size: number, radius: number): void {
  context.beginPath();
  context.roundRect(x, y, size, size, radius);
}

function drawTile(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: Tetromino,
  alpha = 1,
  ghost = false,
): void {
  const cell = LOGICAL_WIDTH / BOARD_WIDTH;
  const inset = 1.5;
  const px = x * cell + inset;
  const py = (y - HIDDEN_ROWS) * cell + inset;
  const size = cell - inset * 2;
  if (py + size < 0 || py > LOGICAL_HEIGHT) return;

  context.save();
  context.globalAlpha = alpha;
  const color = PIECE_COLORS[type];
  if (ghost) {
    context.strokeStyle = color;
    context.lineWidth = 1.5;
    context.setLineDash([4, 3]);
    roundedRect(context, px + 2, py + 2, size - 4, 4);
    context.stroke();
  } else {
    const gradient = context.createLinearGradient(px, py, px + size, py + size);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.06, color);
    gradient.addColorStop(0.72, color);
    gradient.addColorStop(1, '#5b174f');
    context.fillStyle = gradient;
    context.shadowColor = color;
    context.shadowBlur = 5;
    roundedRect(context, px, py, size, 4);
    context.fill();
    context.shadowBlur = 0;
    context.strokeStyle = 'rgba(255,255,255,.42)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(px + 5, py + 1.5);
    context.lineTo(px + size - 5, py + 1.5);
    context.stroke();
  }
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
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  const backdrop = context.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
  backdrop.addColorStop(0, '#120b25');
  backdrop.addColorStop(1, '#090713');
  context.fillStyle = backdrop;
  context.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  const cell = LOGICAL_WIDTH / BOARD_WIDTH;
  context.strokeStyle = 'rgba(192, 170, 255, .055)';
  context.lineWidth = 1;
  for (let x = 1; x < BOARD_WIDTH; x += 1) {
    context.beginPath();
    context.moveTo(x * cell + 0.5, 0);
    context.lineTo(x * cell + 0.5, LOGICAL_HEIGHT);
    context.stroke();
  }
  for (let y = 1; y < VISIBLE_HEIGHT; y += 1) {
    context.beginPath();
    context.moveTo(0, y * cell + 0.5);
    context.lineTo(LOGICAL_WIDTH, y * cell + 0.5);
    context.stroke();
  }

  state.board.forEach((row, y) => {
    row.forEach((type, x) => {
      if (type) {
        const clearing = state.clearingRows.includes(y);
        const pulse = clearing ? 0.35 + Math.abs(Math.sin(time / 35)) * 0.65 : 1;
        drawTile(context, x, y, type, pulse);
      }
    });
  });

  if (state.active && state.ghostY !== null) {
    getCells(state.active.type, state.active.rotation).forEach((offset) => {
      drawTile(context, state.active!.x + offset.x, state.ghostY! + offset.y, state.active!.type, 0.62, true);
    });
    getCells(state.active.type, state.active.rotation).forEach((offset) => {
      drawTile(context, state.active!.x + offset.x, state.active!.y + offset.y, state.active!.type);
    });
  }

  const vignette = context.createRadialGradient(150, 300, 160, 150, 300, 390);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,.34)');
  context.fillStyle = vignette;
  context.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
}
