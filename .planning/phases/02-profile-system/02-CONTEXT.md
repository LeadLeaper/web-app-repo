# Phase 2: Profile System - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace centered modal popups with right-hand slide panel for viewing contact/lead details. Users can access profiles from any section, view comprehensive lead information, and close the panel without losing context in the main content area.

</domain>

<decisions>
## Implementation Decisions

### Panel Behavior & Animation
- **Display mode**: Overlay (panel slides over main content, doesn't push or shrink content area)
- **Close triggers**: Multiple methods - X button, click outside panel (backdrop), ESC key
- All three close methods should work for maximum user flexibility

### Panel Dimensions & Timing
- **Width**: Claude's discretion - choose optimal width based on content needs and existing patterns
- **Animation timing**: Claude's discretion - match left navigation animation patterns (likely 300ms for consistency)

### Content Layout & Organization
- **Section behavior**: Smart defaults
  - Common sections (Contact Details, Company Info) expanded by default
  - Sections with content expanded
  - Empty sections collapsed with "Add" prompts visible
- **Fixed header**: Contact name & photo, LIVE badge, and status indicators
  - Always visible at top while scrolling
  - Action buttons NOT in header (see below)
- **Section ordering**: Grouped by type
  - Static information first (Details, Company, Links)
  - Activity second (Notes, Calls, Meetings, Tasks/Reminders)
  - Engagement third (Email Replies, Email Links Viewed, Emails Sent)
- **Empty state display**: Show empty sections with actionable prompts
  - E.g., "Add Note" for empty Notes section
  - "Schedule Meeting" for empty Meetings section
  - Encourages engagement, shows what's possible

### Navigation & State
- **Prev/Next navigation**: Keep arrows (like current modal)
  - Users can cycle through leads without closing panel
  - Maintains familiar workflow
- **Panel switching behavior**: Claude's discretion - choose smoothest UX when opening different lead while panel is open
- **URL/History**: No URL changes
  - Panel is transient (doesn't update browser URL)
  - Back button doesn't close panel
  - Simpler, no history pollution
- **State persistence**: No memory - always use smart defaults
  - Every time panel opens, sections reset to default expanded/collapsed state
  - Predictable behavior, no hidden complexity

### Action Buttons & AI+ Menu
- **Button position**: Fixed at top, below header
  - Always visible and accessible without scrolling
  - Not in the scrollable header area
- **AI+ menu behavior**: Claude's discretion - optimize for side panel context vs centered modal
- **Button visibility**: Claude's discretion - choose optimal set of always-visible buttons for panel width
- **Next Lead button**: Remove
  - Prev/next arrows are sufficient for navigation
  - Reduces header clutter

### Claude's Discretion
- Panel width (optimize for content and screen size)
- Animation timing (match existing nav patterns)
- Panel switching transition (smooth UX when swapping profiles)
- AI+ dropdown menu positioning and behavior (adapt for side panel)
- Which action buttons are always visible vs overflow menu (optimize for space)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Left navigation system** (nav-left.css, nav-left.js): Uses CSS transforms and transitions for smooth animations - can reuse patterns for panel slide behavior
- **MagnificPopup library**: Currently handles modal overlays - will be replaced for profile panel but library may still be used elsewhere
- **jQuery & Bootstrap 3**: Primary framework - panel must integrate with jQuery patterns
- **Theme & typography systems**: Modern neutral colors and fonts already established

### Established Patterns
- **Animation timing**: Left nav uses 300ms transitions - panel should match for consistency
- **Flexbox layouts**: Main content area uses flexbox, panel overlay fits naturally
- **State persistence**: Navigation panel state persists using localStorage - could use same pattern if needed
- **jQuery event handling**: All interactions use jQuery - panel must follow this pattern

### Integration Points
- **Main content area** (`.main-content`): Panel will overlay this, needs z-index management
- **Profile trigger points**: Currently table row clicks open modal - need to identify and update all trigger points
- **Navigation between leads**: Current modal has prev/next arrows - panel must maintain this from list context
- **Action button behaviors**: AI+ dropdown, email/phone actions - need to adapt from modal to panel context

</code_context>

<specifics>
## Specific Ideas

- Panel slide animation should feel similar to the left navigation collapse/expand - smooth and polished
- Keep the familiar prev/next lead navigation that users already know from the modal
- Empty sections should encourage action ("Add Note", "Schedule Meeting") rather than just hiding
- Multiple close methods (X, backdrop, ESC) give users flexibility in their workflow

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope

</deferred>

---

*Phase: 02-profile-system*
*Context gathered: 2026-03-03*
