/**
 * SCAD College Attendance ERP - Authentication Module
 * Handles login, logout, role-based access, session management,
 * password management, security hardening, and common UI setup.
 */
(function () {
  'use strict';

  // ========== ADMIN USERS SEED ==========
  const DEFAULT_ADMIN_USERS = [
    { username: 'admin', password: 'admin123', role: 'admin', name: 'Dr. K. Ganesan', designation: 'Principal', department: 'ALL', mustChangePassword: true },
    // HODs
    { username: 'hod_sh', password: 'hod123', role: 'hod', name: 'Dr. T. Murugan', designation: 'HOD - Science & Humanities', department: 'ALL_I', mustChangePassword: true },
    { username: 'hod_cse', password: 'hod123', role: 'hod', name: 'Dr. R. Meena', designation: 'HOD - CSE', department: 'CSE', mustChangePassword: true },
    { username: 'hod_ece', password: 'hod123', role: 'hod', name: 'Dr. A. Selvan', designation: 'HOD - ECE', department: 'ECE', mustChangePassword: true },
    { username: 'hod_eee', password: 'hod123', role: 'hod', name: 'Dr. M. Karthik', designation: 'HOD - EEE', department: 'EEE', mustChangePassword: true },
    { username: 'hod_mech', password: 'hod123', role: 'hod', name: 'Dr. S. Kumar', designation: 'HOD - MECH', department: 'MECH', mustChangePassword: true },
    { username: 'hod_civil', password: 'hod123', role: 'hod', name: 'Dr. V. Prakash', designation: 'HOD - CIVIL', department: 'CIVIL', mustChangePassword: true },
    // Faculty
    { username: 'faculty_cse_1', password: 'faculty123', role: 'faculty', name: 'Dr. S. Ramesh', designation: 'Professor', department: 'CSE', facultyId: 'faculty_cse_1', mustChangePassword: true },
    { username: 'faculty_cse_2', password: 'faculty123', role: 'faculty', name: 'Mrs. K. Priya', designation: 'Asst. Professor', department: 'CSE', facultyId: 'faculty_cse_2', mustChangePassword: true },
    { username: 'faculty_cse_3', password: 'faculty123', role: 'faculty', name: 'Mr. R. Vignesh', designation: 'Asst. Professor', department: 'CSE', facultyId: 'faculty_cse_3', mustChangePassword: true },
    { username: 'faculty_ece', password: 'faculty123', role: 'faculty', name: 'Mr. P. Kumar', designation: 'Asst. Professor', department: 'ECE', facultyId: 'faculty_ece', mustChangePassword: true },
    { username: 'faculty_math', password: 'faculty123', role: 'faculty', name: 'Dr. T. Natarajan', designation: 'Professor', department: 'ALL_I', facultyId: 'faculty_math', mustChangePassword: true },
    { username: 'faculty_phy', password: 'faculty123', role: 'faculty', name: 'Dr. S. Krishnan', designation: 'Professor', department: 'ALL_I', facultyId: 'faculty_phy', mustChangePassword: true },
    { username: 'faculty_eng', password: 'faculty123', role: 'faculty', name: 'Mrs. V. Lakshmi', designation: 'Asst. Professor', department: 'ALL_I', facultyId: 'faculty_eng', mustChangePassword: true }
  ];

  // ========== LOGIN RATE LIMITING ==========
  const MAX_LOGIN_ATTEMPTS = 3;
  const LOCKOUT_DURATION_MS = 30000; // 30 seconds
  let loginAttempts = 0;
  let lockoutUntil = 0;

  // ========== SESSION TIMEOUT ==========
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  let activityTimer = null;

  function getAdminUsers() {
    let users = localStorage.getItem('scad_admin_users');
    if (!users) {
      localStorage.setItem('scad_admin_users', JSON.stringify(DEFAULT_ADMIN_USERS));
      return JSON.parse(JSON.stringify(DEFAULT_ADMIN_USERS));
    }
    return JSON.parse(users);
  }

  function saveAdminUsers(users) {
    localStorage.setItem('scad_admin_users', JSON.stringify(users));
  }

  // ========== SECURITY QUESTIONS ==========
  var SECURITY_QUESTIONS = [
    "What is your mother's maiden name?",
    "What was the name of your first school?",
    "What is your favourite movie?",
    "What city were you born in?",
    "What is your pet's name?",
    "What is your favourite food?"
  ];

  function getSecurityData() {
    var data = localStorage.getItem('scad_security_qa');
    return data ? JSON.parse(data) : {};
  }

  function saveSecurityData(data) {
    localStorage.setItem('scad_security_qa', JSON.stringify(data));
  }

  function setSecurityQuestion(username, questionIdx, answer) {
    var data = getSecurityData();
    data[username] = { questionIdx: questionIdx, answer: answer.trim().toLowerCase() };
    saveSecurityData(data);
  }

  function hasSecurityQuestion(username) {
    var data = getSecurityData();
    return !!(data[username] && data[username].answer);
  }

  function verifySecurityAnswer(username, answer) {
    var data = getSecurityData();
    if (!data[username]) return false;
    return data[username].answer === answer.trim().toLowerCase();
  }

  function getSecurityQuestionForUser(username) {
    var data = getSecurityData();
    if (!data[username]) return null;
    return SECURITY_QUESTIONS[data[username].questionIdx] || null;
  }

  // ========== PASSWORD VALIDATION ==========
  function validatePasswordStrength(password, username) {
    const errors = [];
    if (password.length < 8) errors.push('Must be at least 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('Must contain an uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('Must contain a lowercase letter');
    if (!/[0-9]/.test(password)) errors.push('Must contain a digit');
    if (username && password.toLowerCase() === username.toLowerCase()) errors.push('Cannot be the same as your username');
    return { valid: errors.length === 0, errors: errors };
  }

  // ========== SESSION HELPERS (no password in session) ==========
  function buildSessionUser(source, extraFields) {
    var user = {
      username: source.username,
      role: source.role,
      name: source.name,
      designation: source.designation || source.role,
      department: source.department,
      mustChangePassword: !!source.mustChangePassword
    };
    if (extraFields) {
      for (var key in extraFields) {
        if (extraFields.hasOwnProperty(key)) user[key] = extraFields[key];
      }
    }
    return user;
  }

  /**
   * Attempts to log in with the given credentials.
   * Returns { user, error, locked, lockoutRemaining }
   */
  function login(username, password) {
    // Rate limiting check
    var now = Date.now();
    if (now < lockoutUntil) {
      var remaining = Math.ceil((lockoutUntil - now) / 1000);
      return { user: null, error: 'Too many failed attempts. Try again in ' + remaining + ' seconds.', locked: true, lockoutRemaining: remaining };
    }

    var adminUsers = getAdminUsers();
    // Check admin/hod/faculty in ADMIN_USERS
    var admin = adminUsers.find(function(u) { return u.username === username && u.password === password; });
    if (admin) {
      loginAttempts = 0;
      var user = buildSessionUser(admin, admin.facultyId ? { facultyId: admin.facultyId } : null);
      sessionStorage.setItem('scad_user', JSON.stringify(user));
      return { user: user, error: null };
    }

    // Check faculty (from Timetable module)
    if (window.Timetable && window.Timetable.FACULTY) {
      var faculty = window.Timetable.getFacultyById ? window.Timetable.getFacultyById(username) : window.Timetable.FACULTY.find(function(f) { return f.username === username; });
      if (faculty && faculty.password === password) {
        loginAttempts = 0;
        var user = buildSessionUser({
          username: faculty.username,
          role: 'faculty',
          name: faculty.name,
          designation: faculty.designation,
          department: faculty.dept,
          mustChangePassword: !!faculty.mustChangePassword
        }, { facultyId: faculty.id });
        sessionStorage.setItem('scad_user', JSON.stringify(user));
        return { user: user, error: null };
      }
    }

    // Check student
    if (window.MockData) {
      var student = window.MockData.getStudentByRegNo(username);
      if (student && password === (student.password || student.regNo)) {
        loginAttempts = 0;
        var user = buildSessionUser({
          username: student.regNo,
          role: 'student',
          name: student.name,
          designation: student.year + ' Year - ' + student.department + ' ' + student.section,
          department: student.department,
          mustChangePassword: !!student.mustChangePassword
        }, {
          year: student.year,
          section: student.section,
          classGroup: student.classGroup,
          studentId: student.id,
          regNo: student.regNo
        });
        sessionStorage.setItem('scad_user', JSON.stringify(user));
        return { user: user, error: null };
      }
    }

    // Failed login
    loginAttempts++;
    if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
      loginAttempts = 0;
      return { user: null, error: 'Too many failed attempts. Account locked for 30 seconds.', locked: true, lockoutRemaining: LOCKOUT_DURATION_MS / 1000 };
    }

    var attemptsLeft = MAX_LOGIN_ATTEMPTS - loginAttempts;
    return { user: null, error: 'Invalid username or password. ' + attemptsLeft + ' attempt' + (attemptsLeft > 1 ? 's' : '') + ' remaining.' };
  }

  // ========== CHANGE PASSWORD (self-service, requires old password) ==========
  function changePassword(oldPassword, newPassword) {
    var user = getCurrentUser();
    if (!user) return { success: false, error: 'Not logged in' };

    var validation = validatePasswordStrength(newPassword, user.username);
    if (!validation.valid) return { success: false, error: validation.errors.join('. ') };

    if (user.role === 'student') {
      var students = window.MockData.getStudentsList();
      var studentIdx = students.findIndex(function(s) { return s.regNo === user.username; });
      if (studentIdx === -1) return { success: false, error: 'User not found' };
      var student = students[studentIdx];
      if ((student.password || student.regNo) !== oldPassword) return { success: false, error: 'Current password is incorrect' };
      students[studentIdx].password = newPassword;
      students[studentIdx].mustChangePassword = false;
      window.MockData.saveStudentsList(students);
    } else {
      var admins = getAdminUsers();
      var adminIdx = admins.findIndex(function(a) { return a.username === user.username; });
      if (adminIdx > -1) {
        if (admins[adminIdx].password !== oldPassword) return { success: false, error: 'Current password is incorrect' };
        admins[adminIdx].password = newPassword;
        admins[adminIdx].mustChangePassword = false;
        saveAdminUsers(admins);
      } else if (window.Timetable && window.Timetable.getFacultyList) {
        var faculties = window.Timetable.getFacultyList();
        var facIdx = faculties.findIndex(function(f) { return f.username === user.username || f.id === user.username; });
        if (facIdx === -1) return { success: false, error: 'User not found' };
        if (faculties[facIdx].password !== oldPassword) return { success: false, error: 'Current password is incorrect' };
        faculties[facIdx].password = newPassword;
        faculties[facIdx].mustChangePassword = false;
        window.Timetable.saveFacultyList(faculties);
      } else {
        return { success: false, error: 'User not found' };
      }
    }

    user.mustChangePassword = false;
    sessionStorage.setItem('scad_user', JSON.stringify(user));
    return { success: true };
  }

  // ========== FORCE PASSWORD CHANGE (first login, no old password needed) ==========
  function forcePasswordChange(newPassword) {
    var user = getCurrentUser();
    if (!user) return { success: false, error: 'Not logged in' };

    var validation = validatePasswordStrength(newPassword, user.username);
    if (!validation.valid) return { success: false, error: validation.errors.join('. ') };

    if (user.role === 'student') {
      var students = window.MockData.getStudentsList();
      var studentIdx = students.findIndex(function(s) { return s.regNo === user.username; });
      if (studentIdx === -1) return { success: false, error: 'User not found' };
      students[studentIdx].password = newPassword;
      students[studentIdx].mustChangePassword = false;
      window.MockData.saveStudentsList(students);
    } else {
      var admins = getAdminUsers();
      var adminIdx = admins.findIndex(function(a) { return a.username === user.username; });
      if (adminIdx > -1) {
        admins[adminIdx].password = newPassword;
        admins[adminIdx].mustChangePassword = false;
        saveAdminUsers(admins);
      } else if (window.Timetable && window.Timetable.getFacultyList) {
        var faculties = window.Timetable.getFacultyList();
        var facIdx = faculties.findIndex(function(f) { return f.username === user.username || f.id === user.username; });
        if (facIdx === -1) return { success: false, error: 'User not found' };
        faculties[facIdx].password = newPassword;
        faculties[facIdx].mustChangePassword = false;
        window.Timetable.saveFacultyList(faculties);
      } else {
        return { success: false, error: 'User not found' };
      }
    }

    user.mustChangePassword = false;
    sessionStorage.setItem('scad_user', JSON.stringify(user));
    return { success: true };
  }

  function getCurrentUser() {
    var data = sessionStorage.getItem('scad_user');
    return data ? JSON.parse(data) : null;
  }

  function logout() {
    sessionStorage.removeItem('scad_user');
    if (activityTimer) clearTimeout(activityTimer);
    window.location.href = 'index.html';
  }

  function requireAuth(requiredRole) {
    var user = getCurrentUser();
    if (!user) {
      window.location.href = 'index.html';
      return null;
    }
    if (user.mustChangePassword) {
      var currentPage = window.location.pathname.split('/').pop() || 'index.html';
      if (currentPage !== 'index.html' && currentPage !== 'change-password.html') {
        window.location.href = 'index.html';
        return null;
      }
    }
    if (requiredRole && user.role !== requiredRole && user.role !== 'admin' && user.role !== 'hod') {
      window.location.href = getRedirectForRole(user.role);
      return null;
    }
    return user;
  }

  function getRedirectForRole(role) {
    switch (role) {
      case 'admin': return 'dashboard.html';
      case 'hod': return 'hod.html';
      case 'faculty': return 'faculty.html';
      case 'student': return 'student.html';
      default: return 'index.html';
    }
  }

  // ========== SESSION TIMEOUT (inactivity) ==========
  function resetActivityTimer() {
    if (activityTimer) clearTimeout(activityTimer);
    activityTimer = setTimeout(function() {
      var user = getCurrentUser();
      if (user) {
        alert('Your session has expired due to inactivity. Please log in again.');
        logout();
      }
    }, SESSION_TIMEOUT_MS);
  }

  function setupSessionTimeout() {
    var user = getCurrentUser();
    if (!user) return;
    var events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(function(evt) {
      document.addEventListener(evt, resetActivityTimer, { passive: true });
    });
    resetActivityTimer();
  }

  // ========== COMMON UI SETUP ==========
  function setupCommonUI() {
    var user = getCurrentUser();
    if (!user) return;

    // Check mustChangePassword redirect
    if (user.mustChangePassword) {
      var currentPage = window.location.pathname.split('/').pop() || 'index.html';
      if (currentPage !== 'index.html' && currentPage !== 'change-password.html') {
        window.location.href = 'index.html';
        return;
      }
    }

    // --- Sidebar visibility by role ---
    // Hide ALL role-specific elements first
    document.querySelectorAll('.admin-only, .hod-only, .faculty-only, .student-only').forEach(function(el) {
      el.style.setProperty('display', 'none', 'important');
    });
    // Show only items for current role
    var roleClass = '.' + user.role + '-only';
    document.querySelectorAll(roleClass).forEach(function(el) {
      el.style.setProperty('display', 'flex', 'important');
    });

    // --- Active nav link ---
    var currentPath = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.sidebar__nav-item').forEach(function(link) {
      link.classList.remove('sidebar__nav-item--active');
      if (link.getAttribute('href') === currentPath) {
        link.classList.add('sidebar__nav-item--active');
      }
    });

    // --- Dynamic header title ---
    var headerTitle = document.getElementById('dynamic-header-title');
    if (headerTitle) {
      var titles = {
        'dashboard.html': 'Dashboard',
        'hod.html': 'Head of Department Dashboard',
        'faculty.html': 'My Classes & Attendance',
        'reports.html': 'Reports & Analytics',
        'admin-timetable.html': 'Timetable Management',
        'students.html': 'Student Management',
        'staff.html': 'Staff Management',
        'notifications.html': 'My Notifications',
        'change-password.html': 'Change Password'
      };
      if (titles[currentPath]) headerTitle.textContent = titles[currentPath];
    }

    // --- Header user info ---
    var userDisplay = document.getElementById('user-display');
    if (userDisplay) userDisplay.textContent = user.name || user.username;

    var userRole = document.getElementById('user-role');
    if (userRole) {
      userRole.textContent = user.designation || user.role;
      if (user.role === 'admin') {
        userRole.className = 'badge badge--admin';
      } else if (user.role === 'hod') {
        userRole.className = 'badge';
        userRole.style.background = '#1565C0';
        userRole.style.color = '#FFFFFF';
        userRole.style.border = 'none';
      } else {
        userRole.className = 'badge badge--faculty';
      }
    }

    // --- Sidebar user info ---
    var sidebarAvatar = document.getElementById('sidebar-avatar');
    if (sidebarAvatar) sidebarAvatar.textContent = (user.name || 'U').charAt(0).toUpperCase();

    var sidebarName = document.getElementById('sidebar-user-name');
    if (sidebarName) sidebarName.textContent = user.name || user.username;

    var sidebarRole = document.getElementById('sidebar-user-role');
    if (sidebarRole) sidebarRole.textContent = user.designation || user.role;

    // --- Clock (header-date) ---
    var clockEl = document.getElementById('header-date');
    if (clockEl) {
      var updateClock = function() {
        var now = new Date();
        var datePart = now.toLocaleDateString('en-IN', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        var timePart = now.toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
        });
        clockEl.textContent = datePart + ' \u2022 ' + timePart;
      };
      updateClock();
      setInterval(updateClock, 1000);
    }

    // --- Logout buttons ---
    var logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', function() { logout(); });

    var sidebarLogoutBtn = document.getElementById('sidebar-logout-btn');
    if (sidebarLogoutBtn) sidebarLogoutBtn.addEventListener('click', function(e) { e.preventDefault(); logout(); });

    // --- Theme toggle ---
    var themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', function() {
        if (window.Theme && window.Theme.toggle) window.Theme.toggle();
      });
    }

    // --- Session timeout ---
    setupSessionTimeout();
  }

  // Auto-run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupCommonUI);
  } else {
    setupCommonUI();
  }

  // ========== RE-AUTHENTICATION FOR SENSITIVE OPERATIONS ==========
  /**
   * Verifies the current logged-in user's password before allowing
   * sensitive operations like resetting passwords or deleting users.
   * Returns a Promise that resolves to true if verified, false if cancelled.
   */
  function verifyCurrentUser(actionDescription) {
    return new Promise(function(resolve) {
      // Create modal overlay
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;';

      var card = document.createElement('div');
      card.style.cssText = 'background:var(--color-surface,#fff);border-radius:16px;padding:2rem;max-width:400px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.2);';

      card.innerHTML = '<h3 style="margin:0 0 0.5rem 0;font-size:1.2rem;"> Verify Your Identity</h3>'
        + '<p style="color:var(--color-text-muted,#666);font-size:0.9rem;margin:0 0 1rem 0;">To <strong>' + (actionDescription || 'perform this action') + '</strong>, please enter your current password.</p>'
        + '<input type="password" id="reauth-pwd" class="form-input" style="width:100%;margin-bottom:0.75rem;padding:10px;" placeholder="Enter your password" autofocus>'
        + '<div id="reauth-error" style="color:#C62828;font-size:0.85rem;margin-bottom:0.75rem;display:none;"></div>'
        + '<div style="display:flex;justify-content:flex-end;gap:0.75rem;">'
        + '<button type="button" id="reauth-cancel" class="btn btn--outline" style="padding:8px 1.5rem;">Cancel</button>'
        + '<button type="button" id="reauth-confirm" class="btn btn--primary" style="padding:8px 1.5rem;">Verify</button>'
        + '</div>';

      overlay.appendChild(card);
      document.body.appendChild(overlay);

      var pwdInput = document.getElementById('reauth-pwd');
      var errEl = document.getElementById('reauth-error');

      // Focus
      setTimeout(function() { pwdInput.focus(); }, 50);

      function cleanup() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }

      function doVerify() {
        var pwd = pwdInput.value;
        if (!pwd) {
          errEl.textContent = 'Please enter your password';
          errEl.style.display = 'block';
          return;
        }

        var user = getCurrentUser();
        if (!user) { cleanup(); resolve(false); return; }

        // Look up the actual stored password
        var verified = false;
        if (user.role === 'student') {
          var students = window.MockData ? window.MockData.getStudentsList() : [];
          var student = students.find(function(s) { return s.regNo === user.username; });
          if (student && (student.password || student.regNo) === pwd) verified = true;
        } else {
          var admins = getAdminUsers();
          var admin = admins.find(function(a) { return a.username === user.username; });
          if (admin && admin.password === pwd) {
            verified = true;
          } else if (window.Timetable && window.Timetable.getFacultyList) {
            var faculties = window.Timetable.getFacultyList();
            var fac = faculties.find(function(f) { return f.username === user.username || f.id === user.username; });
            if (fac && fac.password === pwd) verified = true;
          }
        }

        if (verified) {
          cleanup();
          resolve(true);
        } else {
          errEl.textContent = 'Incorrect password';
          errEl.style.display = 'block';
          pwdInput.value = '';
          pwdInput.focus();
        }
      }

      document.getElementById('reauth-confirm').addEventListener('click', doVerify);
      document.getElementById('reauth-cancel').addEventListener('click', function() { cleanup(); resolve(false); });
      pwdInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') doVerify(); });
      // Close on overlay click (not card)
      overlay.addEventListener('click', function(e) { if (e.target === overlay) { cleanup(); resolve(false); } });
    });
  }

  // Export globally
  window.Auth = {
    login: login,
    logout: logout,
    getCurrentUser: getCurrentUser,
    requireAuth: requireAuth,
    setupCommonUI: setupCommonUI,
    getRedirectForRole: getRedirectForRole,
    getAdminUsers: getAdminUsers,
    saveAdminUsers: saveAdminUsers,
    changePassword: changePassword,
    forcePasswordChange: forcePasswordChange,
    validatePasswordStrength: validatePasswordStrength,
    verifyCurrentUser: verifyCurrentUser,
    SECURITY_QUESTIONS: SECURITY_QUESTIONS,
    setSecurityQuestion: setSecurityQuestion,
    hasSecurityQuestion: hasSecurityQuestion,
    verifySecurityAnswer: verifySecurityAnswer,
    getSecurityQuestionForUser: getSecurityQuestionForUser
  };

})();
