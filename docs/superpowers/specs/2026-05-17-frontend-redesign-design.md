# Frontend UI Redesign — Design Spec

**Date:** 2026-05-17
**Style:** Linear-style minimalist with layered depth
**Goals:** Design sense, visual hierarchy, modern aesthetic

## 1. Design Philosophy

Minimalist foundation with **intentional design decisions** — not stripped bare, but every element earns its place. Visual hierarchy through background color gradation, subtle shadows, and precise spacing rather than borders and decorations.

**Core principles:**
- White as the dominant canvas, grays for depth layers
- Blue (`#2563eb`) reserved exclusively for primary interactive elements
- Shadows replace borders as the primary depth indicator
- Typography and spacing carry the visual weight

## 2. Layout Structure

```
┌─────────────────────────────────────────────────┐
│ ┌───────────┐ ┌───────────────────────────────┐ │
│ │           │ │  Header (borderless)          │ │
│ │ Sidebar   │ ├───────────────────────────────┤ │
│ │ 240px     │ │                               │ │
│ │ bg:#fafafa│ │  Chat Area                    │ │
│ │           │ │  bg:#ffffff                   │ │
│ │           │ ├───────────────────────────────┤ │
│ │           │ │  Input (fixed bottom)         │ │
│ └───────────┘ └───────────────────────────────┘ │
└─────────────────────────────────────────────────┘
     #fafafa          #ffffff (main)
```

- **Page background:** `#ffffff` (pure white)
- **Sidebar:** `#fafafa` — differentiated by subtle background shift, no border
- **Main area:** `#ffffff` — clean canvas
- **Content cards:** `#ffffff` with `shadow-sm` only where elevation is needed

## 3. Color System

```css
:root {
  /* Surfaces — layered depth */
  --background: #ffffff;
  --foreground: #1a1a1a;

  /* Sidebar — slightly darker than page */
  --sidebar: #fafafa;
  --sidebar-foreground: #1a1a1a;
  --sidebar-border: transparent;        /* no visible border */
  --sidebar-accent: #f5f5f5;
  --sidebar-accent-foreground: #1a1a1a;

  /* Cards */
  --card: #ffffff;
  --card-foreground: #1a1a1a;

  /* Brand — blue only for primary actions */
  --primary: #2563eb;
  --primary-foreground: #ffffff;

  /* Muted — gray hierarchy */
  --muted: #f5f5f5;
  --muted-foreground: #888888;
  --secondary: #f5f5f5;
  --secondary-foreground: #555555;
  --accent: #f5f5f5;
  --accent-foreground: #1a1a1a;

  /* Borders — minimal, light */
  --border: #eaeaea;
  --input: #eaeaea;
  --ring: #2563eb;

  /* Feedback */
  --destructive: #ef4444;
  --success: #22c55e;

  /* Radius — tighter */
  --radius: 0.5rem;

  /* Shadows — subtle elevation */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.06);
}
```

## 4. Typography

- **Font:** Inter (unchanged), JetBrains Mono for code
- **Base size:** 15px (body), 13px (UI chrome), 12px (labels)
- **Line height:** 1.6 (body), 1.4 (UI)
- **Font weight:** 400 (body), 500 (medium), 600 (semibold)
- **Color:** `#1a1a1a` primary, `#888888` secondary

## 5. Sidebar Design

### Logo Area
- Height: 48px (reduced from 56px)
- Text only: "Data Analyst" — 13px, weight 600
- No icon/brand mark

### Action Bar
- "New conversation" button: text + `+` icon, no background, hover: `#f5f5f5` bg
- Search icon button: same treatment

### Conversation List
- Compact items: height 34px
- **Selected state:** left 2px blue bar (`--primary`) + text `--foreground`
- **Default state:** text `--muted-foreground`, hover: `#f5f5f5` bg
- Three-dot menu: hidden by default, visible on hover
- Date group labels: 10px uppercase, `--muted-foreground`

### Settings Entry
- Fixed bottom, no divider
- 13px text + gear icon + current LLM name
- Hover: `#f5f5f5` bg

### Visual Treatment
- No right border — sidebar distinguished by `#fafafa` bg vs `#ffffff` main
- Width: 240px desktop, overlay drawer on mobile

## 6. Header

- Borderless — blends into chat area background
- Left: hamburger icon (18px) + conversation title (14px, medium)
- Right: status indicators (model name, DB type) as plain text with small dot indicators
- Export button: icon only, no border, hover: `#f5f5f5` bg
- Compact height: reduce padding

## 7. Message Bubbles

### User Messages
- Right-aligned, max-width 70%
- Background: `#f5f5f5` (replacing blue)
- Text: `--foreground`
- Border-radius: 12px, top-right: 4px (chat tail effect)
- No shadow

### AI Messages
- Left-aligned, no background, no border
- Pure text with AI avatar beside
- Avatar: 28px circle, `#f5f5f5` bg, `--muted-foreground` icon
- Content flows naturally with no wrapper padding

### AI Message Layers

**Reasoning section:**
- Collapsible, left border line (`#eaeaea`) + `#f9f9f9` bg
- No colored borders (remove violet theme)

**Tool calls:**
- Same treatment: left border + `#f9f9f9` bg
- Remove green theme, use gray system
- Tool cards: `#f9f9f9` bg, `#eaeaea` border

### Action Buttons (copy/retry)
- Below message, visible on hover
- 12px text + icon, `--muted-foreground`
- Hover: `#f5f5f5` bg

## 8. Input Bar

- Fixed at bottom, no card wrapper
- Top: single `1px` divider line (`--border`)
- Layout: upload button (left) + text input (center, full-width) + send button (right)
- Text input: no border, no background, 16px, `--foreground`
- Send button: 36px circle, `--primary` bg, white arrow icon, disabled: 30% opacity
- Upload button: icon only, hover: `#f5f5f5` bg
- Helper text: 11px, `--muted-foreground`, centered below

## 9. Welcome State (Empty Chat)

- Centered layout
- Logo: simplified geometric icon, `#eaeaea` color, 40px
- Title: 22px, bold, `--foreground`
- Description: 14px, `--muted-foreground`, 1-2 lines
- Quick action items:
  - List-style (not grid cards)
  - Each: icon (`--muted-foreground`) + title + arrow
  - Hover: `#f5f5f5` bg
  - No borders, no shadows

## 10. Settings Panel (Dialog)

- Pure white card, no gradient icons
- Header: title + close button, minimal
- Tab switch: underline style, no pill background
- Form fields: `rounded-md` (6px), light `--border`
- Buttons: solid `--primary`, no gradient, no heavy shadow
- Connection test area: `#f9f9f9` bg (no gradient)
- Provider cards: monochrome circles, no gradient fills

## 11. Markdown Rendering

- Code blocks: dark bg (`#1a1a1a`) but no gradient header bar
- Tables: no hover bg change, keep divider lines
- Blockquotes: left line in `--border` gray (not blue)
- Headings: same hierarchy, tighter spacing

## 12. Animations & Transitions

- **Message enter:** opacity fade-in only (remove translateY)
- **Sidebar toggle:** translateX transition (keep)
- **Hover states:** 150ms ease
- **prefers-reduced-motion:** fully respected
- **Scroll:** smooth scrolling for chat area

## 13. Responsive Behavior

- **Desktop (>=1024px):** sidebar inline, 240px
- **Tablet (768-1023px):** sidebar overlay with backdrop
- **Mobile (<768px):** sidebar overlay, input full-width, messages max-width 90%

## 14. EChart Component

- No structural changes to chart rendering
- Chart colors updated to match new palette (use same `--chart-1` through `--chart-5` tokens)
- Chart background: transparent (inherit from parent)
- Chart container: no extra padding or border

## 15. Hydration Strategy

- Keep `mounted` guard pattern for client-only content
- Use `suppressHydrationWarning` for text content that may differ (titles, status)
- All structural conditionals (showing/hiding elements) wrapped in `mounted` check

## 16. Files to Modify

| File | Changes |
|------|---------|
| `frontend/src/app/globals.css` | Color system, shadows, radius, animations, scrollbar |
| `frontend/src/app/page.tsx` | Sidebar layout, header, conversation list styles, welcome ref removed |
| `frontend/src/components/chat/ChatPanel.tsx` | Welcome state redesign, message list, loading indicators |
| `frontend/src/components/chat/MessageBubble.tsx` | User/AI bubble styles, reasoning/tool call styles, action buttons |
| `frontend/src/components/chat/InputBar.tsx` | Remove card wrapper, simplify layout |
| `frontend/src/components/settings/SettingsPanel.tsx` | Remove gradients, simplify provider cards, update form styles |
| `frontend/src/app/layout.tsx` | No changes (keep fonts and structure) |
| `frontend/src/components/chart/EChart.tsx` | No changes (chart internals unchanged) |
