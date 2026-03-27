/* ========================================
   Profile Panel — Interaction Skeleton
   Behaviors preserved:
     1. Slide in → spinner → fade in on initial contact click
     2. Fade out → spinner → fade in when switching contacts
     3. Same fade cycle as refresh when clicking already-displayed contact
   ======================================== */

(function($) {
    'use strict';

    const ANIMATION_DURATION = 300;

    // ─── Badge style ──────────────────────────────────────────────────────────
    // Change this single value to switch the visual treatment of all status badges.
    //   'b' — Pill + gradient + drop shadow
    //   'd' — Dot indicator (LIVE dot pulses)
    // Preference is also readable/overridable via profilePanelCallbacks.badgeStyle.
    const BADGE_STYLE = 'd';

    // ─── AI Engagement view state ─────────────────────────────────────────────
    var panelCurrentView     = 'crm';  // 'crm' | 'ai'
    var _aiEditorsMounted    = {};     // sectionId → true for mounted tinyMCE instances

    // ─── AI view data model (current contact) ─────────────────────────────────
    var _aiCurrentPosts      = null;   // null | [] | [{id, preview, meta, text}] — from current ping
    var _aiSavedPosts        = null;   // null | [{id, preview, meta, text}] — restored from cloud
    var _aiCurrentPostStates = {};     // { postId: {state, replyText} }
    var _aiCurrentSections   = [];     // [{id, type, title, subject, body}]
    var _postCardCounter     = 0;      // fallback counter for posts missing a host-supplied id

    // ─── AI view per-contact state cache (in-memory, survives contact navigation) ───
    var _aiStateCache         = {};     // { contactId: { posts, postStates, sections, itemStates } }
    var _aiStateLoadPending   = false;  // true while onLoadAiState cloud fetch is in-flight
    var _aiStateCacheDisabled = true;   // disabled by default — onLoadProfile always drives restoration so TinyMCE can mount correctly
    var _pendingActivityData  = undefined; // pre-loaded by onLoadProfile before DOM is ready; undefined = not preloaded

    // ─── Per-field inline edit state ─────────────────────────────────────────
    var $currentFieldEdit = null;   // the .field-editable currently being edited

    // ─── Current contact reference ────────────────────────────────────────────
    var _currentContactData = null; // full contactData object for the displayed contact

    // ─── Notes textarea dirty flag ────────────────────────────────────────────
    // Set to true when the notes textarea receives focus (textarea mode only).
    // Checked and flushed on close / next / prev to trigger auto-save.
    var _notesDirty = false;

    // ─── User-Company Research load generation counter ────────────────────────
    // Incremented each time openUserCompanyResearchModal fires a load request.
    // The callback checks this before rendering so stale responses are discarded.
    var _llLoadGen = 0;

    // ─── Backend integration callbacks ───────────────────────────────────────
    // Assign handlers before calling openProfilePanel to wire up backend integration.
    //
    //   onChange(contactId, fieldName, newValue)
    //     Fired on every field edit. Use for real-time draft persistence.
    //     fieldName is one of: 'name' | 'company' | 'title' | 'email' | 'phone' |
    //                          'mobile' | 'location' | 'website' | 'linkedin'
    //
    //   onSave(contactId, patch, done)
    //     Fired when a field is confirmed. patch is a single-key object, e.g.
    //     { email: 'new@example.com' }. Call done() on success or
    //     done(errorMessage) to surface an inline error and keep the editor open.
    //
    //   onClose(contactId)
    //     Fired when the panel closes (× button or ESC). Any unsaved edits are
    //     already discarded at this point.
    //
    //   onNext(currentContactId, done)
    //     Fired when the › Next button is clicked. The host resolves the adjacent
    //     contact (handling sort order, pagination, etc.) and calls
    //     done(contactData) to load it, or done(null) if at the boundary.
    //
    //   onPrev(currentContactId, done)
    //     Same as onNext but for the ‹ Previous button.
    //
    //   onLoadProfile(contactId, done)
    //     Single combined loader fired when a contact's profile opens.
    //     Replaces both onLoadActivity and onLoadAiState with one cloud round-trip.
    //     Fetch all profile data and call:
    //       done({ activityData, aiState })
    //     where activityData is the same shape as onLoadActivity's done() argument
    //     and aiState is the same shape as onLoadAiState's done() argument (null if none).
    //     When onLoadProfile is registered, onLoadActivity and onLoadAiState are
    //     ignored; register only one set or the other, not both.
    //
    //   onLoadActivity(contactId, done)
    //     Fired after the panel renders with basic contact info. Fetch and return
    //     activity data by calling done({ notes, meetings, calls, reminders,
    //     emailReplies, emailLinksViewed, emailsSent }).
    //     Ignored when onLoadProfile is registered.
    //
    //   onLoadResearch(contactId, done)
    //     Fired each time the Employer Research modal is opened.
    //     Fetch and return the HTML string by calling done(htmlString).
    //
    //   onActivityAction(contactId, sectionKey)
    //     Fired when an action button in the Engagement History accordion is clicked.
    //     sectionKey is one of: 'notes' (Add Note) | 'meetings' (Schedule) |
    //                           'calls' (Log Call) | 'reminders' (Add Task).
    //
    //   onActivityEdit(contactId, sectionKey, itemIndex, item)
    //     Fired when the edit pencil on an existing activity item is clicked.
    //     item is the raw object from the activityData array at itemIndex.
    //
    //   notesMode: 'list' | 'textarea'  (default: 'list')
    //     Controls the Notes accordion rendering.
    //     'list'     — ordered list of individually-dated, editable note items.
    //     'textarea' — single freeform textarea; suited for integrations that
    //                  store notes as a plain-text blob.
    //
    //   onSaveNote(contactId, content, done)
    //     (textarea mode only) Fired when the textarea auto-save triggers on
    //     close / next / prev after focus. Call done() on success or
    //     done(errorMessage) on failure.
    //
    //   onToggleView(contactId, proceed)
    //     Fired when the Toggle View button is clicked before any view switch
    //     occurs. Call proceed() to allow the switch. Omitting the call (or
    //     not registering this callback) leaves the toggle disabled — register
    //     it to gate AI view access per-user.
    //
    //
    //   onSaveAiState(contactId, state, done)
    //     Fired whenever AI view state is captured (on close / next / prev).
    //     state is the full serialisable snapshot:
    //       { posts, postStates, sections, itemStates }
    //     posts       — flat array of LinkedIn post objects that have a generated
    //                   reply (state 'done' or 'sent'); null if none. New posts
    //                   without replies are never persisted — users always re-ping.
    //     postStates  — { [postId]: { replyId, comment, subject, body, state } }
    //                   state is always 'done' or 'sent' for persisted entries.
    //     sections    — [{ id, type, title, subject, body }] email draft sections.
    //     itemStates  — { [action]: state } dropdown states; ping-linkedin and
    //                   underway states are never included — ping-linkedin always
    //                   resets on next open, and underway entries are discarded
    //                   when the panel closes before the action completes.
    //     Persist this object to the cloud keyed on contactId. Call done() on
    //     completion (fire-and-forget — navigation is not blocked).
    //
    //   onLoadAiState(contactId, done)
    //     Fired when a contact's profile opens and no in-memory cache exists.
    //     Called immediately (before the user switches to AI view) so dropdown
    //     item states are accurate while in CRM view and AI content is pre-cached.
    //     Fetch the previously saved state from the cloud and call done(savedState)
    //     to restore it, or done(null) if no saved state exists.
    //     The panel shows "Loading…" only if the user switches to AI view while
    //     the fetch is still in-flight; otherwise restoration is silent.
    //     Ignored when onLoadProfile is registered.
    //
    //   onReplyClick(sourcePostId, postText, contactId)
    //     Fired when the user clicks Reply on a LinkedIn post card.
    //     sourcePostId is the id assigned to the post (matches the card's id
    //     attribute and data-post-id). The host is responsible for generating a
    //     unique replyId and calling window.createPostReply(replyId, sourcePostId)
    //     to inject the reply scaffold, then window.setPostReply(replyId, opts)
    //     to populate fields incrementally.
    //
    //   aiSectionTypes: [{type, title, action}]  (default: null)
    //     Ordered array that defines the available Zone 2 email draft types.
    //     type   — unique string identifier matched against addAiSection({type}).
    //     title  — display label (used in Zone 2 section headers).
    //     action — dropdown data-ai-action value that triggers generation.
    //     Controls three things:
    //       1. Display order — addAiSection inserts sections at the position
    //          matching their type in this array; unrecognised types append last.
    //       2. Dropdown injection — _populateEngagementDropdown() injects one
    //          menu item per entry, bracketed by two structural dividers (one
    //          after ping-linkedin, one before configure-engagement). To include
    //          a "Generate ALL of the above" option, add a generate-all entry as
    //          the last element: { type:'generate-all', title:'Generate ALL of
    //          the above', action:'generate-all' }. Divider objects within this
    //          array are not supported and will render as broken items.
    //       3. Dynamic dropdown mapping — the panel reads this array to determine
    //          which dropdown actions trigger onGenerateDraft, so new types are
    //          supported without changing panel code.
    //     Easily extended: add entries to this array; no other changes needed.
    //
    //   onGenerateAll(contactId, pendingTypes)
    //     Fired when "Generate ALL of the above" is selected in the AI+
    //     Engagement dropdown. pendingTypes is the subset of aiSectionTypes
    //     entries whose type has not yet been generated (i.e. not present in
    //     _aiCurrentSections). The host should trigger generation for each
    //     pending type in parallel (calling addAiSection / updateAiSection).
    //
    //   onSendReply(replyId, sourcePostId, subject, comment, mountEl, contactId, done)
    //     Fired when the user clicks Send in a post reply area. The button
    //     automatically enters an underway (spinner) state on click.
    //     replyId      — the reply session ID generated by the host.
    //     sourcePostId — the id of the originating post card.
    //     subject      — current value of the subject input (_SUB).
    //     comment      — current value of the LinkedIn comment textarea (_COM).
    //     mountEl      — the reply editor mount div (_MOUNT) for reading body content.
    //     contactId    — id of the currently displayed contact.
    //     done()       — call with no args on success → button shows checkmark.
    //                    call with an error string on failure → button resets to idle
    //                    and the string is shown as a panel notification.
    //
    // $.extend preserves any properties already set by a host config file
    // (e.g. profilePanelCallbacks.js) loaded before this script. Panel
    // null-defaults fill in anything the host did not set.
    window.profilePanelCallbacks = $.extend({
        onChange         : null,   // function(contactId, fieldName, newValue)
        onSave           : null,   // function(contactId, patch, done)
        onClose          : null,   // function(contactId)
        onNext           : null,   // function(currentContactId, done)
        onPrev           : null,   // function(currentContactId, done)
        onLoadProfile    : null,   // function(contactId, done) — done({activityData, aiState}) — single combined loader
        onLoadActivity   : null,   // function(contactId, done) — ignored when onLoadProfile is registered
        onLoadResearch   : null,   // function(contactId, done)
        onActivityAction : null,   // function(contactId, sectionKey)
        onActivityEdit   : null,   // function(contactId, sectionKey, itemIndex, item)
        notesMode        : 'list', // 'list' | 'textarea'
        onSaveNote       : null,   // function(contactId, content, done)  — textarea mode only
        badgeStyle       : null,   // 'b' | 'd' — overrides the BADGE_STYLE constant when set
        onToggleView     : null,   // function(contactId, proceed) — gate AI view access
        onSaveAiState    : null,   // function(contactId, state, done) — persist AI view state to cloud
        onLoadAiState    : null,   // function(contactId, done) — done(savedState|null) — ignored when onLoadProfile is registered
        aiSectionTypes   : null,   // [{type, title, action}] — Zone 2 order; include generate-all as last entry if desired
        onGenerateAll    : null,   // function(contactId) — Generate ALL button clicked
        onReplyClick     : null,   // function(sourcePostId, postText, contactId)
        onSendReply      : null    // function(replyId, sourcePostId, subject, comment, mountEl, contactId)
    }, window.profilePanelCallbacks || {});

    // ─── Identity card ───────────────────────────────────────────────────────

    // Status values → badge label + CSS modifier class
    var STATUS_CONFIG = {
        draft:  { label: 'Draft',  cls: 'panel-status-badge--draft'  },
        live:   { label: 'Live',   cls: 'panel-status-badge--live'   },
        paused: { label: 'Paused', cls: 'panel-status-badge--paused' },
        done:   { label: 'Done',   cls: 'panel-status-badge--done'   }
    };
    var STATUS_ALL_CLASSES = Object.keys(STATUS_CONFIG).map(function(k) { return STATUS_CONFIG[k].cls; }).join(' ');

    function updatePanelIdentity(contactData) {
        var $identity = $('.panel-identity');
        if (!$identity.length) return;
        $identity.find('.panel-photo')
            .attr('src', contactData.photo || '')
            .attr('alt', contactData.name || '');
        $identity.find('.panel-name').text(contactData.name || '');
        // Status badge — set label + colour, or hide if status is unset
        var statusCfg = STATUS_CONFIG[contactData.status] || null;
        var $badge = $identity.find('.panel-status-badge');
        if (statusCfg) {
            $badge
                .text(statusCfg.label)
                .attr('aria-label', statusCfg.label + ' contact')
                .removeClass(STATUS_ALL_CLASSES + ' badge-style-b badge-style-d')
                .addClass(statusCfg.cls + ' badge-style-' + ((window.profilePanelCallbacks && window.profilePanelCallbacks.badgeStyle) || BADGE_STYLE))
                .removeClass('hidden');
        } else {
            $badge.addClass('hidden');
        }
        $identity.find('.panel-company').text(contactData.company || '');
        $identity.find('.panel-title-text').text(contactData.title || '');
        // Populate LinkedIn About snippet + popover (shown only in AI view via CSS)
        var about = contactData.about || '';
        $('#panel-about-text').text(about);
        $('#panel-about-popover-text').text(about);
        // Ensure popover is closed when contact changes
        $('#panel-about-popover').removeClass('open').attr('aria-hidden', 'true');
        $('#panel-about-snippet').attr('aria-expanded', 'false');
    }

    // ─── Main content renderer ───────────────────────────────────────────────

    function renderMainContent(contactData) {
        var $content = $('.profile-content');
        $content.html(
            buildContactDetailsHTML(contactData) +
            buildActivitySkeletonHTML()
        );
        var cb = window.profilePanelCallbacks;
        if (cb && typeof cb.onLoadProfile === 'function') {
            // onLoadProfile supplies both activityData and aiState in one cloud call.
            // If the data already arrived before the DOM was ready, _pendingActivityData
            // is set — apply it now. Otherwise _eagerLoadProfile will call
            // loadPanelActivity directly when the cloud response comes in.
            if (_pendingActivityData !== undefined) {
                loadPanelActivity(_pendingActivityData);
                _pendingActivityData = undefined;
            }
            return;
        }
        if (cb && typeof cb.onLoadActivity === 'function') {
            cb.onLoadActivity(contactData.id, function(activityData) {
                loadPanelActivity(activityData);
            });
        }
    }

    // SVG snippets reused in renderers
    const EXT_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="detail-ext-icon">' +
        '<path d="M19 19H5V5h7V3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7z' +
        'M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>';

    const CHEVRON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="accordion-chevron">' +
        '<path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>';

    function escHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ─── Unicode normalizer ───────────────────────────────────────────────────
    //
    // LinkedIn users paste Unicode Mathematical Alphanumeric Symbol characters
    // (e.g. 𝗯𝗼𝗹𝗱, 𝘪𝘵𝘢𝘭𝘪𝘤) to fake bold/italic formatting.  These live above
    // U+FFFF (surrogate pairs in UTF-16) and are silently corrupted to '?' by
    // databases configured with 3-byte utf8 instead of utf8mb4.
    // This function maps every such character back to its plain ASCII equivalent
    // before text is stored or rendered, keeping saves clean and restores faithful.
    //
    // Each RANGES entry: [firstCodepoint, lastCodepoint, asciiBaseCodepoint]
    // The offset within the range maps 1-to-1 onto the ASCII base sequence.
    //
    var _UNICODE_MATH_RANGES = [
        // ── Letters ────────────────────────────────────────────────────────────
        [0x1D400, 0x1D419, 0x41], // Mathematical Bold Capital A-Z
        [0x1D41A, 0x1D433, 0x61], // Mathematical Bold Small a-z
        [0x1D434, 0x1D44D, 0x41], // Mathematical Italic Capital A-Z
        [0x1D44E, 0x1D467, 0x61], // Mathematical Italic Small a-z
        [0x1D468, 0x1D481, 0x41], // Mathematical Bold Italic Capital A-Z
        [0x1D482, 0x1D49B, 0x61], // Mathematical Bold Italic Small a-z
        [0x1D49C, 0x1D4B5, 0x41], // Mathematical Script Capital A-Z
        [0x1D4B6, 0x1D4CF, 0x61], // Mathematical Script Small a-z
        [0x1D4D0, 0x1D4E9, 0x41], // Mathematical Bold Script Capital A-Z
        [0x1D4EA, 0x1D503, 0x61], // Mathematical Bold Script Small a-z
        [0x1D504, 0x1D51D, 0x41], // Mathematical Fraktur Capital A-Z
        [0x1D51E, 0x1D537, 0x61], // Mathematical Fraktur Small a-z
        [0x1D538, 0x1D551, 0x41], // Mathematical Double-Struck Capital A-Z
        [0x1D552, 0x1D56B, 0x61], // Mathematical Double-Struck Small a-z
        [0x1D56C, 0x1D585, 0x41], // Mathematical Bold Fraktur Capital A-Z
        [0x1D586, 0x1D59F, 0x61], // Mathematical Bold Fraktur Small a-z
        [0x1D5A0, 0x1D5B9, 0x41], // Mathematical Sans-Serif Capital A-Z
        [0x1D5BA, 0x1D5D3, 0x61], // Mathematical Sans-Serif Small a-z
        [0x1D5D4, 0x1D5ED, 0x41], // Mathematical Sans-Serif Bold Capital A-Z  ← LinkedIn bold
        [0x1D5EE, 0x1D607, 0x61], // Mathematical Sans-Serif Bold Small a-z    ← LinkedIn bold
        [0x1D608, 0x1D621, 0x41], // Mathematical Sans-Serif Italic Capital A-Z
        [0x1D622, 0x1D63B, 0x61], // Mathematical Sans-Serif Italic Small a-z
        [0x1D63C, 0x1D655, 0x41], // Mathematical Sans-Serif Bold Italic Capital A-Z
        [0x1D656, 0x1D66F, 0x61], // Mathematical Sans-Serif Bold Italic Small a-z
        [0x1D670, 0x1D689, 0x41], // Mathematical Monospace Capital A-Z
        [0x1D68A, 0x1D6A3, 0x61], // Mathematical Monospace Small a-z
        // ── Digits ─────────────────────────────────────────────────────────────
        [0x1D7CE, 0x1D7D7, 0x30], // Mathematical Bold Digit 0-9
        [0x1D7D8, 0x1D7E1, 0x30], // Mathematical Double-Struck Digit 0-9
        [0x1D7E2, 0x1D7EB, 0x30], // Mathematical Sans-Serif Digit 0-9
        [0x1D7EC, 0x1D7F5, 0x30], // Mathematical Sans-Serif Bold Digit 0-9
        [0x1D7F6, 0x1D7FF, 0x30]  // Mathematical Monospace Digit 0-9
    ];

    function _normalizeFancyUnicode(str) {
        if (!str || typeof str.codePointAt !== 'function') return str || '';
        var out = [];
        var i   = 0;
        while (i < str.length) {
            var cp   = str.codePointAt(i);
            var step = cp > 0xFFFF ? 2 : 1;  // surrogate pair = 2 UTF-16 code units
            var mapped = null;
            if (cp > 0xFFFF) {               // all math ranges are above BMP — skip BMP fast
                for (var r = 0; r < _UNICODE_MATH_RANGES.length; r++) {
                    var rng = _UNICODE_MATH_RANGES[r];
                    if (cp >= rng[0] && cp <= rng[1]) {
                        mapped = String.fromCharCode(rng[2] + (cp - rng[0]));
                        break;
                    }
                }
            }
            out.push(mapped !== null ? mapped : str.slice(i, i + step));
            i += step;
        }
        return out.join('');
    }

    // ─── Field data helpers ───────────────────────────────────────────────────

    // Returns the full contactData object for the currently-displayed contact.
    function getCurrentContactData() {
        return _currentContactData;
    }

    // Flattens contactData arrays into the 9 named editable fields.
    function extractEditableFields(cd) {
        var f = { name: cd.name || '', company: cd.company || '', title: cd.title || '',
                  email: '', phone: '', mobile: '', location: '', website: '', linkedin: '' };
        (cd.details || []).forEach(function(item) {
            if (item.type === 'email' && !f.email)   { f.email    = item.value; return; }
            if (item.type === 'phone') {
                var isMobile = item.label && /mobile/i.test(item.label);
                if (isMobile && !f.mobile) { f.mobile = item.value; }
                else if (!isMobile && !f.phone) { f.phone = item.value; }
                return;
            }
            if (item.type === 'text'  && !f.location) { f.location = item.value; }
        });
        (cd.companyInfo || []).forEach(function(item) {
            if (item.type === 'url' && !f.website) f.website = item.value;
        });
        (cd.socialLinks || []).forEach(function(item) {
            if (item.platform === 'LinkedIn' && !f.linkedin) f.linkedin = item.url;
        });
        return f;
    }

    // Writes a single edited field value back into the live contactData arrays in place.
    function mergeEditableFields(cd, ef) {
        cd.name    = ef.name    !== undefined ? ef.name    : cd.name;
        cd.company = ef.company !== undefined ? ef.company : cd.company;
        cd.title   = ef.title   !== undefined ? ef.title   : cd.title;
        var phoneSet = false, mobileSet = false, emailSet = false, locSet = false;
        (cd.details || []).forEach(function(item) {
            if (item.type === 'email' && !emailSet && ef.email !== undefined)   { item.value = ef.email;    emailSet  = true; }
            else if (item.type === 'phone') {
                var isMobile = item.label && /mobile/i.test(item.label);
                if (isMobile && !mobileSet && ef.mobile !== undefined) { item.value = ef.mobile; mobileSet = true; }
                else if (!isMobile && !phoneSet && ef.phone !== undefined) { item.value = ef.phone; phoneSet = true; }
            }
            else if (item.type === 'text' && !locSet && ef.location !== undefined) { item.value = ef.location; locSet = true; }
        });
        if (!mobileSet && ef.mobile) {
            cd.details = cd.details || [];
            cd.details.push({ label: 'Mobile', value: ef.mobile, type: 'phone' });
        }
        if (ef.email && !emailSet) {
            cd.details = cd.details || [];
            cd.details.push({ value: ef.email, type: 'email' });
        }
        if (ef.location && !locSet) {
            cd.details = cd.details || [];
            cd.details.push({ value: ef.location, type: 'text' });
        }
        var webSet = false;
        (cd.companyInfo || []).forEach(function(item) {
            if (item.type === 'url' && !webSet && ef.website !== undefined) { item.value = ef.website; webSet = true; }
        });
        if (!webSet && ef.website) {
            cd.companyInfo = cd.companyInfo || [];
            cd.companyInfo.push({ label: 'Website', value: ef.website, type: 'url' });
        }
        var liSet = false;
        (cd.socialLinks || []).forEach(function(item) {
            if (item.platform === 'LinkedIn' && !liSet && ef.linkedin !== undefined) { item.url = ef.linkedin; liSet = true; }
        });
        if (!liSet && ef.linkedin) {
            cd.socialLinks = cd.socialLinks || [];
            cd.socialLinks.push({ platform: 'LinkedIn', url: ef.linkedin });
        }
        return cd;
    }

    // ─── Per-field inline edit ────────────────────────────────────────────────

    var FIELD_PENCIL_SVG =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">' +
        '<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z' +
        'M20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>' +
        '</svg>';

    var FIE_CONFIRM_SVG =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">' +
        '<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>' +
        '</svg>';

    var FIE_CANCEL_SVG =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">' +
        '<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>' +
        '</svg>';

    // Opens the inline editor for a .field-editable row.
    // If another field is already open, it is silently cancelled first.
    function openFieldEdit($editable, value) {
        if ($currentFieldEdit) {
            if ($currentFieldEdit[0] === $editable[0]) return; // already editing
            closeCurrentFieldEdit();
        }
        $currentFieldEdit = $editable;
        $editable.addClass('editing');
        $editable.append(
            '<div class="field-inline-edit">' +
            '<div class="fie-input-wrap">' +
            '<input class="fie-input" type="text" value="' + escHtml(value) + '" autocomplete="off">' +
            '<button class="fie-clear-btn" type="button" tabindex="-1" aria-label="Clear">\u00d7</button>' +
            '</div>' +
            '<button class="fie-confirm-btn" type="button" aria-label="Save">' + FIE_CONFIRM_SVG + '</button>' +
            '<button class="fie-cancel-btn" type="button" aria-label="Cancel">' + FIE_CANCEL_SVG + '</button>' +
            '</div>'
        );
        setTimeout(function() {
            var $input = $editable.find('.fie-input');
            $input.focus();
            if ($editable.data('field') === 'name') $input.select();
        }, 30);
    }

    // Silently cancels any active inline field editor (no save, no re-render).
    function closeCurrentFieldEdit() {
        if (!$currentFieldEdit) return;
        var $e = $currentFieldEdit;
        $currentFieldEdit = null;
        $e.removeClass('editing');
        $e.find('.field-inline-edit').remove();
        $e.find('.fie-error').remove();
    }

    // Contact details card — all editable fields wrapped in .field-editable with hover pencil.
    // Empty phone/mobile always rendered as placeholder. Other empty fields also shown so
    // users can add them via the pencil.
    function buildContactDetailsHTML(contactData) {
        var ef = extractEditableFields(contactData);

        function pencilBtn(label) {
            return '<button class="field-pencil" type="button" aria-label="Edit ' + escHtml(label) + '">' +
                FIELD_PENCIL_SVG + '</button>';
        }

        function editableRow(fieldName, viewHTML, label) {
            return '<div class="field-editable" data-field="' + fieldName + '">' +
                '<div class="field-view">' + viewHTML + '</div>' +
                pencilBtn(label) +
                '</div>';
        }

        var rows = '';

        // Location — always show (placeholder if empty)
        rows += editableRow('location',
            ef.location
                ? '<span class="detail-plain">' + escHtml(ef.location) + '</span>'
                : '<span class="detail-muted">location</span>',
            'location');

        // Email — always show
        rows += editableRow('email',
            ef.email
                ? '<a href="mailto:' + escHtml(ef.email) + '" class="detail-link"><span class="detail-link-text">' + escHtml(ef.email) + '</span></a>'
                : '<span class="detail-muted">office email</span>',
            'email');

        // Office phone — always show
        rows += editableRow('phone',
            ef.phone
                ? '<a href="tel:' + escHtml(ef.phone.replace(/\s/g,'')) + '" class="detail-link"><span class="detail-link-text">' + escHtml(ef.phone) + '</span></a>'
                : '<span class="detail-muted">office phone</span>',
            'office phone');

        // Mobile phone — always show
        rows += editableRow('mobile',
            ef.mobile
                ? '<a href="tel:' + escHtml(ef.mobile.replace(/\s/g,'')) + '" class="detail-link"><span class="detail-link-text">' + escHtml(ef.mobile) + '</span></a>'
                : '<span class="detail-muted">mobile phone</span>',
            'mobile phone');

        // Website — always show
        rows += editableRow('website',
            ef.website
                ? '<a href="' + escHtml(ef.website) + '" target="_blank" rel="noopener" class="detail-link detail-link-ext"><span class="detail-link-text">' + escHtml(ef.website) + '</span>' + EXT_ICON + '</a>'
                : '<span class="detail-muted">company website</span>',
            'website');

        // LinkedIn — always show
        rows += editableRow('linkedin',
            ef.linkedin
                ? '<a href="' + escHtml(ef.linkedin) + '" target="_blank" rel="noopener" class="detail-link detail-link-ext"><span class="detail-link-text">' + escHtml(ef.linkedin) + '</span>' + EXT_ICON + '</a>'
                : '<span class="detail-muted">linkedin url</span>',
            'linkedin');

        // Additional social links beyond the first LinkedIn
        (contactData.socialLinks || []).forEach(function(item) {
            if (item.url && item.url !== ef.linkedin) {
                rows += '<div class="detail-row"><a href="' + escHtml(item.url) + '" target="_blank" rel="noopener" class="detail-link detail-link-ext"><span class="detail-link-text">' + escHtml(item.url) + '</span>' + EXT_ICON + '</a></div>';
            }
        });

        // Lead owner + created date — single flex row: label | [name / date stacked]
        // createdAt rendered as HTML so hosts can embed markup (e.g. <span class="dt-at">@</span>)
        var meta = '';
        if (contactData.leadOwner || contactData.createdAt) {
            meta += '<div class="detail-row detail-row-meta">';
            if (contactData.leadOwner) {
                meta += '<span class="detail-label">Lead Owner:</span>';
            }
            meta += '<div class="detail-meta-values">';
            if (contactData.leadOwner) {
                meta += '<span class="detail-plain">' + escHtml(contactData.leadOwner) + '</span>';
            }
            if (contactData.createdAt) {
                meta += '<span class="detail-muted">' + contactData.createdAt + '</span>';
            }
            meta += '</div></div>';
        }

        return '<div class="contact-details-card">' + rows + meta + '</div>';
    }

    // Activity accordion (notes, meetings, calls, reminders, email metrics).
    // activityData: { notes, meetings, calls, reminders,
    //                 emailReplies     — array of { date, from, to, subject, body }
    //                                    or legacy number count
    //                 emailLinksViewed — array of { date, description }
    //                                    or legacy number count
    //                 emailsSent       — array of { date, subject }
    //                                    or legacy number count }
    function buildActivityAccordionHTML(activityData) {
        var ad = activityData || {};
        var cb = window.profilePanelCallbacks;
        var notesMode = (cb && cb.notesMode) || 'list';

        // Accept both array (new) and plain number (legacy) for email sections
        function emailItems(val) { return Array.isArray(val) ? val : null; }
        function emailCount(val) { return typeof val === 'number' ? val : 0; }

        // Normalize notes to a plain string for textarea mode
        // (accepts either a raw string or an array of note objects)
        var notesText = null;
        if (notesMode === 'textarea') {
            if (typeof ad.notes === 'string') {
                notesText = ad.notes;
            } else if (Array.isArray(ad.notes)) {
                notesText = ad.notes.map(function(n) { return n.text || ''; }).join('\n\n');
            } else {
                notesText = '';
            }
        }

        var sections = [
            notesMode === 'textarea'
                ? { key: 'notes', label: 'Notes', action: null,        items: null,            noteText: notesText }
                : { key: 'notes', label: 'Notes', action: 'Add Note',  items: ad.notes || [] },
            { key: 'meetings',     label: 'Meetings',          action: 'Schedule', items: ad.meetings  || [] },
            { key: 'calls',        label: 'Calls',             action: 'Log Call', items: ad.calls     || [] },
            { key: 'reminders',    label: 'Tasks / Reminders', action: 'Add Task', items: ad.reminders || [] },
            { key: 'email-replies', label: 'Email Replies',      action: null, items: emailItems(ad.emailReplies),     count: emailCount(ad.emailReplies)     },
            { key: 'email-links',   label: 'Email Links Viewed', action: null, items: emailItems(ad.emailLinksViewed), count: emailCount(ad.emailLinksViewed) },
            { key: 'emails-sent',   label: 'Emails Sent',        action: null, items: emailItems(ad.emailsSent),       count: emailCount(ad.emailsSent)       }
        ];

        var html = '<div class="activity-accordion">' +
            '<div class="panel-section-label">Engagement History</div>';
        sections.forEach(function(section) {
            var isTextarea = section.noteText !== undefined && section.noteText !== null;
            var count      = isTextarea
                ? (section.noteText.trim() ? 1 : 0)           // textarea: (1) if content, (0) if blank
                : (section.items ? section.items.length : (section.count || 0));
            var countHtml  = ' <span class="accordion-count">(' + count + ')</span>';
            var actionLink = section.action
                ? '<button type="button" class="accordion-action" data-action="' + section.key + '">' + section.action + '</button>'
                : '';

            html += '<div class="accordion-row" data-section="' + section.key + '">';
            html += '<div class="accordion-header">';
            html += '<span class="accordion-title">' + escHtml(section.label) + countHtml + '</span>';
            html += '<div class="accordion-header-right">' + actionLink + CHEVRON_SVG + '</div>';
            html += '</div>'; // .accordion-header

            html += '<div class="accordion-body">';
            if (isTextarea) {
                // ── Textarea (single-blob) mode ───────────────────────────────
                html += '<div class="notes-textarea-wrap">' +
                    '<textarea class="notes-textarea" placeholder="Add a note\u2026">' +
                    escHtml(section.noteText) +
                    '</textarea>' +
                    '</div>';
            } else if (section.items && section.items.length > 0) {
                section.items.forEach(function(item, idx) {
                    html += buildAccordionItemHTML(section.key, item, idx);
                });
            } else if (!section.items && section.count > 0) {
                html += '<div class="accordion-item-plain">' + section.count + ' item' + (section.count !== 1 ? 's' : '') + '</div>';
            }
            html += '</div>'; // .accordion-body
            html += '</div>'; // .accordion-row
        });
        html += '</div>'; // .activity-accordion
        return html;
    }

    function buildAccordionItemHTML(sectionKey, item, idx) {
        var date = '', desc = '';
        switch (sectionKey) {
            case 'notes':
                date = item.date || '';
                desc = item.text || '';
                break;
            case 'meetings':
                date = (item.date || '') + (item.time ? ' @ ' + item.time : '');
                desc = item.title || '';
                break;
            case 'calls':
                date = item.date || '';
                desc = (item.outcome || '') + (item.duration ? ' · ' + item.duration : '');
                break;
            case 'reminders':
                date = item.date || '';
                desc = item.text || '';
                break;
            case 'email-replies':
                date = item.date || '';
                desc = item.subject || '';
                break;
            case 'email-links':
                date = item.date || '';
                desc = item.description || item.link || '';
                break;
            case 'emails-sent':
                date = item.date || '';
                desc = item.subject || '';
                break;
            default:
                desc = JSON.stringify(item);
        }
        // Only editable sections show the edit pencil
        var editBtn = (sectionKey === 'notes' || sectionKey === 'meetings' ||
                       sectionKey === 'calls' || sectionKey === 'reminders')
            ? '<button type="button" class="accordion-item-edit" aria-label="Edit item">' + FIELD_PENCIL_SVG + '</button>'
            : '';
        // Email-reply rows are clickable (open the reply viewer)
        var isReply = sectionKey === 'email-replies';
        return '<div class="accordion-item' + (isReply ? ' accordion-item--reply' : '') + '"' +
            ' data-section="' + escHtml(sectionKey) + '" data-index="' + idx + '"' +
            (isReply ? ' role="button" tabindex="0"' : '') + '>' +
            (date ? '<span class="accordion-item-date">' + escHtml(date) + '</span>' : '') +
            '<span class="accordion-item-desc">' + escHtml(desc) + '</span>' +
            editBtn +
            '</div>';
    }

    // Renders the activity section shell while async data is in flight.
    function buildActivitySkeletonHTML() {
        return '<div class="activity-accordion">' +
            '<div class="panel-section-label">Engagement History</div>' +
            '<div class="accordion-loading"><span class="detail-muted">Loading\u2026</span></div>' +
            '</div>';
    }

    // Replaces the skeleton with fully rendered activity data.
    // Called by the host via the onLoadActivity done() callback.
    function loadPanelActivity(activityData) {
        var $accordion = $('.activity-accordion');
        if (!$accordion.length) return;
        $accordion.replaceWith(buildActivityAccordionHTML(activityData));
    }

    // ─── Notes textarea auto-save ────────────────────────────────────────────
    // Called before close / navigate. If the textarea was focused since the
    // last contact load, grabs the current value, updates the local cache,
    // and fires onSaveNote (fire-and-forget — navigation is not blocked).
    function flushNotesDirty(contactId) {
        if (!_notesDirty) return;
        _notesDirty = false;
        var content = $('.notes-textarea').val();
        if (content === undefined) return;          // textarea not in DOM
        if (_currentContactData && _currentContactData.activityData) {
            _currentContactData.activityData.notes = content;
        }
        var cb = window.profilePanelCallbacks;
        if (cb && typeof cb.onSaveNote === 'function') {
            cb.onSaveNote(contactId, content, function() {}); // fire-and-forget
        }
    }

    // ─── Email Reply viewer ───────────────────────────────────────────────────

    var ER_CHECKMARK_SVG =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">' +
        '<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';

    // Injects the email reply modal DOM once — idempotent.
    function ensureEmailReplyModal() {
        if ($('#er-modal').length) return;
        $('body').append(
            '<div class="er-backdrop" id="er-backdrop" aria-hidden="true"></div>' +
            '<div class="er-modal" id="er-modal" role="dialog" aria-modal="true" aria-hidden="true">' +
            '<div class="er-fields">' +
            '<div class="er-field"><span class="er-label">Date</span><span class="er-value" id="er-date"></span></div>' +
            '<div class="er-field"><span class="er-label">From</span><span class="er-value" id="er-from"></span></div>' +
            '<div class="er-field"><span class="er-label">To</span><span class="er-value" id="er-to"></span></div>' +
            '<div class="er-field er-field--subject"><span class="er-label">Subject</span><span class="er-value er-value--bold" id="er-subject"></span></div>' +
            '</div>' +
            '<div class="er-body-wrap" id="er-body-wrap"><div class="er-body" id="er-body"></div></div>' +
            '<div class="er-footer">' +
            '<button type="button" class="er-confirm-btn" id="er-close-btn" aria-label="Close">' + ER_CHECKMARK_SVG + '</button>' +
            '</div>' +
            '</div>'
        );
    }

    function openEmailReplyModal(item) {
        ensureEmailReplyModal();
        $('#er-date').text(item.date || '');
        $('#er-from').text(item.from || '');
        $('#er-to').text(item.to || '');
        $('#er-subject').text(item.subject || '');
        // Preserve paragraph breaks and line breaks in the body
        var bodyHtml = escHtml(item.body || '').replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>');
        $('#er-body').html('<p>' + bodyHtml + '</p>');
        $('#er-body-wrap').scrollTop(0);
        $('#er-modal').addClass('open').attr('aria-hidden', 'false');
        $('#er-backdrop').addClass('open');
        setTimeout(function() {
            var btn = document.getElementById('er-close-btn');
            if (btn) btn.focus();
        }, 50);
    }

    function closeEmailReplyModal() {
        $('#er-modal').removeClass('open').attr('aria-hidden', 'true');
        $('#er-backdrop').removeClass('open');
    }

    // Populates the Employer Research modal with fetched HTML.
    // Called by the host via the onLoadResearch done() callback.
    function loadPanelResearch(htmlString) {
        $('#rp-employer-content').html(htmlString || '');
        $('#rp-employer-modal .rp-body').scrollTop(0);
    }

    // ─── Core panel behaviors ────────────────────────────────────────────────

    // ① Slide in → spinner → fade in on initial open; refresh/switch routing when already open
    function openProfilePanel(contactData) {
        // Lazy-populate the engagement dropdown if the DOM-ready call was a no-op.
        // This happens when panel HTML is injected into the DOM dynamically (e.g.
        // AJAX / server-side partial) after $(document).ready() has already fired.
        if (!$('#ai-engagement-dropdown .ai-dropdown-injected').length) {
            _populateEngagementDropdown();
        }
        var $panel = $('.profile-panel');
        _notesDirty = false;            // fresh contact — clear any stale dirty state
        _currentContactData = contactData;
        if ($panel.hasClass('open')) {
            updatePanelContent(contactData); // behaviors 2 & 3
            return;
        }
        _updateCompanyLabels(contactData);   // stamp company name into dropdown + modal
        $panel.data('contact-id', contactData.id);
        $panel.addClass('open');             // slide in (behavior 1)
        // Toggle starts hidden; _eagerLoadProfile shows it if saved AI state exists.
        _hideViewToggle();
        // Kick off the profile data load immediately so cloud data can arrive
        // in parallel with the 400ms open animation.
        _pendingActivityData = undefined;
        _eagerLoadProfile(contactData.id);
        var $content = $('.profile-content');
        $content.hide().html('<div class="loading-spinner"></div>').show();
        setTimeout(function() {
            updatePanelIdentity(contactData);
            renderMainContent(contactData);
            $content.hide().fadeIn(200);
        }, 400);
    }

    // ② Fade out → spinner → fade in (behaviors 2 & 3)
    function updatePanelContent(contactData) {
        var $panel = $('.profile-panel');
        var $content = $('.profile-content');

        // Save AI state for the contact we're leaving before clearing anything
        _saveAiState($panel.data('contact-id'));

        _currentContactData = contactData;
        _updateCompanyLabels(contactData);   // stamp company name into dropdown + modal

        // Switch back to CRM view and clean up AI zones/editors
        if (panelCurrentView === 'ai') {
            switchToCrmView();
        }
        _hideViewToggle();           // hidden until saved AI state or a generation action confirms content
        clearAiSections();           // destroys editors, removes zones, resets tracking
        _resetEngagementItemStates(); // clear per-item states in dropdown

        // Eagerly load profile data (activity + AI state) for the incoming contact.
        // When onLoadProfile is registered this is a single cloud call; otherwise
        // falls back to separate onLoadActivity and onLoadAiState callbacks.
        _pendingActivityData = undefined;
        _eagerLoadProfile(contactData.id);

        // Close and reset all AI+ dropdown states
        $('#ai-engagement-btn').removeClass('open').attr('aria-expanded', 'false');
        $('#ai-engagement-dropdown').removeClass('open').attr('aria-hidden', 'true').attr('data-state', 'start');
        $('#ai-research-btn').removeClass('open').attr('aria-expanded', 'false');
        $('#ai-research-dropdown').removeClass('open').attr('aria-hidden', 'true');
        $('#ai-slack-btn').removeClass('open').attr('aria-expanded', 'false');
        $('#ai-slack-dropdown').removeClass('open').attr('aria-hidden', 'true').attr('data-state', 'start');

        $content.fadeOut(200, function() {
            $content.html('<div class="loading-spinner"></div>').show();
            setTimeout(function() {
                updatePanelIdentity(contactData);
                renderMainContent(contactData);
                $panel.data('contact-id', contactData.id);
                $content.hide().fadeIn(200);
            }, 400);
        });
    }

    // ③ Prev/next — host resolves adjacent contact via callback
    function navigateContact(direction) {
        var currentId = $('.profile-panel').data('contact-id');
        flushNotesDirty(currentId);
        closeCurrentFieldEdit();
        var cb = window.profilePanelCallbacks;
        var handler = direction === 'prev'
            ? (cb && cb.onPrev)
            : (cb && cb.onNext);
        if (typeof handler === 'function') {
            handler(currentId, function(contactData) {
                if (!contactData) return;   // boundary — host signals no more contacts
                updatePanelContent(contactData);
            });
        }
    }

    // ④ Slide out + clear
    function closeProfilePanel() {
        var $panel = $('.profile-panel');
        if (!$panel.hasClass('open')) return;

        var closingContactId = $panel.data('contact-id');

        // Save AI view state before clearing so it's restored on next open
        _saveAiState(closingContactId);

        flushNotesDirty(closingContactId);
        // Cancel any in-progress field edit silently before closing
        closeCurrentFieldEdit();

        $panel.removeClass('open');
        $('#panel-view-toggle').removeClass('visible ai-view');
        hidePanelNotification();
        // Close any open research modals
        closeEmployerResearchModal();
        closeLeadLeaperResearchModal();
        // Close any open AI+ dropdowns and reset their states to "start"
        $('#ai-engagement-btn').removeClass('open').attr('aria-expanded', 'false');
        $('#ai-engagement-dropdown')
            .removeClass('open')
            .attr('aria-hidden', 'true')
            .attr('data-state', 'start');
        $('#ai-research-btn').removeClass('open').attr('aria-expanded', 'false');
        $('#ai-research-dropdown').removeClass('open').attr('aria-hidden', 'true');
        $('#ai-slack-btn').removeClass('open').attr('aria-expanded', 'false');
        $('#ai-slack-dropdown')
            .removeClass('open')
            .attr('aria-hidden', 'true')
            .attr('data-state', 'start');
        // Reset AI view: switch back to CRM, destroy all editor instances and zones
        switchToCrmView();
        clearAiSections();           // resets tracking
        _resetEngagementItemStates();

        var cb = window.profilePanelCallbacks;
        if (cb && typeof cb.onClose === 'function') {
            cb.onClose(closingContactId);
        }

        setTimeout(function() {
            $('.profile-content').html('');
            $panel.removeData('contact-id');
            _currentContactData = null;
        }, ANIMATION_DURATION);
    }

    // Switch AI+ Engagement dropdown between 'start' and 'active' states
    function setAiEngagementState(state) {
        $('#ai-engagement-dropdown').attr('data-state', state);
    }

    // ─── Per-item research dropdown state ────────────────────────────────────
    // Sets the visual state of a single item in the AI+ Research dropdown.
    // state: 'idle' (arrow) | 'loading' (spinner) | 'done' (green checkmark)
    // aiAction: 'employer-research' | 'user-company-research'
    function setResearchItemState(aiAction, state) {
        var loadClass, doneClass;
        if (aiAction === 'employer-research') {
            loadClass = 'research-employer-loading';
            doneClass = 'research-employer-done';
        } else if (aiAction === 'user-company-research') {
            loadClass = 'research-company-loading';
            doneClass = 'research-company-done';
        } else {
            return;
        }
        $('body').removeClass(loadClass + ' ' + doneClass);
        if (state === 'loading') { $('body').addClass(loadClass); }
        else if (state === 'done')    { $('body').addClass(doneClass); }
        // 'idle' — classes already removed above
    }

    // Switch Slack VSR dropdown between 'start' and 'active' states
    function setAiSlackState(state) {
        $('#ai-slack-dropdown').attr('data-state', state);
    }

    // ─── Per-item engagement dropdown state ──────────────────────────────────
    // Sets the visual state of a single item in the AI+ Engagement dropdown.
    // state: 'idle' (arrow) | 'underway' (spinner) | 'done' (green checkmark)
    function _setEngagementItemState(aiAction, state) {
        var $item = $('#ai-engagement-dropdown .ai-dropdown-item[data-ai-action="' + aiAction + '"]');
        if (!$item.length) return;
        if (state === 'idle') {
            $item.removeAttr('data-item-state');
        } else {
            $item.attr('data-item-state', state);
        }
    }

    // Reset all actionable engagement items to idle
    function _resetEngagementItemStates() {
        $('#ai-engagement-dropdown .ai-dropdown-item[data-ai-action]').removeAttr('data-item-state');
    }

    // Show/hide the CRM ↔ AI toggle button.
    // Hidden by default on every profile load; revealed only when AI content
    // exists (saved state restored) or is being generated (dropdown action fired).
    function _showViewToggle() {
        $('#panel-view-toggle').addClass('visible');
    }
    function _hideViewToggle() {
        $('#panel-view-toggle').removeClass('visible ai-view');
    }

    // ─── AI view tracking helpers ─────────────────────────────────────────────
    function _resetAiTracking() {
        _aiCurrentPosts      = null;
        _aiSavedPosts        = null;
        _aiCurrentPostStates = {};
        _aiCurrentSections   = [];
        _aiStateLoadPending  = false;
    }

    // Persist current AI view state into the per-contact cache.
    // Call this BEFORE clearAiSections() so editor content is still accessible.
    function _saveAiState(contactId) {
        if (!contactId) return;
        var _hasNewPostsWithReplies = $.grep(_aiCurrentPosts || [], function(p) {
            var ps = _aiCurrentPostStates[p.id] || _aiCurrentPostStates[String(p.id)];
            return ps && (ps.state === 'done' || ps.state === 'sent');
        }).length > 0;
        if (!_hasNewPostsWithReplies && !(_aiSavedPosts && _aiSavedPosts.length) &&
                _aiCurrentSections.length === 0) return;

        // Read up-to-date subject values from DOM (user may have edited)
        var sections = $.map(_aiCurrentSections, function(sec) {
            var $secEl  = $('.ai-section[data-section-id="' + sec.id + '"]');
            var subject = $secEl.find('.ai-subject-input').val();
            if (subject === undefined || subject === null) subject = sec.subject;
            // Retrieve editor body via optional callback (production: tinyMCE getContent)
            var body = sec.body;
            var cb = window.profilePanelCallbacks;
            if (cb && typeof cb.onEditorGetContent === 'function') {
                var fresh = cb.onEditorGetContent(sec.id);
                if (fresh !== null && fresh !== undefined) body = fresh;
            }
            return $.extend({}, sec, { subject: subject, body: body });
        });

        // Read up-to-date reply field values from DOM for any active reply sessions
        var postStates = {};
        $.each(_aiCurrentPostStates, function(sourcePostId, ps) {
            var saved = $.extend({}, ps);
            if (ps.replyId) {
                var r   = ps.replyId;
                var com = $('#' + r + '_COM').val();
                var sub = $('#' + r + '_SUB').val();
                var bdy;
                var edId = r + '_MCE';
                if (typeof tinymce !== 'undefined' && tinymce.get(edId)) {
                    bdy = tinymce.get(edId).getContent();
                } else {
                    bdy = $('#' + edId).val();
                }
                if (com !== undefined) saved.comment = com;
                if (sub !== undefined) saved.subject = sub;
                if (bdy !== undefined) saved.body    = bdy;
            }
            postStates[sourcePostId] = saved;
        });

        // Capture engagement dropdown item states.
        // ping-linkedin is always excluded — users re-ping on every profile open.
        // underway is excluded — if the panel closes before an action completes
        // the response is discarded, so the item must reset to idle on next open.
        var itemStates = {};
        $('#ai-engagement-dropdown .ai-dropdown-item[data-ai-action]').each(function() {
            var action = $(this).data('ai-action');
            if (action === 'ping-linkedin') return; // never persisted
            var state  = $(this).attr('data-item-state') || 'idle';
            if (state !== 'idle' && state !== 'underway') itemStates[action] = state;
        });

        // Build the saved posts array: previously-saved posts (already had replies)
        // plus any new posts from this session that now have a reply (done / sent).
        // Posts with no reply are never persisted — the user always re-pings.
        var savedPosts = (_aiSavedPosts || []).slice(); // start with restored posts
        $.each(_aiCurrentPosts || [], function(i, post) {
            var ps = postStates[post.id] || postStates[String(post.id)];
            if (ps && (ps.state === 'done' || ps.state === 'sent')) {
                savedPosts.push(post);
            }
        });

        var stateSnapshot = {
            posts:      savedPosts.length ? savedPosts : null,
            postStates: postStates,
            sections:   sections,
            itemStates: itemStates
        };

        // Update in-memory cache (skipped when caching is disabled)
        if (!_aiStateCacheDisabled) {
            _aiStateCache[contactId] = stateSnapshot;
        }

        // Persist to cloud — always fires regardless of cache disable flag
        // (fire-and-forget — navigation is not blocked)
        var cb = window.profilePanelCallbacks;
        if (cb && typeof cb.onSaveAiState === 'function') {
            cb.onSaveAiState(contactId, stateSnapshot, function() {});
        }
    }

    // Single entry-point called from updatePanelContent on every profile open.
    // When onLoadProfile is registered it fires that callback once and dispatches
    // both activityData and aiState from the single response, avoiding two separate
    // cloud round-trips. Falls back to the independent onLoadAiState callback
    // (onLoadActivity is then handled separately by renderMainContent as before).
    function _eagerLoadProfile(contactId) {
        if (!contactId) return;
        var cb = window.profilePanelCallbacks;

        if (cb && typeof cb.onLoadProfile === 'function') {
            _aiStateLoadPending = true;
            cb.onLoadProfile(contactId, function(result) {
                _aiStateLoadPending = false;
                // Guard: user may have navigated away before this fired
                var currentId = _currentContactData && _currentContactData.id;
                if (contactId !== currentId) return;

                result = result || {};

                // ── Dispatch activity data ──────────────────────────────────
                var activityData = result.activityData || null;
                if ($('.activity-accordion').length) {
                    // DOM already rendered — populate immediately
                    loadPanelActivity(activityData);
                } else {
                    // DOM not yet ready — store for renderMainContent to pick up
                    _pendingActivityData = activityData;
                }

                // ── Dispatch AI state ───────────────────────────────────────
                var aiState = result.aiState || null;
                if (aiState) {
                    _aiStateCache[contactId] = aiState;
                    _restoreAiState(contactId);
                    if (_aiStateCacheDisabled) { delete _aiStateCache[contactId]; }
                    // Saved content exists — reveal the toggle even while in CRM view
                    // so the user can see AI content is available.
                    _showViewToggle();
                    if (panelCurrentView === 'ai') { hideAiLoadingState(); }
                } else {
                    // No saved state — toggle stays hidden until the user generates content.
                    if (panelCurrentView === 'ai') { hideAiLoadingState(); }
                }
            });
            return;
        }

        // Fallback: onLoadActivity is handled by renderMainContent; handle AI state here.
        _eagerLoadAiState(contactId);
    }

    // Eagerly load saved AI state for a contact as soon as its profile opens.
    // Called from _eagerLoadProfile (fallback path) so dropdown item states are
    // accurate in CRM view and content is pre-cached before the user may switch.
    function _eagerLoadAiState(contactId) {
        if (!contactId) return;
        var cb = window.profilePanelCallbacks;

        // In-memory cache hit — restore immediately (same-session re-visit)
        // Skipped when caching is disabled so we always go to cloud.
        if (!_aiStateCacheDisabled && _aiStateCache[contactId]) {
            _restoreAiState(contactId);
            _showViewToggle();
            return;
        }

        // Fetch from cloud
        if (cb && typeof cb.onLoadAiState === 'function') {
            _aiStateLoadPending = true;
            cb.onLoadAiState(contactId, function(savedState) {
                _aiStateLoadPending = false;
                // Guard: user may have navigated to a different contact before this fired
                var currentId = _currentContactData && _currentContactData.id;
                if (contactId !== currentId) return;

                if (savedState) {
                    // Write to cache, restore, then clean up the entry if caching is disabled
                    _aiStateCache[contactId] = savedState;
                    _restoreAiState(contactId);
                    if (_aiStateCacheDisabled) { delete _aiStateCache[contactId]; }
                    _showViewToggle();
                    if (panelCurrentView === 'ai') { hideAiLoadingState(); }
                } else {
                    // No saved state — toggle stays hidden until content is generated.
                    if (panelCurrentView === 'ai') { hideAiLoadingState(); }
                }
            });
        }
    }

    // Restore saved AI view state for a contact (returns true if cache was found).
    function _restoreAiState(contactId) {
        var cached = _aiStateCache[contactId];
        if (!cached) return false;

        // Restore LinkedIn posts zone.
        // posts is a flat array of posts that had replies — always shown as saved.
        var cachedPosts = cached.posts;
        if (cachedPosts && cachedPosts.length) {
            // Legacy guard: handle old { new, saved } shape from pre-migration saves
            if (!Array.isArray(cachedPosts) && cachedPosts.saved) {
                _showSavedPosts(cachedPosts.saved);  // legacy {new,saved} shape
            } else {
                _showSavedPosts(cachedPosts);         // current flat-array shape
            }
            // Rebuild any reply areas that were active when the contact was last visited
            $.each(cached.postStates || {}, function(sourcePostId, ps) {
                if (!ps.replyId) return;
                createPostReply(ps.replyId, sourcePostId);
                setPostReply(ps.replyId, {
                    comment: ps.comment || '',
                    subject: ps.subject || '',
                    body:    ps.body    || '',
                    visible: !!(ps.state === 'done' || ps.body),
                    state:   ps.state
                });
            });
        }

        // Restore email draft sections
        $.each(cached.sections || [], function(i, sec) {
            addAiSection({
                id:      sec.id,
                type:    sec.type,
                title:   sec.title,
                subject: sec.subject,
                body:    sec.body,
                loading: false
            });
        });

        // Restore engagement dropdown item states
        $.each(cached.itemStates || {}, function(action, state) {
            _setEngagementItemState(action, state);
        });

        return true;
    }

    // ─── Snapshot export / import (cross-session persistence) ────────────────
    //
    // getAiSnapshot(contactId)
    //   Returns a serialisable snapshot of the full AI view state for contactId.
    //   Flushes the current DOM state into the cache first if contactId is the
    //   active contact. Returns null if no state exists for this contact.
    //   The host should call this on close / next / prev and persist the result.
    //
    // restoreAiState(contactId, snapshot)
    //   Feeds a previously-saved snapshot back into the cache. If contactId is
    //   the active contact and the AI view is currently visible the state is
    //   applied immediately; otherwise it is applied the next time the AI view
    //   is opened for that contact.
    //
    function getAiSnapshot(contactId) {
        if (!contactId) return null;
        // Flush live DOM values — _saveAiState fires onSaveAiState regardless of cache flag
        if (_currentContactData && _currentContactData.id === contactId) {
            _saveAiState(contactId);
        }
        if (_aiStateCacheDisabled) return null;  // no in-memory copy is maintained
        var cached = _aiStateCache[contactId];
        return cached ? JSON.parse(JSON.stringify(cached)) : null;
    }

    function restoreAiState(contactId, snapshot) {
        if (!contactId || !snapshot) return;
        _aiStateCache[contactId] = snapshot;
        // Apply immediately if this contact is already displayed in the AI view
        if (_currentContactData && _currentContactData.id === contactId &&
                panelCurrentView === 'ai') {
            _restoreAiState(contactId);
        }
        if (_aiStateCacheDisabled) { delete _aiStateCache[contactId]; }
    }

    // ─── Session cache management ─────────────────────────────────────────────
    //
    // clearAiStateCache([opts])
    //
    //   Clears the in-memory AI state cache and optionally disables future caching.
    //   Cloud persistence (onSaveAiState / onLoadAiState) is never affected.
    //
    //   opts.contactId  {string}   — clear only this contact's entry; omit to clear all.
    //   opts.disable    {boolean}  — true:  suppress all future in-memory reads/writes
    //                                false: re-enable in-memory caching (default enabled)
    //
    //   When caching is disabled the panel still fully restores from onLoadAiState
    //   (via a transient entry that is immediately deleted) and still fires
    //   onSaveAiState on every save — only the persistent in-memory copy is omitted.
    //   Use disable:true for long-lived sessions navigating many contacts to avoid
    //   unbounded memory growth.
    //
    function clearAiStateCache(opts) {
        opts = opts || {};
        if (opts.contactId) {
            delete _aiStateCache[opts.contactId];
        } else {
            _aiStateCache = {};
        }
        if (opts.disable === true)  { _aiStateCacheDisabled = true;  }
        if (opts.disable === false) { _aiStateCacheDisabled = false; }
    }

    // ─── Pre-action authorization + access checks ────────────────────────────
    //
    // Called before any AI+ Engagement or AI+ Research action.
    // 1. Fires onCheckAuthorization(contactId, aiAction, done) if registered.
    // 2. For 'ping-linkedin' only, additionally fires onCheckLinkedInAccess(contactId, done).
    // On any failure: resets the item to idle; shows an info notification only if a
    // message is provided (plain text or HTML both supported).
    // If a callback is not registered its check defaults to blocked (false).
    function _runAuthChecks(contactId, aiAction, onSuccess) {
        var cb = window.profilePanelCallbacks || {};

        function _fail(message) {
            _setEngagementItemState(aiAction, 'idle');
            if (message) {
                showPanelNotification(message, { type: 'info', html: true });
            }
        }

        function _afterAuthOk() {
            if (aiAction === 'ping-linkedin') {
                if (typeof cb.onCheckLinkedInAccess === 'function') {
                    cb.onCheckLinkedInAccess(contactId, function(accessible, message) {
                        if (!accessible) { _fail(message); return; }
                        onSuccess();
                    });
                } else {
                    _fail();    // onCheckLinkedInAccess not registered — block
                }
            } else {
                onSuccess();
            }
        }

        if (typeof cb.onCheckAuthorization === 'function') {
            cb.onCheckAuthorization(contactId, aiAction, function(allowed, message) {
                if (!allowed) { _fail(message); return; }
                _afterAuthOk();
            });
        } else {
            _fail();            // onCheckAuthorization not registered — block
        }
    }

    // ─── AI Engagement view — zone API ───────────────────────────────────────
    //
    // Zone 1 (LinkedIn Posts) — showLinkedInPosts(posts)
    //   posts: null = loading spinner
    //         []   = empty state message
    //         [{id, preview, text, date}] = post cards
    //   Fires: profilePanelCallbacks.onGenerateReply(postId, postText, contactId)
    //   Host calls updateLinkedInPost(postId, {state, replyText}) to update button/reply state
    //   When state='done' + replyText provided: fires onEditorSetContent
    //     using sectionId='reply-{postId}'
    //
    // Zone 2 (Email Drafts) — addAiSection / updateAiSection / removeAiSection
    //   section: { id, type, title, subject, body, loading }
    //   Fires on content: profilePanelCallbacks.onEditorSetContent(sectionId, html, mountEl)
    //   Fires on destroy: profilePanelCallbacks.onEditorDestroy(sectionId, mountEl)
    //   Fires on send:    profilePanelCallbacks.onSend(sectionId, subject, mountEl, contactId)
    //
    // Both zones and all cards/sections within them are independently collapsible.
    // ─────────────────────────────────────────────────────────────────────────

    var AI_ZONE_CHEVRON = '<svg class="ai-zone-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>';
    var AI_ITEM_CHEVRON = '<svg class="ai-post-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>';
    var AI_SEC_CHEVRON  = '<svg class="ai-section-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>';

    // ── Zone 1: LinkedIn Posts ────────────────────────────────────────────────
    //
    // Zone 1 has two sub-zones:
    //   #ai-zone-posts-new   — posts from the current "Ping LinkedIn" call
    //   #ai-zone-posts-saved — posts restored from cloud (previously had replies)

    function _buildPostsZoneHtml() {
        return '<div class="ai-zone" id="ai-zone-posts">' +
            '<div class="ai-zone-header" role="button" tabindex="0" aria-expanded="true">' +
                AI_ZONE_CHEVRON +
                '<span class="ai-zone-title">LinkedIn Posts</span>' +
                '<span class="ai-zone-badge"></span>' +
            '</div>' +
            '<div class="ai-zone-body">' +
                '<div id="ai-zone-posts-new"></div>' +
                '<div id="ai-zone-posts-saved"></div>' +
            '</div>' +
        '</div>';
    }

    function _updatePostsZoneBadge() {
        var n = $('#ai-zone-posts-new .ai-post-card').length +
                $('#ai-zone-posts-saved .ai-post-card').length;
        _updateZoneBadge('posts', n > 0 ? n : null);
    }

    function _ensurePostsZone() {
        if (!$('#ai-zone-posts').length) {
            $('#panel-ai-view').prepend(_buildPostsZoneHtml());
        }
    }

    function _autoExpandPostsZone() {
        var $zone = $('#ai-zone-posts');
        if ($zone.hasClass('collapsed')) {
            $zone.removeClass('collapsed');
            $zone.find('> .ai-zone-header').attr('aria-expanded', 'true');
            $zone.find('> .ai-zone-body').show();
        }
    }

    function showLinkedInPosts(posts) {
        // Normalise fancy-Unicode formatting characters (LinkedIn bold/italic) to
        // plain ASCII before storing or rendering, so saved state round-trips cleanly
        // through databases that don't support 4-byte UTF-8 (utf8mb4).
        if (posts && posts.length) {
            posts = $.map(posts, function(post) {
                return $.extend({}, post, {
                    preview: _normalizeFancyUnicode(post.preview),
                    text:    _normalizeFancyUnicode(post.text)
                });
            });
        }
        // Exclude posts already in the saved sub-zone (restored from cloud) to
        // avoid duplicates. Match by preview string — the most stable identifier.
        if (posts && posts.length && _aiSavedPosts && _aiSavedPosts.length) {
            var _savedPreviews = {};
            $.each(_aiSavedPosts, function(i, sp) {
                if (sp.preview) _savedPreviews[sp.preview] = true;
            });
            posts = $.grep(posts, function(post) {
                return !_savedPreviews[post.preview];
            });
        }
        _aiCurrentPosts = posts;
        _ensurePostsZone();
        var $new = $('#ai-zone-posts-new');
        // Destroy any active reply editors in new sub-zone before clearing
        var _cb = window.profilePanelCallbacks;
        $new.find('.ai-post-reply-btn[data-reply-id]').each(function() {
            var replyId = $(this).attr('data-reply-id');
            if (typeof tinymce !== 'undefined' && tinymce.get(replyId + '_MCE')) {
                tinymce.get(replyId + '_MCE').remove();
            }
            if (_cb && typeof _cb.onEditorDestroy === 'function') {
                var mountEl = document.getElementById(replyId + '_MOUNT');
                if (mountEl) _cb.onEditorDestroy(replyId, mountEl);
            }
        });
        $new.empty();
        if (posts === null) {
            $new.html('<div class="ai-zone-loading"><span class="ai-btn-spinner"></span>Fetching LinkedIn posts\u2026</div>');
            _updateZoneBadge('posts', null);
            return;
        }
        // Posts loaded (empty or populated) — mark item done
        _setEngagementItemState('ping-linkedin', 'done');
        if (!posts || !posts.length) {
            $new.html('<div class="ai-zone-empty">No recent LinkedIn posts found for this contact.</div>');
        } else {
            $.each(posts, function(i, post) { $new.append(_buildPostCardHtml(post)); });
        }
        _updatePostsZoneBadge();
        _autoExpandPostsZone();
    }

    // Populate the saved-posts sub-zone (posts with prior replies, restored from cloud).
    function _showSavedPosts(posts) {
        if (!posts || !posts.length) return;
        _aiSavedPosts = posts;
        _ensurePostsZone();
        var $saved = $('#ai-zone-posts-saved');
        $saved.empty();
        $.each(posts, function(i, post) { $saved.append(_buildPostCardHtml(post)); });
        _updatePostsZoneBadge();
        _autoExpandPostsZone();
    }

    function setAbout(aboutText) {
        if (typeof aboutText !== 'string') return;
        $('#panel-about-text').text(aboutText);
        $('#panel-about-popover-text').text(aboutText);
    }

    // ── Build reply area inner HTML (injected on Reply click) ─────────────────
    function _buildReplyAreaContent(replyId, sourcePostId) {
        var p  = escHtml(replyId);
        var sp = escHtml(sourcePostId || '');
        return '<div class="ai-post-reply-label">Generated Reply</div>' +
            // Comment wrap hidden by default — only revealed when setPostReply supplies a comment
            '<div class="ai-reply-comment-wrap" style="display:none">' +
                '<div class="ai-reply-field-label">LinkedIn Comment</div>' +
                '<textarea id="' + p + '_COM" class="ai-post-reply-comment" placeholder="AI-generated LinkedIn comment\u2026" rows="1"></textarea>' +
            '</div>' +
            '<div class="ai-reply-field-label">Subject</div>' +
            '<div class="ai-subject-row">' +
                '<input type="text" id="' + p + '_SUB" class="ai-post-reply-subject ai-subject-input" placeholder="Email subject\u2026">' +
                '<button type="button" class="ai-send-btn" data-reply-id="' + p + '" data-source-post-id="' + sp + '" data-btn-state="idle">' +
                    '<span class="snd-label">Send</span>' +
                    '<span class="snd-spinner"><span class="ai-btn-spinner"></span></span>' +
                    '<span class="snd-check">&#10003;</span>' +
                '</button>' +
            '</div>' +
            '<div class="ai-reply-mount" id="' + p + '_MOUNT">' +
                '<textarea id="' + p + '_MCE" class="' + p + '_MCE"></textarea>' +
            '</div>';
    }

    // ── createPostReply(replyId, sourcePostId) ───────────────────────────────
    //   Called by the host after receiving onReplyClick to inject the reply
    //   scaffold into the post card identified by sourcePostId and mark the
    //   Reply button as underway. The host supplies the replyId it generated.
    //
    function createPostReply(replyId, sourcePostId) {
        if (!replyId || !sourcePostId) return;
        var $card = $('#' + sourcePostId);
        if (!$card.length) return;
        var $btn = $card.find('.ai-post-reply-btn');
        // Inject reply area DOM
        $card.find('.ai-post-reply-area').html(_buildReplyAreaContent(replyId, sourcePostId));
        // Transition button to underway
        $btn.attr({ 'data-reply-id': replyId, 'data-btn-state': 'underway' });
        // Track replyId against the source post for state persistence
        if (!_aiCurrentPostStates[sourcePostId]) _aiCurrentPostStates[sourcePostId] = {};
        _aiCurrentPostStates[sourcePostId].replyId = replyId;
    }

    // ── setPostReply(postId, opts) ─────────────────────────────────────────────
    //   Populate the reply area fields for a given reply session postId.
    //   Each field in opts is optional and can be called multiple times.
    //
    //   opts.comment  {string}  — sets the LinkedIn comment textarea (_COM)
    //   opts.subject  {string}  — sets the email subject input (_SUB)
    //   opts.body     {string}  — sets the TinyMCE / textarea editor (_MCE)
    //   opts.visible  {boolean} — slides the reply area into view
    //   opts.state    {string}  — 'done' transitions the Reply button to done state
    //
    function setPostReply(postId, opts) {
        if (!postId || !opts) return;
        var p = postId;

        if (opts.comment !== undefined) {
            var $com  = $('#' + p + '_COM');
            var $wrap = $com.closest('.ai-reply-comment-wrap');
            $com.val(opts.comment);
            // Reveal the comment section if hidden
            if ($wrap.is(':hidden')) { $wrap.slideDown(200); }
            // Resize after animations settle (250 ms > the 200 ms slideDown duration).
            // Using a closure over the element reference avoids re-querying in the timer.
            var _comEl = $com[0];
            setTimeout(function() {
                if (_comEl && _comEl.scrollHeight > 0) {
                    _comEl.style.height = 'auto';
                    _comEl.style.height = _comEl.scrollHeight + 'px';
                }
            }, 250);
        }

        if (opts.subject !== undefined) {
            $('#' + p + '_SUB').val(opts.subject);
        }

        if (opts.body !== undefined) {
            var edId = p + '_MCE';
            if (typeof tinymce !== 'undefined' && tinymce.get(edId)) {
                tinymce.get(edId).setContent(opts.body);
            } else {
                $('#' + edId).val(opts.body);
            }
        }

        if (opts.visible) {
            var $visBtn = $('[data-reply-id="' + p + '"]');
            if ($visBtn.length) {
                $visBtn.closest('.ai-post-card').find('.ai-post-reply-area').slideDown(200, function() {
                    // Now that the reply area and all its ancestors are visible,
                    // scrollHeight is accurate — resize any comment textarea within it.
                    $(this).find('.ai-post-reply-comment').each(function() {
                        this.style.height = 'auto';
                        this.style.height = this.scrollHeight + 'px';
                    });
                });
            }
        }

        if (opts.state === 'done') {
            var $doneBtn = $('[data-reply-id="' + p + '"]');
            $doneBtn.attr('data-btn-state', 'done');
            // Track in post states for persistence
            var srcPostId = String($doneBtn.data('post-id') || '');
            if (srcPostId) {
                if (!_aiCurrentPostStates[srcPostId]) _aiCurrentPostStates[srcPostId] = {};
                _aiCurrentPostStates[srcPostId].state = 'done';
                _aiCurrentPostStates[srcPostId].replyId = p;
            }
        }
    }

    function updateLinkedInPost(postId, updates) {
        // Track post state for persistence
        if (!_aiCurrentPostStates[postId]) _aiCurrentPostStates[postId] = {};
        $.extend(_aiCurrentPostStates[postId], updates);
        var $btn = $('.ai-post-reply-btn[data-post-id="' + postId + '"]');
        if (!$btn.length) return;
        var $card       = $btn.closest('.ai-post-card');
        var $replyArea  = $card.find('.ai-post-reply-area');
        var $mount      = $replyArea.find('.ai-reply-mount');
        var sectionId   = 'reply-' + postId;
        var cb          = window.profilePanelCallbacks;
        var state       = updates.state || 'idle';
        $btn.prop('disabled', false);
        if (state === 'generating') {
            $btn.attr('data-btn-state', 'underway').prop('disabled', false);
        } else if (state === 'done') {
            $btn.attr('data-btn-state', 'done');
            $replyArea.slideDown(200);
            if (cb && typeof cb.onEditorMount === 'function') {
                cb.onEditorMount(sectionId, $mount[0]);
            }
            if (updates.replyText && cb && typeof cb.onEditorSetContent === 'function') {
                cb.onEditorSetContent(sectionId, updates.replyText, $mount[0]);
            }
        } else {
            // idle / reset — tear down reply editor if it was shown
            if ($replyArea.is(':visible')) {
                if (cb && typeof cb.onEditorDestroy === 'function') {
                    cb.onEditorDestroy(sectionId, $mount[0]);
                }
                $replyArea.slideUp(150);
            }
            $btn.attr('data-btn-state', 'idle');
        }
    }

    function _buildPostCardHtml(post) {
        // Guard against missing or digit-leading IDs — both break jQuery's #id selector.
        // Missing id   → auto-generate a unique 'pp-N' value.
        // Digit-leading → prefix with 'pp-' so the CSS selector remains valid.
        var rawId = (post.id != null && post.id !== '') ? String(post.id) : '';
        var safeId = rawId === ''          ? ('pp-' + (++_postCardCounter))
                   : /^\d/.test(rawId)    ? ('pp-' + rawId)
                   :                        rawId;
        var id = escHtml(safeId);
        return '<div class="ai-post-card ' + id + '" id="' + id + '" data-post-id="' + id + '">' +
            '<div class="ai-post-header">' +
                AI_ITEM_CHEVRON +
                '<div class="ai-post-preview-wrap">' +
                    '<span class="ai-post-preview">' + escHtml(post.preview || '') + '</span>' +
                    (post.meta ? '<span class="ai-post-meta">' + escHtml(post.meta) + '</span>' : '') +
                '</div>' +
                '<button type="button" class="ai-post-reply-btn" data-post-id="' + id + '" data-btn-state="idle">' +
                    '<span class="rpl-label">Reply \u203a</span>' +
                    '<span class="rpl-spinner"><span class="ai-btn-spinner"></span></span>' +
                    '<span class="rpl-check">&#10003;</span>' +
                '</button>' +
            '</div>' +
            '<div class="ai-post-body">' +
                '<p class="ai-post-text">' + escHtml(post.text || post.preview || '') + '</p>' +
            '</div>' +
            '<div class="ai-post-reply-area" style="display:none"></div>' +
        '</div>';
    }

    // ── Zone 2: Email Drafts ──────────────────────────────────────────────────

    function addAiSection(section) {
console.log('addAiSection:  section= ' + JSON.stringify(section));
        if ($('[data-section-id="' + section.id + '"].ai-section').length) return; // no duplicates
        // Collapse Zone 1 (LinkedIn Posts) so the user can focus on the new draft activity
        var $postsZone = $('#ai-zone-posts');
        if ($postsZone.length && !$postsZone.hasClass('collapsed')) {
            $postsZone.addClass('collapsed');
            $postsZone.find('> .ai-zone-body').slideUp(150);
        }
        // Track section for persistence
        _aiCurrentSections.push({
            id:      section.id,
            type:    section.type  || section.id,
            title:   section.title || '',
            subject: section.subject || '',
            body:    section.body    || null
        });
        var $view = $('#panel-ai-view');
        if (!$('#ai-zone-drafts').length) {
            $view.append(_buildDraftsZoneHtml());
        }
        var $body = $('#ai-zone-drafts .ai-zone-body');
        // Insert at the position determined by aiSectionTypes order
        var _cb2   = window.profilePanelCallbacks;
        var _types = _cb2 && _cb2.aiSectionTypes;
        var _sHtml = _buildSectionHtml(section);
        if (_types && _types.length) {
            var _typeIdx = -1;
            $.each(_types, function(i, t) { if (t.type === section.type) { _typeIdx = i; return false; } });
            if (_typeIdx >= 0) {
                // Find the last existing section whose type has a lower index
                var $insertAfter = null;
                $body.find('.ai-section').each(function() {
                    var existingType = $(this).data('section-type');
                    var existingIdx  = -1;
                    $.each(_types, function(i, t) { if (t.type === existingType) { existingIdx = i; return false; } });
                    if (existingIdx >= 0 && existingIdx < _typeIdx) { $insertAfter = $(this); }
                });
                if ($insertAfter) { $insertAfter.after(_sHtml); }
                else              { $body.prepend(_sHtml); }
            } else {
                $body.append(_sHtml);
            }
        } else {
            $body.append(_sHtml);
        }
    }

    function updateAiSection(id, updates) {
        var $section = $('.ai-section[data-section-id="' + id + '"]');
        if (!$section.length) return;
        // Track updates in internal model
        var _sec = $.grep(_aiCurrentSections, function(s) { return s.id === id; })[0];
        if (updates.subject !== undefined && _sec) _sec.subject = updates.subject;
        if (updates.body    !== undefined && _sec) _sec.body    = updates.body;
        if (updates.title !== undefined) {
            $section.find('.ai-section-title').text(updates.title);
        }
        // Update loading text mid-generation (before loading → ready transition)
        if (updates.loadingText !== undefined) {
            $section.find('.ai-section-loading-text').text(updates.loadingText);
        }
        // Transition loading → ready: reveal content without rebuilding DOM (preserves editor mount)
        if (updates.loading === false) {
            $section.find('.ai-section-status')
                .removeClass('ai-section-status--loading')
                .addClass('ai-section-status--ready')
                .html('Ready');
            $section.find('.ai-section-loading').remove();
            $section.find('.ai-section-content').show();
            if (updates.subject !== undefined) {
                $section.find('.ai-subject-input').val(updates.subject);
            }
            // Mark the corresponding engagement dropdown item as done
            _setEngagementItemState(id, 'done');
        } else if (updates.subject !== undefined) {
            $section.find('.ai-subject-input').val(updates.subject);
        }
        if (updates.body !== undefined && updates.body !== null) {
            var cb = window.profilePanelCallbacks;
            var mountEl = document.getElementById(id + '_MOUNT');
            if (mountEl && cb && typeof cb.onEditorSetContent === 'function') {
                cb.onEditorSetContent(id, updates.body, mountEl);
            }
        }
    }

    function removeAiSection(id) {
        _destroyEditor(id);
        var $section = $('.ai-section[data-section-id="' + id + '"]');
        $section.remove();
        var $body = $('#ai-zone-drafts .ai-zone-body');
        if (!$body.find('.ai-section').length) { $('#ai-zone-drafts').remove(); }
    }

    function clearAiSections() {
        // Destroy all mounted editors
        Object.keys(_aiEditorsMounted).forEach(function(id) { _destroyEditor(id); });
        _aiEditorsMounted = {};
        $('#ai-zone-posts, #ai-zone-drafts').remove();
        _resetAiTracking();   // clear internal data model
    }

    function _destroyEditor(id) {
        var mountEl = _aiEditorsMounted[id];
        if (!mountEl) return;
        var cb = window.profilePanelCallbacks;
        if (cb && typeof cb.onEditorDestroy === 'function') {
            cb.onEditorDestroy(id, mountEl);
        }
        delete _aiEditorsMounted[id];
    }

    // ── Zone helpers ──────────────────────────────────────────────────────────

    function _buildZoneHtml(zoneId, title) {
        return '<div class="ai-zone" id="ai-zone-' + zoneId + '">' +
            '<div class="ai-zone-header" role="button" tabindex="0" aria-expanded="true">' +
                AI_ZONE_CHEVRON +
                '<span class="ai-zone-title">' + escHtml(title) + '</span>' +
                '<span class="ai-zone-badge"></span>' +
            '</div>' +
            '<div class="ai-zone-body"></div>' +
        '</div>';
    }

    function _buildDraftsZoneHtml() {
        return '<div class="ai-zone" id="ai-zone-drafts"><div class="ai-zone-body"></div></div>';
    }

    function _updateZoneBadge(zoneId, count) {
        var $badge = $('#ai-zone-' + zoneId + ' > .ai-zone-header .ai-zone-badge');
        if (count === null || count === undefined) { $badge.text('').hide(); }
        else { $badge.text(count).show(); }
    }

    function _buildSectionHtml(section) {
        var isLoading = !!(section.loading || section.body === null);
        var statusHtml = isLoading
            ? '<span class="ai-section-status ai-section-status--loading"></span>'
            : '<span class="ai-section-status ai-section-status--ready">Ready</span>';
        var bodyHtml = isLoading
            ? '<div class="ai-section-loading">' +
                  '<span class="ai-btn-spinner"></span>' +
                  '<span class="ai-section-loading-text">' + escHtml(section.loadingText || '') + '</span>' +
              '</div>' + _buildSectionContentHtml(section.id, section.subject || '', true)
            : _buildSectionContentHtml(section.id, section.subject || '', false);
        return '<div class="ai-section" data-section-id="' + escHtml(section.id) +
            '" data-section-type="' + escHtml(section.type || '') + '">' +
            '<div class="ai-section-header">' +
                AI_SEC_CHEVRON +
                '<span class="ai-section-title">' + escHtml(section.title) + '</span>' +
                statusHtml +
            '</div>' +
            '<div class="ai-section-body">' + bodyHtml + '</div>' +
        '</div>';
    }

    function _buildSectionContentHtml(sectionId, subject, hidden) {
        var id = escHtml(sectionId);
        return '<div class="ai-section-content" style="display:none;">' +
            '<div class="ai-subject-field-label">Subject</div>' +
            '<div class="ai-subject-row">' +
                '<input type="text" id="' + id + '_SUB" class="ai-post-section-subject ai-subject-input" placeholder="Email subject\u2026">' +
                '<button type="button" class="ai-send-btn" data-section-id="' + id + '" data-btn-state="idle">' +
                    '<span class="snd-label">Send</span>' +
                    '<span class="snd-spinner"><span class="ai-btn-spinner"></span></span>' +
                    '<span class="snd-check">&#10003;</span>' +
                '</button>' +
            '</div>' +
            '<div class="ai-editor-mount" id="' + id + '_MOUNT">' +
                '<textarea id="' + id + '_MCE" class="' + id + '_MCE"></textarea>' +
            '</div>' +
        '</div>';
    }

    // ─── AI Engagement view switching ────────────────────────────────────────

    // Switch panel to AI Engagement view (expand width, show AI content).
    // ─── Panel notification modal ──────────────────────────────────────────────
    // showPanelNotification(message, options)
    //   message  — string (plain text or HTML)
    //   options  — { type:     'info'|'success'|'warning'|'error'  (default 'info')
    //                title:    string — optional title bar text
    //                duration: ms until auto-dismiss; 0 = persistent (default 0)
    //                html:     true to render message as HTML       (default false) }
    // hidePanelNotification() — dismiss immediately

    var _pnTimer = null;
    var PN_CHECKMARK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

    function ensurePnModal() {
        if ($('#pn-modal').length) return;
        $('body').append(
            '<div id="pn-backdrop" aria-hidden="true"></div>' +
            '<div id="pn-modal" role="alertdialog" aria-modal="true" aria-hidden="true" data-type="info">' +
                '<div class="pn-title-bar hidden"><span class="pn-title" id="pn-title"></span></div>' +
                '<div class="pn-body-wrap"><div class="pn-body" id="pn-body"></div></div>' +
                '<div class="pn-footer">' +
                    '<button type="button" class="pn-close-btn" id="pn-close-btn" aria-label="Dismiss">' +
                        PN_CHECKMARK_SVG +
                    '</button>' +
                '</div>' +
            '</div>'
        );
    }

    function showPanelNotification(message, options) {
        options = $.extend({ type: 'info', title: '', duration: 0, html: false }, options);
        ensurePnModal();
        clearTimeout(_pnTimer);
        var $modal = $('#pn-modal');
        $modal.attr('data-type', options.type);
        // Title bar
        if (options.title) {
            $('#pn-title').text(options.title);
            $modal.find('.pn-title-bar').removeClass('hidden');
        } else {
            $modal.find('.pn-title-bar').addClass('hidden');
        }
        // Body
        if (options.html) {
            $('#pn-body').html(message);
        } else {
            $('#pn-body').text(message);
        }
        $modal.addClass('open').attr('aria-hidden', 'false');
        $('#pn-backdrop').addClass('open');
        setTimeout(function() {
            var btn = document.getElementById('pn-close-btn');
            if (btn) btn.focus();
        }, 50);
        if (options.duration > 0) {
            _pnTimer = setTimeout(hidePanelNotification, options.duration);
        }
    }

    function hidePanelNotification() {
        clearTimeout(_pnTimer);
        _pnTimer = null;
        $('#pn-modal').removeClass('open').attr('aria-hidden', 'true');
        $('#pn-backdrop').removeClass('open');
    }

    function closeAllDropdowns() {
        $('#ai-engagement-btn').removeClass('open').attr('aria-expanded', 'false');
        $('#ai-engagement-dropdown').removeClass('open').attr('aria-hidden', 'true');
        $('#ai-research-btn').removeClass('open').attr('aria-expanded', 'false');
        $('#ai-research-dropdown').removeClass('open').attr('aria-hidden', 'true');
        $('#ai-slack-btn').removeClass('open').attr('aria-expanded', 'false');
        $('#ai-slack-dropdown').removeClass('open').attr('aria-hidden', 'true');
    }

    function showAiLoadingState() {
        var $view = $('#panel-ai-view');
        $view.addClass('ai-view--loading');
        if (!$view.find('#ai-view-loading').length) {
            $view.prepend('<div id="ai-view-loading">Loading\u2026</div>');
        }
    }

    function hideAiLoadingState() {
        $('#panel-ai-view').removeClass('ai-view--loading');
        $('#ai-view-loading').remove();
    }

    function switchToAiView() {
        closeAllDropdowns();
        var $panel = $('.profile-panel');
        $panel.addClass('ai-view-active');
        // jQuery's .show() / .fadeIn() leave an inline display:block on .profile-content
        // which overrides the CSS display:none rule under .ai-view-active.  Clearing it
        // here lets the stylesheet rule take full effect.
        $('.profile-content').css('display', '');
        // Ensure toggle is visible and marked as being in AI view.
        // Calling _showViewToggle() here covers the case where a dropdown action
        // triggers the switch before saved-state restoration has run.
        _showViewToggle();
        $('#panel-view-toggle')
            .addClass('ai-view')
            .attr('aria-label', 'Switch to CRM view')
            .attr('title', 'Switch to CRM view');
        panelCurrentView = 'ai';

        // Content already in the DOM — eager load finished before the user switched.
        if (_aiCurrentPosts !== null || _aiCurrentSections.length > 0) return;

        var contactId = _currentContactData ? _currentContactData.id : null;

        // Cloud fetch is in-flight (started by _eagerLoadProfile on profile open).
        // Show the loading placeholder; the fetch callback will hide it once
        // content is populated.
        if (_aiStateLoadPending) {
            showAiLoadingState();
            return;
        }

        // No saved state and no load in-flight — nothing to restore.
        // The host drives generation through the AI+ Engagement dropdown.
        hideAiLoadingState();
    }

    // Switch panel back to CRM view (contract width, show CRM content)
    function switchToCrmView() {
        closeAllDropdowns();
        var $panel = $('.profile-panel');
        $panel.removeClass('ai-view-active');
        $('#panel-view-toggle')
            .removeClass('ai-view')
            .attr('aria-label', 'Switch to AI Engagement view')
            .attr('title', 'Switch to AI Engagement view');
        panelCurrentView = 'crm';
        // Close About snippet popover when leaving AI view
        $('#panel-about-popover').removeClass('open').attr('aria-hidden', 'true');
        $('#panel-about-snippet').attr('aria-expanded', 'false');
    }

    // Toggle between CRM and AI Engagement views
    function togglePanelView() {
        if (panelCurrentView === 'crm') switchToAiView();
        else switchToCrmView();
    }

    // ─── Quill editor initialization (lazy — called on first AI view open) ───

    function initQuillEditors() {
        if (typeof Quill === 'undefined') {
            console.warn('[AI View] Quill.js not loaded — editors will not initialize');
            return;
        }
        var toolbarOptions = [
            ['bold', 'italic', 'underline'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['code-block'],
            ['clean']
        ];
        var demoContent = {
            linkedin:     '<p>Hi Sarah,</p><p>Great post about mastering peak seasons in iGaming and Betting. Your insights on leveraging key CX metrics, data-driven forecasting, and AI-driven tools highlight how the platform empowers operators to maintain top-notch player experiences when pressure peaks. It\'s a strategic approach that can truly redefine support readiness during critical moments.</p>',
            challenges:   '<p>Hi Sarah,</p><p>Growing competition from language schools and the surge in online platforms have likely put pressure on Zendesk to maintain consistent student satisfaction while managing teacher transitions. Streamlining outreach to schools, educators, and decision-makers using verified contacts can help Zendesk expand its influence and adopt more personalized, timely engagement to stay ahead.</p>',
            competitors:  '<p>Hi Sarah,</p><p>I wanted to share how our approach differs from the solutions your team may currently be evaluating. LeadLeaper\'s verified contact data and AI-powered engagement tools are purpose-built for sales teams that need to move fast without sacrificing accuracy or personalization. I\'d love to show you how teams like yours are seeing results in their first week.</p>',
            announcement: '<p>Hi Sarah,</p><p>I wanted to reach out with some exciting news that I think could be a great fit for your team at Zendesk. We\'ve just launched a new capability that directly addresses the challenges we discussed around pipeline visibility and engagement velocity — and early results from similar teams have been very promising.</p>'
        };
        ['linkedin', 'challenges', 'competitors', 'announcement'].forEach(function(key) {
            var el = document.getElementById('ai-editor-' + key);
            if (!el || el.querySelector('.ql-container')) return; // already initialized
            var quill = new Quill(el, {
                theme: 'snow',
                modules: { toolbar: toolbarOptions },
                placeholder: 'AI-generated draft will appear here\u2026'
            });
            quill.clipboard.dangerouslyPasteHTML(demoContent[key] || '');
        });
        quillsInitialized = true;

        // Populate the LinkedIn comment textarea with demo content and auto-size it
        var commentEl = document.getElementById('ai-comment-linkedin');
        if (commentEl && !commentEl.value) {
            commentEl.value = 'Great post on the challenges of demand peaks.';
            commentEl.style.height = 'auto';
            commentEl.style.height = commentEl.scrollHeight + 'px';
        }

        console.log('[AI View] Quill editors initialized');
    }

    // ─── Employer Research modal ─────────────────────────────────────────────

    function openEmployerResearchModal(contactData) {
        var company = (contactData && contactData.company) || '';
        $('#rp-employer-subtitle').text(company ? '\u00B7 ' + company : '');
        $('#rp-employer-modal').addClass('open').attr('aria-hidden', 'false');
        $('#rp-employer-backdrop').addClass('open');
        setTimeout(function() {
            var btn = document.getElementById('rp-employer-close-btn');
            if (btn) btn.focus();
        }, 50);
    }

    function closeEmployerResearchModal() {
        $('#rp-employer-modal').removeClass('open').attr('aria-hidden', 'true');
        $('#rp-employer-backdrop').removeClass('open');
    }

    // ─── Company label stamping ───────────────────────────────────────────────
    // Updates any remaining dynamic company-name slots whenever a new contact
    // is loaded.  The .ai-company-label span has been removed from the dropdown
    // (label is now static "Your Company Description") so this is a no-op in
    // the current markup; retained for forward-compatibility.
    function _updateCompanyLabels(contactData) {
        var name = (contactData && contactData.company) ? contactData.company : 'My Company';
        $('.ai-company-label').text(name);
        // Note: #rp-ll-title is intentionally NOT updated here — the modal title
        // is always the static "Your Company Description".
    }

    // ─── User-Company Research modal ─────────────────────────────────────────

    function openUserCompanyResearchModal() {
        var cb  = window.profilePanelCallbacks;
        var cid = _currentContactData ? _currentContactData.id : null;

        // Bump generation counter so any in-flight response from a previous open
        // is discarded when it eventually fires.
        var myGen = ++_llLoadGen;

        // Discard any lingering edit state before fetching.
        exitLlEditMode(false);

        // Fetch content first, open only when the callback returns — avoids the
        // skeleton-then-resize flash that occurred when the modal opened before
        // content was ready.  _renderUserCompanyResearch() handles the open + render
        // in one step when the modal is not yet open.
        if (cb && typeof cb.onLoadUserCompanyResearch === 'function') {
            cb.onLoadUserCompanyResearch(cid, function(html, message, canEdit) {
                // Discard if a newer request has been issued since this one started
                if (_llLoadGen !== myGen) return;
                _renderUserCompanyResearch(html, message, canEdit);
            });
        }
    }

    // Renders content into the User-Company Research modal.
    // Signature: (html, message, canEdit)
    //   html     — host-provided HTML to display (string | null)
    //   message  — host-provided info/prompt text or HTML (string | null)
    //   canEdit  — true = show Edit (when html present) or Generate (when message present) button
    //
    // Exactly one of html / message must be non-null.
    // If both are null or both are non-null the call is treated as a cancel:
    // the modal closes silently and no content is rendered.
    //
    // If the modal is not yet open (direct-call path via loadUserCompanyResearchContent)
    // it is opened automatically — no skeleton is shown since content is ready.
    function _renderUserCompanyResearch(html, message, canEdit) {
        var hasHtml = (html  != null);
        var hasMsg  = (message != null);

        // Cancel / error: both supplied or neither supplied
        if (hasHtml === hasMsg) {
            if ($('#rp-ll-modal').hasClass('open')) closeUserCompanyResearchModal();
            if (hasHtml) console.warn('[ProfilePanel] _renderUserCompanyResearch: supply either html or message, not both.');
            return;
        }

        // Auto-open when called directly (no prior openUserCompanyResearchModal call)
        if (!$('#rp-ll-modal').hasClass('open')) {
            exitLlEditMode(false);
            $('#rp-ll-body-content').empty();
            $('#rp-ll-action-btn').hide();
            $('#rp-ll-modal').addClass('open').attr('aria-hidden', 'false');
            $('#rp-ll-backdrop').addClass('open');
            setTimeout(function() {
                var btn = document.getElementById('rp-ll-close-btn-x');
                if (btn) btn.focus();
            }, 50);
        }

        var $body = $('#rp-ll-body-content');
        var $btn  = $('#rp-ll-action-btn');

        if (hasHtml) {
            $body.html(html);
            if (canEdit) {
                $btn.prop('disabled', false)
                    .text('Edit')
                    .removeClass('rp-btn-save-green rp-btn-generate')
                    .addClass('ce-btn-save')
                    .show();
            } else {
                $btn.hide();
            }
        } else {
            // hasMsg
            $body.html('<div class="rp-ll-message">' + message + '</div>');
            if (canEdit) {
                $btn.prop('disabled', false)
                    .text('Generate')
                    .removeClass('ce-btn-save rp-btn-save-green')
                    .addClass('rp-btn-generate')
                    .show();
            } else {
                $btn.hide();
            }
        }
        $('#rp-ll-modal .rp-body').scrollTop(0);
    }

    function closeUserCompanyResearchModal() {
        exitLlEditMode(false);   // discard any unsaved edits
        $('#rp-ll-modal').removeClass('open').attr('aria-hidden', 'true');
        $('#rp-ll-backdrop').removeClass('open');
    }

    function enterLlEditMode() {
        // Store original HTML of the body content so we can revert on cancel
        $('#rp-ll-body-content').data('ll-original', $('#rp-ll-body-content').html());
        $('#rp-ll-modal').addClass('edit-mode');
        $('#rp-ll-action-btn')
            .text('Save')
            .removeClass('ce-btn-save rp-btn-generate')
            .addClass('rp-btn-save-green');
        // Host HTML marks editable sections with class="rp-editable" but no
        // contenteditable attribute, keeping them read-only until Edit is clicked.
        // enterLlEditMode() activates editing; exitLlEditMode() deactivates it.
        var $body      = $('#rp-ll-body-content');
        var $editables = $body.find('.rp-editable');
        $editables.attr('contenteditable', 'true');
        $editables.first().focus();
    }

    function exitLlEditMode(save) {
        if (!$('#rp-ll-modal').hasClass('edit-mode')) return;
        var $body = $('#rp-ll-body-content');
        if (!save) {
            // Cancel — restore original HTML wholesale (discards any edits)
            var orig = $body.data('ll-original');
            if (orig !== undefined) $body.html(orig);
        } else {
            // Save — remove contenteditable from all editable sections
            $body.find('.rp-editable').blur().attr('contenteditable', 'false');
        }
        $body.removeData('ll-original');
        $('#rp-ll-modal').removeClass('edit-mode');
        $('#rp-ll-action-btn')
            .text('Edit')
            .removeClass('rp-btn-save-green rp-btn-generate')
            .addClass('ce-btn-save');
    }

    function _saveLlResearch() {
        var cb   = window.profilePanelCallbacks;
        var cid  = _currentContactData ? _currentContactData.id : null;
        var $btn = $('#rp-ll-action-btn');
        var html = $('#rp-ll-body-content').html();

        // Show spinner while save is in progress
        $btn.prop('disabled', true).html('<span class="ai-btn-spinner"></span>');

        function _restoreSaveBtn() {
            $btn.prop('disabled', false).text('Save');
        }

        if (cb && typeof cb.onSaveUserCompanyResearch === 'function') {
            cb.onSaveUserCompanyResearch(cid, html, function(errMsg) {
                if (errMsg) {
                    _restoreSaveBtn();
                    showPanelNotification(errMsg, { type: 'error' });
                } else {
                    exitLlEditMode(true);
                    closeUserCompanyResearchModal();
                }
            });
        } else {
            exitLlEditMode(true);
            closeUserCompanyResearchModal();
        }
    }

    function _generateLlResearch() {
        var cb  = window.profilePanelCallbacks;
        var cid = _currentContactData ? _currentContactData.id : null;
        if (cb && typeof cb.onGenerateUserCompanyResearch === 'function') {
            $('#rp-ll-body-content').html('<div class="rp-ll-skeleton"></div>');
            $('#rp-ll-action-btn').hide();
            cb.onGenerateUserCompanyResearch(cid, function(html, message, canEdit) {
                _renderUserCompanyResearch(html, message, canEdit);
            });
        }
    }

    // ─── Configure Engagement modal ─────────────────────────────────────────

    function openCeModal() {
        $('#ce-modal').addClass('open').attr('aria-hidden', 'false');
        $('#ce-backdrop').addClass('open').attr('aria-hidden', 'false');
        // Move focus to close button for keyboard accessibility
        setTimeout(function() {
            var btn = document.getElementById('ce-close-btn');
            if (btn) btn.focus();
        }, 50);
    }

    function closeCeModal() {
        $('#ce-modal').removeClass('open').attr('aria-hidden', 'true');
        $('#ce-backdrop').removeClass('open').attr('aria-hidden', 'true');
    }

    // ─── Engagement dropdown — dynamic item injection ─────────────────────────
    //
    // Called from setupPanelHandlers() and may be called again by the host after
    // setting profilePanelCallbacks.aiSectionTypes. Safe to call multiple times —
    // previously injected items are cleared before re-injection.
    //
    // Injects between "Ping LinkedIn for posts" and "Configure Engagement":
    //   • A horizontal rule (opening bracket)
    //   • One menu item per aiSectionTypes entry (in array order)
    //     — include "Generate ALL of the above" as the last array entry to show it
    //   • A horizontal rule (closing bracket)
    //
    // Items are stamped with the standard arrow / spinner / check icon structure
    // so they participate in the existing dropdown-item state machine.
    //
    function _buildDropdownItemHtml(action, label) {
        var ARROW   = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="ai-item-arrow" aria-hidden="true"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>';
        var CHECK   = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="ai-item-check" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#22c55e"/><polyline points="7,13 10,16 17,8" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        var UNAVAIL = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="ai-item-unavail" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="#d1d5db" stroke-width="2"/><line x1="7.5" y1="16.5" x2="16.5" y2="7.5" stroke="#d1d5db" stroke-width="2" stroke-linecap="round"/></svg>';
        return '<li class="ai-dropdown-item" role="menuitem" data-ai-action="' + escHtml(action) + '">' +
            ARROW +
            '<span class="ai-item-spinner"><span class="ai-btn-spinner"></span></span>' +
            CHECK +
            UNAVAIL +
            escHtml(label) +
        '</li>';
    }

    function _populateEngagementDropdown() {
        var cb    = window.profilePanelCallbacks;
        // Use host-supplied types when provided; fall back to hardcoded defaults so the
        // panel is functional out-of-the-box without host configuration.
        // Include 'generate-all' as the last entry to show "Generate ALL of the above".
        var types = (cb && cb.aiSectionTypes && cb.aiSectionTypes.length)
            ? cb.aiSectionTypes
            : [
                { type: 'employer-challenges',   title: 'Employer Challenges',        action: 'employer-challenges'   },
                { type: 'employer-competitors',  title: 'Employer Competitors',        action: 'employer-competitors'  },
                { type: 'employer-announcement', title: 'Employer Announcement',       action: 'employer-announcement' },
                { type: 'generate-all',          title: 'Generate ALL of the above',   action: 'generate-all'          }
            ];

        var $configItem = $('#ai-engagement-dropdown [data-ai-action="configure-engagement"]');
        if (!$configItem.length) return;

        // Clear any previously injected items so this function is safe to call multiple times.
        $('#ai-engagement-dropdown .ai-dropdown-injected').remove();

        // ① Opening HR — divider after "Ping LinkedIn for posts"
        $('<li class="ai-dropdown-divider ai-dropdown-injected" role="separator"></li>')
            .insertBefore($configItem);

        // ② One item per type entry, in declared order
        $.each(types, function(i, t) {
            $(_buildDropdownItemHtml(t.action || t.type, t.title))
                .addClass('ai-dropdown-injected')
                .insertBefore($configItem);
        });

        // ③ Closing HR — divider before "Configure Engagement"
        $('<li class="ai-dropdown-divider ai-dropdown-injected" role="separator"></li>')
            .insertBefore($configItem);
    }

    // ⑤ All panel event handlers
    function setupPanelHandlers() {
        // Inject dynamic dropdown items from aiSectionTypes (must run before any click handlers)
        _populateEngagementDropdown();

        // Notification modal — close button and backdrop click
        $(document).on('click', '#pn-close-btn, #pn-backdrop', function() {
            hidePanelNotification();
        });

        // ESC to close — modals take priority over panel
        $(document).on('keydown', function(e) {
            if (e.which === 27) {
                if ($('#pn-modal').hasClass('open')) { hidePanelNotification(); return; }
                if ($('#er-modal').hasClass('open')) { closeEmailReplyModal(); return; }
                if ($('#ce-modal').hasClass('open')) { closeCeModal(); return; }
                // LL modal: ESC in edit mode → exit edit (stay open); ESC in view mode → close
                if ($('#rp-ll-modal').hasClass('open')) {
                    if ($('#rp-ll-modal').hasClass('edit-mode')) { exitLlEditMode(false); }
                    else { closeLeadLeaperResearchModal(); }
                    return;
                }
                if ($('#rp-employer-modal').hasClass('open')) { closeEmployerResearchModal(); return; }
                // ESC in an active field edit → cancel that edit only (don't close panel)
                if ($currentFieldEdit) { closeCurrentFieldEdit(); return; }
                var $panel = $('.profile-panel');
                if ($panel.hasClass('open')) closeProfilePanel();
            }
        });

        // Close button
        $(document).on('click', '.panel-close-btn', function() {
            closeProfilePanel();
        });

        // ── Per-field inline edit ────────────────────────────────────────────

        // Pencil click — open inline editor for that field
        $(document).on('click', '.field-pencil', function(e) {
            e.stopPropagation();
            var $editable = $(this).closest('.field-editable');
            var fieldName = $editable.data('field');
            var cd = getCurrentContactData();
            if (!cd) return;
            var ef = extractEditableFields(cd);
            openFieldEdit($editable, ef[fieldName] || '');
        });

        // Clear button — empty the input
        $(document).on('click', '.fie-clear-btn', function(e) {
            e.stopPropagation();
            $(this).closest('.fie-input-wrap').find('.fie-input').val('').focus();
        });

        // Cancel button — discard and close
        $(document).on('click', '.fie-cancel-btn', function(e) {
            e.stopPropagation();
            closeCurrentFieldEdit();
        });

        // Confirm button — save single field
        $(document).on('click', '.fie-confirm-btn', function(e) {
            e.stopPropagation();
            var $editable  = $(this).closest('.field-editable');
            var fieldName  = $editable.data('field');
            var newValue   = $editable.find('.fie-input').val().trim();
            var cd         = getCurrentContactData();
            if (!cd) { closeCurrentFieldEdit(); return; }

            var $confirm = $(this);
            var $cancel  = $editable.find('.fie-cancel-btn');
            var $input   = $editable.find('.fie-input');
            $confirm.prop('disabled', true);
            $cancel.prop('disabled', true);
            $input.prop('disabled', true);

            function onDone(err) {
                if (err) {
                    $confirm.prop('disabled', false);
                    $cancel.prop('disabled', false);
                    $input.prop('disabled', false).focus();
                    var $err = $editable.find('.fie-error');
                    if (!$err.length) {
                        $editable.find('.field-inline-edit').after('<div class="fie-error"></div>');
                        $err = $editable.find('.fie-error');
                    }
                    $err.text(typeof err === 'string' ? err : 'Save failed.').addClass('visible');
                    return;
                }
                // Merge single field into contactData
                var patch = {};
                patch[fieldName] = newValue;
                mergeEditableFields(cd, patch);
                // Close editor
                $currentFieldEdit = null;
                $editable.removeClass('editing');
                $editable.find('.field-inline-edit, .fie-error').remove();
                // Re-render identity zone or details card
                if (fieldName === 'name' || fieldName === 'company' || fieldName === 'title') {
                    updatePanelIdentity(cd);
                } else {
                    renderMainContent(cd);
                }
            }

            var cb = window.profilePanelCallbacks;
            var fields = {};
            fields[fieldName] = newValue;
            if (cb && typeof cb.onSave === 'function') {
                cb.onSave(cd.id, fields, onDone);
            } else {
                onDone();
            }
        });

        // Enter key in field input — trigger confirm
        $(document).on('keydown', '.fie-input', function(e) {
            if (e.which === 13) {
                e.preventDefault();
                $(this).closest('.field-editable').find('.fie-confirm-btn').trigger('click');
            }
        });

        // Click outside any active field edit — cancel it
        $(document).on('click.fieldEdit', function(e) {
            if ($currentFieldEdit && !$(e.target).closest('.field-editable').length) {
                closeCurrentFieldEdit();
            }
        });

        // ── Configure Engagement modal ───────────────────────────────────────

        // Close on backdrop click, X button, or Cancel
        $(document).on('click', '#ce-backdrop, #ce-close-btn, #ce-cancel-btn', closeCeModal);

        // ── Employer Research modal ──────────────────────────────────────────

        $(document).on('click', '#rp-employer-backdrop, #rp-employer-close-btn, #rp-employer-close-btn2',
            closeEmployerResearchModal);

        // ── User-Company Research modal ──────────────────────────────────────

        // Backdrop + X close → close (discards edits)
        $(document).on('click', '#rp-ll-backdrop, #rp-ll-close-btn-x', closeUserCompanyResearchModal);

        // Close button in footer → also closes (discards edits)
        $(document).on('click', '#rp-ll-close-btn', closeUserCompanyResearchModal);

        // Edit / Save / Generate button
        $(document).on('click', '#rp-ll-action-btn', function() {
            var $btn = $(this);
            if ($('#rp-ll-modal').hasClass('edit-mode')) {
                _saveLlResearch();
            } else if ($btn.hasClass('rp-btn-generate')) {
                _generateLlResearch();
            } else {
                enterLlEditMode();
            }
        });

        // Hour spinner up/down buttons
        $(document).on('click', '.ce-time-spin-btn', function() {
            var $n = $('#ce-time-num');
            var v = parseInt($n.val(), 10) || 9;
            $n.val($(this).data('dir') === 'up' ? Math.min(v + 1, 12) : Math.max(v - 1, 1));
        });

        // Stub handlers — no functionality yet, just prevent default
        $(document).on('click', '.ce-preview-btn, .ce-btn-pause, .ce-btn-delete, .ce-btn-save',
            function(e) { e.preventDefault(); });

        // Touch reorder: fade out → move one step → fade in
        $(document).on('click', '.ce-move-btn', function(e) {
            e.preventDefault();
            e.stopPropagation();
            var $item = $(this).closest('.ce-touch-item');
            var dir   = $(this).data('dir');
            // Guard against double-click during animation
            if ($item.data('ce-animating')) return;
            var $sibling = dir === 'up'
                ? $item.prev('.ce-touch-item')
                : $item.next('.ce-touch-item');
            if (!$sibling.length) return; // already at edge — silent no-op
            $item.data('ce-animating', true);
            $item.fadeTo(180, 0, function() {
                // DOM swap (item is now invisible)
                if (dir === 'up') $item.insertBefore($sibling);
                else              $item.insertAfter($sibling);
                // Fade back in at the new position
                $item.fadeTo(180, 1, function() {
                    $item.removeData('ce-animating');
                });
            });
        });

        // Prev / Next buttons
        $(document).on('click', '.panel-nav-btn', function() {
            navigateContact($(this).data('nav'));
        });

        // Accordion toggle (skip if click landed on the action link)
        $(document).on('click', '.accordion-header', function(e) {
            if ($(e.target).closest('.accordion-action').length) return;
            var $row = $(this).closest('.accordion-row');
            $row.find('.accordion-body').slideToggle(150);
            $row.toggleClass('open');
        });

        // Notes textarea — mark dirty on focus so auto-save fires on close/navigate
        $(document).on('focus', '.notes-textarea', function() {
            _notesDirty = true;
        });

        // Accordion action buttons — Add Note / Schedule / Log Call / Add Task
        $(document).on('click', '.accordion-action', function() {
            var sectionKey = $(this).data('action');
            var cd = getCurrentContactData();
            if (!cd) return;
            var cb = window.profilePanelCallbacks;
            if (cb && typeof cb.onActivityAction === 'function') {
                cb.onActivityAction(cd.id, sectionKey);
            }
        });

        // ── Email Reply viewer ────────────────────────────────────────────────

        // Clicking a reply row opens the email reply modal
        $(document).on('click', '.accordion-item--reply', function() {
            var $item = $(this);
            var idx   = $item.data('index');
            var cd    = getCurrentContactData();
            if (!cd || !cd.activityData) return;
            var arr  = cd.activityData.emailReplies;
            var item = Array.isArray(arr) ? arr[idx] : null;
            if (!item) return;
            openEmailReplyModal(item);
        });

        // Enter / Space also triggers clickable reply rows (keyboard accessibility)
        $(document).on('keydown', '.accordion-item--reply', function(e) {
            if (e.which === 13 || e.which === 32) { e.preventDefault(); $(this).trigger('click'); }
        });

        // Close email reply modal via confirm button or backdrop
        $(document).on('click', '#er-close-btn, #er-backdrop', closeEmailReplyModal);

        // ─────────────────────────────────────────────────────────────────────

        // Accordion item edit pencil
        $(document).on('click', '.accordion-item-edit', function(e) {
            e.stopPropagation();
            var $item = $(this).closest('.accordion-item');
            var sectionKey = $item.data('section');
            var idx       = $item.data('index');
            var cd = getCurrentContactData();
            if (!cd || !cd.activityData) return;
            var sectionMap = { notes: 'notes', meetings: 'meetings', calls: 'calls', reminders: 'reminders' };
            var arr  = cd.activityData[sectionMap[sectionKey]] || [];
            var item = arr[idx];
            if (!item) return;
            var cb = window.profilePanelCallbacks;
            if (cb && typeof cb.onActivityEdit === 'function') {
                cb.onActivityEdit(cd.id, sectionKey, idx, item);
            }
        });

        // ── View toggle button ───────────────────────────────────────────────

        // Click the left-border circle to switch between CRM and AI Engagement views.
        // If onToggleView is registered the host must call proceed() to allow the switch.
        $(document).on('click', '#panel-view-toggle', function(e) {
            e.stopPropagation();
            var cb  = window.profilePanelCallbacks;
            var cid = getCurrentContactData() ? getCurrentContactData().id : null;
            if (cb && typeof cb.onToggleView === 'function') {
                cb.onToggleView(cid, function() { togglePanelView(); });
            } else {
                togglePanelView();
            }
        });

        // ── AI zone / post card / draft section collapse ─────────────────────

        // Zone header click — collapse/expand entire zone
        $(document).on('click keydown', '.ai-zone-header', function(e) {
            if (e.type === 'keydown' && e.which !== 13 && e.which !== 32) return;
            if (e.type === 'keydown') e.preventDefault();
            var $zone = $(this).closest('.ai-zone');
            var closing = !$zone.hasClass('collapsed');
            $zone.toggleClass('collapsed', closing);
            $(this).attr('aria-expanded', String(!closing));
            $zone.find('> .ai-zone-body').slideToggle(150);
        });

        // Post card header click — collapse/expand individual post card
        // (guard: don't fire when clicking the Reply button inside the header)
        $(document).on('click', '.ai-post-header', function(e) {
            if ($(e.target).closest('.ai-post-reply-btn').length) return;
            var $card   = $(this).closest('.ai-post-card');
            var closing = !$card.hasClass('collapsed');
            $card.toggleClass('collapsed', closing);
            var $body  = $card.find('.ai-post-body');
            var $reply = $card.find('.ai-post-reply-area');
            if (closing) {
                $body.slideUp(150);
                if ($reply.is(':visible')) { $reply.slideUp(150); }
            } else {
                $body.slideDown(150);
                var postId    = String($card.data('post-id'));
                var postState = _aiCurrentPostStates[postId];
                if (postState && postState.state === 'done') { $reply.slideDown(150); }
            }
        });

        // Draft section header click — collapse/expand individual section
        $(document).on('click', '.ai-section-header', function() {
            var $section = $(this).closest('.ai-section');
            $section.toggleClass('collapsed');
            $section.find('> .ai-section-body').slideToggle(150);
        });

        // ── AI Reply button ───────────────────────────────────────────────────

        $(document).on('click', '.ai-post-reply-btn', function(e) {
            e.stopPropagation();
            var $btn = $(this);
            // Prevent re-triggering while generation is in progress
            if ($btn.attr('data-btn-state') === 'underway') return;
            var $card        = $btn.closest('.ai-post-card');
            var postText     = $card.find('.ai-post-text').text();
            var sourcePostId = String($btn.attr('data-post-id') || '');
            var cid          = _currentContactData ? _currentContactData.id : null;
            // Notify host — host generates replyId and calls createPostReply() + setPostReply()
            var cb = window.profilePanelCallbacks;
            if (cb && typeof cb.onReplyClick === 'function') {
                cb.onReplyClick(sourcePostId, postText, cid);
            }
        });

        // ── Post reply comment — auto-resize textarea ─────────────────────────

        $(document).on('input', '.ai-post-reply-comment', function() {
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
        });

        // ── AI Send button (email draft sections + post reply areas) ─────────

        $(document).on('click', '.ai-send-btn', function() {
            var $btn    = $(this);
            // Ignore clicks while already underway or done
            if ($btn.attr('data-btn-state') === 'underway' ||
                $btn.attr('data-btn-state') === 'done') return;
            var replyId = String($btn.data('reply-id') || '');
            var cid     = _currentContactData ? _currentContactData.id : null;
            var cb      = window.profilePanelCallbacks;

            if (replyId) {
                // Post reply Send — transition to underway, pass done() to host
                $btn.attr('data-btn-state', 'underway');
                var srcPostId = String($btn.data('source-post-id') || '');
                var subject   = $('#' + replyId + '_SUB').val();
                var comment   = $('#' + replyId + '_COM').val();
                var mountEl   = document.getElementById(replyId + '_MOUNT');
                var done = function(err) {
                    if (err) {
                        $btn.attr('data-btn-state', 'idle');
                        if (typeof err === 'string') {
                            showPanelNotification(err, { type: 'error', html: true });
                        }
                    } else {
                        $btn.attr('data-btn-state', 'done');
                    }
                };
                if (cb && typeof cb.onSendReply === 'function') {
                    cb.onSendReply(replyId, srcPostId, subject, comment, mountEl, cid, done);
                }
            } else {
                // Email draft section Send
                var sectionId = String($btn.data('section-id'));
                var subject2  = $btn.closest('.ai-section-content').find('.ai-subject-input').val();
                var mountEl2  = document.getElementById('ai-editor-mount-' + sectionId);
                if (cb && typeof cb.onSend === 'function') {
                    cb.onSend(sectionId, subject2, mountEl2, cid);
                }
            }
        });

        // ── LinkedIn About snippet popover ───────────────────────────────────

        // Click toggles the full About popover open/closed
        $(document).on('click', '#panel-about-snippet', function(e) {
            e.stopPropagation();
            var $popover = $('#panel-about-popover');
            var isOpen   = $popover.hasClass('open');
            $popover.toggleClass('open', !isOpen)
                    .attr('aria-hidden', String(isOpen));
            $(this).attr('aria-expanded', String(!isOpen));
        });

        // Keyboard activation: Enter or Space triggers click
        $(document).on('keydown', '#panel-about-snippet', function(e) {
            if (e.which === 13 || e.which === 32) {
                e.preventDefault();
                $(this).trigger('click');
            }
        });

        // ── AI+ Engagement dropdown ──────────────────────────────────────────

        // Toggle open/close on button click
        $(document).on('click', '#ai-engagement-btn', function(e) {
            e.stopPropagation();
            var $btn      = $(this);
            var $dropdown = $('#ai-engagement-dropdown');
            var isOpen    = $btn.hasClass('open');

            // Always close research + slack dropdowns when toggling engagement
            $('#ai-research-btn').removeClass('open').attr('aria-expanded', 'false');
            $('#ai-research-dropdown').removeClass('open').attr('aria-hidden', 'true');
            $('#ai-slack-btn').removeClass('open').attr('aria-expanded', 'false');
            $('#ai-slack-dropdown').removeClass('open').attr('aria-hidden', 'true');

            if (isOpen) {
                $btn.removeClass('open').attr('aria-expanded', 'false');
                $dropdown.removeClass('open').attr('aria-hidden', 'true');
            } else {
                // Left-anchor: dropdown extends rightward from button's left edge
                var rect = this.getBoundingClientRect();
                $dropdown.css({
                    top:   (rect.bottom + 4) + 'px',
                    left:  rect.left + 'px',
                    right: '',              // clear right positioning
                    width: ''
                });
                $btn.addClass('open').attr('aria-expanded', 'true');
                $dropdown.addClass('open').attr('aria-hidden', 'false');
            }
        });

        // ── AI+ Research dropdown ────────────────────────────────────────────

        // Toggle open/close on button click
        $(document).on('click', '#ai-research-btn', function(e) {
            e.stopPropagation();
            var $btn      = $(this);
            var $dropdown = $('#ai-research-dropdown');
            var isOpen    = $btn.hasClass('open');

            // Always close engagement + slack dropdowns when toggling research
            $('#ai-engagement-btn').removeClass('open').attr('aria-expanded', 'false');
            $('#ai-engagement-dropdown').removeClass('open').attr('aria-hidden', 'true');
            $('#ai-slack-btn').removeClass('open').attr('aria-expanded', 'false');
            $('#ai-slack-dropdown').removeClass('open').attr('aria-hidden', 'true');

            if (isOpen) {
                $btn.removeClass('open').attr('aria-expanded', 'false');
                $dropdown.removeClass('open').attr('aria-hidden', 'true');
            } else {
                // Left-anchor: dropdown extends rightward from button's left edge
                var rect = this.getBoundingClientRect();
                $dropdown.css({
                    top:   (rect.bottom + 4) + 'px',
                    left:  rect.left + 'px',
                    right: '',              // clear right positioning
                    width: ''
                });
                $btn.addClass('open').attr('aria-expanded', 'true');
                $dropdown.addClass('open').attr('aria-hidden', 'false');
            }
        });

        // ── Slack VSR dropdown ───────────────────────────────────────────────

        // Toggle open/close on button click (right-anchored: extends leftward)
        $(document).on('click', '#ai-slack-btn', function(e) {
            e.stopPropagation();
            var $btn      = $(this);
            var $dropdown = $('#ai-slack-dropdown');
            var isOpen    = $btn.hasClass('open');

            // Always close engagement + research dropdowns when toggling slack
            $('#ai-engagement-btn').removeClass('open').attr('aria-expanded', 'false');
            $('#ai-engagement-dropdown').removeClass('open').attr('aria-hidden', 'true');
            $('#ai-research-btn').removeClass('open').attr('aria-expanded', 'false');
            $('#ai-research-dropdown').removeClass('open').attr('aria-hidden', 'true');

            if (isOpen) {
                $btn.removeClass('open').attr('aria-expanded', 'false');
                $dropdown.removeClass('open').attr('aria-hidden', 'true');
            } else {
                // Right-anchor: dropdown extends leftward from button's right edge
                var rect = this.getBoundingClientRect();
                $dropdown.css({
                    top:   (rect.bottom + 4) + 'px',
                    right: (window.innerWidth - rect.right) + 'px',
                    left:  '',              // clear left positioning
                    width: ''
                });
                $btn.addClass('open').attr('aria-expanded', 'true');
                $dropdown.addClass('open').attr('aria-hidden', 'false');
            }
        });

        // ── Shared: close popovers/dropdowns when clicking outside ──────────

        $(document).on('click', function(e) {
            // Close About snippet popover when clicking outside snippet + popover
            if (!$(e.target).closest('#panel-about-snippet, #panel-about-popover').length) {
                $('#panel-about-popover').removeClass('open').attr('aria-hidden', 'true');
                $('#panel-about-snippet').attr('aria-expanded', 'false');
            }
            // Close all AI+ dropdowns when clicking outside their buttons/menus
            if (!$(e.target).closest('#ai-engagement-btn, #ai-engagement-dropdown, #ai-research-btn, #ai-research-dropdown, #ai-slack-btn, #ai-slack-dropdown').length) {
                $('#ai-engagement-btn').removeClass('open').attr('aria-expanded', 'false');
                $('#ai-engagement-dropdown').removeClass('open').attr('aria-hidden', 'true');
                $('#ai-research-btn').removeClass('open').attr('aria-expanded', 'false');
                $('#ai-research-dropdown').removeClass('open').attr('aria-hidden', 'true');
                $('#ai-slack-btn').removeClass('open').attr('aria-expanded', 'false');
                $('#ai-slack-dropdown').removeClass('open').attr('aria-hidden', 'true');
            }
        });

        // ── Shared: dropdown item click — handles items in both AI+ dropdowns ──

        $(document).on('click', '.ai-dropdown-item', function(e) {
            e.stopPropagation();
            var $item      = $(this);
            var aiAction   = $item.data('ai-action');
            var dropdownId = $item.closest('.ai-engagement-dropdown').attr('id');
            var _cid       = _currentContactData ? _currentContactData.id : null;

            // Close all dropdowns and their buttons
            $('#ai-engagement-btn').removeClass('open').attr('aria-expanded', 'false');
            $('#ai-engagement-dropdown').removeClass('open').attr('aria-hidden', 'true');
            $('#ai-research-btn').removeClass('open').attr('aria-expanded', 'false');
            $('#ai-research-dropdown').removeClass('open').attr('aria-hidden', 'true');
            $('#ai-slack-btn').removeClass('open').attr('aria-expanded', 'false');
            $('#ai-slack-dropdown').removeClass('open').attr('aria-hidden', 'true');

            // Configure Engagement — open modal, no auth check needed
            if (aiAction === 'configure-engagement') { openCeModal(); return; }

            // ── AI+ Engagement: Generate ALL of the above ─────────────────────
            if (dropdownId === 'ai-engagement-dropdown' && aiAction === 'generate-all') {
                _setEngagementItemState('generate-all', 'underway');
                _runAuthChecks(_cid, aiAction, function() {
                    if (panelCurrentView === 'crm') switchToAiView();
                    var cb = window.profilePanelCallbacks;
                    if (cb && typeof cb.onGenerateAll === 'function') {
                        // Auto-detect which types have already been generated so the host
                        // can skip them and avoid duplicating content.
                        var pendingTypes = [];
                        $.each((cb.aiSectionTypes || []), function(i, t) {
                            if ((t.action || t.type) === 'generate-all') return; // not a generatable draft type
                            var alreadyDone = $.grep(_aiCurrentSections, function(s) {
                                return s.type === t.type;
                            }).length > 0;
                            if (!alreadyDone) pendingTypes.push(t);
                        });
                        cb.onGenerateAll(_cid, pendingTypes);
                    }
                });
                return;
            }

            // ── AI+ Engagement: Ping LinkedIn ──────────────────────────────────
            if (dropdownId === 'ai-engagement-dropdown' && aiAction === 'ping-linkedin') {
                _setEngagementItemState('ping-linkedin', 'underway');
                _runAuthChecks(_cid, aiAction, function() {
                    if (panelCurrentView === 'crm') switchToAiView();
                    var cb = window.profilePanelCallbacks;
                    if (cb && typeof cb.onPingLinkedIn === 'function') cb.onPingLinkedIn(_cid);
                });
                return;
            }

            // ── AI+ Engagement: email draft types ─────────────────────────────
            // Build draft type map from aiSectionTypes if provided; fall back to
            // hardcoded defaults so the panel works without configuration.
            var _draftCb = window.profilePanelCallbacks;
            var _engDraftTypes;
            if (_draftCb && _draftCb.aiSectionTypes && _draftCb.aiSectionTypes.length) {
                _engDraftTypes = {};
                $.each(_draftCb.aiSectionTypes, function(i, t) {
                    var _a = t.action || t.type;
                    if (_a === 'generate-all') return; // handled by its own click branch
                    _engDraftTypes[_a] = { type: t.type, title: t.title };
                });
            } else {
                _engDraftTypes = {
                    'employer-challenges':   { type: 'employer-challenges',   title: 'Employer Challenges' },
                    'employer-competitors':  { type: 'employer-competitors',  title: 'Employer Competitors' },
                    'employer-announcement': { type: 'employer-announcement', title: 'Employer Announcement' }
                };
            }
            if (dropdownId === 'ai-engagement-dropdown' && _engDraftTypes[aiAction]) {
                var _meta = _engDraftTypes[aiAction];
                _setEngagementItemState(aiAction, 'underway');
                _runAuthChecks(_cid, aiAction, function() {
                    if (panelCurrentView === 'crm') switchToAiView();
                    var cb = window.profilePanelCallbacks;
                    if (cb && typeof cb.onGenerateDraft === 'function') {
                        cb.onGenerateDraft(aiAction, _meta.type, _meta.title, _cid);
                    }
                });
                return;
            }

            // ── AI+ Research: Employer Research ───────────────────────────────
            if (dropdownId === 'ai-research-dropdown' && aiAction === 'employer-research') {
                _runAuthChecks(_cid, aiAction, function() {
                    var cb = window.profilePanelCallbacks;
                    if (cb && typeof cb.onLoadResearch === 'function' && _currentContactData) {
                        // Fetch first, open only when content is ready — avoids resize flash
                        cb.onLoadResearch(_currentContactData.id, function(html) {
                            loadPanelResearch(html);
                            openEmployerResearchModal(_currentContactData || {});
                        });
                    } else {
                        openEmployerResearchModal(_currentContactData || {});
                    }
                });
                return;
            }

            // ── AI+ Research: User-Company Research ──────────────────────────
            if (dropdownId === 'ai-research-dropdown' && aiAction === 'user-company-research') {
                _runAuthChecks(_cid, aiAction, function() {
                    openUserCompanyResearchModal();
                });
                return;
            }

            // ── Slack VSR (no auth check) ──────────────────────────────────────
            if (dropdownId === 'ai-slack-dropdown' && aiAction === 'post-vsr-channel') {
                if ($('#ai-slack-dropdown').attr('data-state') === 'start') setAiSlackState('active');
            }

            console.log('[AI+] dropdown:', dropdownId, '| action:', aiAction);
        });
    }

    window.showLinkedInPosts           = showLinkedInPosts;
    window.showSavedPosts              = _showSavedPosts;
    window.setAbout                    = setAbout;
    window.createPostReply             = createPostReply;
    window.setPostReply                = setPostReply;
    window.getAiSnapshot               = getAiSnapshot;
    window.restoreAiState              = restoreAiState;
    window.clearAiStateCache           = clearAiStateCache;
    window.updateLinkedInPost          = updateLinkedInPost;  // legacy — prefer setPostReply
    window.addAiSection                = addAiSection;
    window.updateAiSection             = updateAiSection;
    window.removeAiSection             = removeAiSection;
    window.clearAiSections             = clearAiSections;
    window.showPanelNotification       = showPanelNotification;
    window.hidePanelNotification       = hidePanelNotification;
    window.openProfilePanel            = openProfilePanel;
    window.closeProfilePanel           = closeProfilePanel;
    window.openCeModal                 = openCeModal;
    window.closeCeModal                = closeCeModal;
    window.openEmployerResearchModal   = openEmployerResearchModal;
    window.closeEmployerResearchModal  = closeEmployerResearchModal;
    window.openEmailReplyModal         = openEmailReplyModal;
    window.closeEmailReplyModal        = closeEmailReplyModal;
    window.openUserCompanyResearchModal    = openUserCompanyResearchModal;
    window.closeUserCompanyResearchModal   = closeUserCompanyResearchModal;
    // Direct-call equivalent of the onLoadUserCompanyResearch done() callback.
    // Opens the modal automatically if not already open, then renders content.
    // Same contract as done(): supply exactly one of html or message (not both, not neither).
    window.loadUserCompanyResearchContent  = _renderUserCompanyResearch;
    window.enterLlEditMode                 = enterLlEditMode;
    window.exitLlEditMode                  = exitLlEditMode;
    window.updatePanelContent          = updatePanelContent;
    window.loadPanelActivity           = loadPanelActivity;
    window.loadPanelResearch           = loadPanelResearch;
    window.navigateContact             = navigateContact;
    window.setupPanelHandlers          = setupPanelHandlers;
    window.populateEngagementDropdown  = _populateEngagementDropdown;
    window.setAiEngagementState        = setAiEngagementState;
    window.setAiSlackState             = setAiSlackState;
    window.setAiItemState              = _setEngagementItemState;  // manual per-item control (engagement)
    window.setResearchItemState        = setResearchItemState;     // manual per-item control (research)
    window.switchToAiView              = switchToAiView;
    window.switchToCrmView             = switchToCrmView;
    window.togglePanelView             = togglePanelView;
    // Field data / edit helpers
    window.extractEditableFields       = extractEditableFields;

    $(document).ready(function() { setupPanelHandlers(); });

})(jQuery);
