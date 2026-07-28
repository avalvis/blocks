import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { GameEngine } from './engine/GameEngine';
import { getCells, PIECE_COLORS } from './engine/pieces';
import {
  BOARD_WIDTH,
  HIDDEN_ROWS,
  VISIBLE_HEIGHT,
  type GameState,
  type InputAction,
  type Tetromino,
} from './engine/types';
import { ArcadeAudio } from './lib/audio';
import {
  loadStoredData,
  saveStoredData,
  type Preferences,
  type StoredData,
} from './lib/storage';
import { drawBoard } from './render/drawBoard';

const KEY_ACTIONS: Record<string, InputAction> = {
  ArrowLeft: 'moveLeft',
  a: 'moveLeft',
  A: 'moveLeft',
  ArrowRight: 'moveRight',
  d: 'moveRight',
  D: 'moveRight',
  ArrowDown: 'softDrop',
  s: 'softDrop',
  S: 'softDrop',
  ArrowUp: 'rotateCW',
  w: 'rotateCW',
  W: 'rotateCW',
  x: 'rotateCW',
  X: 'rotateCW',
  z: 'rotateCCW',
  Z: 'rotateCCW',
  q: 'rotateCCW',
  Q: 'rotateCCW',
  ' ': 'hardDrop',
  c: 'hold',
  C: 'hold',
  Shift: 'hold',
  p: 'pause',
  P: 'pause',
  Escape: 'pause',
};

const REPEATING_ACTIONS = new Set<InputAction>(['moveLeft', 'moveRight', 'softDrop']);

function formatScore(value: number): string {
  return value.toLocaleString('en-US', { minimumIntegerDigits: 6, useGrouping: true });
}

function PreviewPiece({ type, label }: { type: Tetromino | null; label: string }) {
  if (!type) {
    return <div className="preview-grid empty" aria-label={`${label}: empty`} />;
  }
  const cells = getCells(type, 0);
  const minX = Math.min(...cells.map((cell) => cell.x));
  const minY = Math.min(...cells.map((cell) => cell.y));
  return (
    <div className="preview-grid" role="img" aria-label={`${label}: ${type} piece`}>
      {cells.map((cell, index) => (
        <span
          className="preview-cell"
          key={`${cell.x}-${cell.y}-${index}`}
          style={{
            '--piece-color': PIECE_COLORS[type],
            gridColumn: cell.x - minX + 1,
            gridRow: cell.y - minY + 1,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

function IconButton({
  label,
  children,
  onClick,
  active,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button className={`icon-button${active ? ' active' : ''}`} type="button" onClick={onClick} aria-label={label}>
      {children}
    </button>
  );
}

function ControlModeSwitch({
  mode,
  onChange,
  compact = false,
}: {
  mode: Preferences['inputMode'];
  onChange: (mode: Preferences['inputMode']) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`mode-switch${compact ? ' compact' : ''}`}
      role="group"
      aria-label="Desktop control mode"
    >
      <button
        type="button"
        className={mode === 'keyboard' ? 'active' : ''}
        aria-pressed={mode === 'keyboard'}
        onClick={() => onChange('keyboard')}
      >
        Keys
      </button>
      <button
        type="button"
        className={mode === 'mouse' ? 'active' : ''}
        aria-pressed={mode === 'mouse'}
        onClick={() => onChange('mouse')}
      >
        Mouse
      </button>
    </div>
  );
}

function IntroGraphic() {
  const stackCells = [
    { x: 0, y: 7, color: 'cyan' },
    { x: 1, y: 7, color: 'violet' },
    { x: 2, y: 7, color: 'pink' },
    { x: 4, y: 7, color: 'cyan' },
    { x: 5, y: 7, color: 'violet' },
    { x: 0, y: 6, color: 'cyan' },
    { x: 1, y: 6, color: 'violet' },
    { x: 4, y: 6, color: 'pink' },
    { x: 5, y: 6, color: 'pink' },
    { x: 1, y: 5, color: 'violet' },
    { x: 4, y: 5, color: 'pink' },
    { x: 0, y: 4, color: 'cyan' },
  ];

  return (
    <div className="intro-graphic" role="img" aria-label="Animated falling blocks">
      <div className="arcade-grid">
        <span className="grid-glow" />
        <span className="drop-trail trail-one" />
        <span className="drop-trail trail-two" />
        {stackCells.map((cell, index) => (
          <span
            className={`stack-cell stack-${cell.color}${cell.y === 7 ? ' clear-cell' : ''}`}
            key={`${cell.x}-${cell.y}-${index}`}
            style={{
              left: 11 + cell.x * 22,
              top: 14 + cell.y * 22,
            }}
          />
        ))}
        <div className="falling-piece" aria-hidden="true">
          <i /><i /><i /><i />
        </div>
        <span className="line-flash" />
        <span className="impact-ring" />
      </div>
    </div>
  );
}

function TouchButton({
  label,
  action,
  children,
  onAction,
  repeat = false,
  className = '',
}: {
  label: string;
  action: InputAction;
  children: React.ReactNode;
  onAction: (action: InputAction) => void;
  repeat?: boolean;
  className?: string;
}) {
  const timerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const clearTimers = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    timerRef.current = null;
    intervalRef.current = null;
  };

  useEffect(() => clearTimers, []);

  return (
    <button
      type="button"
      className={`touch-button ${className}`}
      aria-label={label}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        onAction(action);
        if (repeat) {
          timerRef.current = window.setTimeout(() => {
            intervalRef.current = window.setInterval(() => onAction(action), action === 'softDrop' ? 45 : 38);
          }, 150);
        }
      }}
      onPointerUp={clearTimers}
      onPointerCancel={clearTimers}
      onPointerLeave={clearTimers}
    >
      {children}
    </button>
  );
}

export function App() {
  const engineRef = useRef<GameEngine | null>(null);
  if (!engineRef.current) engineRef.current = new GameEngine();
  const engine = engineRef.current;

  const [stored, setStored] = useState<StoredData>(() => loadStoredData());
  const [game, setGame] = useState<GameState>(() => engine.getState());
  const [panel, setPanel] = useState<'help' | 'settings' | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(game);
  const storedRef = useRef(stored);
  const drawNeededRef = useRef(true);
  const audioRef = useRef<ArcadeAudio | null>(null);
  const gestureRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const mouseTargetRef = useRef<{ x: number; y: number } | null>(null);
  const mouseAimFrameRef = useRef<number | null>(null);
  const highScoreSaveTimerRef = useRef<number | null>(null);
  const previousActiveRef = useRef(game.active);
  const previousEventRef = useRef(0);
  const previousStatusRef = useRef(game.status);

  if (!audioRef.current) audioRef.current = new ArcadeAudio(stored.preferences);

  const updatePreferences = useCallback((patch: Partial<Preferences>) => {
    setStored((current) => {
      const next = { ...current, preferences: { ...current.preferences, ...patch } };
      storedRef.current = next;
      saveStoredData(next);
      audioRef.current?.update(next.preferences);
      return next;
    });
  }, []);

  const performAction = useCallback((action: InputAction) => {
    void audioRef.current?.unlock();
    engine.dispatch(action);
    audioRef.current?.playAction(action);
  }, [engine]);

  const commitMouseDrop = useCallback(() => {
    void audioRef.current?.unlock();
    engine.commitAim();
    audioRef.current?.playAction('hardDrop');
  }, [engine]);

  const aimAtLastMouseTarget = useCallback(() => {
    const target = mouseTargetRef.current;
    if (!target) return;
    if (mouseAimFrameRef.current !== null) window.cancelAnimationFrame(mouseAimFrameRef.current);
    mouseAimFrameRef.current = window.requestAnimationFrame(() => {
      mouseAimFrameRef.current = null;
      engine.aimAt(target.x, target.y);
    });
  }, [engine]);

  const targetFromPointer = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const target = {
      x: ((event.clientX - bounds.left) / bounds.width) * BOARD_WIDTH,
      y: HIDDEN_ROWS + ((event.clientY - bounds.top) / bounds.height) * VISIBLE_HEIGHT,
    };
    mouseTargetRef.current = target;
    return target;
  }, []);

  const startGame = useCallback(() => {
    void audioRef.current?.unlock();
    setPanel(null);
    engine.start();
  }, [engine]);

  const restartGame = useCallback(() => {
    void audioRef.current?.unlock();
    setPanel(null);
    engine.restart();
  }, [engine]);

  const openPanel = useCallback((nextPanel: 'help' | 'settings') => {
    engine.pause(true);
    setPanel(nextPanel);
    if (nextPanel === 'help' && !stored.preferences.helpDismissed) {
      updatePreferences({ helpDismissed: true });
    }
  }, [engine, stored.preferences.helpDismissed, updatePreferences]);

  useEffect(() => engine.subscribe((next) => {
    stateRef.current = next;
    drawNeededRef.current = true;
    setGame(next);
  }), [engine]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const animate = (time: number) => {
      const delta = time - last;
      last = time;
      engine.tick(delta);
      if (
        canvasRef.current
        && (drawNeededRef.current || stateRef.current.status === 'clearing')
      ) {
        drawNeededRef.current = drawBoard(canvasRef.current, stateRef.current, time, {
          smoothMovement: storedRef.current.preferences.inputMode === 'mouse',
        });
      }
      frame = requestAnimationFrame(animate);
    };
    const requestDraw = () => {
      drawNeededRef.current = true;
    };
    window.addEventListener('resize', requestDraw);
    frame = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener('resize', requestDraw);
      cancelAnimationFrame(frame);
    };
  }, [engine]);

  useEffect(() => {
    if (game.score > stored.highScore) {
      const next = { ...stored, highScore: game.score };
      storedRef.current = next;
      setStored(next);
      if (highScoreSaveTimerRef.current !== null) {
        window.clearTimeout(highScoreSaveTimerRef.current);
      }
      highScoreSaveTimerRef.current = window.setTimeout(() => {
        highScoreSaveTimerRef.current = null;
        saveStoredData(storedRef.current);
      }, 300);
    }
  }, [game.score, stored]);

  useEffect(() => {
    storedRef.current = stored;
  }, [stored]);

  useEffect(() => {
    const flushStoredData = () => {
      if (highScoreSaveTimerRef.current !== null) {
        window.clearTimeout(highScoreSaveTimerRef.current);
        highScoreSaveTimerRef.current = null;
        saveStoredData(storedRef.current);
      }
    };
    window.addEventListener('pagehide', flushStoredData);
    return () => {
      window.removeEventListener('pagehide', flushStoredData);
      flushStoredData();
    };
  }, []);

  useEffect(() => {
    const previous = previousActiveRef.current;
    const active = game.active;
    const spawned = Boolean(
      active
      && (!previous || previous.y > active.y + 3 || previous.type !== active.type),
    );
    previousActiveRef.current = active;
    if (spawned && stored.preferences.inputMode === 'mouse') {
      aimAtLastMouseTarget();
    }
  }, [aimAtLastMouseTarget, game.active, stored.preferences.inputMode]);

  useEffect(() => {
    if (game.eventId !== previousEventRef.current && game.lastScoreEvent) {
      audioRef.current?.playScore(game.lastScoreEvent);
      previousEventRef.current = game.eventId;
    }
    if (game.status === 'gameOver' && previousStatusRef.current !== 'gameOver') {
      audioRef.current?.playGameOver();
    }
    previousStatusRef.current = game.status;
  }, [game.eventId, game.lastScoreEvent, game.status]);

  useEffect(() => {
    const timers = new Map<string, { timeout?: number; interval?: number }>();
    const clearKey = (key: string) => {
      const timersForKey = timers.get(key);
      if (timersForKey?.timeout) window.clearTimeout(timersForKey.timeout);
      if (timersForKey?.interval) window.clearInterval(timersForKey.interval);
      timers.delete(key);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (panel && event.key === 'Escape') {
        event.preventDefault();
        setPanel(null);
        return;
      }
      const action = KEY_ACTIONS[event.key];
      if (!action || panel) return;
      event.preventDefault();
      if (event.repeat || timers.has(event.key)) return;
      performAction(action);
      if (REPEATING_ACTIONS.has(action)) {
        const record: { timeout?: number; interval?: number } = {};
        record.timeout = window.setTimeout(() => {
          record.interval = window.setInterval(() => performAction(action), action === 'softDrop' ? 45 : 38);
        }, 150);
        timers.set(event.key, record);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => clearKey(event.key);
    const onBlur = () => {
      timers.forEach((_, key) => clearKey(key));
      engine.pause(true);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      timers.forEach((_, key) => clearKey(key));
    };
  }, [engine, panel, performAction]);

  useEffect(() => () => {
    if (mouseAimFrameRef.current !== null) cancelAnimationFrame(mouseAimFrameRef.current);
    audioRef.current?.dispose();
  }, []);

  const onGestureStart = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'mouse' && stored.preferences.inputMode === 'mouse') {
      event.preventDefault();
      const target = targetFromPointer(event);
      engine.aimAt(target.x, target.y);
      if (game.status !== 'playing') return;
      if (event.button === 0) {
        commitMouseDrop();
        engine.aimAt(target.x, target.y);
      } else if (event.button === 2) {
        performAction('hold');
        engine.aimAt(target.x, target.y);
      }
      return;
    }
    gestureRef.current = { x: event.clientX, y: event.clientY, time: performance.now() };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onBoardPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (
      event.pointerType !== 'mouse'
      || stored.preferences.inputMode !== 'mouse'
      || game.status !== 'playing'
    ) return;
    targetFromPointer(event);
    aimAtLastMouseTarget();
  };

  const onGestureEnd = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'mouse' && stored.preferences.inputMode === 'mouse') return;
    const start = gestureRef.current;
    gestureRef.current = null;
    if (!start || game.status !== 'playing') return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const elapsed = performance.now() - start.time;
    if (Math.abs(dx) < 18 && Math.abs(dy) < 18 && elapsed < 350) {
      performAction('rotateCW');
    } else if (Math.abs(dx) > Math.abs(dy)) {
      const steps = Math.min(5, Math.max(1, Math.round(Math.abs(dx) / 28)));
      const action = dx > 0 ? 'moveRight' : 'moveLeft';
      for (let i = 0; i < steps; i += 1) performAction(action);
    } else if (dy < -32) {
      performAction('hardDrop');
    } else if (dy > 28) {
      const steps = Math.min(8, Math.max(1, Math.round(dy / 20)));
      for (let i = 0; i < steps; i += 1) performAction('softDrop');
    }
  };

  const showPause = game.status === 'paused' && !panel;

  return (
    <div className="app">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <a className="brand" href="/" aria-label="Blocks home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span>blocks</span>
        </a>
        <div className="top-actions">
          <span className="desktop-hint">
            {stored.preferences.inputMode === 'mouse'
              ? 'Point to place · Click to drop'
              : 'Arrows to move · Space to drop'}
          </span>
          <ControlModeSwitch
            compact
            mode={stored.preferences.inputMode}
            onChange={(inputMode) => updatePreferences({ inputMode })}
          />
          <IconButton label="Pause game" onClick={() => performAction('pause')}>Ⅱ</IconButton>
          <IconButton label="Open controls" onClick={() => openPanel('help')}>?</IconButton>
          <IconButton label="Open sound settings" onClick={() => openPanel('settings')}>♪</IconButton>
        </div>
      </header>

      <main className="game-shell">
        <section className="game-layout" aria-label="Blocks game">
          <aside className="hud-panel hud-left">
            <div className="hud-card hold-card">
              <span className="hud-label">Hold</span>
              <PreviewPiece type={game.hold} label="Held piece" />
              <span className={`ready-dot ${game.canHold ? 'available' : ''}`}>
                {game.canHold ? 'available' : 'locked'}
              </span>
            </div>
            <div className="hud-card best-card">
              <span className="hud-label">Best</span>
              <strong>{formatScore(stored.highScore)}</strong>
            </div>
          </aside>

          <div className={`board-wrap status-${game.status}`}>
            <div className="board-edge" />
            <canvas
              ref={canvasRef}
              className="game-board"
              width="300"
              height="600"
              aria-label="10 by 20 falling-block game board"
              onPointerDown={onGestureStart}
              onPointerMove={onBoardPointerMove}
              onPointerUp={onGestureEnd}
              onPointerCancel={() => { gestureRef.current = null; }}
              onContextMenu={(event) => {
                if (stored.preferences.inputMode === 'mouse') event.preventDefault();
              }}
            />
            {game.lastScoreEvent && game.status !== 'ready' && (
              <div className="score-toast" key={game.eventId} aria-live="polite">
                <strong>{game.lastScoreEvent.label}</strong>
                <span>+{game.lastScoreEvent.points.toLocaleString('en-US')}</span>
              </div>
            )}
            {game.status === 'ready' && (
              <div className="game-overlay intro-overlay">
                <IntroGraphic />
                <button className="primary-button play-button" type="button" onClick={startGame}>
                  <span className="play-icon" aria-hidden="true">▶</span>
                  Play
                </button>
              </div>
            )}
            {showPause && (
              <div className="game-overlay">
                <span className="eyebrow">Intermission</span>
                <h2>Run paused.</h2>
                <button className="primary-button" type="button" onClick={() => engine.pause()}>
                  Resume <span>→</span>
                </button>
                <button className="text-button" type="button" onClick={restartGame}>Start over</button>
              </div>
            )}
            {game.status === 'gameOver' && (
              <div className="game-overlay">
                <span className="eyebrow">Top out</span>
                <h2>Board full.</h2>
                <div className="final-score">
                  <span>Score</span>
                  <strong>{formatScore(game.score)}</strong>
                </div>
                <button className="primary-button" type="button" onClick={restartGame}>
                  Play again <span>↻</span>
                </button>
              </div>
            )}
          </div>

          <aside className="hud-panel hud-right">
            <div className="score-block">
              <span className="hud-label">Score</span>
              <strong>{formatScore(game.score)}</strong>
            </div>
            <div className="stats-row">
              <div><span className="hud-label">Level</span><strong>{String(game.level).padStart(2, '0')}</strong></div>
              <div><span className="hud-label">Lines</span><strong>{String(game.lines).padStart(3, '0')}</strong></div>
            </div>
            <div className="hud-card next-card">
              <span className="hud-label">Up next</span>
              <div className="next-list">
                {game.queue.slice(0, 1).map((type, index) => (
                  <PreviewPiece key={`${type}-${index}`} type={type} label={`Next piece ${index + 1}`} />
                ))}
              </div>
            </div>
          </aside>
        </section>

        <section className="touch-controls" aria-label="Touch controls">
          <div className="touch-cluster movement-cluster">
            <span className="touch-cluster-label">Move</span>
            <TouchButton label="Move left" action="moveLeft" onAction={performAction} repeat>
              <span aria-hidden="true">←</span><small>Left</small>
            </TouchButton>
            <TouchButton label="Soft drop" action="softDrop" onAction={performAction} repeat>
              <span aria-hidden="true">↓</span><small>Down</small>
            </TouchButton>
            <TouchButton label="Move right" action="moveRight" onAction={performAction} repeat>
              <span aria-hidden="true">→</span><small>Right</small>
            </TouchButton>
          </div>
          <div className="touch-cluster action-cluster">
            <span className="touch-cluster-label">Actions</span>
            <TouchButton label="Hold piece" action="hold" onAction={performAction} className="touch-small">
              <span aria-hidden="true">H</span><small>Hold</small>
            </TouchButton>
            <TouchButton label="Rotate counter-clockwise" action="rotateCCW" onAction={performAction}>
              <span aria-hidden="true">↶</span><small>Left spin</small>
            </TouchButton>
            <TouchButton label="Rotate clockwise" action="rotateCW" onAction={performAction}>
              <span aria-hidden="true">↷</span><small>Right spin</small>
            </TouchButton>
            <TouchButton label="Hard drop" action="hardDrop" onAction={performAction} className="touch-accent">
              <span aria-hidden="true">⇣</span><small>Drop</small>
            </TouchButton>
          </div>
        </section>
      </main>

      <footer className="footer">
        <span>v1.0</span>
      </footer>

      {panel && (
        <div className="modal-backdrop" role="presentation" onPointerDown={(event) => {
          if (event.target === event.currentTarget) setPanel(null);
        }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <button className="modal-close" type="button" onClick={() => setPanel(null)} aria-label="Close panel">×</button>
            {panel === 'help' ? (
              <>
                <span className="eyebrow">Input map</span>
                <h2 id="modal-title">Controls</h2>
                <div className="desktop-control-help">
                  <ControlModeSwitch
                    mode={stored.preferences.inputMode}
                    onChange={(inputMode) => updatePreferences({ inputMode })}
                  />
                  {stored.preferences.inputMode === 'mouse' ? (
                    <div className="controls-list mouse-controls-list">
                      <div><kbd>Move</kbd><span>Point to a landing cell</span></div>
                      <div><kbd>Left</kbd><span>Hard drop</span></div>
                      <div><kbd>Right</kbd><span>Hold piece</span></div>
                      <div><kbd>P</kbd><span>Pause</span></div>
                    </div>
                  ) : (
                    <div className="controls-list">
                      <div><kbd>←</kbd><kbd>→</kbd><span>Move</span></div>
                      <div><kbd>↓</kbd><span>Soft drop</span></div>
                      <div><kbd>↑</kbd><kbd>Z</kbd><span>Rotate</span></div>
                      <div><kbd>Space</kbd><span>Hard drop</span></div>
                      <div><kbd>C</kbd><span>Hold</span></div>
                      <div><kbd>P</kbd><span>Pause</span></div>
                    </div>
                  )}
                </div>
                <div className="mobile-control-help controls-list">
                  <div><kbd>← ↓ →</kbd><span>Move and descend</span></div>
                  <div><kbd>↶ ↷</kbd><span>Rotate either way</span></div>
                  <div><kbd>H</kbd><span>Hold piece</span></div>
                  <div><kbd>⇣</kbd><span>Hard drop</span></div>
                </div>
                <p className="modal-copy desktop-control-help">Switch modes here any time. Keyboard controls stay available in mouse mode.</p>
                <p className="modal-copy mobile-control-help">Use the full deck below the board. Taps and swipes on the board remain available as shortcuts.</p>
              </>
            ) : (
              <>
                <span className="eyebrow">Audio rack</span>
                <h2 id="modal-title">Sound</h2>
                <label className="setting-row">
                  <span><strong>Music</strong><small>Original pulse loop</small></span>
                  <input
                    type="checkbox"
                    checked={stored.preferences.musicEnabled}
                    onChange={(event) => updatePreferences({ musicEnabled: event.target.checked })}
                  />
                </label>
                <label className="setting-row">
                  <span><strong>Effects</strong><small>Moves, drops and clears</small></span>
                  <input
                    type="checkbox"
                    checked={stored.preferences.effectsEnabled}
                    onChange={(event) => updatePreferences({ effectsEnabled: event.target.checked })}
                  />
                </label>
                <label className="volume-control">
                  <span>Master volume</span>
                  <output>{Math.round(stored.preferences.volume * 100)}%</output>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={stored.preferences.volume}
                    onChange={(event) => updatePreferences({ volume: Number(event.target.value) })}
                  />
                </label>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
