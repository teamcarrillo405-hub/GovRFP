# Avero GovTool — Full UI/UX Overhaul Design Spec
**Date:** 2026-04-24  
**Status:** Approved for Implementation  
**Author:** George Carrillo + Claude Code

---

## 1. Product Identity

- **Product name:** Avero GovTool
- **Tagline:** "We Build AI That Moves Your Business Forward."
- **Parent company:** Avero (formerly HCC — fully rebranded)
- **Merger:** ProposalAI + GovRFP → unified as Avero GovTool
- **Logo files:** `C:\Users\glcar\paperclip\branding\logo.svg` + `logo.png`
- **Repos:** `C:\Users\glcar\hcc-proposal-ai` (ProposalAI) + `C:\Users\glcar\contractor-rfp-website` (GovRFP)

---

## 2. Brand Tokens (Authoritative)

Source: `C:\Users\glcar\paperclip\ui\src\index.css` (.dark block)

### Chrome (dark surfaces only)
| Token | Value | Usage |
|-------|-------|-------|
| `--navy` | `#0B1220` | Header · sidebar · footer ONLY |
| `--slate` | `#1A2433` | Sidebar card bg / hover group |
| `--mid` | `#1E2B3C` | Active nav bg |
| `--navborder` | `#263447` | Borders on dark surfaces |
| `--softgray` | `#9AA4B2` | Secondary text on dark surfaces |

### Primary Interactive (one color only)
| Token | Value | Usage |
|-------|-------|-------|
| `--blue` | `#2F80FF` | ALL CTAs · active nav · links · score bars · badges |

### Semantic Status (text only — never fills/backgrounds)
| Token | Value | Usage |
|-------|-------|-------|
| `--success` | `#00C48C` | "Go" verdict · "Won" · positive delta text |
| `--error` | `#FF4D4F` | "Due Today/Tomorrow" · "No-Go" · error text |
| `--warning` | `#F59E0B` | "Caution" verdict · "Due Soon" text |

### Data Visualization (charts only — never UI chrome)
| Token | Value |
|-------|-------|
| `--chart-1` | `#2F80FF` |
| `--chart-2` | `#7B61FF` |
| `--chart-3` | `#00C2FF` |
| `--chart-4` | `#00A3A3` |

### Light Surfaces
| Token | Value | Usage |
|-------|-------|-------|
| `--body` | `#F0F2F5` | Page background |
| `--card` | `#FFFFFF` | All card/panel backgrounds |
| `--text-1` | `#0F172A` | Primary text |
| `--text-2` | `#475569` | Secondary text |
| `--text-3` | `#94A3B8` | Muted/metadata text |
| `--border` | `#E2E8F0` | Card borders |
| `--divider` | `#F8FAFC` | Row dividers inside cards |

---

## 3. George's Color Law (Non-Negotiable)

1. Colors must **mean** something specific — not decoration
2. Blue = interactive/active (one and only CTA color)
3. Green/Red/Amber = status **text** ONLY — never fill colors on large elements
4. Score bars are ALWAYS blue — the status badge communicates quality
5. Proposal card left borders = ALWAYS blue — no red/green/amber variants
6. KPI cards = NO colored top borders — white cards, weight+size creates hierarchy
7. Task status dots = gray for all except the due date TEXT (red for "Today")
8. If squinting reveals more than 2 colors → too many colors

---

## 4. Layout System

### App Shell
```css
.app-shell { display: flex; flex-direction: column; min-height: 100vh; }
.app-header { position: sticky; top: 0; z-index: 200; height: 52px; background: #0B1220; }
.body-row { display: flex; flex: 1; }
.sidebar { width: 220px; position: sticky; top: 52px; height: calc(100vh - 52px); background: #0B1220; overflow-y: auto; }
.main-content { flex: 1; padding: 28px; overflow: visible; }
.app-footer { background: #0B1220; height: 44px; }
```

- **Header:** Dark navy `#0B1220`, sticky 52px, "Avero GovTool" wordmark + blue A monogram
- **Sidebar:** Dark navy `#0B1220`, 220px, sticky below header, white 13px/Inter 500 text
- **Body:** Light (`#F0F2F5` bg, `#FFFFFF` cards), natural scroll, full viewport
- **Footer:** Dark navy `#0B1220`, 44px
- **NO fixed height viewports** — full screen, natural scroll

---

## 5. Typography Scale (Industry Gold Standard)

| Element | Size | Weight | Color | Notes |
|---------|------|--------|-------|-------|
| Sidebar nav | 13px | 500 | white | |
| Nav section labels | 10px | 700 | `--navborder` | uppercase, letter-spacing 0.12em |
| Page title | 20px | 800 | `--text-1` | letter-spacing -0.025em |
| Section labels | 11px | 700 | `--text-2` | uppercase, letter-spacing 0.10em |
| KPI values | 32px | 900 | `--text-1` | letter-spacing -0.04em |
| Card headings | 13.5px | 700 | `--text-1` | |
| Body text | 13px | 400–500 | `--text-1` | |
| Metadata/labels | 11–11.5px | 500–600 | `--text-2` or `--text-3` | |
| Status tags | 10.5px | 700 | semantic color text | 8% opacity bg |

---

## 6. Component Patterns

### Cards
- Background: `#FFFFFF`
- Border: 1px solid `#E2E8F0`
- Border-radius: 8px
- Shadow: none (borders only)
- KPI cards: NO colored top borders or side accents

### Buttons
- Primary: `#2F80FF` solid, white text, 8px radius, 13px/600
- Secondary/Ghost: `#E2E8F0` border, `--text-2` text, 8px radius
- Destructive: red text only, no fill (ghost with red text)

### Status Badges
- 10.5px/700, semantic color text, matching color at 8% opacity background
- Examples: green "Go", amber "Caution", red "No-Go"

### Score Bars
- Always `#2F80FF` fill
- Track: `#E2E8F0`
- Height: 6px for section bars, 4px for mini bars, 8px for card bars

### Icons
- Lucide-style inline SVG ONLY
- 15px default, 1.5 stroke, currentColor
- NO emojis anywhere in the product

---

## 7. Sidebar Navigation Structure

```
WORKSPACE
  Dashboard
  Pipeline

PROPOSALS
  All Proposals
  Compliance Matrix

INTELLIGENCE
  Opportunities
  Content Library
  Past Performance

ANALYZE
  Analytics
  Scoring & Red Team

SETTINGS
  Team
  Integrations
  Billing
```

Active state: blue left border (2px) + `--mid` background + blue icon + white text

---

## 8. Page Inventory

### P0 — Dashboard (Command Center)
**Status:** Mockup v4 complete — `dashboard-v4.html`

Key components:
- KPI strip: 4 cards (Win Rate, Active Proposals, Pipeline Value, Avg Score) — NO colored borders
- Proposal cards: uniform blue left border, score bar blue, status as text label
- Activity feed: SVG icons, no emoji
- Pipeline funnel: CSS-drawn, blue bars
- Task list: all dots gray, due date TEXT carries red/amber color

### P0 — Proposal Editor
**Status:** Mockup v1 complete — `editor-v1.html`

Architecture: 3-column sticky layout
- Left panel (240px, dark): 8 federal section nav with coverage indicators
- Center canvas (flex-1): TipTap-style editor, max-width 860px paper, floating format toolbar
- Right panel (280px): Tabbed tools — Compliance, Past Performance, Scoring Rubric, Grammar, Win Themes, Page Limits, Color Team, Custom Template
- Top bar: Proposal name + status + export + last saved

Unique capabilities vs competitors:
- Real-time compliance score per section header
- SME task assignment per section
- Version history button
- Requirement coverage % without opening tool panel
- Inline comment threads
- Compliance underline on non-covered text

### P0 — Content Library
**Status:** Mockup v1 complete — `content-library-v1.html`

Architecture: 3-zone layout
- Left (200px): Category tree (Technical, Management, Safety, Past Performance, Boilerplate)
- Main (flex-1): Grid/list of 847 assets with tag cloud, last used, quality score, usage count
- Right (320px): Preview panel with insert/edit actions

### P0 — Compliance Matrix
**Status:** Mockup v1 complete — `compliance-matrix-v1.html`

Standalone spreadsheet:
- Rows = RFP requirements, Columns = proposal sections
- Coverage status: Covered / Partial / Missing (text labels only)
- Blue coverage bars showing % addressed
- Jump to Section links
- Filter by status, risk, section
- Export to PDF/Excel button

### P1 — Opportunity Directory
**Status:** Mockup v1 complete — `opportunities-v1.html`

Key components:
- Filter bar: NAICS, set-aside, agency, state, deadline range, sort
- 5 SAM.gov cards: match score (blue 18px/800), deadline urgency as text color only, Track + Open in GovTool buttons

### P1 — Opportunity Detail
**Status:** Mockup v1 complete — `opportunity-detail-v1.html`

Components:
- Metadata grid (solicitation #, NAICS, set-aside, agency, due date, estimated value)
- Prior awards timeline with incumbent marker
- 5 right-sidebar panels: Match Score, SBA Eligibility, Teaming Partners, Competitor Intel, PP Match

### P1 — Pipeline Board
**Status:** Mockup v1 complete — `pipeline-board-v1.html`

Kanban: 4 columns (Identified / Qualifying / Drafting / Submitted)
- Column headers: stage name + blue count badge + dollar total
- Cards: name, agency, WS pill (blue), contract value, set-aside, assignee
- Drafting cards: 4px blue progress bar
- Submitted cards: status text label

### P1 — Past Performance Library
**Status:** Mockup v1 complete — `past-performance-v1.html`

- Search by challenge type / NAICS / customer / outcome
- CPARS ratings as semantic text color
- Quality scores, usage counts, relevance score from editor context
- List + detail panel layout

### P2 — Scoring & Red Team
**Status:** Mockup v1 complete — `scoring-redteam-v1.html`

Components:
- Score header: 48px/900 overall score, verdict pill, review cycle step tracker
- Score history line chart (SVG) — review cycle progression
- Section breakdown table: score + blue bar + delta (green text) + top finding
- Reviewer comments with priority labels (text only)
- SSEB verdict simulation with probability indicators

### P2 — Analytics
**Status:** Mockup v1 complete — `analytics-v1.html`

Components:
- KPI strip: Win Rate, Proposals Won, Total Value, Avg Time to Submit
- Win Rate by Agency (horizontal bar chart, blue)
- Win Rate by Set-Aside (SVG donut chart, data viz palette)
- Pipeline trend line chart (SVG, dual axis)
- NAICS performance table
- Team performance table (semantic text colors only)
- AI Learning Insights (3 pattern cards)

### P2 — Team Management
**Status:** Mockup v1 complete — `team-management-v1.html`

Components:
- Members table: avatar + name + email + role pill + stats + status
- Pending invitations section
- Roles & Permissions reference card

---

## 9. Competitor Benchmarks

| Product | Color Strategy | What We Beat |
|---------|---------------|--------------|
| Loopio | ONE teal accent only | We match discipline + add federal-specific data density |
| GovTribe | Navy sidebar, blue CTAs only | We match + add compliance tooling, content library |
| Responsive | ONE green accent | We match + exceed with AI scoring, Red Team tools |
| Salesforce | Blue only, 60-30-10 rule | We match the standard they set |
| Linear | 3-variable LCH, structure over color | We apply the same principle to federal domain |

---

## 10. Watchdog Standards (100/100 each)

1. **Color:** Max 2 visible colors (navy chrome + blue accent). Semantic = text only.
2. **Typography:** Strict scale adherence. No orphan font sizes.
3. **Information:** Every element shows real, specific federal data — nothing generic/placeholder.
4. **Layout:** Full viewport, sticky sidebar, natural scroll, responsive grid.
5. **Professionalism:** Passes Fortune 100 bar — Bloomberg, Salesforce, Workday context.
6. **Completeness:** All interactive states shown (hover, active, empty, loading).
7. **Consistency:** 4px grid spacing, 8px card radius, no shadows (borders only).

---

## 11. Tech Stack (Implementation Target)

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14+ App Router |
| Styling | Tailwind CSS 4 |
| Editor | TipTap (rich text) |
| Auth | Supabase Auth + RLS |
| Database | Supabase (PostgreSQL) |
| AI | Anthropic Claude API |
| Icons | Lucide React |
| Font | Inter (Google Fonts) |

---

## 12. Implementation Priority

**Phase 1 — Core Shell + Dashboard**
- App shell (header, sidebar, footer, routing)
- Brand token CSS variables
- Dashboard page

**Phase 2 — Proposal Workflow**
- Proposal list page
- Proposal editor (3-column layout)
- Compliance matrix

**Phase 3 — Intelligence**
- Opportunity directory + detail
- Content library
- Past performance library

**Phase 4 — Pipeline + Analytics**
- Pipeline board (kanban)
- Analytics dashboard
- Scoring & Red Team

**Phase 5 — Team + Settings**
- Team management
- Integrations
- Billing

---

## 13. Mockup Reference Files

All mockups in `C:\Users\glcar\hcc-proposal-ai\.superpowers\brainstorm\3606-1777137577\content\`

| File | Page |
|------|------|
| `dashboard-v4.html` | Dashboard (approved) |
| `editor-v1.html` | Proposal Editor |
| `opportunities-v1.html` | Opportunity Directory |
| `opportunity-detail-v1.html` | Opportunity Detail |
| `content-library-v1.html` | Content Library |
| `compliance-matrix-v1.html` | Compliance Matrix |
| `past-performance-v1.html` | Past Performance Library |
| `pipeline-board-v1.html` | Pipeline Board |
| `analytics-v1.html` | Analytics |
| `team-management-v1.html` | Team Management |
| `scoring-redteam-v1.html` | Scoring & Red Team |
