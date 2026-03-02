# Phase 1: Foundation - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish left-hand navigation panel with modern visual design. This phase delivers the foundational navigation structure, color/typography theme, and responsive flexbox layout that all 9 sections will use. Profile panel (Phase 2) and section-specific content (Phase 3) come later.

</domain>

<decisions>
## Implementation Decisions

### Left Nav Panel Behavior

**Expand/Collapse Pattern:**
- Hover to expand temporarily (no click required)
- Include pin/unpin button to lock nav in open or collapsed state
- Hovering over collapsed nav (60px) expands it to full width (250px)
- Moving mouse away collapses it again (unless pinned)

**Panel Dimensions:**
- Open width: 250px
- Collapsed width: 60px
- Industry standard sizing - matches Slack, VS Code patterns

**Animation & Transitions:**
- Smooth slide animation using CSS transitions
- Duration: 200-300ms
- Icons slightly enlarge on hover (scale transform ~1.1-1.2x)

**Icon System:**
- Use SVG icons, NOT Font Awesome
- Custom SVG assets for all 9 sections
- Icons must work well at collapsed size (60px width)

**State Persistence:**
- Save pinned/unpinned state to localStorage
- Persist across page loads and sessions
- Default state: collapsed (unpinned) on first visit

### Claude's Discretion

- Exact animation timing curve (ease-in-out vs custom bezier)
- Icon hover scale factor (1.1x vs 1.15x vs 1.2x)
- Pin button icon and placement
- Loading state handling

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Bootstrap 2023:** Grid system, utilities - can reuse for layout structure
- **jQuery 2023:** Already loaded - use for nav interactions and state management
- **Brand Color `#08c`:** Existing brand blue - available for nav accents
- **Body Class System:** Pattern of using body classes for feature flags - can use for nav state

### Established Patterns
- **Global Variables:** Existing pattern (aID, uID, etc.) - can add navPinnedState variable
- **localStorage Usage:** Already used for user preferences - add nav state
- **jQuery Event Handlers:** Consistent pattern throughout - use for hover/click handlers
- **CSS Transitions:** Existing Bootstrap modal transitions - similar timing can be used

### Integration Points
- **Replace `.navbar-fixed-top`:** Current horizontal navbar at top → new left sidebar
- **Preserve `.main-content` structure:** Content area adjusts when nav expands/collapses
- **Body Classes:** Add `.nav-pinned` / `.nav-collapsed` classes for state management
- **Maintain jQuery Compatibility:** All nav interactions must work with existing jQuery 2023

</code_context>

<specifics>
## Specific Ideas

**Visual References:**
- Icon hover: Slight scale enlargement for tactile feedback
- Animation feel: Smooth, professional (not playful or bouncy) - appropriate for CRM context

**Technical Preferences:**
- SVG over icon fonts for better scaling and customization
- localStorage for state (not server-side) - faster, simpler
- Hover-to-expand pattern: Modern, minimal, efficient

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-02*
