# Phase 2: Profile System - Research

**Researched:** 2026-03-03
**Domain:** UI/UX Panel Implementation - Right-hand slide panel for contact/lead profiles
**Confidence:** HIGH

## Summary

Phase 2 requires replacing centered modal popups with a right-hand overlay slide panel that displays comprehensive contact/lead information. This is a fundamental UI pattern shift from a disrupting modal to a non-disruptive overlay panel. The existing codebase uses jQuery, Bootstrap 3, and custom CSS animations. The left navigation panel (Phase 1) establishes proven patterns for smooth CSS transforms and transitions that should be mirrored for the right panel implementation.

The primary challenge is identifying all modal trigger points across the application and replacing them with panel-opening behavior, while maintaining the familiar prev/next navigation users expect from the existing modal workflow.

**Primary recommendation:** Implement a fixed right-hand overlay panel using CSS transforms (`translateX`), flexbox layouts, and smooth transitions (300ms to match left nav patterns). Use jQuery event handling consistent with existing codebase patterns. Replace MagnificPopup modal calls with panel open/close functions.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Panel Behavior & Animation:**
- Display mode: Overlay (panel slides over main content, doesn't push or shrink content area)
- Close triggers: Multiple methods - X button, click outside panel (backdrop), ESC key
- All three close methods must work for maximum user flexibility

**Panel Dimensions & Timing:**
- Width: Claude's discretion - choose optimal width based on content needs and existing patterns
- Animation timing: Claude's discretion - match left navigation animation patterns (likely 300ms for consistency)

**Content Layout & Organization:**
- Section behavior: Smart defaults
  - Common sections (Contact Details, Company Info) expanded by default
  - Sections with content expanded
  - Empty sections collapsed with "Add" prompts visible
- Fixed header: Contact name & photo, LIVE badge, and status indicators
  - Always visible at top while scrolling
  - Action buttons NOT in header (see below)
- Section ordering: Grouped by type
  - Static information first (Details, Company, Links)
  - Activity second (Notes, Calls, Meetings, Tasks/Reminders)
  - Engagement third (Email Replies, Email Links Viewed, Emails Sent)
- Empty state display: Show empty sections with actionable prompts
  - E.g., "Add Note" for empty Notes section
  - "Schedule Meeting" for empty Meetings section
  - Encourages engagement, shows what's possible

**Navigation & State:**
- Prev/Next navigation: Keep arrows (like current modal)
  - Users can cycle through leads without closing panel
  - Maintains familiar workflow
- Panel switching behavior: Claude's discretion - choose smoothest UX when opening different lead while panel is open
- URL/History: No URL changes
  - Panel is transient (doesn't update browser URL)
  - Back button doesn't close panel
  - Simpler, no history pollution
- State persistence: No memory - always use smart defaults
  - Every time panel opens, sections reset to default expanded/collapsed state
  - Predictable behavior, no hidden complexity

**Action Buttons & AI+ Menu:**
- Button position: Fixed at top, below header
  - Always visible and accessible without scrolling
  - Not in the scrollable header area
- AI+ menu behavior: Claude's discretion - optimize for side panel context vs centered modal
- Button visibility: Claude's discretion - choose optimal set of always-visible buttons for panel width
- Next Lead button: Remove
  - Prev/next arrows are sufficient for navigation
  - Reduces header clutter

### Claude's Discretion

- Panel width (optimize for content and screen size)
- Animation timing (match existing nav patterns)
- Panel switching transition (smooth UX when swapping profiles)
- AI+ dropdown menu positioning and behavior (adapt for side panel)
- Which action buttons are always visible vs overflow menu (optimize for space)

### Deferred Ideas (OUT OF SCOPE)

None - discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROF-01 | User can open contact/lead profile in right-hand slide panel | Panel trigger system, jQuery event binding patterns, data passing mechanism |
| PROF-02 | Profile panel displays contact/lead details and company info | Fixed header section, content layout organization, collapsible sections |
| PROF-03 | Profile panel shows engagement history | Section organization pattern, activity grouping |
| PROF-04 | Profile panel shows social/professional links | Section organization pattern, static information grouping |
| PROF-05 | Profile panel shows notes, calls, meetings, and reminders | Section organization pattern, activity grouping, expandable sections |
| PROF-06 | Profile panel shows team member ownership | Fixed header or ownership section implementation |
| PROF-07 | User can close profile panel without losing context | Multiple close methods (X button, backdrop click, ESC key), no state changes to main area |
| PROF-08 | Profile panel replaces existing popup behavior (no modal popups) | Complete replacement of MagnificPopup modal calls, removal of Bootstrap modal invocations |

</phase_requirements>

## Standard Stack

### Core Libraries

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jQuery | 1.11.x or 3.x (current codebase) | DOM manipulation, event binding, animations | Existing project foundation; all interactions use jQuery patterns |
| Bootstrap | 3.x | CSS framework, modal/button/form components | Already integrated; provides utility classes and responsive grid system |
| CSS3 Transforms & Transitions | Native | Smooth panel animations, sliding effects | Zero dependencies, hardware-accelerated, proven in left nav (Phase 1) |

### Supporting Elements

| Element | Status | Purpose |
|---------|--------|---------|
| MagnificPopup | To Be Replaced | Currently handles modal overlays; will be replaced for profile panel workflow |
| Bootstrap Modal | To Be Replaced | Used for confirmation dialogs and other modals; profile panel uses custom overlay pattern |

### Recommended Installation

```bash
# No new packages needed - use existing jQuery and Bootstrap
# Panel functionality built with native CSS and jQuery
```

## Architecture Patterns

### Recommended Project Structure

The profile panel should integrate into existing file organization:

```
existing/
├── nav-left.js          # Left navigation (Phase 1) - patterns to mirror
├── nav-left.css         # Left nav styles - animation patterns to replicate
├── webapp.js            # Main app JS - add profile panel logic
├── webapp.css           # Main styles - add panel overlay styles
├── theme.css            # Theme (Phase 1) - use existing color palette
└── typography.css       # Typography (Phase 1) - use existing fonts
```

**New files to create:**
- `profile-panel.js` — Panel open/close logic, content rendering, event handling
- `profile-panel.css` — Panel styles, animations, responsiveness, z-index management

### Pattern 1: CSS Transform Slide Animation

**What:** Use `transform: translateX()` for smooth hardware-accelerated panel sliding. This mirrors the left navigation approach from Phase 1.

**When to use:** Sliding any element on/off screen - proven performance and consistency

**Example:**

```css
/* Source: Existing nav-left.css pattern (300ms transitions proven) */

.profile-panel {
    position: fixed;
    top: 0;
    right: 0;
    height: 100vh;
    width: 380px;                          /* Claude's discretion - typical for content panels */
    background-color: #ffffff;
    z-index: 1100;                         /* Above main content, below modals if needed */
    transform: translateX(100%);            /* Start off-screen right */
    transition: transform 300ms ease-out;  /* Match left nav timing */
}

.profile-panel.open {
    transform: translateX(0);               /* Slide into view */
}

.profile-panel-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.3);
    z-index: 1090;                         /* Below panel, above main content */
    opacity: 0;
    transition: opacity 300ms ease-out;
    pointer-events: none;                  /* Don't intercept clicks when hidden */
}

.profile-panel-backdrop.visible {
    opacity: 1;
    pointer-events: auto;
}
```

### Pattern 2: Fixed Header with Scrollable Content

**What:** Keep contact name, photo, and actions fixed at top while profile details scroll below

**When to use:** When content exceeds viewport height and header must remain accessible

**Example:**

```html
<!-- Fixed header pattern -->
<div class="profile-panel open">
    <!-- FIXED: Header with name, photo, status -->
    <div class="profile-header">
        <button class="close-btn">&times;</button>
        <img class="contact-photo" src="..." alt="Contact">
        <h2 class="contact-name">John Doe</h2>
        <span class="live-badge">LIVE</span>
    </div>

    <!-- FIXED: Navigation & Action Buttons -->
    <div class="profile-actions">
        <button class="btn-prev">&larr;</button>
        <button class="btn-email">Email</button>
        <button class="btn-call">Call</button>
        <button class="btn-more">⋮</button>
    </div>

    <!-- SCROLLABLE: Content sections -->
    <div class="profile-content">
        <!-- Collapsible sections -->
    </div>
</div>
```

### Pattern 3: Smart Collapsible Sections

**What:** Show/hide sections based on: user preference (toggles), content presence (empty = collapsed), section importance (common = expanded)

**When to use:** When displaying variable-length data that may be empty

**Example:**

```javascript
// Source: Mirrored from nav-left.js popover expand/collapse logic

function initSectionToggles(profilePanel) {
    profilePanel.find('.section-header').on('click', function() {
        const section = $(this).closest('.profile-section');
        const content = section.find('.section-content');
        const isExpanded = section.hasClass('expanded');

        section.toggleClass('expanded');
        content.slideToggle(300); // Match animation timing
    });
}

// Smart defaults on panel open
function openProfilePanel(contactData) {
    // Always expanded: Contact Details, Company Info
    const alwaysExpanded = ['details', 'company'];

    // Expand if has content
    const hasContentSections = ['notes', 'calls', 'meetings'];

    alwaysExpanded.forEach(id => {
        panel.find(`#section-${id}`).addClass('expanded');
    });

    hasContentSections.forEach(id => {
        const hasItems = contactData[id]?.length > 0;
        if (hasItems) {
            panel.find(`#section-${id}`).addClass('expanded');
        }
    });
}
```

### Pattern 4: Event Delegation for Multiple Close Methods

**What:** Bind close handlers to: (1) close button click, (2) backdrop click, (3) ESC key

**When to use:** When modal/overlay needs multiple user-friendly close triggers

**Example:**

```javascript
// Source: jQuery event binding pattern from existing webapp.js

const panelCloseHandlers = {
    closeButton: function() {
        $('#profile-panel').find('.close-btn').on('click', closePanel);
    },

    backdropClick: function() {
        $('.profile-panel-backdrop').on('click', closePanel);
    },

    escapeKey: function() {
        $(document).on('keydown', function(e) {
            if (e.which === 27) { // ESC key code
                closePanel();
            }
        });
    }
};

function closePanel() {
    const panel = $('#profile-panel');
    const backdrop = $('.profile-panel-backdrop');

    panel.removeClass('open');
    backdrop.removeClass('visible');

    // Allow animation to complete before cleanup
    setTimeout(() => {
        panel.find('.profile-content').empty();
    }, 300);
}
```

### Anti-Patterns to Avoid

- **Full page reload on profile change:** Use AJAX/dynamic content updates instead
- **Z-index without strategy:** Document all z-index values and maintain central registry to prevent conflicts
- **Inline styles for animations:** Use CSS classes paired with transitions - easier to adjust timing globally
- **Blocking main content:** Ensure panel is overlay only - never use `margin-right` or `padding-right` on main content
- **Keyboard traps:** Always allow ESC to close; manage focus appropriately for accessibility
- **Manual panel width calculations:** Use CSS flexbox and max-width constraints instead

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Smooth sliding animations | Custom JavaScript with `setInterval` | CSS `transform` + `transition` | Hardware acceleration, 60fps, browser optimization, existing Phase 1 precedent |
| Modal backdrop/overlay | DIY click handlers | Combine CSS classes + jQuery event delegation | Handles edge cases (rapid clicks, nested modals, focus management) |
| Collapsible sections | Manual DOM manipulation | jQuery `.slideToggle()` or CSS `max-height` transitions | Handles animation state, prevents double-clicks, proven in codebase |
| Keyboard event handling | Direct `window.onkeydown` | jQuery `$(document).on('keydown')` | Proper event delegation, plays nice with other handlers, consistent with existing patterns |
| Responsive z-index management | Scattered z-index values | CSS custom properties or documented registry | Prevents conflicts, easier to maintain, scalable as features grow |

**Key insight:** The existing codebase (jQuery, Bootstrap, CSS transforms) already provides everything needed for a professional slide panel. Building custom solutions for animations or event handling would duplicate already-solved problems and introduce maintenance burden.

## Common Pitfalls

### Pitfall 1: Z-Index Conflicts

**What goes wrong:** Panel appears behind other elements, or backdrop doesn't block clicks properly

**Why it happens:** Multiple overlays (modals, tooltips, popovers, dropdowns) accumulate z-index values without coordination; new panel z-index not considered in context

**How to avoid:**
- Document z-index strategy: `1000` = left nav, `1090` = backdrop, `1100` = panel, `1200+` = alerts/modals
- Search codebase for existing z-index values before choosing panel z-index
- Test panel opening over all content types (with active popovers, dropdowns, modals)

**Warning signs:**
- Panel opens but elements from other sections appear on top
- Close button visible but unclickable (backdrop overlay issue)

### Pitfall 2: Main Content Reflow on Panel Open

**What goes wrong:** Main content shifts right when panel opens, creating jarring layout jitter

**Why it happens:** Temptation to use `margin-right` or `padding-right` to make space; browser must recalculate layout

**How to avoid:**
- Panel must be `position: fixed` overlay only - never adjust main content positioning
- Use CSS `overflow: hidden` on body if needed to prevent scroll bar shift (but test this carefully)
- Verify in browser: open/close panel and main content should not move at all

**Warning signs:**
- Content "jumps" when panel opens/closes
- Horizontal scrollbar appears/disappears
- Text reflow visible during animation

### Pitfall 3: Animated Transitions Cutting Off

**What goes wrong:** Panel slides in but content is clipped or sections don't expand properly

**Why it happens:** Parent overflow properties conflict with child animations (`overflow: hidden` prevents child elements from showing)

**How to avoid:**
- Audit CSS: ensure panel has `overflow: visible` for header area, `overflow-y: auto` only on scrollable content section
- Test all section toggles while panel is sliding
- Verify smooth transitions between: panel closed → panel opening → first section expanding

**Warning signs:**
- Content visible only after animation completes
- Section expansion happens without visible animation
- Buttons/header cut off during slide

### Pitfall 4: Misidentifying Modal Trigger Points

**What goes wrong:** Some leads still open in modal after phase implementation

**Why it happens:** Multiple ways to open profiles - table row click, search results, email chain, etc.; easy to miss one code path

**How to avoid:**
- Create comprehensive list of ALL ways to open a profile in current app
- Search for all jQuery `.on('click')` handlers and MagnificPopup calls
- Test every section of the app (Lists, Engagement, Dashboard, etc.) to verify no modals remain

**Warning signs:**
- Modal opens instead of panel in specific sections
- Prev/next navigation works in panel but not from that entry point
- Some contact types open differently than others

### Pitfall 5: Content Not Scrolling Properly

**What goes wrong:** Panel opens but scrolling jerky, bouncy, or doesn't work in certain browsers

**Why it happens:** Conflicting `overflow` properties, `position: fixed` with `overflow-y: auto` edge cases, or missing height constraints

**How to avoid:**
- Set explicit height: `height: 100vh` on panel container
- Set overflow on content section only: `.profile-content { overflow-y: auto; max-height: calc(100vh - 200px); }`
- Test on multiple browsers (desktop focus: Chrome, Firefox, Safari) and scroll with mouse/trackpad
- Test with long content (50+ notes, many historical emails)

**Warning signs:**
- Scroll bar doesn't appear when needed
- Scrolling lags or stutters
- Content bounces to top when scrolling stops
- Scroll doesn't work after opening second/third profile

### Pitfall 6: Rapid Click State Inconsistency

**What goes wrong:** Clicking close and open rapidly causes panel to get stuck half-visible or in wrong state

**Why it happens:** Animations aren't complete; new click happens before transition ends; state variables not tracked

**How to avoid:**
- Track animation state: `data('isAnimating', true)` during transition
- Ignore new requests during animation: `if (panel.data('isAnimating')) return;`
- Use CSS `transition` end event (`transitionend`) to update state, not hardcoded timeouts
- Or use a simple flag: store close time, ignore new opens within 300ms

**Warning signs:**
- Clicking prev/next multiple times breaks navigation
- Panel becomes unresponsive after rapid clicks
- State inconsistencies in console

## Code Examples

Verified patterns from existing codebase:

### Opening Profile Panel with Data

```javascript
// Source: Mirrored from webapp.js modal opening pattern (line ~915: pmp function)

function openProfilePanel(contactData) {
    const panel = $('#profile-panel');
    const backdrop = $('.profile-panel-backdrop');

    // Prevent double-open
    if (panel.hasClass('open')) {
        // If already open, just update content (smooth transition to new contact)
        updatePanelContent(contactData);
        return;
    }

    // Populate panel with contact data
    renderProfileContent(contactData);

    // Show panel with animation
    panel.addClass('open');
    backdrop.addClass('visible');

    // Initialize section toggles after content renders
    initSectionToggles(panel);
}

function updatePanelContent(contactData) {
    const panel = $('#profile-panel');

    // Update header (photo, name, status)
    panel.find('.contact-photo').attr('src', contactData.photo);
    panel.find('.contact-name').text(contactData.name);

    // Fade content area, update, fade back
    const content = panel.find('.profile-content');
    content.fadeOut(150, function() {
        $(this).html(renderSections(contactData)).fadeIn(150);
        initSectionToggles(panel);
    });
}

// Render all profile sections with smart defaults
function renderProfileContent(contactData) {
    const panel = $('#profile-panel');

    const html = `
        <div class="profile-header">
            <button class="close-btn" aria-label="Close panel">&times;</button>
            <img class="contact-photo" src="${contactData.photo}" alt="${contactData.name}">
            <h2 class="contact-name">${contactData.name}</h2>
            <span class="live-badge">LIVE</span>
        </div>

        <div class="profile-actions">
            <button class="btn-nav btn-prev" title="Previous contact" data-nav="prev">&larr;</button>
            <button class="btn-email" title="Email"><i class="glyphicon glyphicon-envelope"></i></button>
            <button class="btn-call" title="Call"><i class="glyphicon glyphicon-phone"></i></button>
            <button class="btn-more" data-toggle="dropdown">⋮</button>
        </div>

        <div class="profile-content">
            ${renderSections(contactData)}
        </div>
    `;

    panel.html(html);
}

function renderSections(contactData) {
    // Details, Company, Links, Notes, Calls, Meetings, Engagement
    const sections = [
        { id: 'details', title: 'Details', alwaysExpanded: true, data: contactData.details },
        { id: 'company', title: 'Company Info', alwaysExpanded: true, data: contactData.company },
        { id: 'links', title: 'Links', alwaysExpanded: false, data: contactData.socialLinks },
        { id: 'notes', title: 'Notes', alwaysExpanded: null, data: contactData.notes }, // null = expand if has content
        { id: 'calls', title: 'Calls', alwaysExpanded: null, data: contactData.calls },
        { id: 'meetings', title: 'Meetings', alwaysExpanded: null, data: contactData.meetings }
    ];

    return sections.map(section => renderSection(section, contactData)).join('');
}

function renderSection(section, contactData) {
    const hasContent = section.data && section.data.length > 0;
    const shouldExpand = section.alwaysExpanded === true ||
                         (section.alwaysExpanded === null && hasContent);

    const expandedClass = shouldExpand ? 'expanded' : '';
    const displayStyle = shouldExpand ? 'display: block;' : 'display: none;';

    return `
        <div class="profile-section ${section.id} ${expandedClass}">
            <div class="section-header">
                <span class="section-title">${section.title}</span>
                <span class="section-toggle">▾</span>
            </div>
            <div class="section-content" style="${displayStyle}">
                ${renderSectionContent(section, contactData)}
            </div>
        </div>
    `;
}

function renderSectionContent(section, contactData) {
    if (!section.data || section.data.length === 0) {
        // Empty state with actionable prompt
        const prompts = {
            'notes': 'Add Note',
            'calls': 'Log Call',
            'meetings': 'Schedule Meeting'
        };
        return `<div class="empty-state">${prompts[section.id] || 'No items'}</div>`;
    }

    // Render items based on section type
    return section.data.map(item => `<div class="item">${JSON.stringify(item)}</div>`).join('');
}
```

### Closing Panel with Multiple Triggers

```javascript
// Source: webapp.js modal close pattern with multiple handlers

function setupPanelCloseHandlers() {
    const panel = $('#profile-panel');
    const backdrop = $('.profile-panel-backdrop');

    // Close button click
    $(document).on('click', '.profile-panel .close-btn', function(e) {
        e.preventDefault();
        closeProfilePanel();
    });

    // Backdrop click (outside panel)
    $(document).on('click', '.profile-panel-backdrop', function(e) {
        if (e.target === this) { // Only if clicked on backdrop, not children
            closeProfilePanel();
        }
    });

    // ESC key
    $(document).on('keydown', function(e) {
        if (e.which === 27 && panel.hasClass('open')) { // ESC = 27
            closeProfilePanel();
        }
    });
}

function closeProfilePanel() {
    const panel = $('#profile-panel');
    const backdrop = $('.profile-panel-backdrop');

    // Already closed or animating - ignore
    if (!panel.hasClass('open')) return;

    // Trigger animation
    panel.removeClass('open');
    backdrop.removeClass('visible');

    // Clear content after animation completes
    setTimeout(() => {
        panel.html('');
    }, 300); // Match CSS transition timing
}
```

### Prev/Next Navigation

```javascript
// Source: webapp.js modal navigation pattern

function setupPanelNavigation() {
    $(document).on('click', '.profile-panel .btn-nav', function() {
        const direction = $(this).data('nav'); // 'prev' or 'next'
        navigateContact(direction);
    });
}

function navigateContact(direction) {
    // Get current contact ID from panel
    const currentId = $('#profile-panel').data('contact-id');

    // Get list of contacts from current view (table, search results, etc.)
    // This data comes from the main app state
    const contacts = window.currentContactList || [];
    const currentIndex = contacts.findIndex(c => c.id === currentId);

    if (currentIndex === -1) return; // Contact not in list

    let nextIndex;
    if (direction === 'next') {
        nextIndex = (currentIndex + 1) % contacts.length; // Wrap around
    } else {
        nextIndex = (currentIndex - 1 + contacts.length) % contacts.length; // Wrap around
    }

    const nextContact = contacts[nextIndex];

    // Update panel without closing
    updatePanelContent(nextContact);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Centered modal popups (MagnificPopup) | Right-hand overlay slide panel | Phase 2 (2026-03) | Non-disruptive viewing, familiar data management patterns |
| Single modal for all contact details | Smart collapsible sections with defaults | Phase 2 | Users see relevant info immediately; less scrolling |
| Hardcoded animation timing | CSS transitions (300ms consistent) | Phase 1 (left nav) → Phase 2 | Maintains consistent feel, easier to adjust globally |
| Bootstrap modals | Custom CSS overlay | Phase 2 | Full control over appearance, no modal backdrop conflicts |

**Deprecated/outdated:**
- MagnificPopup for profile popups: Replaced with custom slide panel (better UX, consistent with left nav)
- Bootstrap `.modal()` jQuery API for profiles: Replaced with custom open/close functions (simpler event handling)

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed - Wave 0 gap (JavaScript testing setup needed) |
| Config file | To be created during implementation planning |
| Quick run command | `npm test` (post-installation) |
| Full suite command | `npm test -- --coverage` (post-installation) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROF-01 | User can click contact to open panel | integration/e2e | `npm test -- profile-panel.test.js` | ❌ Wave 0 |
| PROF-02 | Panel displays contact details, company info | unit | `npm test -- renderContent.test.js` | ❌ Wave 0 |
| PROF-03 | Panel shows engagement history section | unit | `npm test -- sections.test.js` | ❌ Wave 0 |
| PROF-04 | Panel shows social/professional links | unit | `npm test -- sections.test.js` | ❌ Wave 0 |
| PROF-05 | Panel shows notes, calls, meetings, reminders | unit | `npm test -- sections.test.js` | ❌ Wave 0 |
| PROF-06 | Team member ownership displays | unit | `npm test -- renderContent.test.js` | ❌ Wave 0 |
| PROF-07 | User can close panel via X, backdrop, ESC | integration | `npm test -- closeHandlers.test.js` | ❌ Wave 0 |
| PROF-08 | No modal popups remain in any section | e2e | `npm test -- smoke-no-modals.test.js` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** Quick smoke test (panel opens/closes, content renders)
- **Per wave merge:** Full test suite green before phase gate
- **Phase gate:** All PROF requirements passing automated tests + manual verification across all sections

### Wave 0 Gaps

- [ ] `tests/profile-panel.test.js` — covers PROF-01 (open panel from various contexts)
- [ ] `tests/renderContent.test.js` — covers PROF-02, PROF-06 (content rendering)
- [ ] `tests/sections.test.js` — covers PROF-03, PROF-04, PROF-05 (section display)
- [ ] `tests/closeHandlers.test.js` — covers PROF-07 (close methods)
- [ ] `tests/smoke-no-modals.test.js` — covers PROF-08 (integration check)
- [ ] `package.json` changes — add Jest or Vitest, testing libraries, test scripts
- [ ] `.gitignore` updates — exclude `coverage/`, `node_modules/` if not already present

**Recommended testing setup:** Jest with jsdom (for DOM testing in JavaScript) or Vitest (modern, faster). Both work well with jQuery code.

## Open Questions

1. **Exact panel width for standard desktop viewport (1920+)**
   - What we know: User chose "Claude's discretion"; similar panels often 350-450px
   - What's unclear: Content types and average text length to determine optimal width
   - Recommendation: Start with 380px (follows common SaaS panel width); iterate based on Phase 2 task feedback

2. **Panel switching animation when changing contacts with panel already open**
   - What we know: User chose "Claude's discretion"; transition should be "smooth"
   - What's unclear: Fade out/in? Slide? Instant? How long?
   - Recommendation: Cross-fade content (150ms fade out, re-render, 150ms fade in) for smooth visual continuity

3. **AI+ menu behavior in narrow panel**
   - What we know: User chose "Claude's discretion"; must adapt for side panel vs modal
   - What's unclear: Dropdown position (below button? left edge? right edge?)
   - Recommendation: Position dropdown to left of button (into panel), max-width constraint, scroll if needed

4. **Which action buttons always visible, which in overflow menu?**
   - What we know: User chose "Claude's discretion"; space is limited (380px - padding)
   - What's unclear: Button count and sizes from existing modal
   - Recommendation: Always show: Email, Call. Overflow: AI+, Archive, Tags, etc.

## Sources

### Primary (HIGH confidence)

- **Existing codebase patterns** — nav-left.js, nav-left.css demonstrate CSS transforms (300ms), jQuery event binding, popover handling
- **CONTEXT.md decisions** — User requirements document specific constraints and discretionary areas
- **REQUIREMENTS.md PROF-01 through PROF-08** — Phase requirements clearly defined
- **Bootstrap 3 documentation** — Grid, modals, button components available for integration
- **jQuery 3.x documentation** — Event delegation, DOM manipulation, animation methods

### Secondary (MEDIUM confidence)

- **Project architecture inferred from existing files** — webapp.js (modal patterns), webapp.css (layout structure), theme/typography established
- **MagnificPopup documentation** — Current implementation identified for replacement planning
- **SaaS UI patterns** — Right-hand panel overlay is industry standard for data inspection interfaces

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** - jQuery, Bootstrap 3, CSS transforms all proven in Phase 1
- Architecture: **HIGH** - Clear patterns from existing left nav, decision document constrains options
- Pitfalls: **MEDIUM-HIGH** - Common issues identified from modal/overlay experience; Phase 1 animation pitfalls already resolved
- Validation: **MEDIUM** - No existing test infrastructure; framework selection recommended but specific tools are Claude's discretion

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (30 days - stable tech stack)

---

*Phase 2: Profile System*
*Research complete. Ready for planning phase.*
