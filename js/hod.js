(function () {
    'use strict';

    window.HODDashboard = {
        
        renderODRequests: function() {
            const tbody = document.getElementById('hod-od-table-body');
            const badge = document.getElementById('hod-od-badge');
            if (!tbody || !window.ODExemption) return;

            const dept = this.user ? this.user.department : 'ALL';
            const reqs = window.ODExemption.getRequests({ department: dept });
            const pendingCount = reqs.filter(r => r.status === 'pending').length;

            if (badge) {
                badge.textContent = `${pendingCount} Pending`;
                badge.className = pendingCount > 0 ? 'badge badge--late' : 'badge badge--present';
            }

            if (reqs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--color-text-muted);">No OD requests submitted for this department.</td></tr>';
                return;
            }

            tbody.innerHTML = reqs.map(r => {
                const statusBadge = r.status === 'approved' 
                    ? '<span class="badge badge--present">Approved</span>' 
                    : r.status === 'rejected'
                    ? '<span class="badge badge--absent">Rejected</span>'
                    : '<span class="badge badge--late">Pending</span>';

                const actionHtml = r.status === 'pending'
                    ? `<div style="display:flex; gap:4px;">
                        <button class="btn btn--sm btn--primary" onclick="window.HODDashboard.handleOD('${r.id}', 'approve')">Approve</button>
                        <button class="btn btn--sm btn--outline" onclick="window.HODDashboard.handleOD('${r.id}', 'reject')">Reject</button>
                       </div>`
                    : `<span style="font-size:0.8rem; color:var(--color-text-muted);">${r.approver || 'Reviewed'}</span>`;

                return `<tr>
                    <td><strong><a href="#" class="profile-btn" data-student-id="${r.studentId}" style="color:var(--color-primary);">${r.studentName}</a></strong><br><small style="color:var(--color-text-muted);">${r.regNo}</small></td>
                    <td><span class="badge badge--od">${r.category}</span></td>
                    <td><strong>${r.date}</strong><br><small>Periods: [${r.periods.join(', ')}]</small></td>
                    <td>${r.reason}<br><small style="color:var(--color-text-muted);">${r.proofNote || ''}</small></td>
                    <td>${statusBadge}</td>
                    <td>${actionHtml}</td>
                </tr>`;
            }).join('');
        },

        handleOD: function(reqId, action) {
            if (!window.ODExemption) return;
            const approver = this.user ? `${this.user.name} (HOD - ${this.user.department})` : 'HOD';
            if (action === 'approve') {
                window.ODExemption.approveRequest(reqId, approver);
                alert('On-Duty Request Approved. Student attendance records updated with OD exemption.');
            } else {
                const reason = prompt('Enter reason for rejection:', 'Documentation insufficient');
                if (reason === null) return;
                window.ODExemption.rejectRequest(reqId, approver, reason);
            }
            this.renderODRequests();
            this.renderUnlockRequests();
        },

        renderDiscrepancies: function() {
            const tbody = document.getElementById('hod-discrepancy-table-body');
            const badge = document.getElementById('hod-discrepancy-badge');
            if (!tbody || !window.ReconciliationEngine) return;

            const dept = this.user ? this.user.department : 'ALL';
            const dateStr = this.currentDate.toISOString().split('T')[0];
            const list = window.ReconciliationEngine.analyzeDiscrepancies(dateStr, dept);

            if (badge) {
                badge.textContent = `${list.length} Flagged`;
                badge.className = list.length > 0 ? 'badge badge--absent' : 'badge badge--present';
            }

            if (list.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:#2E7D32; font-weight:500;">✓ No attendance discrepancies or bunking flagged for this department.</td></tr>';
                return;
            }

            tbody.innerHTML = list.map(d => {
                const typeBadge = d.type === 'SUSPECTED_BUNKING'
                    ? '<span class="badge badge--bunk">Suspected Bunking</span>'
                    : '<span class="badge badge--gatemiss">Gate Miss</span>';

                const actionBtns = d.resolved
                    ? `<span style="color:#2E7D32; font-weight:600; font-size:0.8rem;">✓ ${d.resolutionText || 'Resolved'}</span>`
                    : `<div style="display:flex; gap:4px;">
                        <button class="btn btn--sm btn--outline" onclick="window.HODDashboard.resolveDiscrepancy('${d.id}', 'EXCUSED')">Excuse</button>
                        <button class="btn btn--sm btn--danger" onclick="window.HODDashboard.resolveDiscrepancy('${d.id}', 'CONFIRMED_BUNKING')">Notify Parent</button>
                       </div>`;

                return `<tr>
                    <td><strong><a href="#" class="profile-btn" data-student-id="${d.studentId}" style="color:var(--color-primary);">${d.studentName}</a></strong><br><small style="color:var(--color-text-muted);">${d.regNo}</small></td>
                    <td>Year ${d.year} (${d.section})</td>
                    <td><strong>${d.gateTime}</strong></td>
                    <td>${typeBadge}</td>
                    <td><small>${d.details}</small></td>
                    <td>${actionBtns}</td>
                </tr>`;
            }).join('');
        },

        resolveDiscrepancy: function(id, actionType) {
            if (window.ReconciliationEngine) {
                window.ReconciliationEngine.resolveDiscrepancy(id, actionType);
                if (actionType === 'CONFIRMED_BUNKING') {
                    alert('Disciplinary alert recorded and parent notification queued.');
                }
                this.renderDiscrepancies();
            this.renderDefaulters();
            }
        },

        
        renderDefaulters: function() {
            const tbody = document.getElementById('hod-defaulters-table-body');
            const badge = document.getElementById('hod-defaulters-count-badge');
            if (!tbody || !window.AttendanceEngine) return;

            const dept = this.user ? this.user.department : 'ALL';
            const dateStr = this.currentDate.toISOString().split('T')[0];
            const allDefaulters = window.AttendanceEngine.getDefaulters(dateStr);
            const deptDefaulters = dept === 'ALL' ? allDefaulters : allDefaulters.filter(d => d.student.department === dept);

            if (badge) {
                badge.textContent = `${deptDefaulters.length} Students`;
                badge.className = deptDefaulters.length > 0 ? 'badge badge--absent' : 'badge badge--present';
            }

            if (deptDefaulters.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:#2E7D32; font-weight:500;">✓ No students below 75% attendance in this department.</td></tr>';
                return;
            }

            tbody.innerHTML = deptDefaulters.map(d => {
                const s = d.student;
                const pctColor = d.attendancePct < 60 ? '#C62828' : '#E65100';
                const parentPhoneClean = (s.parentPhone || '').replace(/\s+/g, '');
                const smsMsg = encodeURIComponent(`Dear Parent, Attendance Alert from SCAD CET: Your ward ${s.name} (${s.regNo}) has only ${d.attendancePct}% attendance (${d.presentDays}/${d.workingDays} days). Mandatory HOD meeting required.`);

                return `<tr>
                    <td><strong>${s.regNo}</strong></td>
                    <td><a href="#" class="profile-btn" data-student-id="${s.id}" style="color:var(--color-primary); font-weight:600;">${s.name}</a></td>
                    <td>Year ${s.year} (${s.section})</td>
                    <td>
                        <span style="font-weight:700; color:${pctColor}; font-size:0.95rem;">${d.attendancePct}%</span>
                        <small style="color:var(--color-text-muted); display:block;">(${d.presentDays}/${d.workingDays} days)</small>
                    </td>
                    <td style="text-align:center; font-weight:600; color:${d.maxConsecutiveAbsences >= 3 ? '#C62828' : 'inherit'};">${d.maxConsecutiveAbsences} days</td>
                    <td><a href="tel:${parentPhoneClean}" style="color:var(--color-primary); font-size:0.85rem;">${s.parentPhone || '—'}</a></td>
                    <td>
                        <div style="display:flex; gap:4px; flex-wrap:wrap;">
                            <button class="btn btn--sm btn--outline" onclick="window.WarningLetterGenerator ? window.WarningLetterGenerator.generate('${s.id}') : null">Letter</button>
                            <button class="btn btn--sm btn--secondary" onclick="window.location.href='sms:${parentPhoneClean}?body=${smsMsg}'">SMS Parent</button>
                        </div>
                    </td>
                </tr>`;
            }).join('');
        },

        
        renderUnlockRequests: function() {
            const tbody = document.getElementById('hod-unlock-table-body');
            const badge = document.getElementById('hod-unlock-badge');
            if (!tbody) return;

            const dept = this.user ? this.user.department : 'ALL';
            let allReqs = JSON.parse(localStorage.getItem('scad_unlock_requests') || '[]');
            
            // Filter by department if applicable
            let deptReqs = allReqs;
            if (dept !== 'ALL') {
                deptReqs = allReqs.filter(r => r.department === dept || r.department === 'ALL_I');
            }

            const pendingCount = deptReqs.filter(r => r.status === 'pending').length;
            if (badge) {
                badge.textContent = `${pendingCount} Pending`;
                badge.className = pendingCount > 0 ? 'badge badge--late' : 'badge badge--present';
            }

            if (deptReqs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--color-text-muted);">No period unlock requests submitted.</td></tr>';
                return;
            }

            tbody.innerHTML = deptReqs.map(r => {
                const statusBadge = r.status === 'approved'
                    ? '<span class="badge badge--present">Unlocked</span>'
                    : r.status === 'rejected'
                    ? '<span class="badge badge--absent">Rejected</span>'
                    : '<span class="badge badge--late">Pending HOD Review</span>';

                const actionHtml = r.status === 'pending'
                    ? `<div style="display:flex; gap:4px;">
                        <button class="btn btn--sm btn--primary" onclick="window.HODDashboard.handleUnlock('${r.id}', 'approve')">Approve & Unlock</button>
                        <button class="btn btn--sm btn--outline" onclick="window.HODDashboard.handleUnlock('${r.id}', 'reject')">Reject</button>
                       </div>`
                    : `<span style="font-size:0.8rem; color:var(--color-text-muted);">${r.reviewedBy || 'Processed'}</span>`;

                return `<tr>
                    <td><strong>${r.facultyName}</strong><br><small style="color:var(--color-text-muted);">${r.facultyId}</small></td>
                    <td><strong>Period ${r.period}</strong><br><small>${r.classGroup.replace(/-/g, ' ')}</small></td>
                    <td><strong>${r.date}</strong><br><small>Window: ${r.scheduledTime || '09:00 - 09:10'}</small></td>
                    <td>${r.reason}</td>
                    <td>${statusBadge}</td>
                    <td>${actionHtml}</td>
                </tr>`;
            }).join('');
        },

        handleUnlock: function(reqId, action) {
            let allReqs = JSON.parse(localStorage.getItem('scad_unlock_requests') || '[]');
            const req = allReqs.find(r => r.id === reqId);
            if (!req) return;

            const approverName = this.user ? `${this.user.name} (HOD - ${this.user.department})` : 'HOD';

            if (action === 'approve') {
                req.status = 'approved';
                req.reviewedBy = `Approved by ${approverName}`;
                
                // Unlock period permission in localStorage
                const unlockKey = `scad_unlocked_${req.date}_${req.classGroup}_${req.period}`;
                localStorage.setItem(unlockKey, JSON.stringify({
                    unlocked: true,
                    unlockedAt: new Date().toISOString(),
                    unlockedBy: approverName
                }));

                // Audit trail
                if (window.AuditLogger) {
                    window.AuditLogger.log(
                        'PERIOD_UNLOCKED_BY_HOD',
                        `${req.classGroup} (Period ${req.period})`,
                        `HOD approved late attendance marking for ${req.facultyName}. Reason: ${req.reason}`
                    );
                }

                alert(`Permission granted. Period ${req.period} (${req.classGroup}) has been unlocked for ${req.facultyName}.`);
            } else {
                req.status = 'rejected';
                req.reviewedBy = `Rejected by ${approverName}`;
            }

            localStorage.setItem('scad_unlock_requests', JSON.stringify(allReqs));
            this.renderUnlockRequests();
        },

        init: function () {
            this.user = window.Auth ? window.Auth.requireAuth('hod') : null;
            if (!this.user) return;

            if (window.Theme) {
                window.Theme.init();
                const themeToggleBtn = document.getElementById('themeToggle');
                if (themeToggleBtn) {
                    themeToggleBtn.addEventListener('click', () => window.Theme.toggle());
                }
            }

            const headerUserName = document.getElementById('user-display');
            if (headerUserName) headerUserName.textContent = this.user.name;

            const sidebarAvatar = document.getElementById('sidebar-avatar');
            if (sidebarAvatar) sidebarAvatar.textContent = this.user.name.charAt(0).toUpperCase();
            
            const sidebarUserName = document.getElementById('sidebar-user-name');
            if (sidebarUserName) sidebarUserName.textContent = this.user.name;
            
            const sidebarUserRole = document.getElementById('sidebar-user-role');
            if (sidebarUserRole) sidebarUserRole.textContent = this.user.designation;

            const datePicker = document.getElementById('date-picker');
            const today = new Date().toISOString().split('T')[0];
            if (datePicker) {
                datePicker.value = today;
                this.currentDate = today;
                datePicker.addEventListener('change', (e) => {
                    this.currentDate = e.target.value;
                    this.renderDashboard();
                });
            } else {
                this.currentDate = today;
            }

            this.updateClock();
            setInterval(() => this.updateClock(), 1000);

            const verifyBtn = document.getElementById('verify-day-btn');
            if (verifyBtn) {
                verifyBtn.addEventListener('click', () => this.verifyDay());
            }

            // Logout setup
            const sidebarLogoutBtn = document.getElementById('sidebar-logout-btn');
            const headerLogoutBtn = document.getElementById('logout-btn');
            if (sidebarLogoutBtn) sidebarLogoutBtn.addEventListener('click', (e) => { e.preventDefault(); window.Auth.logout(); });
            if (headerLogoutBtn) headerLogoutBtn.addEventListener('click', () => window.Auth.logout());

            this.renderDashboard();
        },

        updateClock: function () {
            const now = new Date();
            const clockEl = document.getElementById('header-date');
            if (clockEl) {
                const datePart = now.toLocaleDateString('en-IN', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                });
                const timePart = now.toLocaleTimeString('en-US', {
                    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
                });
                clockEl.textContent = `${datePart} • ${timePart}`;
            }
        },

        renderDashboard: function () {
            const grid = document.getElementById('faculty-grid');
            if (!grid || !window.Timetable) return;

            let deptFaculty;
            if (this.user.department === 'ALL_I') {
                deptFaculty = window.Timetable.FACULTY.filter(f => ['MATH', 'ENG', 'PHY'].includes(f.dept));
            } else {
                deptFaculty = window.Timetable.FACULTY.filter(f => f.dept === this.user.department);
            }

            if (deptFaculty.length === 0) {
                grid.innerHTML = '<div style="grid-column: 1/-1; padding: 2rem; text-align: center; color: var(--color-text-muted);">No faculty found for this department.</div>';
                return;
            }

            let allSubmitted = true;
            let html = '';

            deptFaculty.forEach(faculty => {
                let periodsHtml = '';
                let missingSubmissions = false;

                const schedule = window.Timetable.getFacultySchedule(faculty.id, this.currentDate);

                for (let p = 1; p <= 7; p++) {
                    const periodData = schedule[p - 1];
                    const isFree = periodData.type === 'free';
                    
                    if (isFree) {
                        periodsHtml += '<div class="period-badge" style="background: rgba(0,0,0,0.05); color: #999;" title="Period ' + p + ' - Free">P' + p + '</div>';
                        continue;
                    }

                    const storageKey = 'scad_submitted_' + this.currentDate + '_' + faculty.id + '_' + p;
                    const isSubmitted = localStorage.getItem(storageKey) === 'true';

                    if (isSubmitted) {
                        periodsHtml += '<div class="period-badge submitted" title="Period ' + p + ' - Submitted">P' + p + '</div>';
                    } else {
                        periodsHtml += '<div class="period-badge pending" title="Period ' + p + ' - Pending">P' + p + '</div>';
                        missingSubmissions = true;
                    }
                }

                if (missingSubmissions) {
                    allSubmitted = false;
                }

                const checkIcon = missingSubmissions ? '<button class="btn btn--sm btn--danger" onclick="window.HODDashboard.sendReminder(\'' + faculty.id + '\', \'' + faculty.name + '\')">Remind</button>' : '<span style="font-size: 1.2rem;"></span>';

                html += '<div class="faculty-card"><div style="display: flex; justify-content: space-between; align-items: flex-start;"><div><h3 style="margin: 0 0 4px 0;">' + faculty.name + '</h3><div style="font-size: 0.85rem; color: var(--color-text-muted);">' + faculty.designation + '</div></div>' + checkIcon + '</div><div class="period-badges">' + periodsHtml + '</div></div>';
            });

            grid.innerHTML = html;

            const verifiedKey = 'scad_verified_' + this.currentDate + '_' + this.user.department;
            const isVerified = localStorage.getItem(verifiedKey) === 'true';

            const banner = document.getElementById('verification-banner');
            const statusText = document.getElementById('verification-status-text');
            const verifyBtn = document.getElementById('verify-day-btn');

            if (isVerified) {
                banner.className = 'verification-banner verified';
                statusText.textContent = 'Daily Attendance Verification: Verified ';
                verifyBtn.textContent = 'Verified';
                verifyBtn.disabled = true;
                verifyBtn.style.background = '#2E7D32';
            } else {
                banner.className = 'verification-banner';
                statusText.textContent = 'Daily Attendance Verification: Pending ⏳';
                verifyBtn.textContent = 'Verify & Close Day';
                verifyBtn.style.background = '';
                
                const now = new Date();
                const isAfter4 = now.getHours() >= 16;
                verifyBtn.disabled = !(allSubmitted || isAfter4);
                
                if (!allSubmitted && !isAfter4) {
                    verifyBtn.title = 'All faculty must submit, or time must be past 4:00 PM.';
                } else {
                    verifyBtn.title = '';
                }
            }
        },

        verifyDay: function () {
            if (!confirm('Are you sure you want to verify and close attendance for this day? Modifications will require admin override.')) return;
            
            const verifiedKey = 'scad_verified_' + this.currentDate + '_' + this.user.department;
            localStorage.setItem(verifiedKey, 'true');
            
            this.showToast('Day verified successfully.', 'success');
            this.renderDashboard();
        },

        sendReminder: function (id, name) {
            const storageKey = 'scad_notifications_' + id;
            let notifications = JSON.parse(localStorage.getItem(storageKey) || '[]');
            
            notifications.unshift({
                id: Date.now(),
                type: 'warning',
                title: 'Attendance Reminder',
                message: `Please submit your pending attendance for today (${this.currentDate}).`,
                timestamp: new Date().toISOString(),
                read: false,
                from: this.user.name
            });
            
            localStorage.setItem(storageKey, JSON.stringify(notifications));
            
            this.showToast('Reminder sent to ' + name, 'success');
        },

        showToast: function (message, type) {
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
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        window.HODDashboard.init();
    });

})();
