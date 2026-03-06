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

    // ─── Identity card ───────────────────────────────────────────────────────

    function updatePanelIdentity(contactData) {
        const $identity = $('.panel-identity');
        if (!$identity.length) return;
        $identity.find('.panel-photo')
            .attr('src', contactData.photo || '')
            .attr('alt', contactData.name || '');
        $identity.find('.panel-name').text(contactData.name || '');
        $identity.find('.panel-badge-live').toggleClass('hidden', !contactData.isLive);
        $identity.find('.panel-company').text(contactData.company || '');
        $identity.find('.panel-title-text').text(contactData.title || '');
    }

    // ─── Main content renderer ───────────────────────────────────────────────

    function renderMainContent(contactData) {
        const $content = $('.profile-content');
        $content.html(
            buildContactDetailsHTML(contactData) +
            buildActivityAccordionHTML(contactData)
        );
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

    // Contact details card (location, email, phone, URLs, social, lead owner)
    function buildContactDetailsHTML(contactData) {
        let rows = '';

        // Detail fields: email → mailto link, phone → tel link, url → ext link, text → plain
        (contactData.details || []).forEach(function(item) {
            if (!item.value) return;
            let valueHTML;
            if (item.type === 'email') {
                valueHTML = '<a href="mailto:' + escHtml(item.value) + '" class="detail-link">' + escHtml(item.value) + '</a>';
            } else if (item.type === 'phone') {
                valueHTML = '<a href="tel:' + escHtml(item.value.replace(/\s/g,'')) + '" class="detail-link">' + escHtml(item.value) + '</a>';
            } else if (item.type === 'url') {
                valueHTML = '<a href="' + escHtml(item.value) + '" target="_blank" rel="noopener" class="detail-link detail-link-ext">' + escHtml(item.value) + EXT_ICON + '</a>';
            } else {
                valueHTML = '<span class="detail-plain">' + escHtml(item.value) + '</span>';
            }
            rows += '<div class="detail-row">' + valueHTML + '</div>';
        });

        // Website from companyInfo (type: url)
        (contactData.companyInfo || []).filter(function(i) { return i.type === 'url'; }).forEach(function(item) {
            rows += '<div class="detail-row"><a href="' + escHtml(item.value) + '" target="_blank" rel="noopener" class="detail-link detail-link-ext">' + escHtml(item.value) + EXT_ICON + '</a></div>';
        });

        // Social links
        (contactData.socialLinks || []).forEach(function(item) {
            rows += '<div class="detail-row"><a href="' + escHtml(item.url) + '" target="_blank" rel="noopener" class="detail-link detail-link-ext">' + escHtml(item.url) + EXT_ICON + '</a></div>';
        });

        // Lead owner + created date
        if (contactData.leadOwner) {
            rows += '<div class="detail-row detail-row-meta"><span class="detail-label">Lead Owner:</span> <span class="detail-plain">' + escHtml(contactData.leadOwner) + '</span></div>';
        }
        if (contactData.createdAt) {
            rows += '<div class="detail-row detail-row-meta"><span class="detail-muted">' + escHtml(contactData.createdAt) + '</span></div>';
        }

        return rows ? '<div class="contact-details-card">' + rows + '</div>' : '';
    }

    // Activity accordion (notes, meetings, calls, reminders, email metrics)
    function buildActivityAccordionHTML(contactData) {
        const sections = [
            { key: 'notes',        label: 'Notes',             action: 'Add Note', items: contactData.notes     || [] },
            { key: 'meetings',     label: 'Meetings',          action: 'Schedule', items: contactData.meetings  || [] },
            { key: 'calls',        label: 'Calls',             action: 'Log Call', items: contactData.calls     || [] },
            { key: 'reminders',    label: 'Tasks / Reminders', action: 'Add Task', items: contactData.reminders || [] },
            { key: 'email-replies', label: 'Email Replies',      action: null, count: contactData.emailReplies     || 0 },
            { key: 'email-links',   label: 'Email Links Viewed', action: null, count: contactData.emailLinksViewed || 0 },
            { key: 'emails-sent',   label: 'Emails Sent',        action: null, count: contactData.emailsSent       || 0 }
        ];

        let html = '<div class="activity-accordion">' +
            '<div class="panel-section-label">Engagement History</div>';
        sections.forEach(function(section) {
            const count = section.items ? section.items.length : (section.count || 0);
            const actionLink = section.action
                ? '<a class="accordion-action" data-action="' + section.key + '" href="#">' + section.action + '</a>'
                : '';

            html += '<div class="accordion-row" data-section="' + section.key + '">';
            html += '<div class="accordion-header">';
            html += '<span class="accordion-title">' + escHtml(section.label) +
                    ' <span class="accordion-count">(' + count + ')</span></span>';
            html += '<div class="accordion-header-right">' + actionLink + CHEVRON_SVG + '</div>';
            html += '</div>'; // .accordion-header

            html += '<div class="accordion-body">';
            if (section.items && section.items.length > 0) {
                section.items.forEach(function(item) {
                    html += buildAccordionItemHTML(section.key, item);
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

    function buildAccordionItemHTML(sectionKey, item) {
        let date = '', desc = '';
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
            default:
                desc = JSON.stringify(item);
        }
        return '<div class="accordion-item">' +
            (date ? '<span class="accordion-item-date">' + escHtml(date) + '</span>' : '') +
            '<span class="accordion-item-desc">' + escHtml(desc) + '</span>' +
            '</div>';
    }

    // ─── Core panel behaviors ────────────────────────────────────────────────

    // ① Slide in → spinner → fade in on initial open; refresh/switch routing when already open
    function openProfilePanel(contactData, contactList) {
        const $panel = $('.profile-panel');
        if (contactList && Array.isArray(contactList)) {
            window.currentContactList = contactList;
        }
        if ($panel.hasClass('open')) {
            updatePanelContent(contactData); // behaviors 2 & 3
            return;
        }
        $panel.data('contact-id', contactData.id);
        $panel.addClass('open');             // slide in (behavior 1)
        const $content = $('.profile-content');
        $content.hide().html('<div class="loading-spinner"></div>').show();
        setTimeout(function() {
            updatePanelIdentity(contactData);
            renderMainContent(contactData);
            $content.hide().fadeIn(200);
        }, 400);
    }

    // ② Fade out → spinner → fade in (behaviors 2 & 3)
    function updatePanelContent(contactData) {
        const $panel = $('.profile-panel');
        const $content = $('.profile-content');
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

    // ③ Prev/next with wrap-around
    function navigateContact(direction) {
        const $panel = $('.profile-panel');
        const currentId = $panel.data('contact-id');
        const contacts = window.currentContactList || [];
        if (!contacts.length) return;
        const idx = contacts.findIndex(c => c.id === currentId);
        if (idx === -1) return;
        const next = direction === 'next'
            ? (idx + 1) % contacts.length
            : (idx - 1 + contacts.length) % contacts.length;
        updatePanelContent(contacts[next]);
    }

    // ④ Slide out + clear
    function closeProfilePanel() {
        const $panel = $('.profile-panel');
        if (!$panel.hasClass('open')) return;
        $panel.removeClass('open');
        // Close any open AI+ dropdown and reset its state to "start"
        $('#ai-engagement-btn').removeClass('open').attr('aria-expanded', 'false');
        $('#ai-engagement-dropdown')
            .removeClass('open')
            .attr('aria-hidden', 'true')
            .attr('data-state', 'start');
        setTimeout(function() {
            $('.profile-content').html('');
            $panel.removeData('contact-id');
        }, ANIMATION_DURATION);
    }

    // Switch AI+ dropdown between 'start' and 'active' states
    function setAiEngagementState(state) {
        $('#ai-engagement-dropdown').attr('data-state', state);
    }

    // ⑤ All panel event handlers
    function setupPanelHandlers() {
        // ESC to close
        $(document).on('keydown', function(e) {
            const $panel = $('.profile-panel');
            if (e.which === 27 && $panel.hasClass('open')) closeProfilePanel();
        });

        // Close button
        $(document).on('click', '.panel-close-btn', function() {
            closeProfilePanel();
        });

        // Prev / Next buttons
        $(document).on('click', '.panel-nav-btn', function() {
            navigateContact($(this).data('nav'));
        });

        // Accordion toggle (skip if click landed on the action link)
        $(document).on('click', '.accordion-header', function(e) {
            if ($(e.target).closest('.accordion-action').length) return;
            const $row = $(this).closest('.accordion-row');
            $row.find('.accordion-body').slideToggle(150);
            $row.toggleClass('open');
        });

        // Accordion action links (prevent default; behaviour wired later)
        $(document).on('click', '.accordion-action', function(e) {
            e.preventDefault();
        });

        // ── AI+ Engagement dropdown ──────────────────────────────────────────

        // Toggle open/close on button click
        $(document).on('click', '#ai-engagement-btn', function(e) {
            e.stopPropagation();
            const $btn      = $(this);
            const $dropdown = $('#ai-engagement-dropdown');
            const isOpen    = $btn.hasClass('open');

            if (isOpen) {
                $btn.removeClass('open').attr('aria-expanded', 'false');
                $dropdown.removeClass('open').attr('aria-hidden', 'true');
            } else {
                // Anchor to button's left edge; min-width matches button so content can expand
                const rect = this.getBoundingClientRect();
                $dropdown.css({
                    top:      (rect.bottom + 4) + 'px',
                    left:     rect.left + 'px',
                    minWidth: rect.width + 'px',
                    width:    ''              // clear any previously set fixed width
                });
                $btn.addClass('open').attr('aria-expanded', 'true');
                $dropdown.addClass('open').attr('aria-hidden', 'false');
            }
        });

        // Close when clicking outside the button or dropdown
        $(document).on('click', function(e) {
            if (!$(e.target).closest('#ai-engagement-btn, #ai-engagement-dropdown').length) {
                $('#ai-engagement-btn').removeClass('open').attr('aria-expanded', 'false');
                $('#ai-engagement-dropdown').removeClass('open').attr('aria-hidden', 'true');
            }
        });

        // Dropdown item click — close dropdown; actions dispatched by aiAction value
        $(document).on('click', '.ai-dropdown-item', function(e) {
            e.stopPropagation();
            const aiAction = $(this).data('ai-action');
            $('#ai-engagement-btn').removeClass('open').attr('aria-expanded', 'false');
            $('#ai-engagement-dropdown').removeClass('open').attr('aria-hidden', 'true');

            // Demo: "Ping LinkedIn for posts" in starting state triggers active state
            // (represents AI completing LinkedIn ping + generating all 4 email drafts)
            if (aiAction === 'ping-linkedin') {
                const currentState = $('#ai-engagement-dropdown').attr('data-state');
                if (currentState === 'start') {
                    setAiEngagementState('active');
                }
            }

            // TODO: dispatch aiAction to appropriate handler
            console.log('[AI+ Engagement] action:', aiAction, '| state:', $('#ai-engagement-dropdown').attr('data-state'));
        });
    }

    window.openProfilePanel      = openProfilePanel;
    window.closeProfilePanel     = closeProfilePanel;
    window.updatePanelContent    = updatePanelContent;
    window.navigateContact       = navigateContact;
    window.setupPanelHandlers    = setupPanelHandlers;
    window.setAiEngagementState  = setAiEngagementState;

    $(document).ready(function() { setupPanelHandlers(); });

})(jQuery);
