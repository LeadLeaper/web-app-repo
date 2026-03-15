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
    const BADGE_STYLE = 'b';

    // ─── AI Engagement view state ─────────────────────────────────────────────
    var panelCurrentView = 'crm';   // 'crm' | 'ai'
    var quillsInitialized = false;  // lazy-init Quill editors on first AI view open

    // ─── Per-field inline edit state ─────────────────────────────────────────
    var $currentFieldEdit = null;   // the .field-editable currently being edited

    // ─── Current contact reference ────────────────────────────────────────────
    var _currentContactData = null; // full contactData object for the displayed contact

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
    //   onLoadActivity(contactId, done)
    //     Fired after the panel renders with basic contact info. Fetch and return
    //     activity data by calling done({ notes, meetings, calls, reminders,
    //     emailReplies, emailLinksViewed, emailsSent }).
    //
    //   onLoadResearch(contactId, done)
    //     Fired when the Employer Research modal is opened and no cached data
    //     exists yet. Fetch and return the HTML string by calling done(htmlString).
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
    window.profilePanelCallbacks = {
        onChange         : null,   // function(contactId, fieldName, newValue)
        onSave           : null,   // function(contactId, patch, done)
        onClose          : null,   // function(contactId)
        onNext           : null,   // function(currentContactId, done)
        onPrev           : null,   // function(currentContactId, done)
        onLoadActivity   : null,   // function(contactId, done)
        onLoadResearch   : null,   // function(contactId, done)
        onActivityAction : null,   // function(contactId, sectionKey)
        onActivityEdit   : null    // function(contactId, sectionKey, itemIndex, item)
    };

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
                .addClass(statusCfg.cls + ' badge-style-' + BADGE_STYLE)
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
        // Use cached activity data if already loaded for this contact (e.g. same-contact
        // refresh), otherwise fire the async callback and cache the result on arrival.
        if (contactData.activityData !== undefined) {
            loadPanelActivity(contactData.activityData);
            return;
        }
        var cb = window.profilePanelCallbacks;
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
        // Accept both array (new) and plain number (legacy) for email sections
        function emailItems(val) { return Array.isArray(val) ? val : null; }
        function emailCount(val) { return typeof val === 'number' ? val : 0; }
        var sections = [
            { key: 'notes',        label: 'Notes',             action: 'Add Note', items: ad.notes     || [] },
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
            var count = section.items ? section.items.length : (section.count || 0);
            var actionLink = section.action
                ? '<button type="button" class="accordion-action" data-action="' + section.key + '">' + section.action + '</button>'
                : '';

            html += '<div class="accordion-row" data-section="' + section.key + '">';
            html += '<div class="accordion-header">';
            html += '<span class="accordion-title">' + escHtml(section.label) +
                    ' <span class="accordion-count">(' + count + ')</span></span>';
            html += '<div class="accordion-header-right">' + actionLink + CHEVRON_SVG + '</div>';
            html += '</div>'; // .accordion-header

            html += '<div class="accordion-body">';
            if (section.items && section.items.length > 0) {
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

    // Replaces the skeleton (or existing accordion) with fully rendered activity data.
    // Also caches the data on the current contact so same-contact refreshes skip
    // the onLoadActivity callback entirely.
    // Called by the host via the onLoadActivity done() callback.
    function loadPanelActivity(activityData) {
        var $accordion = $('.activity-accordion');
        if (!$accordion.length) return;
        if (_currentContactData && _currentContactData.activityData === undefined) {
            _currentContactData.activityData = activityData;
        }
        $accordion.replaceWith(buildActivityAccordionHTML(activityData));
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

    // Patches the Employer Research modal with fetched HTML and caches it on the
    // current contact so subsequent opens don't re-fire onLoadResearch.
    // Called by the host via the onLoadResearch done() callback.
    function loadPanelResearch(htmlString) {
        if (_currentContactData) {
            _currentContactData.employerResearch = htmlString;
        }
        var content = htmlString ||
            '<div class="rp-section"><p style="color:#a3a3a3;font-size:13px;">' +
            'No employer research available for this contact yet.</p></div>';
        $('#rp-employer-content').html(content);
        $('#rp-employer-modal .rp-body').scrollTop(0);
    }

    // ─── Core panel behaviors ────────────────────────────────────────────────

    // ① Slide in → spinner → fade in on initial open; refresh/switch routing when already open
    function openProfilePanel(contactData) {
        var $panel = $('.profile-panel');
        _currentContactData = contactData;
        if ($panel.hasClass('open')) {
            updatePanelContent(contactData); // behaviors 2 & 3
            return;
        }
        $panel.data('contact-id', contactData.id);
        $panel.addClass('open');             // slide in (behavior 1)
        $('#panel-view-toggle').addClass('visible');
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
        _currentContactData = contactData;
        var $panel = $('.profile-panel');
        var $content = $('.profile-content');

        // If currently in AI Engagement view, reset back to CRM view before loading the new
        // contact. updatePanelContent() renders into .profile-content (the CRM container);
        // jQuery's fadeIn() sets display:block inline, which overrides the CSS display:none
        // applied by .ai-view-active — causing both views to appear simultaneously.
        if (panelCurrentView === 'ai') {
            switchToCrmView();
            if (quillsInitialized) {
                $('.ai-editor').empty();
                quillsInitialized = false;
            }
            // Reset AI section collapse states
            $('.ai-section').removeClass('collapsed');
            $('.ai-section-toggle').text('hide').attr('data-state', 'visible');
            $('.ai-post-block').addClass('collapsed');
            $('.ai-post-block-toggle').text('show more').attr('aria-label', 'Show post text');
            $('.ai-comment-textarea').val('').each(function() { this.style.height = ''; });
            // Close and reset all AI+ dropdown states
            $('#ai-engagement-btn').removeClass('open').attr('aria-expanded', 'false');
            $('#ai-engagement-dropdown').removeClass('open').attr('aria-hidden', 'true').attr('data-state', 'start');
            $('#ai-research-btn').removeClass('open').attr('aria-expanded', 'false');
            $('#ai-research-dropdown').removeClass('open').attr('aria-hidden', 'true').attr('data-state', 'start');
            $('#ai-slack-btn').removeClass('open').attr('aria-expanded', 'false');
            $('#ai-slack-dropdown').removeClass('open').attr('aria-hidden', 'true').attr('data-state', 'start');
        }

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

        // Cancel any in-progress field edit silently before closing
        closeCurrentFieldEdit();

        $panel.removeClass('open');
        $('#panel-view-toggle').removeClass('visible ai-view');
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
        $('#ai-research-dropdown')
            .removeClass('open')
            .attr('aria-hidden', 'true')
            .attr('data-state', 'start');
        $('#ai-slack-btn').removeClass('open').attr('aria-expanded', 'false');
        $('#ai-slack-dropdown')
            .removeClass('open')
            .attr('aria-hidden', 'true')
            .attr('data-state', 'start');
        // Reset AI view: switch back to CRM, clear Quill editor DOM for fresh init
        switchToCrmView();
        if (quillsInitialized) {
            $('.ai-editor').empty();
            quillsInitialized = false;
        }
        // Reset all AI section states
        $('.ai-section').removeClass('collapsed');
        $('.ai-section-toggle').text('hide').attr('data-state', 'visible');
        // Post-block collapses back to default (article text hidden, comment textarea visible)
        $('.ai-post-block').addClass('collapsed');
        $('.ai-post-block-toggle').text('show more').attr('aria-label', 'Show post text');
        // Clear and reset comment textarea height
        $('.ai-comment-textarea').val('').each(function() { this.style.height = ''; });

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

    // Switch AI+ Research dropdown between 'start' and 'active' states
    function setAiResearchState(state) {
        $('#ai-research-dropdown').attr('data-state', state);
    }

    // Switch Slack VSR dropdown between 'start' and 'active' states
    function setAiSlackState(state) {
        $('#ai-slack-dropdown').attr('data-state', state);
    }

    // ─── AI Engagement view switching ────────────────────────────────────────

    // Switch panel to AI Engagement view (expand width, show AI content)
    function switchToAiView() {
        var $panel = $('.profile-panel');
        $panel.addClass('ai-view-active');
        $('#panel-view-toggle')
            .addClass('ai-view')
            .attr('aria-label', 'Switch to CRM view')
            .attr('title', 'Switch to CRM view');
        panelCurrentView = 'ai';
        if (!quillsInitialized) initQuillEditors();
    }

    // Switch panel back to CRM view (contract width, show CRM content)
    function switchToCrmView() {
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
        $('#rp-employer-subtitle').text(company ? '· ' + company : '');
        var content = (contactData && contactData.employerResearch) || '';
        if (!content) {
            content = '<div class="rp-section"><p class="rp-empty-state">No employer research available for this contact yet.</p></div>';
        }
        $('#rp-employer-content').html(content);
        // Reset scroll to top
        $('#rp-employer-modal .rp-body').scrollTop(0);
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

    // ─── LeadLeaper Research modal ───────────────────────────────────────────

    function openLeadLeaperResearchModal() {
        // Ensure we open in view mode (reset any lingering edit state)
        exitLlEditMode(false);
        $('#rp-ll-modal .rp-body').scrollTop(0);
        $('#rp-ll-modal').addClass('open').attr('aria-hidden', 'false');
        $('#rp-ll-backdrop').addClass('open');
        setTimeout(function() {
            var btn = document.getElementById('rp-ll-close-btn-x');
            if (btn) btn.focus();
        }, 50);
    }

    function closeLeadLeaperResearchModal() {
        exitLlEditMode(false);   // discard any unsaved edits
        $('#rp-ll-modal').removeClass('open').attr('aria-hidden', 'true');
        $('#rp-ll-backdrop').removeClass('open');
    }

    function enterLlEditMode() {
        // Store original HTML of each editable field so we can revert on cancel
        $('#rp-ll-modal .rp-editable').each(function() {
            $(this).data('ll-original', $(this).html());
        });
        $('#rp-ll-modal').addClass('edit-mode');
        $('#rp-ll-modal .rp-editable').attr('contenteditable', 'true');
        $('#rp-ll-action-btn')
            .text('Save')
            .removeClass('ce-btn-save')
            .addClass('rp-btn-save-green');
        // Focus the first editable field
        $('#rp-ll-modal .rp-editable').first().focus();
    }

    function exitLlEditMode(save) {
        if (!$('#rp-ll-modal').hasClass('edit-mode')) return;
        if (!save) {
            // Revert each field to its original HTML
            $('#rp-ll-modal .rp-editable').each(function() {
                var orig = $(this).data('ll-original');
                if (orig !== undefined) $(this).html(orig);
            });
        }
        // Clear stored originals
        $('#rp-ll-modal .rp-editable').removeData('ll-original').blur();
        $('#rp-ll-modal').removeClass('edit-mode');
        $('#rp-ll-modal .rp-editable').attr('contenteditable', 'false');
        $('#rp-ll-action-btn')
            .text('Edit')
            .removeClass('rp-btn-save-green')
            .addClass('ce-btn-save');
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

    // ⑤ All panel event handlers
    function setupPanelHandlers() {
        // ESC to close — modals take priority over panel
        $(document).on('keydown', function(e) {
            if (e.which === 27) {
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

        // ── LeadLeaper Research modal ────────────────────────────────────────

        // Backdrop + X close → close (discards edits)
        $(document).on('click', '#rp-ll-backdrop, #rp-ll-close-btn-x', closeLeadLeaperResearchModal);

        // Close button in footer → also closes (discards edits)
        $(document).on('click', '#rp-ll-close-btn', closeLeadLeaperResearchModal);

        // Edit / Save toggle button
        $(document).on('click', '#rp-ll-action-btn', function() {
            if ($('#rp-ll-modal').hasClass('edit-mode')) {
                exitLlEditMode(true);   // save changes
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

        // Click the left-border circle to switch between CRM and AI Engagement views
        $(document).on('click', '#panel-view-toggle', function(e) {
            e.stopPropagation();
            togglePanelView();
        });

        // ── AI section show/hide ─────────────────────────────────────────────

        // Section-level toggle (all 4 AI engagement sections)
        $(document).on('click', '.ai-section-toggle', function() {
            var $section = $(this).closest('.ai-section');
            var isCollapsed = $section.hasClass('collapsed');
            $section.toggleClass('collapsed', !isCollapsed);
            $(this).text(isCollapsed ? 'hide' : 'show')
                   .attr('data-state', isCollapsed ? 'visible' : 'hidden');
        });

        // LinkedIn post content sub-section toggle (show/hide post text independently)
        $(document).on('click', '.ai-post-block-toggle', function() {
            var $block = $(this).closest('.ai-post-block');
            var isCollapsed = $block.hasClass('collapsed');
            $block.toggleClass('collapsed', !isCollapsed);
            $(this).text(isCollapsed ? 'show less' : 'show more')
                   .attr('aria-label', isCollapsed ? 'Hide post text' : 'Show post text');
        });

        // Auto-resize LinkedIn comment textarea (vertical only) on user input
        $(document).on('input', '.ai-comment-textarea', function() {
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
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
            var $item        = $(this);
            var aiAction     = $item.data('ai-action');
            var dropdownId   = $item.closest('.ai-engagement-dropdown').attr('id');

            // Close all dropdowns and their buttons
            $('#ai-engagement-btn').removeClass('open').attr('aria-expanded', 'false');
            $('#ai-engagement-dropdown').removeClass('open').attr('aria-hidden', 'true');
            $('#ai-research-btn').removeClass('open').attr('aria-expanded', 'false');
            $('#ai-research-dropdown').removeClass('open').attr('aria-hidden', 'true');
            $('#ai-slack-btn').removeClass('open').attr('aria-expanded', 'false');
            $('#ai-slack-dropdown').removeClass('open').attr('aria-hidden', 'true');

            // Configure Engagement — open modal, skip all other logic
            if (aiAction === 'configure-engagement') { openCeModal(); return; }

            // Demo state toggles
            if (dropdownId === 'ai-engagement-dropdown' && aiAction === 'ping-linkedin') {
                var currentState = $('#ai-engagement-dropdown').attr('data-state');
                if (currentState === 'start') setAiEngagementState('active');
            }
            if (dropdownId === 'ai-research-dropdown' && aiAction === 'employer-research') {
                var currentState = $('#ai-research-dropdown').attr('data-state');
                if (currentState === 'start') setAiResearchState('active');
                // Open modal immediately (may already have cached employerResearch HTML)
                openEmployerResearchModal(_currentContactData || {});
                // Fire async load only if not already fetched (undefined = never loaded;
                // null/'' = loaded with no data — both are valid cached states)
                var cbR = window.profilePanelCallbacks;
                if (_currentContactData &&
                    _currentContactData.employerResearch === undefined &&
                    cbR && typeof cbR.onLoadResearch === 'function') {
                    cbR.onLoadResearch(_currentContactData.id, function(html) {
                        loadPanelResearch(html);
                    });
                }
            }
            if (dropdownId === 'ai-research-dropdown' && aiAction === 'leadleaper-research') {
                openLeadLeaperResearchModal();
            }
            if (dropdownId === 'ai-slack-dropdown' && aiAction === 'post-vsr-channel') {
                var currentState = $('#ai-slack-dropdown').attr('data-state');
                if (currentState === 'start') setAiSlackState('active');
            }

            // Auto-switch to AI Engagement view when an AI+ Engagement action is triggered
            if (dropdownId === 'ai-engagement-dropdown' && aiAction !== 'configure-engagement') {
                if (panelCurrentView === 'crm') switchToAiView();
            }

            // TODO: dispatch aiAction to appropriate handler
            console.log('[AI+] dropdown:', dropdownId, '| action:', aiAction);
        });
    }

    window.openProfilePanel            = openProfilePanel;
    window.closeProfilePanel           = closeProfilePanel;
    window.openCeModal                 = openCeModal;
    window.closeCeModal                = closeCeModal;
    window.openEmployerResearchModal   = openEmployerResearchModal;
    window.closeEmployerResearchModal  = closeEmployerResearchModal;
    window.openEmailReplyModal         = openEmailReplyModal;
    window.closeEmailReplyModal        = closeEmailReplyModal;
    window.openLeadLeaperResearchModal = openLeadLeaperResearchModal;
    window.closeLeadLeaperResearchModal= closeLeadLeaperResearchModal;
    window.enterLlEditMode             = enterLlEditMode;
    window.exitLlEditMode              = exitLlEditMode;
    window.updatePanelContent          = updatePanelContent;
    window.loadPanelActivity           = loadPanelActivity;
    window.loadPanelResearch           = loadPanelResearch;
    window.navigateContact             = navigateContact;
    window.setupPanelHandlers          = setupPanelHandlers;
    window.setAiEngagementState        = setAiEngagementState;
    window.setAiResearchState          = setAiResearchState;
    window.setAiSlackState             = setAiSlackState;
    window.switchToAiView              = switchToAiView;
    window.switchToCrmView             = switchToCrmView;
    window.togglePanelView             = togglePanelView;
    // Field data / edit helpers
    window.extractEditableFields       = extractEditableFields;

    $(document).ready(function() { setupPanelHandlers(); });

})(jQuery);
