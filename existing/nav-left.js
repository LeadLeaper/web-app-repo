/**
 * Left Navigation Panel - Interaction Logic
 *
 * Features:
 * - Fixed-width navigation (no expanding)
 * - Active section highlighting
 * - Icon popover with delay
 * - Smart click behavior (immediate load, first subsection, or list selection)
 */

(function($) {
    'use strict';

    // Constants
    const CLASS_ACTIVE = 'active';
    const POPOVER_DELAY = 600; // ms delay before showing popover
    const ACTIVE_SECTION_KEY = 'activeNavSection';
    const LAST_SELECTED_LIST_KEY = 'lastSelectedList'; // Format: section:listId

    // Selectors
    const $body = $('body');
    const $leftNav = $('#left-nav');
    const $navItems = $('.nav-item');

    // Popover delay timer
    let popoverTimer = null;

    /**
     * Set up icon popovers with delay
     * Shows subsections or lists when hovering over icons
     */
    function setupIconPopovers() {
        $navItems.each(function() {
            const $item = $(this);
            const $link = $item.find('.nav-link');
            const section = $item.data('section');

            // Parse JSON data attributes (jQuery .data() should auto-parse, but be explicit)
            let subsections = $item.data('subsections');
            let lists = $item.data('lists');
            let hasLists = $item.data('has-lists'); // For Lists section

            // If they're strings, parse them
            if (typeof subsections === 'string') {
                try {
                    subsections = JSON.parse(subsections);
                } catch(e) {
                    subsections = null;
                }
            }

            if (typeof lists === 'string') {
                try {
                    lists = JSON.parse(lists);
                } catch(e) {
                    lists = null;
                }
            }

            // Only show popover if there are subsections, lists, or has-lists flag
            if (!subsections && !lists && !hasLists) {
                return;
            }

            // Create popover element with error handling
            let $popover;
            try {
                $popover = createPopover(section, subsections, lists);
                $item.append($popover);
            } catch (error) {
                console.error('ERROR creating popover for', section, ':', error.message);
                return; // Skip event handlers if popover creation failed
            }

            // Show popover on hover with delay
            $link.on('mouseenter', function() {
                if (popoverTimer) {
                    clearTimeout(popoverTimer);
                }

                popoverTimer = setTimeout(function() {
                    // Hide all other popovers first
                    $('.nav-popover').removeClass('visible');

                    // Position and show this popover
                    positionPopover($popover, $link);
                    $popover.addClass('visible');
                }, POPOVER_DELAY);
            });

            // Keep popover visible when hovering over it
            $popover.on('mouseenter', function() {
                if (popoverTimer) {
                    clearTimeout(popoverTimer);
                }
                $popover.addClass('visible');
            });

            // Hide popover when leaving both link and popover
            $link.on('mouseleave', function() {
                if (popoverTimer) {
                    clearTimeout(popoverTimer);
                }

                setTimeout(function() {
                    if (!$popover.is(':hover') && !$link.is(':hover')) {
                        $popover.removeClass('visible');
                    }
                }, 100);
            });

            $popover.on('mouseleave', function() {
                setTimeout(function() {
                    if (!$popover.is(':hover') && !$link.is(':hover')) {
                        $popover.removeClass('visible');
                    }
                }, 100);
            });
        });
    }

    /**
     * Create popover element with subsections or lists
     */
    function createPopover(section, subsections, lists) {
        const $popover = $('<div class="nav-popover"></div>');

        // Special handling for Lists section
        if (section === 'lists') {
            return createListsPopover(section);
        }

        const $list = $('<ul class="nav-popover-list"></ul>');

        // Add header
        const headerText = subsections ? section.charAt(0).toUpperCase() + section.slice(1) : 'Lists';
        $popover.append(`<div class="nav-popover-header">${headerText}</div>`);

        // Add items with title + description format
        const items = subsections || lists || [];
        items.forEach(function(item, index) {
            const itemId = typeof item === 'object' ? item.id : item;
            const itemName = typeof item === 'object' ? item.name : item;
            const itemDesc = typeof item === 'object' ? item.desc : '';

            let linkContent;
            if (itemDesc) {
                // Enhanced format with title + description
                linkContent = `
                    <div class="popover-item-title">${itemName}</div>
                    <div class="popover-item-desc">${itemDesc}</div>
                `;
            } else {
                // Simple format (backward compatible)
                linkContent = itemName;
            }

            const $listItem = $(`
                <li class="nav-popover-item">
                    <a href="#" class="nav-popover-link" data-section="${section}" data-item-id="${itemId}" data-item-index="${index}">
                        ${linkContent}
                    </a>
                </li>
            `);

            $list.append($listItem);
        });

        $popover.append($list);

        // Handle popover link clicks
        $popover.on('click', '.nav-popover-link', function(e) {
            e.preventDefault();
            e.stopPropagation();

            const itemId = $(this).data('item-id');
            const itemIndex = $(this).data('item-index');

            // Hide popover
            $popover.removeClass('visible');

            // Load the selected item
            if (subsections) {
                loadSubsection(section, itemId, itemIndex);
            } else {
                loadList(section, itemId);
            }
        });

        return $popover;
    }

    /**
     * Create special Lists popover with dynamic 1-3 column layout, Add button, and Archived section
     * Column logic: 1-7 lists = 1 col, 8-14 lists = 2 cols, 15-20 lists = 3 cols
     * Max 7 items per column, max 20 lists total
     */
    function createListsPopover(section) {
        const $popover = $('<div class="nav-popover lists-popover"></div>');

        // Header
        $popover.append(`<div class="nav-popover-header">Your Lists</div>`);

        // Add List Button
        const $addBtn = $(`
            <button class="nav-popover-add-btn">
                + Add List
            </button>
        `);
        $popover.append($addBtn);

        // Sample lists (in production, this would come from data)
        // Using 18 lists to demonstrate 3-column layout
        const sampleLists = [
            'My Leads', 'Hot Prospects', 'Follow-ups', 'Cold Leads',
            'Q1 Targets', 'Enterprise Deals', 'SMB Pipeline', 'Nurture Campaigns',
            'Warm Leads', 'New Contacts', 'Re-engagement', 'VIP Clients',
            'Trial Users', 'Qualified Leads', 'Web Signups', 'Event Attendees',
            'Referrals', 'Partner Leads'
        ];

        // Limit to 20 lists maximum
        const lists = sampleLists.slice(0, 20);
        const listCount = lists.length;

        // Determine number of columns based on list count
        let columnCount = 1;
        if (listCount >= 15) {
            columnCount = 3;
        } else if (listCount >= 8) {
            columnCount = 2;
        }

        // Multi-column list grid with dynamic columns
        const $list = $(`<ul class="nav-popover-list multi-column column-${columnCount}"></ul>`);

        lists.forEach(function(listName, index) {
            const $listItem = $(`
                <li class="nav-popover-item">
                    <a href="#" class="nav-popover-link" data-section="${section}" data-item-id="${listName}" data-item-index="${index}">
                        ${listName}
                    </a>
                </li>
            `);
            $list.append($listItem);
        });
        $popover.append($list);

        // Archived Lists Section
        const $archived = $(`
            <div class="nav-popover-archived">
                <span class="archived-label">View Archived Lists</span>
                <svg class="archived-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 3h18v4H3V3zm1 5h16v13H4V8zm8 7l4-4h-3V9h-2v2H8l4 4z"/>
                </svg>
            </div>
        `);
        $popover.append($archived);

        // Handle Add button click
        $addBtn.on('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            $popover.removeClass('visible');

            // Trigger custom event for app to handle
            $(document).trigger('nav:list:add', { section: section });
        });

        // Handle list clicks
        $popover.on('click', '.nav-popover-link', function(e) {
            e.preventDefault();
            e.stopPropagation();

            const itemId = $(this).data('item-id');

            $popover.removeClass('visible');
            loadList(section, itemId);
        });

        // Handle archived click
        $archived.on('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            $popover.removeClass('visible');

            // Trigger custom event for app to handle
            $(document).trigger('nav:list:archived', { section: section });
        });

        return $popover;
    }

    /**
     * Position popover next to the nav item (using fixed positioning)
     * Caret centered with icon, with automatic upward positioning for bottom items
     */
    function positionPopover($popover, $link) {
        const linkOffset = $link.offset();
        const linkHeight = $link.outerHeight();
        const windowHeight = $(window).height();

        // Calculate icon center position
        const iconCenterY = linkOffset.top + (linkHeight / 2);

        // Caret is positioned at ~17px from edge of popover (see CSS ::before/::after)
        const caretOffset = 17;

        // Initial position (downward popover) - adjusted by 8px for better alignment
        let topPos = iconCenterY - caretOffset - 8;

        // Make popover visible temporarily to measure height
        $popover.css({ visibility: 'hidden', display: 'block' });
        const popoverHeight = $popover.outerHeight();
        $popover.css({ visibility: '', display: '' });

        // Check if popover would go off bottom of screen (with 40px buffer for status bar)
        const wouldOverflowBottom = (topPos + popoverHeight) > (windowHeight - 40);

        if (wouldOverflowBottom) {
            // Position popover ABOVE the icon
            // For upward popovers, caret is at bottom: 17px, so align it with icon center
            // User requested +14px adjustment for User avatar popover
            topPos = iconCenterY - popoverHeight + caretOffset + 9;
            $popover.addClass('popover-upward');
        } else {
            $popover.removeClass('popover-upward');
        }

        $popover.css({
            top: topPos + 'px',
            left: '65px'
        });
    }

    /**
     * Detect current section from URL hash or body class
     * and highlight the corresponding nav item
     */
    function highlightActiveSection() {
        // First, try to detect from URL hash
        const hash = window.location.hash.replace('#', '');

        if (hash) {
            $navItems.removeClass(CLASS_ACTIVE);
            $navItems.filter('[data-section="' + hash + '"]').addClass(CLASS_ACTIVE);
            return;
        }

        // Fallback: detect from body classes
        // Map common body classes to nav sections
        const sectionMap = {
            'teamMgr': 'team',
            'dashView': 'dashboard',
            'listView': 'lists',
            'engSel': 'engagement',
            'trackView': 'tracking',
            'alertMgr': 'alerts',
            'acctMgr': 'user',
            'integMgr': 'integrations',
            'helpView': 'help'
        };

        let detectedSection = null;

        // Check body classes against the map
        $.each(sectionMap, function(bodyClass, section) {
            if ($body.hasClass(bodyClass)) {
                detectedSection = section;
                return false; // break loop
            }
        });

        // Highlight the detected section
        if (detectedSection) {
            $navItems.removeClass(CLASS_ACTIVE);
            $navItems.filter('[data-section="' + detectedSection + '"]').addClass(CLASS_ACTIVE);
        }
    }

    /**
     * Set up click handlers for navigation items with smart default behavior:
     * 4a: No subsections/lists -> immediately load content
     * 4b2: Has subsections -> load first subsection (no popover selection needed)
     * 4c2: Has lists -> load last-selected list or refresh current
     */
    function setupNavItemClicks() {
        $navItems.on('click', '.nav-link', function(e) {
            e.preventDefault();
            const $link = $(this);
            const $item = $link.closest('.nav-item');
            const section = $item.data('section');

            // Parse JSON data attributes
            let subsections = $item.data('subsections');
            let lists = $item.data('lists');

            if (typeof subsections === 'string') {
                try { subsections = JSON.parse(subsections); } catch(e) { subsections = null; }
            }

            if (typeof lists === 'string') {
                try { lists = JSON.parse(lists); } catch(e) { lists = null; }
            }

            // Remove active class from all items
            $navItems.removeClass(CLASS_ACTIVE);

            // Add active class to clicked item
            $item.addClass(CLASS_ACTIVE);

            // Store active section
            sessionStorage.setItem(ACTIVE_SECTION_KEY, section);

            // Smart loading behavior
            if (!subsections && !lists) {
                // 4a: No subsections or lists - load content immediately
                loadSectionContent(section);
            } else if (subsections) {
                // 4b2: Has subsections - load first subsection
                loadSubsection(section, subsections[0], 0);
            } else if (lists) {
                // 4c2: Has lists - load previous or refresh current
                loadListContentSmart(section, lists);
            }
        });
    }

    /**
     * Load main section content (4a)
     */
    function loadSectionContent(section) {
        // Navigate to section page or update main content area
        window.location.hash = section;

        // Trigger custom event for app to handle
        $(document).trigger('nav:section:load', { section: section });
    }

    /**
     * Load specific subsection (from popover or default first)
     */
    function loadSubsection(section, subsectionId, subsectionIndex) {
        // Trigger custom event
        $(document).trigger('nav:subsection:load', {
            section: section,
            subsection: subsectionId,
            subsectionIndex: subsectionIndex
        });

        // Update URL hash
        window.location.hash = section + '/' + subsectionId;
    }

    /**
     * Load specific list (from popover selection)
     */
    function loadList(section, listId) {
        // Store this list as last-selected
        const lastListKey = LAST_SELECTED_LIST_KEY + ':' + section;
        localStorage.setItem(lastListKey, listId);

        // Trigger custom event
        $(document).trigger('nav:list:load', {
            section: section,
            listId: listId,
            action: 'load'
        });

        // Update URL hash
        window.location.hash = section + '/list/' + listId;
    }

    /**
     * Load list with smart behavior (4c2)
     * Load last-selected list or refresh current list
     */
    function loadListContentSmart(section, lists) {
        const lastListKey = LAST_SELECTED_LIST_KEY + ':' + section;
        const lastListId = localStorage.getItem(lastListKey);

        if (lastListId) {
            // Load previously-selected list
            loadList(section, lastListId);
        } else if (lists && lists.length > 0) {
            // No previous list - load first list as default
            const firstListId = typeof lists[0] === 'object' ? lists[0].id : lists[0];
            loadList(section, firstListId);
        } else {
            // Trigger refresh of current list
            $(document).trigger('nav:list:load', {
                section: section,
                listId: null,
                action: 'refresh'
            });
        }
    }

    /**
     * Store selected list for later recall (called by main app)
     */
    function storeSelectedList(section, listId) {
        const lastListKey = LAST_SELECTED_LIST_KEY + ':' + section;
        localStorage.setItem(lastListKey, listId);
    }

    // Expose functions globally for main app to use
    window.navStoreSelectedList = storeSelectedList;

    /**
     * Restore active section from sessionStorage if available
     */
    function restoreActiveSection() {
        const savedSection = sessionStorage.getItem('activeNavSection');

        if (savedSection) {
            $navItems.removeClass(CLASS_ACTIVE);
            $navItems.filter('[data-section="' + savedSection + '"]').addClass(CLASS_ACTIVE);
        } else {
            // If no saved section, try to detect from page
            highlightActiveSection();
        }
    }

    /**
     * Set up logo click handler
     */
    function setupLogoClick() {
        $('#nav-logo').on('click', function(e) {
            e.preventDefault();

            // Navigate to dashboard
            window.location.hash = 'dashboard';

            // Remove active class from all nav items
            $navItems.removeClass(CLASS_ACTIVE);

            // Add active to dashboard
            $navItems.filter('[data-section="dashboard"]').addClass(CLASS_ACTIVE);

            // Store active section
            sessionStorage.setItem(ACTIVE_SECTION_KEY, 'dashboard');

            // Trigger custom event
            $(document).trigger('nav:section:load', { section: 'dashboard' });
        });
    }

    /**
     * Initialize the navigation panel
     */
    function init() {
        // Set up interaction behaviors
        setupLogoClick();
        setupIconPopovers();
        setupNavItemClicks();

        // Highlight active section
        restoreActiveSection();

        // Re-highlight on hash change
        $(window).on('hashchange', highlightActiveSection);
    }

    // Initialize when DOM is ready
    $(document).ready(init);

})(jQuery);
