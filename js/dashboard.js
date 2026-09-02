/**
 * SCAD College Attendance Dashboard — Main Controller
 * Ties together MockData, Auth, AttendanceEngine, Theme, and Charts.
 */
(function (window) {
  'use strict';

  const Dashboard = {
    currentDate: '',
    currentPage: 1,
    pageSize: 15,
    records: [],        // full attendance records from engine
    filteredRecords: [], // after search/filter
    debounceTimer: null,
    currentUser: null,

    /* ============================
       INITIALISATION
       ============================ */
    
    _renderDiscrepancies: function() {
      const tbody = document.getElementById('discrepancy-table-body');
      const badge = document.getElementById('discrepancy-badge');
      if (!tbody) return;

      if (!window.ReconciliationEngine) return;
      const list = window.ReconciliationEngine.analyzeDiscrepancies(this.currentDate, this.currentDept);

      if (badge) {
        badge.textContent = `${list.length} Flagged`;
        badge.className = list.length > 0 ? 'badge badge--absent' : 'badge badge--present';
      }

      if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:#2E7D32; font-weight:500;">✓ No attendance discrepancies or bunking detected. All records reconciled.</td></tr>';
        return;
      }

      tbody.innerHTML = list.slice(0, 10).map(d => {
        const typeBadge = d.type === 'SUSPECTED_BUNKING'
          ? '<span class="badge badge--bunk">Suspected Bunking</span>'
          : '<span class="badge badge--gatemiss">Gate Miss</span>';

        const actionBtns = d.resolved
          ? `<span style="color:#2E7D32; font-weight:600; font-size:0.8rem;">✓ ${d.resolutionText || 'Resolved'}</span>`
          : `<div style="display:flex; gap:4px;">
              <button class="btn btn--sm btn--outline" onclick="window.Dashboard._resolveDiscrepancy('${d.id}', 'EXCUSED')">Excuse</button>
              <button class="btn btn--sm btn--danger" onclick="window.Dashboard._resolveDiscrepancy('${d.id}', 'CONFIRMED_BUNKING')">Notify Parent</button>
            </div>`;

        return `<tr>
          <td><strong><a href="#" class="profile-btn" data-student-id="${d.studentId}" style="color:var(--color-primary);">${d.studentName}</a></strong><br><small style="color:var(--color-text-muted);">${d.regNo}</small></td>
          <td>${d.department} - ${d.year} (${d.section})</td>
          <td><strong>${d.gateTime}</strong></td>
          <td>${typeBadge}</td>
          <td><small>${d.details}</small></td>
          <td>${actionBtns}</td>
        </tr>`;
      }).join('');
    },

    _resolveDiscrepancy: function(id, actionType) {
      if (window.ReconciliationEngine) {
        window.ReconciliationEngine.resolveDiscrepancy(id, actionType);
        if (actionType === 'CONFIRMED_BUNKING') {
          alert('Parent SMS alert queued and recorded to student disciplinary profile.');
        }
        this._renderDiscrepancies();
      }
    },

    init: function () {
      // Auth gate
      if (!window.Auth || !window.Auth.getCurrentUser()) {
        window.location.href = 'index.html';
        return;
      }
      this.currentUser = window.Auth.getCurrentUser();

      // Theme
      if (window.Theme) window.Theme.init();

      // Today's date
      const today = new Date();
      this.currentDate = this._dateToStr(today);

      const datePicker = document.getElementById('date-picker');
      if (datePicker) datePicker.value = this.currentDate;

      // Clock — update every second
      this._updateHeaderTime();
      setInterval(() => this._updateHeaderTime(), 1000);

      // UI setup
      this._setupUserDisplay();
      this._setupEventListeners();

      // Faculty: restrict dept filter to own department
      if (this.currentUser && this.currentUser.role === 'faculty' && this.currentUser.department !== 'ALL') {
        const deptFilter = document.getElementById('dept-filter');
        if (deptFilter) {
          deptFilter.value = this.currentUser.department;
          deptFilter.disabled = true;
        }
      }

      // Load data
      this.loadAttendance(this.currentDate);
    },

    /* ============================
       DATA LOADING
       ============================ */
    loadAttendance: function (dateStr) {
      this.currentDate = dateStr;

      if (!window.MockData || !window.AttendanceEngine) {
        this.records = [];
        this.applyFilters();
        return;
      }

      const students = window.MockData.students;
      const attendanceData = window.MockData.generateGateData(dateStr);
      const overrides = window.AttendanceEngine.getOverrides(dateStr);
      this.records = window.AttendanceEngine.buildGateRecords(students, attendanceData, overrides);

      this.applyFilters();
      this._renderDefaulters(dateStr);
    },

    /* ============================
       FILTERING
       ============================ */
    applyFilters: function () {
      const searchVal = (document.getElementById('search-input') || {}).value || '';
      const deptVal = (document.getElementById('dept-filter') || {}).value || 'ALL';
      const statusVal = (document.getElementById('status-filter') || {}).value || 'ALL';
      const yearVal = (document.getElementById('year-filter') || {}).value || 'ALL';

      // Map select values to engine values (handle case)
      const statusMap = { 'Present': 'present', 'Late': 'late', 'Absent': 'absent', 'ALL': 'ALL' };
      const engineStatus = statusMap[statusVal] || statusVal;

      this.filteredRecords = window.AttendanceEngine.filterRecords(this.records, {
        search: searchVal,
        department: deptVal,
        status: engineStatus
      });

      // Year filter
      if (yearVal !== 'ALL') {
        this.filteredRecords = this.filteredRecords.filter(r => r.student.year === yearVal);
      }

      // Period filter
      const periodVal = (document.getElementById('period-filter') || {}).value || 'ALL';
      if (periodVal !== 'ALL') {
        const periodNum = parseInt(periodVal, 10);
        // We need to fetch period attendance for all relevant class groups
        const periodDataByClassGroup = {};
        
        this.filteredRecords = this.filteredRecords.map(r => {
          const cg = r.student.classGroup;
          if (!periodDataByClassGroup[cg]) {
            periodDataByClassGroup[cg] = window.AttendanceEngine.getPeriodAttendance(this.currentDate, cg, periodNum);
          }
          const pStatus = periodDataByClassGroup[cg][r.student.id] || 'absent';
          
          // Apply status filter on period status
          if (engineStatus !== 'ALL' && pStatus !== engineStatus) {
             return null;
          }
          
          return {
            ...r,
            status: pStatus,
            checkIn: null,
            checkOut: null,
            isOverridden: false,
            overrideReason: null
          };
        }).filter(r => r !== null);
      }

      // Faculty sees only their department
      if (this.currentUser && this.currentUser.role === 'faculty' && this.currentUser.department !== 'ALL') {
        this.filteredRecords = this.filteredRecords.filter(r => r.student.department === this.currentUser.department);
      }

      this.currentPage = 1;
      this._render();
    },

    /* ============================
       RENDERING
       ============================ */
    _render: function () {
      this._renderStats();
      this._renderTable();
      this._renderCharts();
      this._renderDeviceAlerts();
      this._renderHODVerification();
    },

    _renderStats: function () {
      const stats = window.AttendanceEngine.calculateStats(this.filteredRecords);
      this._animateValue('total-count', stats.total);
      this._animateValue('present-count', stats.present);
      this._animateValue('late-count', stats.late);
      this._animateValue('absent-count', stats.absent);
      this._animateValue('checkout-count', stats.checkedOut);

      // Active devices
      if (window.MockData && window.MockData.getActiveDeviceCount) {
        const activeCount = window.MockData.getActiveDeviceCount();
        const totalDevices = window.MockData.devices ? window.MockData.devices.length : 5;
        const offlineCount = totalDevices - activeCount;
        const el = document.getElementById('active-device-count');
        if (el) el.textContent = activeCount;
        const noteEl = document.getElementById('device-offline-note');
        if (noteEl) {
          noteEl.textContent = offlineCount > 0 ? offlineCount + ' device' + (offlineCount > 1 ? 's' : '') + ' offline' : 'All systems normal';
          noteEl.style.color = offlineCount > 0 ? '#C62828' : '#2E7D32';
        }
      }
    },

    _renderTable: function () {
      const tbody = document.getElementById('attendance-table-body');
      const emptyState = document.getElementById('empty-state');
      const paginationEl = document.getElementById('pagination');
      if (!tbody) return;

      tbody.innerHTML = '';

      if (this.filteredRecords.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        if (paginationEl) paginationEl.innerHTML = '';
        return;
      }
      if (emptyState) emptyState.style.display = 'none';

      // Pagination slice
      const start = (this.currentPage - 1) * this.pageSize;
      const end = Math.min(start + this.pageSize, this.filteredRecords.length);
      const page = this.filteredRecords.slice(start, end);
      const isAdmin = this.currentUser && this.currentUser.role === 'admin';

      page.forEach((r, idx) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--color-border-light)';

        // Status badge class
        const badgeClass = {
          present: 'badge--present',
          late: 'badge--late',
          absent: 'badge--absent'
        }[r.status] || '';

        // Status display label (capitalize first letter)
        const statusLabel = r.status.charAt(0).toUpperCase() + r.status.slice(1);

        // Clickable name
        let nameHtml = `<a class="student-name-link profile-btn" data-student-id="${r.student.id}">${this._escapeHtml(r.student.name)}</a>`;
        if (r.isOverridden && r.overrideReason) {
            nameHtml += `<br><small style="color:var(--color-text-muted); font-size:0.8rem;">Note: ${this._escapeHtml(r.overrideReason)}</small>`;
        }

        tr.innerHTML = `
          <td style="padding:0.75rem 1rem;color:var(--color-text-muted)">${start + idx + 1}</td>
          <td style="padding:0.75rem 1rem;font-weight:500">${r.student.regNo}</td>
          <td style="padding:0.75rem 1rem">${nameHtml}</td>
          <td style="padding:0.75rem 1rem">${r.student.department}</td>
          <td style="padding:0.75rem 1rem">${r.student.year}</td>
          <td style="padding:0.75rem 1rem;color:var(--color-text-secondary)">${this._formatTime(r.checkIn)}</td>
          <td style="padding:0.75rem 1rem;color:var(--color-text-secondary)">${this._formatTime(r.checkOut)}</td>
          <td style="padding:0.75rem 1rem"><span class="badge ${badgeClass}">${statusLabel}</span></td>
          <td class="actions-col" style="padding:0.75rem 1rem">
            ${isAdmin ? '<button class="btn btn--sm btn--secondary edit-btn" data-student-id="' + r.student.id + '">Edit</button>' : ''}
          </td>
        `;
        tbody.appendChild(tr);
      });

      this._renderPagination();
    },

    _renderPagination: function () {
      const container = document.getElementById('pagination');
      if (!container) return;
      container.innerHTML = '';

      const totalPages = Math.ceil(this.filteredRecords.length / this.pageSize);
      if (totalPages <= 1) return;

      // Previous
      const prev = document.createElement('button');
      prev.className = 'btn btn--secondary btn--sm';
      prev.textContent = '← Prev';
      prev.disabled = this.currentPage === 1;
      prev.onclick = () => { this.currentPage--; this._renderTable(); };
      container.appendChild(prev);

      // Page info
      const info = document.createElement('span');
      info.className = 'text-sm text-muted';
      info.style.padding = '0 8px';
      info.textContent = `Page ${this.currentPage} of ${totalPages}`;
      container.appendChild(info);

      // Next
      const next = document.createElement('button');
      next.className = 'btn btn--secondary btn--sm';
      next.textContent = 'Next →';
      next.disabled = this.currentPage === totalPages;
      next.onclick = () => { this.currentPage++; this._renderTable(); };
      container.appendChild(next);
    },

    _renderCharts: function () {
      if (!window.Charts) return;

      const stats = window.AttendanceEngine.calculateStats(this.filteredRecords);
      window.Charts.renderDonut('chart-donut', stats);
      window.Charts.renderDepartmentBars('chart-departments', this.filteredRecords);
    },

    /* ============================
       EDIT MODAL
       ============================ */
    _openEditModal: function (studentId) {
      const id = parseInt(studentId, 10);
      const record = this.records.find(r => r.student.id === id);
      if (!record) return;

      document.getElementById('edit-student-id').value = id;
      document.getElementById('edit-student-name').textContent = record.student.name;
      document.getElementById('edit-student-reg').textContent = record.student.regNo;

      const statusLabel = record.status.charAt(0).toUpperCase() + record.status.slice(1);
      document.getElementById('edit-current-status').textContent = statusLabel;
      document.getElementById('edit-status-select').value = statusLabel;
      document.getElementById('edit-reason').value = '';

      document.getElementById('edit-modal').classList.add('active');
    },

    _closeModal: function () {
      document.getElementById('edit-modal').classList.remove('active');
    },

    _saveEdit: function () {
      const studentId = parseInt(document.getElementById('edit-student-id').value, 10);
      const newStatusRaw = document.getElementById('edit-status-select').value; // e.g. "Present"
      const reason = document.getElementById('edit-reason').value.trim();

      if (!reason) {
        this._showToast('Please provide a reason for the change.', 'error');
        return;
      }

      // Convert to lowercase to match engine
      const newStatus = newStatusRaw.toLowerCase();

      window.AttendanceEngine.saveOverride(this.currentDate, studentId, newStatus, reason);
      this._showToast('Attendance updated successfully.', 'success');
      this._closeModal();
      this.loadAttendance(this.currentDate);
    },

    /* ============================
       DEVICE ALERTS
       ============================ */
    _renderDeviceAlerts: function () {
      if (!window.MockData || !window.MockData.getDeviceAlerts) return;

      const alerts = window.MockData.getDeviceAlerts();
      const section = document.getElementById('device-alerts-section');
      const container = document.getElementById('device-alerts-container');
      const badge = document.getElementById('device-alert-count-badge');

      if (!section || !container) return;

      if (alerts.length === 0) {
        section.style.display = 'none';
        return;
      }

      section.style.display = '';
      if (badge) badge.textContent = alerts.length + ' issue' + (alerts.length > 1 ? 's' : '');

      container.innerHTML = alerts.map(device => {
        // Time ago
        const diffMs = Date.now() - new Date(device.lastSync).getTime();
        const diffMin = Math.floor(diffMs / 60000);
        let timeAgo;
        if (diffMin < 60) timeAgo = diffMin + 'm ago';
        else timeAgo = Math.floor(diffMin / 60) + 'h ago';

        // Style by severity
        let bgColor, icon, borderColor;
        if (device.status === 'offline') {
          bgColor = 'rgba(198, 40, 40, 0.08)';
          icon = '\ud83d\udd34';
          borderColor = '#C62828';
        } else {
          bgColor = 'rgba(255, 143, 0, 0.08)';
          icon = '\u26a0\ufe0f';
          borderColor = '#FF8F00';
        }

        return `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;background:${bgColor};border-left:3px solid ${borderColor};border-bottom:1px solid var(--color-border)">
            <div style="display:flex;align-items:center;gap:0.75rem;min-width:0">
              <span style="font-size:1.1rem;flex-shrink:0">${icon}</span>
              <div style="min-width:0">
                <div style="font-weight:600;font-size:0.95rem">${device.name} \u2014 ${device.id}</div>
                <div style="font-size:0.8rem;color:var(--color-text-muted);margin-top:2px">${device.issue || 'Unknown issue'}</div>
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0;margin-left:1rem">
              <div style="font-size:0.8rem;color:var(--color-text-muted)">${timeAgo}</div>
              <div style="font-size:0.7rem;margin-top:2px;color:var(--color-text-muted)">${device.location}</div>
            </div>
          </div>`;
      }).join('');
    },

    /* ============================
       HOD VERIFICATION
       ============================ */
    _renderHODVerification: function () {
      const grid = document.getElementById('hod-verification-grid');
      const panel = document.getElementById('verification-status-panel');
      if (!grid || !panel) return;

      // Only show to Admin
      if (!this.user || this.user.role !== 'admin') {
        panel.style.display = 'none';
        return;
      }
      panel.style.display = 'block';

      const departments = ['ALL_I', 'CSE', 'ECE', 'EEE', 'MECH', 'CIVIL'];
      const deptNames = {
        'ALL_I': 'Science & Humanities (Yr 1)',
        'CSE': 'CSE Dept',
        'ECE': 'ECE Dept',
        'EEE': 'EEE Dept',
        'MECH': 'Mech Dept',
        'CIVIL': 'Civil Dept'
      };

      let html = '';
      const dateStr = this.currentDate.toISOString().split('T')[0];

      departments.forEach(dept => {
        const verifiedKey = `scad_verified_${dateStr}_${dept}`;
        const isVerified = localStorage.getItem(verifiedKey) === 'true';

        let icon, color, text, bg;
        if (isVerified) {
            icon = '';
            color = '#2E7D32';
            bg = 'rgba(46, 125, 50, 0.1)';
            text = 'Verified';
        } else {
            icon = '⏳';
            color = '#C62828';
            bg = 'rgba(244, 67, 54, 0.1)';
            text = 'Pending';
        }

        html += `
          <div style="background:var(--color-bg); border:1px solid var(--color-border); border-radius:8px; padding:1rem; display:flex; flex-direction:column; align-items:center; text-align:center;">
              <div style="font-weight:600; margin-bottom:0.5rem; font-size:0.95rem;">${deptNames[dept]}</div>
              <div style="display:inline-flex; align-items:center; gap:0.5rem; padding:0.4rem 0.75rem; border-radius:20px; background:${bg}; color:${color}; font-size:0.85rem; font-weight:600;">
                  <span>${icon}</span> ${text}
              </div>
          </div>
        `;
      });

      grid.innerHTML = html;
    },

    /* ============================
       TOAST
       ============================ */
    _showToast: function (message, type) {
      const container = document.getElementById('toast-container');
      if (!container) return;

      const toast = document.createElement('div');
      toast.className = 'toast toast--' + (type || 'success');
      toast.textContent = message;
      container.appendChild(toast);

      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    },

    /* ============================
       CSV EXPORT
       ============================ */
    _downloadCSV: function () {
      if (!window.AttendanceEngine) return;
      const csv = window.AttendanceEngine.exportToCSV(this.filteredRecords, this.currentDate);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'SCAD_Attendance_' + this.currentDate + '.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    /* ============================
       EVENT LISTENERS
       ============================ */
    _setupEventListeners: function () {
      const self = this;

      // Search (debounced)
      const searchInput = document.getElementById('search-input');
      if (searchInput) {
        searchInput.addEventListener('input', function () {
          clearTimeout(self.debounceTimer);
          self.debounceTimer = setTimeout(() => self.applyFilters(), 300);
        });
      }

      // Filters
      ['dept-filter', 'status-filter', 'year-filter', 'period-filter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => self.applyFilters());
      });

      // Date picker
      const datePicker = document.getElementById('date-picker');
      if (datePicker) {
        datePicker.addEventListener('change', function (e) {
          self.loadAttendance(e.target.value);
        });
      }

      // CSV Export
      const csvBtn = document.getElementById('csv-export-btn');
      if (csvBtn) csvBtn.addEventListener('click', () => self._downloadCSV());

      // Logout
      const logoutBtn = document.getElementById('logout-btn');
      if (logoutBtn) logoutBtn.addEventListener('click', () => window.Auth.logout());


      // Theme toggle
      const themeBtn = document.getElementById('theme-toggle-btn');
      if (themeBtn) {
        themeBtn.addEventListener('click', function () {
          if (window.Theme) window.Theme.toggle();
          // Re-render charts with new theme colors
          setTimeout(() => self._renderCharts(), 100);
        });
      }

      // Edit & Profile buttons — event delegation on table body
      const tbody = document.getElementById('attendance-table-body');
      if (tbody) {
        tbody.addEventListener('click', function (e) {
          const editBtn = e.target.closest('.edit-btn');
          if (editBtn) {
            const sid = editBtn.getAttribute('data-student-id');
            self._openEditModal(sid);
            return;
          }
          // Profile clicks handled globally by profile-modal.js
        });
      }

      // Profile buttons in defaulters table
      const defaultersTbody = document.getElementById('defaulters-table-body');
      if (defaultersTbody) {
        defaultersTbody.addEventListener('click', function (e) {
          // Profile clicks handled globally by profile-modal.js
        });
      }

      // Modal Close - Edit
      const modal = document.getElementById('edit-modal');
      const closeBtn = document.getElementById('modal-close-btn');
      const cancelBtn = document.getElementById('edit-cancel-btn');
      const overlay = document.querySelector('#edit-modal .modal__overlay');
      const saveBtn = document.getElementById('edit-save-btn');

      const closeEditModal = () => { self._closeModal(); };
      if (closeBtn) closeBtn.addEventListener('click', closeEditModal);
      if (cancelBtn) cancelBtn.addEventListener('click', closeEditModal);
      if (overlay) overlay.addEventListener('click', closeEditModal);
      if (saveBtn) saveBtn.addEventListener('click', () => self._saveEdit());

      // Profile modal close handled globally by profile-modal.js
    },

    /* ============================
       USER DISPLAY
       ============================ */
    _setupUserDisplay: function () {
      const userDisplay = document.getElementById('user-display');
      const userRole = document.getElementById('user-role');

      if (userDisplay && this.currentUser) {
        userDisplay.textContent = this.currentUser.name || this.currentUser.username;
      }
      if (userRole && this.currentUser) {
        const roleText = this.currentUser.designation || this.currentUser.role;
        userRole.textContent = roleText;
        userRole.className = this.currentUser.role === 'admin' ? 'badge badge--admin' : 'badge badge--faculty';
      }

      // Hide actions column for faculty
      if (this.currentUser && this.currentUser.role !== 'admin') {
        const style = document.createElement('style');
        style.textContent = '.actions-col { display: none !important; }';
        document.head.appendChild(style);
      }

      // Sidebar user info
      const sidebarAvatar = document.getElementById('sidebar-avatar');
      const sidebarName = document.getElementById('sidebar-user-name');
      const sidebarRole = document.getElementById('sidebar-user-role');
      if (this.currentUser) {
        if (sidebarAvatar) sidebarAvatar.textContent = (this.currentUser.name || 'U').charAt(0).toUpperCase();
        if (sidebarName) sidebarName.textContent = this.currentUser.name || this.currentUser.username;
        if (sidebarRole) sidebarRole.textContent = this.currentUser.designation || this.currentUser.role;
        
        // Show faculty link if role is faculty
        if (this.currentUser.role === 'faculty') {
            const facultyLink = document.getElementById('nav-faculty-link');
            if (facultyLink) facultyLink.style.display = 'flex';
        }
      }
    },

    /* ============================
       HELPERS
       ============================ */
    _updateHeaderTime: function () {
      const el = document.getElementById('header-date');
      if (!el) return;
      const now = new Date();
      const datePart = now.toLocaleDateString('en-IN', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
      const timePart = now.toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
      });
      el.textContent = datePart + '  •  ' + timePart;
      el.style.display = 'block';
    },

    _formatTime: function (date) {
      if (!date) return '--';
      if (!(date instanceof Date)) date = new Date(date);
      if (isNaN(date.getTime())) return '--';
      return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    },

    _animateValue: function (id, target) {
      const el = document.getElementById(id);
      if (!el) return;
      const start = parseInt(el.textContent) || 0;
      if (start === target) { el.textContent = target; return; }

      const duration = 400;
      const t0 = performance.now();
      const step = (now) => {
        const progress = Math.min((now - t0) / duration, 1);
        el.textContent = Math.floor(start + (target - start) * progress);
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = target;
      };
      requestAnimationFrame(step);
    },

    _dateToStr: function (d) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    },

    _renderDefaulters: function (dateStr) {
      const section = document.getElementById('defaulters-section');
      const tbody = document.getElementById('defaulters-table-body');
      const badge = document.getElementById('defaulters-count-badge');
      if (!section || !tbody || !window.AttendanceEngine) return;

      // Show loading state while computing (30-day scan)
      section.style.display = '';
      tbody.innerHTML = '<tr><td colspan="7" style="padding:16px;text-align:center;color:var(--color-text-muted)">⏳ Analysing 30-day attendance history…</td></tr>';
      if (badge) badge.textContent = 'Loading…';

      // Run async so the rest of the dashboard renders first
      const self = this;
      setTimeout(function () {
        const defaulters = window.AttendanceEngine.getDefaulters(dateStr);

      // Filter by current dept/year if faculty
        let filtered = defaulters;
        if (self.currentUser && self.currentUser.role === 'faculty' && self.currentUser.department !== 'ALL') {
          filtered = defaulters.filter(d => d.student.department === self.currentUser.department);
        }

        if (filtered.length === 0) {
          section.style.display = 'none';
          return;
        }

        section.style.display = '';
        if (badge) badge.textContent = filtered.length + ' Student' + (filtered.length > 1 ? 's' : '');

        tbody.innerHTML = '';
        filtered.forEach(d => {
          const riskColors = { high: '#C62828', medium: '#E65100', low: '#F9A825' };
          const riskBg = { high: 'rgba(198,40,40,0.08)', medium: 'rgba(230,81,0,0.08)', low: 'rgba(249,168,37,0.10)' };
          const riskLabels = { high: ' High', medium: ' Medium', low: ' Low' };

          const pctColor = d.attendancePct < 60 ? '#C62828' : d.attendancePct < 75 ? '#E65100' : '#1B5E20';

          // Mini attendance bar
          const barHtml = `
            <div style="display:flex;align-items:center;gap:8px">
              <div style="flex:1;height:8px;background:var(--color-border);border-radius:4px;overflow:hidden">
                <div style="height:100%;width:${d.attendancePct}%;background:${pctColor};border-radius:4px;transition:width 0.4s"></div>
              </div>
              <span style="font-weight:600;color:${pctColor};font-size:0.85rem;white-space:nowrap">${d.attendancePct}%</span>
              <span style="font-size:0.75rem;color:var(--color-text-muted)">${d.presentDays}/${d.workingDays} days</span>
            </div>`;

          const tr = document.createElement('tr');
          tr.style.background = riskBg[d.riskLevel];
          const parentPhoneClean = (d.student.parentPhone || '').replace(/\s+/g, '');
          const smsMsg = encodeURIComponent(`Dear Parent, Attendance Alert from SCAD CET: Your ward ${d.student.name} (${d.student.regNo}) has ${d.attendancePct}% attendance. Please meet Principal.`);
          tr.innerHTML = `
            <td style="padding:10px 16px;font-weight:500">${d.student.regNo}</td>
            <td style="padding:10px 16px"><a class="student-name-link profile-btn" data-student-id="${d.student.id}" style="color:var(--color-primary); font-weight:600; cursor:pointer;">${self._escapeHtml(d.student.name)}</a></td>
            <td style="padding:10px 16px">${d.student.department}</td>
            <td style="padding:10px 16px">${d.student.year}</td>
            <td style="padding:10px 16px;min-width:160px">${barHtml}</td>
            <td style="padding:10px 16px;text-align:center;font-weight:600;color:${d.maxConsecutiveAbsences >= 5 ? '#C62828' : 'var(--color-text)'}">${d.maxConsecutiveAbsences} days</td>
            <td style="padding:10px 16px">
              <span style="padding:3px 10px;border-radius:20px;font-size:0.78rem;font-weight:600;background:${riskBg[d.riskLevel]};color:${riskColors[d.riskLevel]};border:1px solid ${riskColors[d.riskLevel]}">${riskLabels[d.riskLevel]}</span>
            </td>
            <td style="padding:10px 16px">
              <div style="display:flex; gap:4px;">
                <button class="btn btn--sm btn--outline" onclick="window.WarningLetterGenerator ? window.WarningLetterGenerator.generate('${d.student.id}') : null">Letter</button>
                <button class="btn btn--sm btn--secondary" onclick="window.location.href='sms:${parentPhoneClean}?body=${smsMsg}'">SMS</button>
              </div>
            </td>`;
          tbody.appendChild(tr);
        });
      }, 50); // short delay so dashboard renders first
    },

    /* ============================
       STUDENT PROFILE
       ============================ */
    _openProfileModal: function (studentId) {
      if (!window.AttendanceEngine || !window.AttendanceEngine.getSemesterHistory) return;
      
      const id = parseInt(studentId, 10);
      const data = window.AttendanceEngine.getSemesterHistory(id, this.currentDate, 90);
      if (!data) return;

      const modal = document.getElementById('profile-modal');
      if (!modal) return;

      document.getElementById('profile-avatar').textContent = (data.student.name || 'U').charAt(0).toUpperCase();
      document.getElementById('profile-name').textContent = data.student.name;
      document.getElementById('profile-regno').textContent = data.student.regNo;
      document.getElementById('profile-dept').textContent = data.student.department;
      document.getElementById('profile-year').textContent = data.student.year + ' Year';

      // Enhanced Profile details
      const elYear = document.getElementById('profile-year-val');
      if (elYear) elYear.textContent = data.student.year + ' Year';
      
      const elStatus = document.getElementById('profile-status-val');
      if (elStatus) elStatus.textContent = data.student.status || 'active';
      
      const elEmail = document.getElementById('profile-email-val');
      if (elEmail) elEmail.textContent = data.student.email || 'N/A';
      
      const elPhone = document.getElementById('profile-phone-val');
      if (elPhone) elPhone.textContent = data.student.phone || 'N/A';

      // Parent info
      const elParentName = document.getElementById('profile-parent-name');
      if (elParentName) elParentName.textContent = data.student.parentName || 'N/A';
      const elParentPhone = document.getElementById('profile-parent-phone');
      if (elParentPhone) elParentPhone.textContent = data.student.parentPhone || 'N/A';

      // SMS button - bilingual template
      const smsBtn = document.getElementById('profile-sms-btn');
      if (smsBtn && data.student.parentPhone) {
        const rawPhone = data.student.parentPhone.replace(/[^0-9]/g, '');
        const today = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
        const msgEn = `Dear Parent, this is to inform you that your ward ${data.student.name} (Reg: ${data.student.regNo}) was marked absent on ${today}. Please contact the college for further details. - SCAD College`;
        const msgTa = `அன்புள்ள பெற்றோரே, உங்கள் மாணவர் ${data.student.name} (பதிவு எண்: ${data.student.regNo}) ${today} அன்று வகுப்பிற்கு வரவில்லை என தெரிவிக்கிறோம். மேலும் விவரங்களுக்கு கல்லூரியை தொடர்பு கொள்ளவும். - SCAD கல்லூரி`;
        const fullMsg = msgEn + '\n\n' + msgTa;
        smsBtn.href = `sms:${rawPhone}?body=${encodeURIComponent(fullMsg)}`;
      }

      // Call button
      const callBtn = document.getElementById('profile-call-btn');
      if (callBtn && data.student.parentPhone) {
        const rawPhone = data.student.parentPhone.replace(/[^0-9]/g, '');
        callBtn.href = `tel:${rawPhone}`;
      }

      // Copy Button
      const copyBtn = document.getElementById('profile-copy-phone');
      if (copyBtn) {
        copyBtn.onclick = () => {
          if (data.student.parentPhone) {
            navigator.clipboard.writeText(data.student.parentPhone).then(() => {
              // visual feedback
              const oldHtml = copyBtn.innerHTML;
              copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2E7D32" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
              setTimeout(() => copyBtn.innerHTML = oldHtml, 1500);
            });
          }
        };
      }

      // Populate Stats
      document.getElementById('profile-stat-total').textContent = data.stats.total;
      document.getElementById('profile-stat-present').textContent = data.stats.present;
      document.getElementById('profile-stat-late').textContent = data.stats.late;
      document.getElementById('profile-stat-absent').textContent = data.stats.absent;

      // Update progress ring
      const pctText = document.getElementById('profile-pct-text');
      const ring = document.getElementById('profile-ring');
      const pct = data.stats.percentage;
      if (pctText) pctText.textContent = pct + '%';
      
      if (ring) {
        const radius = (ring.r && ring.r.baseVal) ? ring.r.baseVal.value : 40;
        const circumference = radius * 2 * Math.PI;
        ring.style.strokeDasharray = `${circumference} ${circumference}`;
        const offset = circumference - (pct / 100) * circumference;
        
        ring.style.strokeDashoffset = circumference;
        setTimeout(() => {
          ring.style.strokeDashoffset = offset;
          ring.style.stroke = pct < 60 ? '#C62828' : 
                              pct < 75 ? '#F57C00' : 
                              '#2E7D32';
        }, 50);
      }

      // Render Calendar
      const container = document.getElementById('calendar-container');
      const title = document.getElementById('calendar-month-title');
      if (container) {
          container.innerHTML = '';
          const currDateObj = new Date(this.currentDate);
          const year = currDateObj.getFullYear();
          const month = currDateObj.getMonth();
          
          if(title) title.textContent = currDateObj.toLocaleString('default', { month: 'long', year: 'numeric' }) + ' Attendance';
          
          const firstDay = new Date(year, month, 1).getDay();
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          
          // Empty cells for days before the 1st
          for (let i = 0; i < firstDay; i++) {
              const cell = document.createElement('div');
              cell.className = 'calendar-cell empty';
              container.appendChild(cell);
          }
          
          // History lookup
          const historyMap = {};
          data.history.forEach(day => { historyMap[day.date] = day.status; });
          
          // Days
          for (let d = 1; d <= daysInMonth; d++) {
              const cell = document.createElement('div');
              cell.className = 'calendar-cell';
              const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
              
              if (dateStr === this.currentDate) {
                  cell.classList.add('today');
              }
              
              cell.innerHTML = `<span>${d}</span>`;
              
              if (historyMap[dateStr]) {
                  cell.classList.add(historyMap[dateStr]);
                  cell.title = historyMap[dateStr].toUpperCase();
              }
              
              container.appendChild(cell);
          }
      }

      modal.style.display = 'block';
      modal.classList.add('active');
    },

    _escapeHtml: function (str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }
  };

  window.Dashboard = Dashboard;

  document.addEventListener('DOMContentLoaded', () => Dashboard.init());

})(window);
