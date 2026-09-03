/**
 * SCAD College Attendance Dashboard - Theme Manager
 * Handles light/dark mode toggling and persistence.
 */
(function () {
  'use strict';

  const THEME_KEY = 'scad_theme_preference';

  /**
   * Initializes the theme based on local storage or defaults to light.
   */
  function init() {
    let savedTheme = localStorage.getItem(THEME_KEY);
    
    if (!savedTheme) {
      // Default to light theme for institutional portal
      savedTheme = 'light';
    }
    
    applyTheme(savedTheme);
  }

  /**
   * Toggles the current theme between light and dark.
   */
  function toggle() {
    const currentTheme = getCurrentTheme();
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
  }

  /**
   * Retrieves the current active theme.
   * @returns {string} 'light' or 'dark'
   */
  function getCurrentTheme() {
    return document.body.getAttribute('data-theme') || 'light';
  }

  /**
   * Applies the specified theme to the document and updates UI elements.
   * @param {string} theme - 'light' or 'dark'
   */
  function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    
    // Update toggle button icon if it exists
    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (toggleBtn) {
      if (theme === 'dark') {
        toggleBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
        toggleBtn.setAttribute('aria-label', 'Switch to light mode');
      } else {
        toggleBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
        toggleBtn.setAttribute('aria-label', 'Switch to dark mode');
      }
    }
  }

    /**
   * Initializes global UI elements like the mobile sidebar toggle & overlay.
   */
  function initGlobalUI() {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
    let overlay = document.getElementById('sidebar-overlay');

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'sidebar-overlay';
      overlay.className = 'sidebar-overlay';
      document.body.appendChild(overlay);
    }

    if (sidebarToggle && sidebar) {
      sidebarToggle.onclick = function (e) {
        e.stopPropagation();
        sidebar.classList.toggle('open');
        if (sidebar.classList.contains('open')) {
          overlay.classList.add('active');
          document.body.style.overflow = 'hidden';
        } else {
          overlay.classList.remove('active');
          document.body.style.overflow = '';
        }
      };
    }

    if (overlay && sidebar) {
      overlay.onclick = function () {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
      };
    }

    // Auto-close drawer on mobile navigation click
    document.querySelectorAll('.sidebar__nav-item').forEach(function(item) {
      item.addEventListener('click', function() {
        if (window.innerWidth <= 768 && sidebar) {
          sidebar.classList.remove('open');
          if (overlay) overlay.classList.remove('active');
          document.body.style.overflow = '';
        }
      });
    });

    // Sidebar Logout
    const sidebarLogoutBtn = document.getElementById('sidebar-logout-btn');
    if (sidebarLogoutBtn) {
      sidebarLogoutBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (window.Auth && window.Auth.logout) window.Auth.logout();
      });
    }
  }

  // Auto-init global UI when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGlobalUI);
  } else {
    initGlobalUI();
  }

  // Export to window
  window.Theme = {
    init,
    toggle,
    getCurrentTheme,
    applyTheme
  };

})();


  /**
   * Universal Password Visibility Toggle
   */
  window.togglePasswordVisibility = function(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    
    if (btn) {
      btn.innerHTML = isPassword 
        ? '<svg class="eye-off-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>'
        : '<svg class="eye-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    }
  };

  /**
   * Auto-enhance all password inputs across the entire application
   */
  function setupAllPasswordFields() {
    document.querySelectorAll('input[type="password"], input[data-pwd-toggle]').forEach(function(input) {
      if (!input.id) {
        input.id = 'pwd_' + Math.random().toString(36).substring(2, 9);
      }
      let wrapper = input.parentElement;
      if (!wrapper || !wrapper.classList.contains('password-input-wrapper')) {
        wrapper = document.createElement('div');
        wrapper.className = 'password-input-wrapper';
        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);
      }

      if (!wrapper.querySelector('.password-toggle-btn')) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'password-toggle-btn';
        btn.setAttribute('aria-label', 'Toggle password visibility');
        btn.innerHTML = '<svg class="eye-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
        btn.onclick = function(e) {
          e.preventDefault();
          window.togglePasswordVisibility(input.id, btn);
        };
        wrapper.appendChild(btn);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAllPasswordFields);
  } else {
    setupAllPasswordFields();
  }
  // Re-run periodically to capture any modal inputs
  setInterval(setupAllPasswordFields, 1500);

