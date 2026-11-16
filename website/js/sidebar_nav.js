
    // SIDEBAR & ACCORDION CONTROLLER (UNIFIED GSAP ENGINE)

    let isSidebarCollapsed = true;
    let isMobileSidebarOpen = false;

    function toggleSidebarCollapse() {
      if (window.innerWidth < 1024) {
        closeMobileSidebar();
        return;
      }

      const sidebar = document.getElementById('app-sidebar');
      if (!sidebar || sidebar.dataset.busy) return;

      // Closing: fade the labels out first, then shrink the rail, so text never gets squashed.
      if (!isSidebarCollapsed) {
        sidebar.dataset.busy = '1';
        sidebar.classList.add('sb-closing');
        setTimeout(() => {
          applySidebarState(true);
          sidebar.classList.remove('sb-closing');
          setTimeout(() => { delete sidebar.dataset.busy; }, 380);
        }, 140);
        return;
      }
      sidebar.dataset.busy = '1';
      applySidebarState(false);
      setTimeout(() => { delete sidebar.dataset.busy; }, 420);
    }

    function applySidebarState(collapse) {
      isSidebarCollapsed = collapse;
      const sidebar = document.getElementById('app-sidebar');
      const layout = document.getElementById('app-main-layout');
      const icon = document.getElementById('sidebar-collapse-icon');

      if (isSidebarCollapsed) {
        sidebar.classList.add('sidebar-collapsed');
        sidebar.classList.remove('w-72');
        sidebar.classList.add('w-[76px]');
        if (layout) {
          layout.classList.remove('lg:pl-72');
          layout.classList.add('lg:pl-[76px]');
        }
        if (icon) icon.textContent = 'dock_to_right';

        // Close all accordion subheadings on collapse
        const subModel = document.getElementById('subheadings-model-portal');
        const subData = document.getElementById('subheadings-data-studio');
        const arrowModel = document.getElementById('arrow-model-portal');
        const arrowData = document.getElementById('arrow-data-studio');
        if (subModel) subModel.classList.add('hidden');
        if (subData) subData.classList.add('hidden');
        if (arrowModel) arrowModel.textContent = 'chevron_right';
        if (arrowData) arrowData.textContent = 'chevron_right';

      } else {
        sidebar.classList.remove('sidebar-collapsed');
        sidebar.classList.remove('w-[76px]');
        sidebar.classList.add('w-72');
        if (layout) {
          layout.classList.remove('lg:pl-[76px]');
          layout.classList.add('lg:pl-72');
        }
        if (icon) icon.textContent = 'dock_to_left';

        // When expanding, ensure content under overview and data studio stays collapsed by default
        const subModel = document.getElementById('subheadings-model-portal');
        const subData = document.getElementById('subheadings-data-studio');
        const arrowModel = document.getElementById('arrow-model-portal');
        const arrowData = document.getElementById('arrow-data-studio');
        if (subModel) subModel.classList.add('hidden');
        if (subData) subData.classList.add('hidden');
        if (arrowModel) {
          arrowModel.textContent = 'chevron_right';
          if (window.gsap) gsap.set(arrowModel, { rotation: 0 });
        }
        if (arrowData) {
          arrowData.textContent = 'chevron_right';
          if (window.gsap) gsap.set(arrowData, { rotation: 0 });
        }
      }
    }

    function openMobileSidebarExpanded() {
      const sidebar = document.getElementById('app-sidebar');
      const backdrop = document.getElementById('sidebar-mobile-backdrop');
      const icon = document.getElementById('sidebar-collapse-icon');
      if (!sidebar || !backdrop) return;

      // On mobile, explicitly force expanded mode (w-72)
      isSidebarCollapsed = false;
      sidebar.classList.remove('sidebar-collapsed');
      sidebar.classList.remove('w-[76px]');
      sidebar.classList.add('w-72');
      if (icon) icon.textContent = 'close';

      // Slide in drawer from left
      isMobileSidebarOpen = true;
      sidebar.classList.remove('-translate-x-full');
      sidebar.classList.add('translate-x-0');
      backdrop.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }

    function closeMobileSidebar() {
      const sidebar = document.getElementById('app-sidebar');
      const backdrop = document.getElementById('sidebar-mobile-backdrop');
      const icon = document.getElementById('sidebar-collapse-icon');
      if (!sidebar) return;

      isMobileSidebarOpen = false;
      sidebar.classList.remove('translate-x-0');
      sidebar.classList.add('-translate-x-full');
      if (backdrop) backdrop.classList.add('hidden');
      document.body.style.overflow = '';
      if (icon) icon.textContent = 'dock_to_right';

      // Ensure clean collapsed state for desktop if viewport resizes
      if (window.innerWidth < 1024) {
        sidebar.classList.remove('w-72');
        sidebar.classList.add('w-[76px]');
        sidebar.classList.add('sidebar-collapsed');
        isSidebarCollapsed = true;
      }
    }

    function handleSidebarCollapseClick() {
      if (window.innerWidth < 1024) {
        closeMobileSidebar();
      } else {
        toggleSidebarCollapse();
      }
    }

    function toggleMobileSidebar() {
      if (isMobileSidebarOpen) {
        closeMobileSidebar();
      } else {
        openMobileSidebarExpanded();
      }
    }

    function toggleSidebarAccordion(menuKey) {
      if (isSidebarCollapsed) {
        toggleSidebarCollapse();
      }

      const subList = document.getElementById('subheadings-' + menuKey);
      const arrow = document.getElementById('arrow-' + menuKey);
      if (!subList) return;

      const isHidden = subList.classList.contains('hidden');
      const tween = window.gsap ? gsap : null;
      if (tween) tween.killTweensOf(subList);

      if (isHidden) {
        subList.classList.remove('hidden');
        if (arrow) {
          if (tween) tween.to(arrow, { rotation: 90, duration: 0.3, ease: 'power3.out' });
          else arrow.textContent = 'expand_more';
        }
        if (tween) {
          subList.style.overflow = 'hidden';
          tween.fromTo(subList, { height: 0, opacity: 0 }, {
            height: 'auto', opacity: 1, duration: 0.38, ease: 'power3.out',
            onComplete: () => { subList.style.height = ''; subList.style.overflow = ''; },
          });
          tween.fromTo(subList.querySelectorAll('a'), { x: -8, opacity: 0 },
            { x: 0, opacity: 1, duration: 0.3, stagger: 0.025, ease: 'power2.out', delay: 0.05, clearProps: 'transform,opacity' });
        }
      } else {
        if (arrow) {
          if (tween) tween.to(arrow, { rotation: 0, duration: 0.25, ease: 'power2.inOut' });
          else arrow.textContent = 'chevron_right';
        }
        if (tween) {
          subList.style.overflow = 'hidden';
          tween.to(subList, {
            height: 0, opacity: 0, duration: 0.26, ease: 'power2.inOut',
            onComplete: () => { subList.classList.add('hidden'); subList.style.height = ''; subList.style.overflow = ''; subList.style.opacity = ''; },
          });
        } else {
          subList.classList.add('hidden');
        }
      }
    }

    // Mobile Navigation Drawer Toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const menuIcon = document.getElementById('menu-icon');

    mobileMenuBtn?.addEventListener('click', () => {
      const isHidden = mobileMenu.classList.contains('hidden');
      if (isHidden) {
        mobileMenu.classList.remove('hidden');
        menuIcon.textContent = 'close';
      } else {
        mobileMenu.classList.add('hidden');
        menuIcon.textContent = 'menu';
      }
    });

    // Close mobile menu on link click
    document.querySelectorAll('.mobile-nav-link').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.add('hidden');
        menuIcon.textContent = 'menu';
      });
    });

    // Route-aware accordion auto-expand and mobile drawer dismiss
    document.addEventListener('DOMContentLoaded', () => {
      const sidebar = document.getElementById('app-sidebar');
      const isCollapsed = sidebar ? sidebar.classList.contains('sidebar-collapsed') : isSidebarCollapsed;

      const subModel = document.getElementById('subheadings-model-portal');
      const subData = document.getElementById('subheadings-data-studio');
      const arrowModel = document.getElementById('arrow-model-portal');
      const arrowData = document.getElementById('arrow-data-studio');

      // Keep subheadings collapsed if sidebar is collapsed
      if (isCollapsed) {
        if (subModel) subModel.classList.add('hidden');
        if (subData) subData.classList.add('hidden');
        if (arrowModel) arrowModel.textContent = 'chevron_right';
        if (arrowData) arrowData.textContent = 'chevron_right';
      } else {
        const hash = window.location.hash || '';
        if (hash.includes('data-studio') || hash.includes('dsn-')) {
          if (subData) subData.classList.remove('hidden');
          if (arrowData) arrowData.textContent = 'expand_more';
          if (subModel) subModel.classList.add('hidden');
          if (arrowModel) arrowModel.textContent = 'chevron_right';
        } else if (!hash.includes('model-predictor')) {
          if (subModel) subModel.classList.remove('hidden');
          if (arrowModel) arrowModel.textContent = 'expand_more';
          if (subData) subData.classList.add('hidden');
          if (arrowData) arrowData.textContent = 'chevron_right';
        }
      }

      // Close mobile drawer on any navigation link click inside sidebar
      document.querySelectorAll('#app-sidebar a').forEach(link => {
        link.addEventListener('click', () => {
          if (isMobileSidebarOpen) {
            closeMobileSidebar();
          }
        });
      });
    });

    // Expose globally
    window.openMobileSidebarExpanded = openMobileSidebarExpanded;
    window.closeMobileSidebar = closeMobileSidebar;
    window.toggleMobileSidebar = toggleMobileSidebar;
    window.toggleSidebarCollapse = toggleSidebarCollapse;
    window.toggleSidebarAccordion = toggleSidebarAccordion;
    window.handleSidebarCollapseClick = handleSidebarCollapseClick;

