/**
 * Left Navigation Panel - Interaction Logic
 *
 * Features:
 * - Hover-to-expand behavior
 * - Pin/unpin functionality with localStorage persistence
 * - Active section highlighting
 */

(function($) {
    'use strict';

    // Constants
    const NAV_STORAGE_KEY = 'navPinned';
    const CLASS_NAV_PINNED = 'nav-pinned';
    const CLASS_NAV_COLLAPSED = 'nav-collapsed';
    const CLASS_NAV_EXPANDED = 'nav-expanded';
    const CLASS_ACTIVE = 'active';

    // Selectors
    const $body = $('body');
    const $leftNav = $('#left-nav');
    const $pinBtn = $('#nav-pin-btn');
    const $navItems = $('.nav-item');

    /**
     * Initialize navigation state from localStorage
     */
    function initNavState() {
        const isPinned = localStorage.getItem(NAV_STORAGE_KEY) === 'true';

        if (isPinned) {
            $body.removeClass(CLASS_NAV_COLLAPSED).addClass(CLASS_NAV_PINNED);
            $leftNav.removeClass(CLASS_NAV_COLLAPSED);
        } else {
            $body.removeClass(CLASS_NAV_PINNED).addClass(CLASS_NAV_COLLAPSED);
            $leftNav.addClass(CLASS_NAV_COLLAPSED);
        }
    }

    /**
     * Set up hover-to-expand behavior
     */
    function setupHoverBehavior() {
        $leftNav.on('mouseenter', function() {
            // Only expand on hover if not pinned
            if (!$body.hasClass(CLASS_NAV_PINNED)) {
                $(this).addClass(CLASS_NAV_EXPANDED);
            }
        });

        $leftNav.on('mouseleave', function() {
            // Remove expanded class when mouse leaves (unless pinned)
            if (!$body.hasClass(CLASS_NAV_PINNED)) {
                $(this).removeClass(CLASS_NAV_EXPANDED);
            }
        });
    }

    /**
     * Set up pin/unpin button functionality
     */
    function setupPinButton() {
        $pinBtn.on('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            const isPinned = $body.hasClass(CLASS_NAV_PINNED);

            if (isPinned) {
                // Unpin the navigation
                $body.removeClass(CLASS_NAV_PINNED).addClass(CLASS_NAV_COLLAPSED);
                $leftNav.addClass(CLASS_NAV_COLLAPSED).removeClass(CLASS_NAV_EXPANDED);
                localStorage.setItem(NAV_STORAGE_KEY, 'false');
            } else {
                // Pin the navigation
                $body.removeClass(CLASS_NAV_COLLAPSED).addClass(CLASS_NAV_PINNED);
                $leftNav.removeClass(CLASS_NAV_COLLAPSED).removeClass(CLASS_NAV_EXPANDED);
                localStorage.setItem(NAV_STORAGE_KEY, 'true');
            }
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
     * Set up click handlers for navigation items
     */
    function setupNavItemClicks() {
        $navItems.on('click', function() {
            const section = $(this).data('section');

            // Remove active class from all items
            $navItems.removeClass(CLASS_ACTIVE);

            // Add active class to clicked item
            $(this).addClass(CLASS_ACTIVE);

            // Store active section in sessionStorage for page transitions
            sessionStorage.setItem('activeNavSection', section);
        });
    }

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
        // Initialize nav state from localStorage
        initNavState();

        // Set up interaction behaviors
        setupHoverBehavior();
        setupPinButton();
        setupNavItemClicks();

        // Highlight active section
        restoreActiveSection();

        // Re-highlight on hash change
        $(window).on('hashchange', highlightActiveSection);
    }

    // Initialize when DOM is ready
    $(document).ready(init);

})(jQuery);
