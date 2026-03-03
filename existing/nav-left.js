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

            // Only show popover if there are subsections or lists
            if (!subsections && !lists) {
                return;
            }

            console.log('Setting up popover for:', section, 'subsections:', subsections, 'lists:', lists);

            // Create popover element
            const $popover = createPopover(section, subsections, lists);
            console.log('Created popover element:', $popover.length > 0 ? 'SUCCESS' : 'FAILED');
            $item.append($popover);
            console.log('Appended popover to nav item, total popovers in DOM:', $('.nav-popover').length);

            // Show popover on hover with delay
            $link.on('mouseenter', function() {
                if (popoverTimer) {
                    clearTimeout(popoverTimer);
                }

                popoverTimer = setTimeout(function() {
                    console.log('Popover timer fired for:', section);

                    // Hide all other popovers first
                    $('.nav-popover').removeClass('visible');

                    // Position and show this popover
                    positionPopover($popover, $link);
                    $popover.addClass('visible');

                    console.log('Popover should be visible now. Has visible class:', $popover.hasClass('visible'));
                    console.log('Popover CSS display:', $popover.css('display'));
                    console.log('Popover position:', $popover.css('left'), $popover.css('top'));
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
        const $list = $('<ul class="nav-popover-list"></ul>');

        // Add header
        const headerText = subsections ? 'Subsections' : 'Lists';
        $popover.append(`<div class="nav-popover-header">${headerText}</div>`);

        // Add items
        const items = subsections || lists || [];
        items.forEach(function(item, index) {
            const itemId = typeof item === 'object' ? item.id : item;
            const itemName = typeof item === 'object' ? item.name : item;

            const $listItem = $(`
                <li class="nav-popover-item">
                    <a href="#" class="nav-popover-link" data-section="${section}" data-item-id="${itemId}" data-item-index="${index}">
                        ${itemName}
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
     * Position popover next to the nav item
     */
    function positionPopover($popover, $link) {
        const linkPos = $link.position();
        $popover.css({
            top: linkPos.top + 'px'
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
     * Initialize the navigation panel
     */
    function init() {
        // Set up interaction behaviors
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
