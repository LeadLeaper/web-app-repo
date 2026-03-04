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
     */
    function openProfilePanel(contactData) {
        const $panel = $('.profile-panel');
        const $backdrop = $('.profile-panel-backdrop');
        const $content = $('.profile-content');

        // Render profile content
        const contentHtml = renderProfileContent(contactData);
        $content.html(contentHtml);

        // Show panel with slide animation
        $backdrop.addClass('visible');
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
     * Close profile panel
     */
    function closeProfilePanel() {
        const $panel = $('.profile-panel');
        const $backdrop = $('.profile-panel-backdrop');

        // Hide panel with slide animation
        $panel.removeClass('open');
        $backdrop.removeClass('visible');
    }

    /**
     * Initialize profile panel event handlers
     */
    function init() {
        // Close button
        $('.profile-close-btn').on('click', function(e) {
            e.preventDefault();
            closeProfilePanel();
        });

        // Backdrop click
        $('.profile-panel-backdrop').on('click', function(e) {
            e.preventDefault();
            closeProfilePanel();
        });

        // ESC key
        $(document).on('keydown', function(e) {
            if (e.key === 'Escape' || e.keyCode === 27) {
                const $panel = $('.profile-panel');
                if ($panel.hasClass('open')) {
                    closeProfilePanel();
                }
            }
        });
    }

    // Expose public functions globally
    window.openProfilePanel = openProfilePanel;
    window.closeProfilePanel = closeProfilePanel;
    window.renderProfileContent = renderProfileContent;
    window.renderSections = renderSections;

    // Initialize when DOM is ready
    $(document).ready(init);

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
