/**
 * Profile Panel - Content Rendering and Section Organization
 *
 * Features:
 * - Dynamic content rendering with smart section organization
 * - Collapsible sections with default expansion rules
 * - Empty state prompts for engagement
 * - Smooth animations matching navigation patterns (300ms)
 */

(function($) {
    'use strict';

    // Constants
    const ANIMATION_DURATION = 300; // Match navigation panel timing

    /**
     * Open profile panel with contact data
     * Main entry point for displaying contact/lead profiles
     *
     * @param {Object} contactData - Complete contact information
     * @param {Array} [contactList] - Array of contacts for prev/next navigation
     */
    function openProfilePanel(contactData, contactList) {
        const $panel = $('.profile-panel');
        const $content = $('.profile-content');

        // Store contact list for navigation if provided
        if (contactList && Array.isArray(contactList)) {
            window.currentContactList = contactList;
        }

        // If panel already open, update content instead of reopening
        if ($panel.hasClass('open')) {
            updatePanelContent(contactData);
            return;
        }

        // Render profile content
        const contentHtml = renderProfileContent(contactData);
        $content.html(contentHtml);

        // Store current contact ID on panel
        $panel.data('contact-id', contactData.id);

        // Show panel with slide animation
        $panel.addClass('open');

        // Initialize section toggle handlers after content is rendered
        setTimeout(function() {
            initSectionToggles();
        }, 50);
    }

    /**
     * Render complete profile content
     * Includes fixed header data and all scrollable sections
     *
     * @param {Object} data - Contact data object
     * @returns {String} Complete HTML string
     */
    function renderProfileContent(data) {
        // Update fixed header (outside scrollable content)
        updateFixedHeader(data);

        // Render scrollable sections only
        return renderSections(data);
    }

    /**
     * Update fixed header section with contact identity
     * Modifies existing DOM elements rather than replacing HTML
     *
     * @param {Object} data - Contact data
     */
    function updateFixedHeader(data) {
        // Update photo
        if (data.photo) {
            $('.profile-photo').attr('src', data.photo);
        }

        // Update name
        if (data.name) {
            $('.profile-name').text(data.name);
        }

        // Update LIVE badge visibility
        if (data.isLive) {
            $('.badge-live').show();
        } else {
            $('.badge-live').hide();
        }

        // Update company
        if (data.company) {
            $('.profile-company').text(data.company);
        }

        // Update title
        if (data.title) {
            $('.profile-title').text(data.title);
        }
    }

    /**
     * Render all profile sections in user-specified order
     * Groups: Static Information → Activity → Engagement
     *
     * @param {Object} data - Contact data
     * @returns {String} HTML string with all sections
     */
    function renderSections(data) {
        const sections = [];

        // ===== GROUP 1: Static Information =====

        // Details - Always expanded per user requirement
        sections.push(renderSection({
            id: 'details',
            title: 'Contact Details',
            alwaysExpanded: true,
            data: data.details,
            group: 'static'
        }));

        // Company Info - Always expanded per user requirement
        sections.push(renderSection({
            id: 'company',
            title: 'Company Info',
            alwaysExpanded: true,
            data: data.companyInfo,
            group: 'static'
        }));

        // Social/Professional Links - Expand if has content
        sections.push(renderSection({
            id: 'social-links',
            title: 'Social & Professional Links',
            alwaysExpanded: null,
            data: data.socialLinks,
            group: 'static'
        }));

        // ===== GROUP 2: Activity =====

        // Notes - Expand if has content, else show "Add Note" prompt
        sections.push(renderSection({
            id: 'notes',
            title: 'Notes',
            alwaysExpanded: null,
            data: data.notes,
            group: 'activity',
            emptyPrompt: 'Add Note'
        }));

        // Calls - Expand if has content, else show "Log Call" prompt
        sections.push(renderSection({
            id: 'calls',
            title: 'Call History',
            alwaysExpanded: null,
            data: data.calls,
            group: 'activity',
            emptyPrompt: 'Log Call'
        }));

        // Meetings - Expand if has content, else show "Schedule Meeting" prompt
        sections.push(renderSection({
            id: 'meetings',
            title: 'Meetings',
            alwaysExpanded: null,
            data: data.meetings,
            group: 'activity',
            emptyPrompt: 'Schedule Meeting'
        }));

        // Tasks/Reminders - Expand if has content, else show "Add Reminder" prompt
        sections.push(renderSection({
            id: 'reminders',
            title: 'Tasks & Reminders',
            alwaysExpanded: null,
            data: data.reminders,
            group: 'activity',
            emptyPrompt: 'Add Reminder'
        }));

        // ===== GROUP 3: Engagement =====

        // Email Replies - Expand if has content
        sections.push(renderSection({
            id: 'email-replies',
            title: 'Email Replies',
            alwaysExpanded: null,
            data: data.emailReplies,
            group: 'engagement'
        }));

        // Email Links Viewed - Expand if has content
        sections.push(renderSection({
            id: 'email-links',
            title: 'Email Links Viewed',
            alwaysExpanded: null,
            data: data.emailLinksViewed,
            group: 'engagement'
        }));

        // Emails Sent - Expand if has content
        sections.push(renderSection({
            id: 'emails-sent',
            title: 'Emails Sent',
            alwaysExpanded: null,
            data: data.emailsSent,
            group: 'engagement'
        }));

        return sections.join('');
    }

    /**
     * Render individual section with smart expansion defaults
     *
     * @param {Object} config - Section configuration
     * @param {String} config.id - Section identifier
     * @param {String} config.title - Section display title
     * @param {Boolean|null} config.alwaysExpanded - Expansion rule (true=always, null=conditional)
     * @param {Array|Object} config.data - Section data
     * @param {String} config.group - Section group (static/activity/engagement)
     * @param {String} [config.emptyPrompt] - Action prompt for empty sections
     * @returns {String} Section HTML
     */
    function renderSection(config) {
        const { id, title, alwaysExpanded, data, group, emptyPrompt } = config;

        // Determine if section should be expanded using smart defaults
        let isExpanded = false;
        let hasData = false;

        // Check if data exists
        if (Array.isArray(data)) {
            hasData = data.length > 0;
        } else if (typeof data === 'object' && data !== null) {
            hasData = Object.keys(data).length > 0;
        }

        // Apply expansion rules
        if (alwaysExpanded === true) {
            // Always expanded (Details, Company)
            isExpanded = true;
        } else if (alwaysExpanded === null && hasData) {
            // Expand if has content
            isExpanded = true;
        }
        // Otherwise: collapsed (empty sections)

        const expandedClass = isExpanded ? 'expanded' : '';
        const contentStyle = isExpanded ? '' : 'style="display: none;"';

        // Render section content
        const sectionContent = renderSectionContent(id, data, emptyPrompt);

        return `
            <div class="profile-section ${expandedClass}" data-section-id="${id}" data-group="${group}">
                <div class="section-header">
                    <span class="section-title">${title}</span>
                    <span class="section-toggle">▾</span>
                </div>
                <div class="section-content" ${contentStyle}>
                    ${sectionContent}
                </div>
            </div>
        `;
    }

    /**
     * Render section content based on data type
     * Shows empty state with actionable prompt if no data
     *
     * @param {String} sectionId - Section identifier
     * @param {Array|Object} data - Section data
     * @param {String} [emptyPrompt] - Action prompt for empty sections
     * @returns {String} Content HTML
     */
    function renderSectionContent(sectionId, data, emptyPrompt) {
        // Check if data is empty
        let isEmpty = false;
        if (Array.isArray(data)) {
            isEmpty = data.length === 0;
        } else if (typeof data === 'object' && data !== null) {
            isEmpty = Object.keys(data).length === 0;
        } else {
            isEmpty = !data;
        }

        // Render empty state with actionable prompt
        if (isEmpty) {
            if (emptyPrompt) {
                return `
                    <div class="empty-state">
                        <div class="empty-state-text">No ${sectionId.replace('-', ' ')} yet</div>
                        <a href="#" class="empty-state-action" data-action="add-${sectionId}">
                            ${emptyPrompt}
                        </a>
                    </div>
                `;
            } else {
                return `
                    <div class="empty-state">
                        <div class="empty-state-text">No ${sectionId.replace('-', ' ')} available</div>
                    </div>
                `;
            }
        }

        // Render content based on section type
        // For now, use placeholder rendering (detailed content in plan 02-03)
        return renderPlaceholderContent(sectionId, data);
    }

    /**
     * Render placeholder content for testing
     * Will be replaced with detailed rendering in plan 02-03
     *
     * @param {String} sectionId - Section identifier
     * @param {Array|Object} data - Section data
     * @returns {String} Placeholder HTML
     */
    function renderPlaceholderContent(sectionId, data) {
        // Handle object data (Details, Company Info)
        if (!Array.isArray(data) && typeof data === 'object') {
            const items = Object.entries(data).map(([key, value]) => {
                return `
                    <div class="section-item">
                        <strong>${key}:</strong> ${value}
                    </div>
                `;
            });
            return items.join('');
        }

        // Handle array data (all other sections)
        if (Array.isArray(data)) {
            const items = data.map((item, index) => {
                // Simple rendering based on item structure
                let content = '';

                if (typeof item === 'object') {
                    // Extract common fields
                    const title = item.title || item.subject || item.text || item.type || 'Item';
                    const date = item.date ? `<span class="item-date">${item.date}</span>` : '';
                    const url = item.url ? `<a href="${item.url}" target="_blank">View</a>` : '';

                    content = `
                        <div class="item-title">${title}</div>
                        ${date}
                        ${url}
                    `;
                } else {
                    content = String(item);
                }

                return `
                    <div class="section-item" data-index="${index}">
                        ${content}
                    </div>
                `;
            });

            return items.join('');
        }

        return '<div class="section-item">No data</div>';
    }

    /**
     * Initialize section toggle handlers
     * Binds click events to section headers for expand/collapse
     */
    function initSectionToggles() {
        // Remove existing handlers to prevent duplicates
        $('.profile-content').off('click', '.section-header');

        // Bind click handler using event delegation
        $('.profile-content').on('click', '.section-header', function(e) {
            e.preventDefault();

            const $header = $(this);
            const $section = $header.closest('.profile-section');
            const $content = $section.find('.section-content');

            // Toggle expanded class
            $section.toggleClass('expanded');

            // Animate content visibility with slideToggle (matches 300ms timing)
            $content.slideToggle(ANIMATION_DURATION);
        });

        // Handle empty state action clicks
        $('.profile-content').off('click', '.empty-state-action');
        $('.profile-content').on('click', '.empty-state-action', function(e) {
            e.preventDefault();
            e.stopPropagation(); // Prevent section toggle

            const action = $(this).data('action');

            // Trigger custom event for app to handle
            $(document).trigger('profile:action', { action: action });
        });
    }

    /**
     * Update panel content when switching between contacts
     * Uses fade-out → loading spinner → fade-in for smooth transitions
     *
     * @param {Object} contactData - New contact data
     */
    function updatePanelContent(contactData) {
        const $panel = $('.profile-panel');
        const $content = $('.profile-content');

        // Fade out current content quickly (200ms)
        $content.fadeOut(200, function() {
            // Show loading spinner in content area
            $content.html('<div class="loading-spinner"></div>');
            $content.show();

            // Simulate realistic loading delay (400ms) for data fetch
            setTimeout(function() {
                // Update fixed header
                updateFixedHeader(contactData);

                // Re-render sections with new contact data
                const contentHtml = renderSections(contactData);
                $content.html(contentHtml);

                // Update stored contact ID
                $panel.data('contact-id', contactData.id);

                // Fade in new content (200ms)
                $content.hide().fadeIn(200, function() {
                    // Re-initialize section toggles for new content
                    initSectionToggles();
                });
            }, 400);
        });
    }

    /**
     * Navigate to previous or next contact in list
     * Uses wrap-around logic to cycle through contacts
     *
     * @param {String} direction - 'prev' or 'next'
     */
    function navigateContact(direction) {
        const $panel = $('.profile-panel');

        // Get current contact ID from panel data
        const currentId = $panel.data('contact-id');

        // Get contact list from window state
        const contacts = window.currentContactList || [];

        // Safety check: no contacts available
        if (contacts.length === 0) {
            return;
        }

        // Find current index
        const currentIndex = contacts.findIndex(function(c) {
            return c.id === currentId;
        });

        // Safety check: current contact not found in list
        if (currentIndex === -1) {
            return;
        }

        // Calculate next index with wrap-around
        let nextIndex;
        if (direction === 'next') {
            nextIndex = (currentIndex + 1) % contacts.length;
        } else {
            // Prev with wrap-around (add length to handle negative modulo)
            nextIndex = (currentIndex - 1 + contacts.length) % contacts.length;
        }

        // Get next contact
        const nextContact = contacts[nextIndex];

        // Update panel with cross-fade
        updatePanelContent(nextContact);
    }

    /**
     * Close profile panel
     */
    function closeProfilePanel() {
        const $panel = $('.profile-panel');

        // Check if already closed
        if (!$panel.hasClass('open')) {
            return;
        }

        // Remove class to trigger slide-out animation
        $panel.removeClass('open');

        // Clear content after animation completes (300ms)
        setTimeout(function() {
            $('.profile-content').html('');
            $panel.removeData('contact-id');
        }, ANIMATION_DURATION);
    }

    /**
     * Setup panel interaction handlers
     * Initialize all event handlers using event delegation
     */
    function setupPanelHandlers() {
        // Close Method 1: Close button click
        $(document).on('click', '.profile-panel .close-btn', function(e) {
            e.preventDefault();
            closeProfilePanel();
        });

        // Close Method 2: ESC key
        $(document).on('keydown', function(e) {
            const $panel = $('.profile-panel');
            if (e.which === 27 && $panel.hasClass('open')) { // ESC key = 27
                closeProfilePanel();
            }
        });

        // Navigation: Prev/Next contact buttons
        $(document).on('click', '.profile-panel .btn-nav', function(e) {
            e.preventDefault();
            const direction = $(this).data('nav'); // 'prev' or 'next'
            navigateContact(direction);
        });
    }

    /**
     * Initialize profile panel
     * @deprecated Use setupPanelHandlers() - kept for backwards compatibility
     */
    function init() {
        setupPanelHandlers();
    }

    // Expose public functions globally
    window.openProfilePanel = openProfilePanel;
    window.closeProfilePanel = closeProfilePanel;
    window.updatePanelContent = updatePanelContent;
    window.navigateContact = navigateContact;
    window.renderProfileContent = renderProfileContent;
    window.renderSections = renderSections;
    window.setupPanelHandlers = setupPanelHandlers;

    // Initialize when DOM is ready
    $(document).ready(function() {
        setupPanelHandlers();
    });

})(jQuery);


// ===== Sample Data for Testing =====
// Uncomment to test panel rendering

/*
const sampleContactData = {
    name: "John Doe",
    photo: "https://via.placeholder.com/48",
    company: "Acme Corp",
    title: "VP of Sales",
    isLive: true,
    details: {
        email: "john@acme.com",
        phone: "555-1234",
        location: "San Francisco, CA"
    },
    companyInfo: {
        website: "acme.com",
        industry: "Technology",
        employees: "500-1000"
    },
    socialLinks: [
        {type: "LinkedIn", url: "https://linkedin.com/in/johndoe"},
        {type: "Twitter", url: "https://twitter.com/johndoe"}
    ],
    notes: [
        {text: "Follow up next week", date: "2026-03-01"},
        {text: "Interested in enterprise plan", date: "2026-02-28"}
    ],
    calls: [],
    meetings: [
        {title: "Demo call", date: "2026-03-05"}
    ],
    reminders: [],
    emailReplies: [],
    emailLinksViewed: [],
    emailsSent: [
        {subject: "Introduction", date: "2026-02-28"},
        {subject: "Follow-up", date: "2026-03-01"}
    ]
};

// Test opening panel
// $(document).ready(function() {
//     setTimeout(function() {
//         openProfilePanel(sampleContactData);
//     }, 500);
// });
*/
