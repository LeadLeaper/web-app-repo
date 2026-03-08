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

    // ─── AI Engagement view state ─────────────────────────────────────────────
    let panelCurrentView = 'crm';   // 'crm' | 'ai'
    let quillsInitialized = false;  // lazy-init Quill editors on first AI view open

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
        // Populate LinkedIn About snippet + popover (shown only in AI view via CSS)
        const about = contactData.about || '';
        $('#panel-about-text').text(about);
        $('#panel-about-popover-text').text(about);
        // Ensure popover is closed when contact changes
        $('#panel-about-popover').removeClass('open').attr('aria-hidden', 'true');
        $('#panel-about-snippet').attr('aria-expanded', 'false');
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
        $('#panel-view-toggle').addClass('visible');
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
        $('#panel-view-toggle').removeClass('visible ai-view');
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

        setTimeout(function() {
            $('.profile-content').html('');
            $panel.removeData('contact-id');
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
        const $panel = $('.profile-panel');
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
        const $panel = $('.profile-panel');
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
        const toolbarOptions = [
            ['bold', 'italic', 'underline'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['code-block'],
            ['clean']
        ];
        const demoContent = {
            linkedin:     '<p>Hi Sarah,</p><p>Great post about mastering peak seasons in iGaming and Betting. Your insights on leveraging key CX metrics, data-driven forecasting, and AI-driven tools highlight how the platform empowers operators to maintain top-notch player experiences when pressure peaks. It\'s a strategic approach that can truly redefine support readiness during critical moments.</p>',
            challenges:   '<p>Hi Sarah,</p><p>Growing competition from language schools and the surge in online platforms have likely put pressure on Zendesk to maintain consistent student satisfaction while managing teacher transitions. Streamlining outreach to schools, educators, and decision-makers using verified contacts can help Zendesk expand its influence and adopt more personalized, timely engagement to stay ahead.</p>',
            competitors:  '<p>Hi Sarah,</p><p>I wanted to share how our approach differs from the solutions your team may currently be evaluating. LeadLeaper\'s verified contact data and AI-powered engagement tools are purpose-built for sales teams that need to move fast without sacrificing accuracy or personalization. I\'d love to show you how teams like yours are seeing results in their first week.</p>',
            announcement: '<p>Hi Sarah,</p><p>I wanted to reach out with some exciting news that I think could be a great fit for your team at Zendesk. We\'ve just launched a new capability that directly addresses the challenges we discussed around pipeline visibility and engagement velocity — and early results from similar teams have been very promising.</p>'
        };
        ['linkedin', 'challenges', 'competitors', 'announcement'].forEach(function(key) {
            const el = document.getElementById('ai-editor-' + key);
            if (!el || el.querySelector('.ql-container')) return; // already initialized
            const quill = new Quill(el, {
                theme: 'snow',
                modules: { toolbar: toolbarOptions },
                placeholder: 'AI-generated draft will appear here\u2026'
            });
            quill.clipboard.dangerouslyPasteHTML(demoContent[key] || '');
        });
        quillsInitialized = true;

        // Populate the LinkedIn comment textarea with demo content and auto-size it
        const commentEl = document.getElementById('ai-comment-linkedin');
        if (commentEl && !commentEl.value) {
            commentEl.value = 'Great post on the challenges of demand peaks.';
            commentEl.style.height = 'auto';
            commentEl.style.height = commentEl.scrollHeight + 'px';
        }

        console.log('[AI View] Quill editors initialized');
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
        // ESC to close — modal takes priority over panel
        $(document).on('keydown', function(e) {
            if (e.which === 27) {
                if ($('#ce-modal').hasClass('open')) { closeCeModal(); return; }
                var $panel = $('.profile-panel');
                if ($panel.hasClass('open')) closeProfilePanel();
            }
        });

        // Close button
        $(document).on('click', '.panel-close-btn', function() {
            closeProfilePanel();
        });

        // ── Configure Engagement modal ───────────────────────────────────────

        // Close on backdrop click, X button, or Cancel
        $(document).on('click', '#ce-backdrop, #ce-close-btn, #ce-cancel-btn', closeCeModal);

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
            const $row = $(this).closest('.accordion-row');
            $row.find('.accordion-body').slideToggle(150);
            $row.toggleClass('open');
        });

        // Accordion action links (prevent default; behaviour wired later)
        $(document).on('click', '.accordion-action', function(e) {
            e.preventDefault();
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
            const $section = $(this).closest('.ai-section');
            const isCollapsed = $section.hasClass('collapsed');
            $section.toggleClass('collapsed', !isCollapsed);
            $(this).text(isCollapsed ? 'hide' : 'show')
                   .attr('data-state', isCollapsed ? 'visible' : 'hidden');
        });

        // LinkedIn post content sub-section toggle (show/hide post text independently)
        $(document).on('click', '.ai-post-block-toggle', function() {
            const $block = $(this).closest('.ai-post-block');
            const isCollapsed = $block.hasClass('collapsed');
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
            const $popover = $('#panel-about-popover');
            const isOpen   = $popover.hasClass('open');
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
            const $btn      = $(this);
            const $dropdown = $('#ai-engagement-dropdown');
            const isOpen    = $btn.hasClass('open');

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
                const rect = this.getBoundingClientRect();
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
            const $btn      = $(this);
            const $dropdown = $('#ai-research-dropdown');
            const isOpen    = $btn.hasClass('open');

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
                const rect = this.getBoundingClientRect();
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
            const $btn      = $(this);
            const $dropdown = $('#ai-slack-dropdown');
            const isOpen    = $btn.hasClass('open');

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
                const rect = this.getBoundingClientRect();
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
            const $item        = $(this);
            const aiAction     = $item.data('ai-action');
            const dropdownId   = $item.closest('.ai-engagement-dropdown').attr('id');

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
                const currentState = $('#ai-engagement-dropdown').attr('data-state');
                if (currentState === 'start') setAiEngagementState('active');
            }
            if (dropdownId === 'ai-research-dropdown' && aiAction === 'employer-research') {
                const currentState = $('#ai-research-dropdown').attr('data-state');
                if (currentState === 'start') setAiResearchState('active');
            }
            if (dropdownId === 'ai-slack-dropdown' && aiAction === 'post-vsr-channel') {
                const currentState = $('#ai-slack-dropdown').attr('data-state');
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

    window.openProfilePanel      = openProfilePanel;
    window.closeProfilePanel     = closeProfilePanel;
    window.openCeModal           = openCeModal;
    window.closeCeModal          = closeCeModal;
    window.updatePanelContent    = updatePanelContent;
    window.navigateContact       = navigateContact;
    window.setupPanelHandlers    = setupPanelHandlers;
    window.setAiEngagementState  = setAiEngagementState;
    window.setAiResearchState    = setAiResearchState;
    window.setAiSlackState       = setAiSlackState;
    window.switchToAiView        = switchToAiView;
    window.switchToCrmView       = switchToCrmView;
    window.togglePanelView       = togglePanelView;

    $(document).ready(function() { setupPanelHandlers(); });

})(jQuery);
