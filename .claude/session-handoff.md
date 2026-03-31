# Session Handoff — Profile Panel Phase 2
*Last updated: 2026-03-31 (session 19 — panel-ai-btns inner div; Research dropdown direction; pendingTypes fix; onToggleView toView param; unavailable item state)*

---

## Quick Resume Checklist

After `/clear`, do this to restore full context:

1. Read this file
2. Start the dev server: `mcp__Claude_Preview__preview_start` → `"phase-2-integration-test"` (port 3333)
3. Preview URL: `http://127.0.0.1:3333/phase-2/integration-test.html`
4. Current cache versions (Phase 2): **CSS v47 · JS v55** (plus session-19 patches — no explicit version bump)
5. Current cache versions (Phase 1 nav): **nav-left.css v7 · nav-left.js v2**

---

## Project Context

**Product:** LeadLeaper — a sales engagement/CRM web app
**Project root:** `C:\aagreg\Development\aaaaClaude\projects\web-app\`
**Active work:** `phase-2/` — Profile panel slide-in component
**Integration test:** `phase-2/integration-test.html` (full page with left nav + panel)

The profile panel is a fixed right-side slide-in panel (LinkedIn Sales Navigator pattern) that opens when a user clicks a contact name. It will become the **primary UI surface for both contact management and contact engagement** in the app.

⚠️ **IMPORTANT:** The panel HTML is embedded directly in `integration-test.html` (not loaded from `profile-panel.html`). Changes to the panel structure must be made in BOTH files to keep them in sync.

---

## Files Modified This Session

| File | Purpose |
|------|---------|
| `phase-2/profile-panel.js` | pendingTypes fix; onToggleView toView param; unavailable state comment |
| `phase-2/profile-panel.css` | unavailable state CSS rules (4 new rules) |
| `phase-2/profile-panel.html` | panel-ai-btns inner div added |
| `phase-2/integration-test.html` | panel-ai-btns inner div added; Research dropdown direction fix |

---

## Session 19 Changes (2026-03-31)

### 1 — `div.panel-ai-btns` inner wrapper added to `.panel-actions`

**Both `profile-panel.html` and `integration-test.html` updated.**

The three action buttons (AI+ Engagement, AI+ Research, Slack VSR) are now wrapped in a `div.panel-ai-btns` inner div inside `.panel-actions`. This allows the host to control alignment and `max-width` as a group — e.g. when only 2 buttons are visible, `panel-ai-btns` can constrain the width so buttons don't appear too wide relative to the dropdown lists.

```html
<div class="panel-actions">
    <div class="panel-ai-btns">
        <button ... id="ai-engagement-btn">AI+ Engagement</button>
        <button ... id="ai-research-btn">AI+ Research</button>
        <button ... id="ai-slack-btn">Slack VSR</button>   <!-- hidden when body.panel-ai-2-btns -->
    </div>
</div>
```

**Usage pattern:** When `body` has class `panel-ai-2-btns`, hide the Slack VSR button (`display:none` on `.panel-action-slack`) and set `max-width` on `.panel-ai-btns` to match dropdown list width.

### 2 — AI+ Research dropdown direction fix in 2-btn CRM layout

**`profile-panel.js` — `#ai-research-btn` click handler.**

When `body.panel-ai-2-btns` is set AND the panel is in CRM view (`.profile-panel` does NOT have `.ai-view-active`), the Research dropdown now **right-anchors** (extends leftward from button's right edge) instead of left-anchoring (extending rightward). This prevents the dropdown from clipping the panel's right edge when Research is the rightmost visible button.

Mirrors the existing Slack VSR right-anchor behaviour. In AI view or 3-btn layout the original left-anchor is preserved.

```javascript
var toView = (panelCurrentView === 'crm') ? 'ai' : 'crm';
if ($('body').hasClass('panel-ai-2-btns') && !$('.profile-panel').hasClass('ai-view-active')) {
    // Right-anchor
    $dropdown.css({ top: ..., right: (window.innerWidth - rect.right) + 'px', left: '' });
} else {
    // Left-anchor (original)
    $dropdown.css({ top: ..., left: rect.left + 'px', right: '' });
}
```

### 3 — `pendingTypes` now excludes `unavailable` items (generate-all)

**`profile-panel.js` — `generate-all` handler.**

The `data-item-state` DOM check that guards `pendingTypes` now treats `'unavailable'` as equivalent to `'done'` — items in that state are excluded from the array passed to `onGenerateAll`.

```javascript
if (itemState === 'done' || itemState === 'underway' || itemState === 'unavailable') alreadyDone = true;
```

### 4 — `onToggleView` callback now receives target view as second parameter

**`profile-panel.js` — JSDoc, null-default, and click handler.**

Signature changed from `onToggleView(contactId, proceed)` to:

```javascript
onToggleView(contactId, toView, proceed)
// toView: 'ai' | 'crm' — the view the panel will enter if proceed() is called
```

`toView` is derived as the opposite of `panelCurrentView` at click time:
```javascript
var toView = (panelCurrentView === 'crm') ? 'ai' : 'crm';
cb.onToggleView(cid, toView, function() { togglePanelView(); });
```

### 5 — `_setEngagementItemState` now supports `'unavailable'` state

**`profile-panel.css` (4 new rules) + `profile-panel.js` (comment update).**

New state for engagement dropdown items where data is not available (e.g. no recent announcements for an employer).

**Visual:** Grey prohibition circle icon (`.ai-item-unavail` SVG — already present in `_buildDropdownItemHtml`) + muted grey text + `cursor:default` + no hover highlight.

**CSS added** (after the `done` rules):
```css
.ai-dropdown-item[data-item-state="unavailable"] .ai-item-arrow   { display: none; }
.ai-dropdown-item[data-item-state="unavailable"] .ai-item-unavail { display: block; }
.ai-dropdown-item[data-item-state="unavailable"]                  { color: #b0b0b0; cursor: default; }
.ai-dropdown-item[data-item-state="unavailable"]:hover            { background-color: transparent; }
```

**Setting from host code:**
```javascript
window.setAiItemState('employer-announcement', 'unavailable');
```

**Persistence:** `'unavailable'` is automatically persisted to `itemStates` (the snapshot filter already excludes only `'idle'` and `'underway'`), so the state survives contact switches and panel close/reopen.

**Full state machine** (updated):
| `data-item-state` | Icon shown | Text colour | Hover | Persisted |
|---|---|---|---|---|
| *(absent)* — idle | `›` arrow | normal | yes | no |
| `underway` | spinner | normal | yes | no |
| `done` | ✅ green check | normal | yes | yes |
| `unavailable` | 🚫 grey prohibition | `#b0b0b0` muted | no | yes |

---

## ⚠️ Outstanding Issue — Zone 1 Reply Button Done-State Listener

**Raised session 17. User confirmed in session 19 that clicking the checkmark no longer appears to trigger a listener, but the `.off()` cleanup has not yet been applied as a code-level guarantee.**

When a Zone 1 reply button transitions from `underway` → `done` (green checkmark), the click listener may still be attached. Clicking the checkmark could trigger another reply generation attempt.

**Fix needed:** Remove (`.off()`) the click listener from the reply button when its `data-btn-state` transitions to `done`.

---

## Session 18 Changes (2026-03-29)

### 1 — `onSend` callback signature aligned to production (JS v55 + integration-test.html)

**Production signatures confirmed:**
```javascript
cb.onSend      = function(sectionId, subject, mountEl, contactId, done) { ... }
cb.onSendReply = function(replyId, srcPostId, subject, comment, mountEl, cid, done) { ... }
```

**Fix (profile-panel.js):** `onSend` handler now passes `mountEl2 = document.getElementById(sectionId + '_MOUNT')` as 3rd arg and `done2` as 5th arg.

**Fix (integration-test.html):** Demo `onSend` updated to match production signature with simulated 1.2s async delay.

### 2 — `div.ai-section` now carries `id` attribute (JS v55)

`div.ai-section` elements now rendered with both `id` and `data-section-id` set to the unique `sectionId`. Enables direct `getElementById` lookups from host code.

### 3 — Zone 2 subject not saved on close/next/prev (JS v55)

**Fix:** Read subject input directly by its known unique ID:
```javascript
var subject = $('#' + sec.id + '_SUB').val();
```

### 4 — Zone 2 section content hidden after restore (JS v55)

**Fix:** `_buildSectionContentHtml` now accepts a `hidden` parameter. When `false` (restore path), content div renders without `display:none`.

---

## Session 17 Changes (2026-03-27)

### 1 — `window.setAiItemState` clarification (no code change)
`updateAiSection(id, { loading: false })` auto-marks the dropdown item done via `_setEngagementItemState(id, 'done')`, which looks for `data-ai-action === id` on the dropdown item. This only works if the host used **`aiAction`** (first param of `onGenerateDraft`) as the section `id` in `addAiSection`.

If the host uses a different `id`, call **`window.setAiItemState(aiAction, 'done')`** directly after generation completes.

`window.setAiItemState` is exposed at line ~3147 of `profile-panel.js`.

### 2 — Zone 2 selection: Zone 1 pre-collapse before `onGenerateDraft` (JS v54)
Zone 1 is now collapsed **before** `onGenerateDraft` fires — CRM view uses `hide()`, AI view uses `slideUp(150)`.

### 3 — Zone 2 section header chevron orientation fix (JS v54)
Fixed by adding explicit `transform: rotate(0deg)` hard-reset on the collapsed state.

### 4 — Close+reopen dual-view bug fixed (JS v54)
Explicit hard CRM reset added at the top of the fresh-open path in `openProfilePanel`:
```javascript
$panel.removeClass('ai-view-active');
$('.profile-content').css('display', '');
panelCurrentView = 'crm';
```

---

## Session 16 Changes (2026-03-26)

### 1 — `_buildSectionContentHtml` replacement (JS v51)
### 2 — `addAiSection` / `updateAiSection` API cleanup (JS v51) — dropped `alreadyTracked`, `tracked`, `onEditorMount`
### 3 — Zone 2 header removed (JS v51) — sections are now flat
### 4 — Loading state redesign (CSS v48, JS v51) — static spinner + updateable text
### 5 — Zone 2 light-blue content area (CSS v48) — `background: #f8faff`
### 6 — Section header colours aligned to zone level (CSS v48)
### 7 — Zone 1 auto-collapse on draft trigger (JS v51)
### 8 — "Ready" status hidden (CSS v48)

---

## Current Panel Structure (visual top → bottom)

```
┌─────────────────────────────────────┐
│  ‹ Previous    Next ›           ×   │  .panel-controls (fixed, flex-shrink:0)
├─────────────────────────────────────┤
│  [photo]  Name      LIVE            │  .panel-identity (fixed, flex-shrink:0)
│           Company                   │
│           Title                     │
│           "About" snippet ▾         │  #panel-about-snippet (AI view only)
│  ┌─ full About popover ────────┐    │  #panel-about-popover (opens on snippet click)
│  └─────────────────────────────┘    │
├─────────────────────────────────────┤
│  [AI+ Engagement] [AI+ Research] [Slack VSR]  │  .panel-actions > div.panel-ai-btns (fixed, flex-shrink:0)
├─────────────────────────────────────┤
● ◄ left-border circular toggle btn   │  .panel-view-toggle (position:absolute, left:-18px)
├─────────────────────────────────────┤
│  ▼ scrollable .profile-content      │  CRM VIEW (shown by default)
│  email / phone / location           │
│  ENGAGEMENT HISTORY                 │
│  ┌─ Notes (2) ── Add Note ∨ ─┐     │
│  ┌─ Meetings / Calls / … ─────┐    │
└─────────────────────────────────────┘

AI ENGAGEMENT VIEW (shown when .ai-view-active; panel expands to 920px)
┌─────────────────────────────────────────────────────────────────────────────┐
│  ▼ LinkedIn Posts                                                      [2]  │  .ai-zone (Zone 1)
│  ┌─ post preview text… ──────────────────── [Reply ›] ────────────────┐    │  .ai-post-card
│  │  [full post text]                                                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│  ┌─ second post… ────────────────────────── [Reply ›] ────────────────┐    │
│  └─────────────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─ Employer Challenges ──────────────────────────────────────────────┐     │  .ai-zone (Zone 2)
│  │  [subject input]                                            [SEND] │     │  .ai-section (flat, no zone header)
│  │  .ai-editor-mount  ← host initialises tinyMCE here               │     │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## AI Engagement View — Zone Architecture

### Design philosophy
The panel is a **dumb renderer**. The host (integration test / production app) owns:
- What zones appear and when
- What content each draft section contains
- When to generate content (AI calls)
- All tinyMCE lifecycle (init, setContent, destroy)

The panel owns:
- DOM construction for zones, post cards, and sections
- Collapse/expand interactions
- Reply/Send button states
- Callback firing

### Zone/Section API (all exposed on `window`)

```javascript
// Zone 1 — LinkedIn Posts
window.showLinkedInPosts(posts)
    // posts: null (loading) | [] (empty) | [{id, preview, meta, text}, ...]

window.updateLinkedInPost(postId, updates)
    // updates: { state: 'idle'|'generating'|'done', replyText: '...' }

// Zone 2 — Email Drafts
window.addAiSection({ id, type, title, subject, body, loading, loadingText })
    // loading:true → static spinner placeholder with loadingText (default: 'Generating email…')
    // loading:false → ready with subject+body (no zone header — sections are flat)

window.updateAiSection(id, { loading, subject, body, loadingText })
    // loading:false → transitions to ready state; also auto-marks dropdown item done IF id === aiAction
    // loadingText:'…' → updates spinner text mid-generation (without transitioning to ready)
    // subject/body → updates content in an existing ready section

window.removeAiSection(id)
    // destroys editor (onEditorDestroy callback) + removes DOM node

window.clearAiSections()
    // called on panel close or contact switch — destroys all sections

// Dropdown item state control
window.setAiItemState(aiAction, state)
    // state: 'idle' | 'underway' | 'done' | 'unavailable'
    // Use this when section id !== aiAction (updateAiSection auto-mark won't find the item)
    // 'unavailable' = grey prohibition icon + muted text; persisted across contact switches
```

### Callbacks (`window.profilePanelCallbacks`)

```javascript
window.profilePanelCallbacks = {
    // ── Navigation ──────────────────────────────────────────────────────
    onNext:   function(currentId, done) { done(contactData); },
    onPrev:   function(currentId, done) { done(contactData); },
    onClose:  function(contactId) {},

    // ── CRM view data loading ────────────────────────────────────────────
    onLoadActivity: function(contactId, done) { done(activityData); },
    onLoadResearch: function(contactId, done) { done(researchHtml); },

    // ── CRM contact edit ─────────────────────────────────────────────────
    onChange: function(contactId, fieldName, newValue) {},
    onSave:   function(contactId, editedFields, done) { done(); /* or done(errMsg) */ },

    // ── AI view — gate / view switch ─────────────────────────────────────
    onToggleView: function(contactId, toView, proceed) {
        // toView: 'ai' | 'crm' — the view the panel will enter if proceed() is called
        // Call proceed() to allow the switch; omit to block
    },

    // ── AI view — tinyMCE lifecycle ──────────────────────────────────────
    onEditorSetContent: function(sectionId, html) {
        // Push generated content: tinyMCE.get(editorId).setContent(html)
    },
    onEditorDestroy: function(sectionId) {
        // Cleanup: tinyMCE.get(editorId).remove()
    },
    onEditorGetContent: function(sectionId) {
        // Return current editor HTML — called during AI state save (synchronous)
        // Production: return tinyMCE.get('ai-editor-' + sectionId).getContent();
    },

    // ── AI view — user actions ───────────────────────────────────────────
    onSend: function(sectionId, subject, mountEl, contactId, done) {
        // User clicked SEND on a Zone 2 draft section (email draft)
        // mountEl = document.getElementById(sectionId + '_MOUNT')
        // Host reads body: tinyMCE.get('ai-editor-' + sectionId).getContent()
        // Call done() on success → button transitions to ✓
        // Call done(errMsg) on failure → button reverts to idle + panel notification
    },
    onSendReply: function(replyId, srcPostId, subject, comment, mountEl, cid, done) {
        // User clicked SEND on a Zone 1 reply area (LinkedIn reply follow-up email)
        // Call done() / done(errMsg) same pattern as onSend
    },
    onGenerateReply: function(postId, postText, contactId) {
        // User clicked Reply on a LinkedIn post card
        // Call updateLinkedInPost(postId, { state: 'generating' }) immediately
        // Call updateLinkedInPost(postId, { state: 'done', replyText: '...' }) when done
    },
    onPingLinkedIn: function(contactId) {
        // User clicked "Ping LinkedIn for posts" in dropdown
        // Call showLinkedInPosts(null) for loading state
        // Call showLinkedInPosts([...]) when posts arrive
    },
    onGenerateDraft: function(aiAction, type, title, contactId) {
        // User clicked an email type in dropdown (aiAction = 'employer-challenges' etc.)
        // IMPORTANT: use aiAction (not type) as the section id so updateAiSection auto-marks
        //            the dropdown item done when loading:false is set.
        //            If you use a different id, call window.setAiItemState(aiAction, 'done') manually.
        // Call addAiSection({ id: aiAction, type, title, loading: true })
        // Call updateAiSection(aiAction, { loading: false, subject, body }) when generated
        // NOTE: Zone 1 is pre-collapsed by the panel before this fires — no need to do it here
    },
    onGenerateAll: function(contactId, pendingTypes) {
        // User clicked "Generate ALL of the above"
        // pendingTypes: array of {type, title, action} entries not yet done/underway/unavailable
        // Generate only the types in pendingTypes
    },
};
```

### tinyMCE integration (Option B — `<div>` mount container)

The panel renders `<div class="ai-editor-mount" id="{sectionId}_MOUNT">` inside each ready section. The host initialises tinyMCE inside this div. The panel never touches tinyMCE internals.

---

## Panel Notification Modal — ✅ COMPLETE (session 8)

```javascript
window.showPanelNotification(message, opts)
// message: plain text or HTML string
// opts.type: 'info' (default) | 'success' | 'warning' | 'error'
// opts.title: custom title (default: 'Info' / 'Success' / 'Warning' / 'Error')
// opts.closeLabel: button label (default: 'Close')

window.hidePanelNotification()
```

### z-index ladder (full)
```
panel          100
dropdowns      1200
CE backdrop    1290  /  CE modal      1300
RP backdrop    1290  /  RP modal      1300
ER backdrop    1395  /  ER modal      1400
PN backdrop    1490  /  PN modal      1500
```

---

## Key Design Decisions Made

### Typography
- `font-family: var(--font-sans, ...)` explicitly set on `.profile-panel` root
- All `font-size` values use `--text-*` CSS custom properties

### Layout
- `.profile-panel` → flex column (full-height fixed panel)
- Fixed header sections (`controls`, `identity`, `actions`) each have `flex-shrink: 0`
- `.profile-content` → flex column, `gap: 16px`, `overflow-y: auto` (scrollable)
- `.panel-ai-view` → flex column, `gap: 12px`, `overflow-y: auto` (scrollable)

### Send button styling zones
- Zone 1 (LinkedIn post reply): `.ai-post-reply-area .ai-send-btn` — distinct styling
- Zone 2 (email draft): `.ai-send-btn` — matches Zone 1 styling for consistency (updated session 19 per user request to align the two)

### AI+ Engagement Dropdown — item state machine
- Each `<li>` carries `data-item-state` attribute: absent=`idle`, `"underway"`, `"done"`, `"unavailable"`
- Four coexisting icons per item: `.ai-item-arrow` / `.ai-item-spinner` / `.ai-item-check` / `.ai-item-unavail`
- CSS attribute selectors control visibility per state (only one icon visible at a time)
- `_setEngagementItemState(aiAction, state)` — set one item's state (internal)
- `window.setAiItemState(aiAction, state)` — exposed for host use

### Pre-action Authorization + Access Checks — ✅ COMPLETE (session 11)

Every AI+ Engagement and AI+ Research dropdown action runs through `_runAuthChecks(contactId, aiAction, onSuccess)`:

1. Item state set to `underway` immediately on click
2. `onCheckAuthorization(contactId, aiAction, done)` — `done(true)` to proceed, `done(false, message)` to block
3. `ping-linkedin` only: `onCheckLinkedInAccess(contactId, done)` — additional LinkedIn token check
4. On success: `switchToAiView()` (if needed) + fire the action callback
5. On failure: item reset to `idle` + `showPanelNotification(message, { type: 'info', html: true })`

If a callback is **not registered** its check defaults to **blocked** (secure by default).

### AI State Persistence — ✅ COMPLETE (session 10)

**What is saved:** LinkedIn posts array, per-post states (reply text, state), email sections (id/type/title/subject/body), dropdown item states (persists `done` and `unavailable`; never `idle` or `underway`).

**When saved:** Before clearing the outgoing contact's zones (on next/prev/close).

**When restored:** `_restoreAiState(contactId)` via `_eagerLoadProfile` — restores content and sets dropdown item states. Panel stays in CRM view; toggle button is shown.

**Critical save-before-clear ordering:** `_saveAiState()` must always be called BEFORE `clearAiSections()`.

### CRM view bleed fix — two-part guard
**Part 1:** The 400ms timeout's `fadeIn()` call skips if already in AI view.
**Part 2:** Explicit hard reset at the top of the fresh-open path in `openProfilePanel`:
```javascript
$panel.removeClass('ai-view-active');
$('.profile-content').css('display', '');
panelCurrentView = 'crm';
```
