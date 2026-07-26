---
name: Luxury Arcade Aesthetic
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#cbc4ce'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#958f98'
  outline-variant: '#4a454d'
  surface-tint: '#d3beeb'
  primary: '#d3beeb'
  on-primary: '#38294d'
  primary-container: '#1a0b2e'
  on-primary-container: '#88769f'
  inverse-primary: '#68577e'
  secondary: '#ffabf3'
  on-secondary: '#5b005b'
  secondary-container: '#fe00fe'
  on-secondary-container: '#500050'
  tertiary: '#00dddd'
  on-tertiary: '#003737'
  tertiary-container: '#001717'
  on-tertiary-container: '#008d8d'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#eddcff'
  primary-fixed-dim: '#d3beeb'
  on-primary-fixed: '#231437'
  on-primary-fixed-variant: '#4f4065'
  secondary-fixed: '#ffd7f5'
  secondary-fixed-dim: '#ffabf3'
  on-secondary-fixed: '#380038'
  on-secondary-fixed-variant: '#810081'
  tertiary-fixed: '#00fbfb'
  tertiary-fixed-dim: '#00dddd'
  on-tertiary-fixed: '#002020'
  on-tertiary-fixed-variant: '#004f4f'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Anybody
    fontSize: 72px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  display-lg-mobile:
    fontFamily: Anybody
    fontSize: 40px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Anybody
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  score-value:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: -0.02em
  body-base:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: 0.01em
  label-caps:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.2em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  grid-gutter: 24px
  container-padding: 40px
  block-gap: 2px
---

## Brand & Style

This design system blends the nostalgic energy of a high-end 80s arcade with a refined, contemporary luxury finish. The personality is vibrant and energetic yet maintains a "premium" composure through generous negative space and surgical precision. 

The aesthetic style is **Retro-Futurist Minimalism**. It utilizes deep, dark backgrounds to make high-contrast neon accents pop, while incorporating subtle textures like CRT scanlines and pixel-grid overlays to evoke a sense of digital heritage. Unlike traditional brutalist retro designs, this system prioritizes "gloss" and "depth," treating the tetrominoes as high-quality physical objects—like polished acrylic or candy-coated plastic—set against a sophisticated, dark void.

## Colors

The palette is anchored in deep shadows to create a sense of infinite space. 

- **Backgrounds:** Use `#1A0B2E` (Deep Purple) for primary interface surfaces and `#121212` (Dark Charcoal) or `#0A0512` for the game board and background layers to maximize contrast.
- **Neon Accents:** Magenta (`#FF00FF`), Cyan (`#00FFFF`), Lemon Yellow (`#F7FF00`), and Vivid Orange (`#FF5C00`) are used exclusively for active gameplay elements (tetrominoes) and critical UI feedback.
- **Functional Colors:** Success states use Cyan; Warning/Alert states use Orange or Magenta. Avoid muted tones; colors should always feel "emissive" as if light is being projected through glass.

## Typography

Typography focuses on two distinct roles: **Expression** and **Precision**.

- **Headings & Branding:** Uses *Anybody*. Its variable weight and expressive width feel mechanical yet stylish. Use heavy weights for a bold, high-impact presence.
- **Scores & Data:** Uses *Geist*. This monospaced-adjacent sans-serif provides the "developer-tool" precision required for rapidly changing numbers and statistics.
- **General UI:** Uses *Inter* for maximum legibility in settings, instructions, and secondary metadata.

Always use uppercase for labels (e.g., "NEXT", "HOLD", "LEVEL") to reinforce the arcade cabinet aesthetic.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy. The game board is the central pillar, with UI modules (Score, Next, Hold) floating as clean, secondary blocks.

- **The Game Board:** A 10x20 grid where the "block-gap" is a slim 2px. This tiny gap between tetromino segments creates a "tiled" look without the bulk of heavy borders.
- **Modules:** Use a consistent 40px margin from the screen edges on desktop.
- **Responsive Reflow:** On mobile, the "Next" and "Hold" modules shift from the sides of the board to a horizontal bar positioned directly above or below the play area. 
- **Spacing Rhythm:** Use a 4px base unit. All paddings and margins should be multiples of 4 to maintain mathematical cleanliness.

## Elevation & Depth

Visual hierarchy is achieved through **Tonal Layering** and **Luminescence** rather than traditional drop shadows.

- **Background Texture:** A subtle CRT scanline overlay (1px horizontal lines at 5% opacity) should sit above the background but behind the UI. A 20% opacity pixel-grid pattern is applied only to the "empty" play area.
- **The "Candy" Effect:** Tetrominoes should have a subtle inner-glow (top-left) and a slight gradient to simulate a convex, plastic surface. No external shadows are used; instead, blocks should have a "bloom" or outer-glow effect when they land or clear a line.
- **Backdrop Blurs:** Navigation menus or modals use a heavy backdrop blur (20px) with a semi-transparent `#1A0B2E` fill to maintain the "Glassmorphism" feel while staying true to the dark palette.

## Shapes

The design system uses a **Soft** (0.25rem) roundedness for most UI containers to avoid the harshness of a purely "retro" look. 

- **Tetrominoes:** Blocks should have a very slight corner radius (2px) to mimic molded plastic. They are never sharp, but never fully rounded.
- **UI Modules:** Containers for scores and stats should use `rounded-lg` (0.5rem) to differentiate the interface from the "active" game pieces. 
- **Buttons:** Interactive elements use a "pill" or `rounded-xl` shape to feel tactile and inviting, contrasting with the structural grid of the game.

## Components

- **Tetrominoes:** Solid colors with a high-gloss finish. Each block piece should have a 1px "highlight" line on its top and left inner edge.
- **Buttons:** High-contrast Magenta or Cyan backgrounds with black text. On hover, they should emit an outer-glow (bloom) in their respective color. No borders.
- **Input Fields:** Minimalist. A simple underline or a very dark charcoal fill with a 1px Cyan bottom-border when focused.
- **Chips/Badges:** Used for difficulty levels or status. Small, pill-shaped, with high-tracking Geist typography.
- **Progress Bars:** Used for "Level Up" metrics. Use a segmented bar (each segment 4px wide) rather than a solid line to mimic a digital LED display.
- **Cards:** Used for the "Game Over" screen or "Settings." Dark, semi-transparent layers with a subtle Cyan-to-Magenta gradient border (1px).