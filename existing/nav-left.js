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
     * Set up icon popover with delay
     * Prevents accidental popover triggers when mouse traverses icons
     */
    function setupIconPopovers() {
        $navItems.each(function() {
            const $item = $(this);
            const $icon = $item.find('.nav-icon');
            const sectionName = $item.data('section');

            $icon.on('mouseenter', function() {
                // Clear any existing timer
                if (popoverTimer) {
                    clearTimeout(popoverTimer);
                }

                // Set new timer with delay
                popoverTimer = setTimeout(function() {
                    // Show popover with section name (if tippy or similar library is available)
                    if (typeof tippy !== 'undefined') {
                        tippy($icon[0], {
                            content: sectionName.charAt(0).toUpperCase() + sectionName.slice(1),
                            delay: [0, 0],
                            theme: 'nav-popover',
                            placement: 'right',
                            arrow: true
                        });
                    }
                }, POPOVER_DELAY);
            });

            $icon.on('mouseleave', function() {
                // Clear timer if mouse leaves before delay completes
                if (popoverTimer) {
                    clearTimeout(popoverTimer);
                    popoverTimer = null;
                }
            });
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
     * Set up click handlers for navigation items with smart behavior:
     * 4a: No subsections/lists -> immediately load content
     * 4b: Has subsections (not lists) -> load first subsection
     * 4c: Has lists -> load previously-selected list or refresh current
     */
    function setupNavItemClicks() {
        $navItems.on('click', function(e) {
            e.preventDefault();
            const $item = $(this);
            const section = $item.data('section');
            const hasSubsections = $item.data('has-subsections') || false;
            const hasLists = $item.data('has-lists') || false;

            // Remove active class from all items
            $navItems.removeClass(CLASS_ACTIVE);

            // Add active class to clicked item
            $item.addClass(CLASS_ACTIVE);

            // Store active section
            sessionStorage.setItem(ACTIVE_SECTION_KEY, section);

            // Smart loading behavior
            if (!hasSubsections && !hasLists) {
                // 4a: No subsections or lists - load content immediately
                loadSectionContent(section);
            } else if (hasSubsections && !hasLists) {
                // 4b: Has subsections - load first subsection
                loadFirstSubsection(section);
            } else if (hasLists) {
                // 4c: Has lists - load previous or refresh current
                loadListContent(section);
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
     * Load first subsection (4b)
     */
    function loadFirstSubsection(section) {
        // Trigger custom event with first subsection flag
        $(document).trigger('nav:subsection:load', {
            section: section,
            subsection: 'first'
        });
    }

    /**
     * Load list content - previous or current (4c)
     */
    function loadListContent(section) {
        const lastListKey = LAST_SELECTED_LIST_KEY + ':' + section;
        const lastListId = localStorage.getItem(lastListKey);

        if (lastListId) {
            // Load previously-selected list
            $(document).trigger('nav:list:load', {
                section: section,
                listId: lastListId,
                action: 'load'
            });
        } else {
            // No previous list - trigger refresh of current or show list selector
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

    // Expose storeSelectedList globally for main app to use
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
