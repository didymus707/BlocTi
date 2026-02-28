# Blokr — Front End Design System

This document describes the initial front-end Design System for Blokr (Time Block Manager). It includes design tokens, component guidelines, accessibility notes, and example code for the primitive components you can use across the app.

Goals
- Provide a single source of truth for colors, spacing, type scale and common UI primitives.
- Keep components small, composable and accessible.
- Make it easy to adopt tokens in CSS, Tailwind and plain classNames.

Structure
- design tokens (CSS variables) — src/styles/design-tokens.css
- primitive components — src/components/primitives/*
  - Button, Input, IconButton, Card (examples)
  - Existing icons wrapper at src/components/primitives/icons.tsx
- Documentation (this file)

How to add the tokens to the project
1. Import the token stylesheet once (for example in `src/main.tsx` or `src/index.css`):
   - In `src/main.tsx` add:
     import "./styles/design-tokens.css";
   - Or in `src/index.css` add:
     @import "./styles/design-tokens.css";

Design Tokens (high level)
- Color: surface, elevated, text, primary, neutral, success, danger, focus
- Type scale: base (16px), small, medium, large, display
- Spacing: 4px unit scale (spacing-1 = 4px)
- Border radius & elevation tokens
- Motion: durations & easing

Accessibility basics
- All interactive primitives must be keyboard focusable.
- Use high contrast for text and interactive states.
- Provide aria-labels for icon-only buttons, and visually hidden labels when needed.

Naming conventions
- Tokens use kebab-case CSS custom properties: --blokr-color-primary, --blokr-space-2, etc.
- Component props use simple names: variant, size, className, disabled, aria-label.

Primitive Components
This repo includes a minimal set of primitives to get started. They are intentionally small and accept className to compose with Tailwind or local styles.

- Button: primary / secondary / ghost variants, sizes (sm, md, lg).
- Input: text input with label and error state.
- IconButton: focusable icon-only button that reuses icons.tsx components.
- Card: simple wrapper with padding and optional header.

Example usage
- Using tokens in JSX with Tailwind: combine Tailwind classes and token-based inline styles when needed.
- Prefer semantic elements (button, input, form) and pass through native props (onClick, type, disabled).

Design decision notes
- Tailwind is used in the project; primitives are small wrappers that return semantic HTML and default styling. Consumers are expected to compose and extend with Tailwind classes.
- Tokens are defined as CSS variables to make them available to both CSS and inline styles.

Roadmap (next steps)
- Add Storybook to document components and capture visual regressions.
- Add automated accessibility tests (axe).
- Expose tokens to design tools (Figma token export) if needed.

Files included
- src/styles/design-tokens.css — CSS variables
- src/components/primitives/Button.tsx — reusable Button
- src/components/primitives/Input.tsx — accessible Input
- src/components/primitives/IconButton.tsx — icon-only button

If you'd like, I can:
- Create Storybook scaffolding and example stories for each component.
- Convert tokens to a JS/TS tokens file for usage in JS styling systems.
- Migrate more components to use the primitives.