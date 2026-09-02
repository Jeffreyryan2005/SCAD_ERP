/**
 * SCAD College Attendance ERP - Faculty Class & Attendance Management
 */
(function() {
    'use strict';

    window.FacultyDashboard = {
        user: null,
        currentDate: new Date(),
        dateMode: 'today',
        currentView: 'schedule',
        odRemarksState: {},
        schedule: [],
        currentPeriodSelection: null,
        attendanceState: {},
        studentsList: [],

        
        checkPeriodLockStatus: function(pNum, classGroup) {
            const year = this.currentDate.getFullYear();
            const month = String(this.currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(this.currentDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            const todayStr = new Date().toISOString().split('T')[0];

            // If viewing tomorrow's schedule -> Viewing/Advance reallocation only
            if (dateStr > todayStr) {
                return { locked: false, isFuture: true, statusText: 'Tomorrow (Advance Schedule)' };
            }

            // Check if explicitly unlocked by HOD
            const unlockKey = `scad_unlocked_${dateStr}_${classGroup}_${pNum}`;
            const isUnlocked = localStorage.getItem(unlockKey);
            if (isUnlocked) {
                return { locked: false, isHODUnlocked: true, statusText: 'HOD Unlocked' };
            }

            // Check 10-minute window for today
            if (dateStr === todayStr && window.Timetable && window.Timetable.PERIODS) {
                const periodInfo = window.Timetable.PERIODS.find(p => p.num === pNum);
                if (periodInfo) {
                    const [sh, sm] = periodInfo.start.split(':').map(Number);
                    const now = new Date();
                    const nowMinutes = now.getHours() * 60 + now.getMinutes();
                    const periodStartMinutes = sh * 60 + sm;
                    const periodLockMinutes = periodStartMinutes + 10; // 10-minute grace window

                    if (nowMinutes < periodStartMinutes) {
                        return { locked: false, notStarted: true, statusText: `Starts at ${periodInfo.start}` };
                    } else if (nowMinutes >= periodStartMinutes && nowMinutes <= periodLockMinutes) {
                        return { locked: false, inWindow: true, statusText: 'Window Open' };
                    } else {
                        // Expired 10-minute window
                        return { locked: true, expired: true, statusText: 'Locked (10m Expired)' };
                    }
                }
            }

            // If past date without HOD unlock -> locked
            if (dateStr < todayStr) {
                return { locked: true, expired: true, statusText: 'Locked (Past Date)' };
            }

            return { locked: false, inWindow: true, statusText: 'Open' };
        },

        openUnlockModal: function(item) {
            this.pendingUnlockItem = item;
            const modal = document.getElementById('unlockModal');
            const details = document.getElementById('unlockPeriodDetails');
            const reasonInput = document.getElementById('unlockReasonInput');

            const pNum = item.period.num || item.period;
            if (details) {
                details.textContent = `Period ${pNum} — ${item.subjectName} (${item.classLabel})`;
            }
            if (reasonInput) reasonInput.value = '';
            if (modal) modal.style.display = 'block';
        },

        closeUnlockModal: function() {
            const modal = document.getElementById('unlockModal');
            if (modal) modal.style.display = 'none';
        },

        submitUnlockRequest: function() {
            if (!this.pendingUnlockItem) return;
            const reasonInput = document.getElementById('unlockReasonInput');
            const reason = reasonInput ? reasonInput.value.trim() : '';

            if (!reason) {
                alert('Please enter a valid reason for the late marking permission request.');
                return;
            }

            const item = this.pendingUnlockItem;
            const pNum = item.period.num || item.period;
            const year = this.currentDate.getFullYear();
            const month = String(this.currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(this.currentDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            let allReqs = JSON.parse(localStorage.getItem('scad_unlock_requests') || '[]');
            const newReq = {
                id: 'UNL_' + Date.now(),
                facultyId: this.user.facultyId || this.user.username,
                facultyName: this.user.name,
                department: this.user.department,
                classGroup: item.classGroup,
                period: pNum,
                date: dateStr,
                scheduledTime: (item.period && item.period.time) ? item.period.time : '09:00 - 09:50',
                reason: reason,
                status: 'pending',
                timestamp: new Date().toISOString()
            };

            allReqs.unshift(newReq);
            localStorage.setItem('scad_unlock_requests', JSON.stringify(allReqs));

            // Audit Trail
            if (window.AuditLogger) {
                window.AuditLogger.log(
                    'UNLOCK_PERMISSION_REQUESTED',
                    `${item.classGroup} (Period ${pNum})`,
                    `${this.user.name} requested late attendance unlock from HOD. Reason: ${reason}`
                );
            }

            this.closeUnlockModal();
            this.showToast('Unlock request sent to HOD. Awaiting approval.');
            this.renderScheduleStrip();
        },

        instantDemoUnlock: function() {
            if (!this.pendingUnlockItem) return;
            const item = this.pendingUnlockItem;
            const pNum = item.period.num || item.period;
            const year = this.currentDate.getFullYear();
            const month = String(this.currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(this.currentDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            const unlockKey = `scad_unlocked_${dateStr}_${item.classGroup}_${pNum}`;
            localStorage.setItem(unlockKey, JSON.stringify({
                unlocked: true,
                unlockedAt: new Date().toISOString(),
                unlockedBy: 'HOD (Instant Demo Override)'
            }));

            this.closeUnlockModal();
            this.showToast('Period unlocked! You can now mark attendance.');
            this.renderScheduleStrip();
            this.selectPeriod(pNum);
        },

        init: function() {
            // Require faculty role
            if(window.Auth && window.Auth.requireAuth) {
                this.user = window.Auth.requireAuth('faculty');
            }
            if (!this.user) return;

            // Init Theme
            if(window.Theme && window.Theme.init) window.Theme.init();

            // Populate UI with user details
            const headerUserName = document.getElementById('user-display');
            if (headerUserName) headerUserName.textContent = this.user.name;
            const userRole = document.getElementById('user-role');
            if (userRole) userRole.textContent = 'Faculty';

            const sidebarAvatar = document.getElementById('sidebar-avatar');
            if (sidebarAvatar) sidebarAvatar.textContent = this.user.name.charAt(0).toUpperCase();
            const sidebarUserName = document.getElementById('sidebar-user-name');
            if (sidebarUserName) sidebarUserName.textContent = this.user.name;
            const sidebarUserRole = document.getElementById('sidebar-user-role');
            if (sidebarUserRole) sidebarUserRole.textContent = this.user.designation;

            // Setup bindings
            const logoutBtn = document.getElementById('logoutBtn') || document.getElementById('logout-btn');
            if(logoutBtn) {
                logoutBtn.addEventListener('click', () => {
                    if(window.Auth && window.Auth.logout) window.Auth.logout();
                });
            }

            const markAllBtn = document.getElementById('markAllPresentBtn');
            if(markAllBtn) {
                markAllBtn.addEventListener('click', () => this.markAllPresent());
            }

            const saveBtn = document.getElementById('saveAttendanceBtn');
            if(saveBtn) {
                saveBtn.addEventListener('click', () => this.saveAttendance());
            }

            // Init clock
            this.startClock();

            // Load data
            this.currentDate = new Date();
            this.loadSchedule();
        },

        switchView: function(viewName) {
            this.currentView = viewName;
            document.querySelectorAll('.report-tab-btn').forEach(b => b.classList.remove('active'));
            const activeBtn = document.getElementById('tab-btn-' + viewName);
            if (activeBtn) activeBtn.classList.add('active');

            const schedView = document.getElementById('scheduleSectionView');
            const mentView = document.getElementById('menteesSectionView');
            if (viewName === 'schedule') {
                if (schedView) schedView.style.display = 'block';
                if (mentView) mentView.style.display = 'none';
            } else {
                if (schedView) schedView.style.display = 'none';
                if (mentView) mentView.style.display = 'block';
                this.renderMyMentees();
            }
        },

        setDateMode: function(mode) {
            this.dateMode = mode;
            const btnToday = document.getElementById('date-btn-today');
            const btnTomorrow = document.getElementById('date-btn-tomorrow');
            
            if (mode === 'today') {
                this.currentDate = new Date();
                if (btnToday) { btnToday.className = 'btn btn--sm btn--primary'; }
                if (btnTomorrow) { btnTomorrow.className = 'btn btn--sm btn--outline'; }
            } else {
                // Set to tomorrow
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                this.currentDate = tomorrow;
                if (btnToday) { btnToday.className = 'btn btn--sm btn--outline'; }
                if (btnTomorrow) { btnTomorrow.className = 'btn btn--sm btn--primary'; }
            }

            // Hide attendance marking container if open
            const attCont = document.getElementById('attendanceContainer');
            if (attCont) attCont.style.display = 'none';

            this.loadSchedule();
        },

        renderMyMentees: function() {
            const tbody = document.getElementById('faculty-mentees-tbody');
            const badge = document.getElementById('faculty-mentees-count');
            if (!tbody || !window.MockData) return;

            const fid = this.user ? (this.user.facultyId || this.user.username) : 'faculty_cse_1';
            const mentees = window.MockData.getMenteesForFaculty ? window.MockData.getMenteesForFaculty(fid) : [];

            if (badge) badge.textContent = `${mentees.length} Mentees`;

            if (mentees.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:1.5rem; color:var(--color-text-muted);">No mentees assigned to your profile yet.</td></tr>';
                return;
            }

            tbody.innerHTML = mentees.map(m => {
                const attPct = Math.round(72 + (m.id % 25));
                const pctColor = attPct < 75 ? '#C62828' : '#2E7D32';
                const parentPhoneClean = (m.parentPhone || '').replace(/\s+/g, '');
                const smsMsg = encodeURIComponent(`Dear Parent, SCAD CET Mentor Update: Your ward ${m.name} (${m.regNo}) current attendance is ${attPct}%, CGPA: ${m.cgpa}. Please contact mentor.`);

                return `<tr>
                    <td><strong>${m.regNo}</strong></td>
                    <td><a href="#" class="profile-btn" data-student-id="${m.id}" style="color:var(--color-primary); font-weight:600;">${m.name}</a></td>
                    <td>Year ${m.year} (${m.section})</td>
                    <td><span style="font-weight:700; color:${pctColor};">${attPct}%</span></td>
                    <td><strong>${m.cgpa || '7.50'}</strong></td>
                    <td><span style="color:${m.arrears > 0 ? '#C62828' : '#2E7D32'}; font-weight:600;">${m.arrears || 0}</span></td>
                    <td><a href="tel:${parentPhoneClean}" style="color:var(--color-primary);">${m.parentPhone || '—'}</a></td>
                    <td>
                        <div style="display:flex; gap:4px;">
                            <button class="btn btn--sm btn--secondary" onclick="window.location.href='tel:${parentPhoneClean}'">Call</button>
                            <button class="btn btn--sm btn--outline" onclick="window.location.href='sms:${parentPhoneClean}?body=${smsMsg}'">SMS</button>
                        </div>
                    </td>
                </tr>`;
            }).join('');
        },

        startClock: function() {
            const clockEl = document.getElementById('header-date');
            if(!clockEl) return;

            const updateTime = () => {
                const now = new Date();
                const datePart = now.toLocaleDateString('en-IN', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                });
                const timePart = now.toLocaleTimeString('en-US', {
                    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
                });
                clockEl.textContent = `${datePart} • ${timePart}`;
            };
            
            updateTime();
            setInterval(updateTime, 1000);
        },

        loadSchedule: function() {
            const year = this.currentDate.getFullYear();
            const month = String(this.currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(this.currentDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            
            if(window.Timetable && window.Timetable.getFacultySchedule) {
                this.schedule = window.Timetable.getFacultySchedule(this.user.facultyId, dateStr);
                
                // Process Reallocations
                if(window.Reallocation) {
                    const fromReqs = window.Reallocation.getReallocatedPeriodsFromFaculty(this.user.facultyId, dateStr);
                    fromReqs.forEach(req => {
                        this.schedule = this.schedule.filter(s => {
                            const pNum = s.period.num || s.period;
                            return !(pNum === req.period && s.classGroup === req.classGroup);
                        });
                    });

                    const toReqs = window.Reallocation.getReallocatedPeriodsForFaculty(this.user.facultyId, dateStr);
                    toReqs.forEach(req => {
                        const classSched = window.Timetable.getClassSchedule(req.classGroup, dateStr);
                        if(classSched) {
                            const subjectInfo = classSched[req.period - 1];
                            if(subjectInfo) {
                                this.schedule.push({
                                    period: req.period,
                                    classGroup: req.classGroup,
                                    classLabel: req.classGroup.replace(/-/g, ' '),
                                    subjectCode: subjectInfo.code,
                                    subjectName: subjectInfo.name + ' (Reallocated)',
                                    type: subjectInfo.type
                                });
                            }
                        }
                    });

                    this.schedule.sort((a, b) => (a.period.num || a.period) - (b.period.num || b.period));
                }
            }
            
            this.renderScheduleStrip();
            this.renderIncomingReallocations();
            
            if(this.dateMode === 'today' && window.Timetable && window.Timetable.getCurrentPeriod) {
                const currPeriod = window.Timetable.getCurrentPeriod();
                if(currPeriod) {
                    const scheduled = this.schedule.find(s => (s.period.num || s.period) === currPeriod.num);
                    if(scheduled) {
                        this.selectPeriod(currPeriod.num);
                    }
                }
            }
        },

        renderScheduleStrip: function() {
            const tableBody = document.querySelector('#scheduleStrip tbody');
            if(!tableBody) return;

            tableBody.innerHTML = '';

            if(!this.schedule || this.schedule.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--color-text-muted);">No classes scheduled for ${this.dateMode === 'today' ? 'today' : 'tomorrow'}.</td></tr>`;
                return;
            }

            let currPeriodNum = null;
            if(this.dateMode === 'today' && window.Timetable && window.Timetable.getCurrentPeriod) {
                const p = window.Timetable.getCurrentPeriod();
                if(p) currPeriodNum = p.num;
            }

            this.schedule.forEach(item => {
                const pNum = item.period.num || item.period;
                const periodInfo = (window.Timetable && window.Timetable.PERIODS) ? window.Timetable.PERIODS.find(p => p.num === pNum) : null;
                const timeStr = periodInfo ? (periodInfo.time || `${periodInfo.start} - ${periodInfo.end}`) : (item.period && item.period.time ? item.period.time : '-');
                
                const tr = document.createElement('tr');
                tr.dataset.period = pNum;
                
                if (currPeriodNum === pNum) {
                    tr.classList.add('active');
                } else if (currPeriodNum !== null && pNum < currPeriodNum) {
                    tr.classList.add('past');
                }

                if (item.type === 'free') {
                    tr.classList.add('free-period');
                    tr.innerHTML = `
                        <td style="padding: 1rem;"><strong>Period ${pNum}</strong></td>
                        <td style="padding: 1rem;">${timeStr}</td>
                        <td style="padding: 1rem;" colspan="2"><span style="color:var(--color-text-muted)">Free Period</span></td>
                        <td style="padding: 1rem;">-</td>
                    `;
                } else {
                    const year = this.currentDate.getFullYear();
                    const month = String(this.currentDate.getMonth() + 1).padStart(2, '0');
                    const day = String(this.currentDate.getDate()).padStart(2, '0');
                    const dateStr = `${year}-${month}-${day}`;
                    const storageKey = `scad_period_att_${dateStr}_${item.classGroup}_${pNum}`;
                    const isMarked = localStorage.getItem(storageKey) !== null;
                    const lockStatus = this.checkPeriodLockStatus(pNum, item.classGroup);
                    
                    let badge = isMarked 
                        ? '<span class="badge badge--present">Marked</span>'
                        : '<span class="badge badge--late">Pending</span>';

                    if (!isMarked && lockStatus.locked) {
                        badge = '<span class="badge badge--absent" style="background:rgba(198,40,40,0.1); color:#C62828; border:1px solid #EF9A9A;">Locked (10m Expired)</span>';
                    } else if (lockStatus.isHODUnlocked) {
                        badge += ' <span class="badge badge--present" style="font-size:0.75rem;">HOD Unlocked</span>';
                    }

                    const markBtnText = lockStatus.locked ? 'Request HOD Unlock' : (isMarked ? 'Update Attendance' : (this.dateMode === 'today' ? 'Mark Attendance' : 'Preview Class'));
                    const markBtnClass = lockStatus.locked ? 'btn btn--sm btn--outline' : 'btn btn--sm btn--primary';

                    tr.innerHTML = `
                        <td style="padding: 1rem;"><strong>Period ${pNum}</strong></td>
                        <td style="padding: 1rem;">${timeStr}</td>
                        <td style="padding: 1rem;"><strong>${item.subjectCode}</strong><br><small style="color:var(--color-text-muted)">${item.subjectName}</small></td>
                        <td style="padding: 1rem;">${item.classLabel} ${badge}</td>
                        <td style="padding: 1rem;">
                            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                                <button class="${markBtnClass} mark-btn">${markBtnText}</button>
                                <button class="btn btn--sm btn--outline realloc-btn">${this.dateMode === 'today' ? 'Reallocate' : 'Advance Reallocate'}</button>
                            </div>
                        </td>
                    `;

                    tr.querySelector('.mark-btn').addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (lockStatus.locked) {
                            this.openUnlockModal(item);
                        } else {
                            this.selectPeriod(pNum);
                        }
                    });

                    tr.querySelector('.realloc-btn').addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.openReallocationModal(item);
                    });

                    tr.addEventListener('click', () => {
                        this.selectPeriod(pNum);
                    });
                }

                tableBody.appendChild(tr);
            });
        },

        renderIncomingReallocations: function() {
            const container = document.getElementById('incomingReallocations');
            const list = document.getElementById('reallocRequestsList');
            if(!container || !list || !window.Reallocation) return;

            const year = this.currentDate.getFullYear();
            const month = String(this.currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(this.currentDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            const pending = window.Reallocation.getPendingRequestsForFaculty(this.user.facultyId, dateStr);

            if(pending.length === 0) {
                container.style.display = 'none';
                return;
            }

            container.style.display = 'block';
            list.innerHTML = '';

            pending.forEach(req => {
                const fromFaculty = window.Timetable.getFacultyById ? window.Timetable.getFacultyById(req.fromFacultyId) : null;
                const fromName = fromFaculty ? fromFaculty.name : req.fromFacultyId;
                
                const card = document.createElement('div');
                card.style.cssText = "background: var(--color-surface); border: 1px solid var(--border-color); border-left: 4px solid var(--color-late); padding: 1rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;";
                
                card.innerHTML = `
                    <div>
                        <div style="font-weight: 600;">Reallocation Request from ${fromName} (${req.date === new Date().toISOString().split('T')[0] ? 'Today' : 'Tomorrow, ' + req.date})</div>
                        <div style="color: var(--color-text-muted); font-size: 0.9rem;">
                            Period ${req.period} • ${req.classGroup.replace(/-/g, ' ')}
                            ${req.reason ? `• Reason: "${req.reason}"` : ''}
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn--sm btn--primary accept-btn">Accept</button>
                        <button class="btn btn--sm btn--danger reject-btn">Reject</button>
                    </div>
                `;

                card.querySelector('.accept-btn').addEventListener('click', () => {
                    window.Reallocation.respondToRequest(req.id, 'accepted');
                    this.showToast('Reallocation accepted!');
                    this.loadSchedule();
                });

                card.querySelector('.reject-btn').addEventListener('click', () => {
                    window.Reallocation.respondToRequest(req.id, 'rejected');
                    this.showToast('Reallocation rejected');
                    this.loadSchedule();
                });

                list.appendChild(card);
            });
        },

        selectPeriod: function(pNum) {
            const scheduled = this.schedule.find(s => (s.period.num || s.period) === pNum);
            if(!scheduled || scheduled.type === 'free') return;

            this.selectedPeriod = scheduled;
            
            // Highlight in strip
            document.querySelectorAll('#scheduleStrip tbody tr').forEach(tr => {
                if(parseInt(tr.dataset.period) === pNum) {
                    tr.style.background = "rgba(46, 125, 50, 0.08)";
                } else {
                    tr.style.background = "";
                }
            });

            // Show container
            const container = document.getElementById('attendanceContainer');
            if(container) {
                container.style.display = 'block';
                container.scrollIntoView({ behavior: 'smooth' });
            }

            // Set Title
            const title = document.getElementById('attendanceTitle');
            if(title) {
                title.textContent = `Period ${pNum} — ${scheduled.subjectName} (${scheduled.classLabel}) [${this.dateMode === 'today' ? 'Today' : 'Tomorrow'}]`;
            }

            this.loadPeriodAttendance(scheduled);
        },

        loadPeriodAttendance: function(periodData) {
            if(window.MockData && window.MockData.getStudentsByClassGroup) {
                this.studentsList = window.MockData.getStudentsByClassGroup(periodData.classGroup);
            } else {
                this.studentsList = [];
            }

            const year = this.currentDate.getFullYear();
            const month = String(this.currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(this.currentDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            const pNum = periodData.period.num || periodData.period;
            const storageKey = `scad_period_att_${dateStr}_${periodData.classGroup}_${pNum}`;
            const remarksKey = `scad_period_od_remarks_${dateStr}_${periodData.classGroup}_${pNum}`;
            
            const savedData = localStorage.getItem(storageKey);
            const savedRemarks = localStorage.getItem(remarksKey);

            if (savedRemarks) {
                try { this.odRemarksState = JSON.parse(savedRemarks); } catch(e) { this.odRemarksState = {}; }
            } else {
                this.odRemarksState = {};
            }

            if (savedData) {
                this.attendanceState = JSON.parse(savedData);
                const saveBtn = document.getElementById('saveAttendanceBtn');
                if (saveBtn) saveBtn.textContent = 'Update Attendance';
            } else {
                this.attendanceState = {};
                this.studentsList.forEach(s => {
                    if (window.ODExemption && window.ODExemption.isStudentOnOD(s.id, dateStr, pNum)) {
                        this.attendanceState[s.id] = 'od';
                        this.odRemarksState[s.id] = 'Approved On-Duty Exemption';
                    } else {
                        this.attendanceState[s.id] = 'present';
                    }
                });
                const saveBtn = document.getElementById('saveAttendanceBtn');
                if (saveBtn) saveBtn.textContent = 'Save Attendance';
            }

            this.updateSummary();
            this.renderAttendanceTable();
        },

        renderAttendanceTable: function() {
            const tbody = document.getElementById('attendanceTableBody');
            if(!tbody) return;
            
            tbody.innerHTML = '';
            
            const year = this.currentDate.getFullYear();
            const month = String(this.currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(this.currentDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            const overrides = window.AttendanceEngine ? window.AttendanceEngine.getOverrides(dateStr) : {};

            this.studentsList.forEach((student, index) => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = "1px solid var(--border-color)";
                
                const status = this.attendanceState[student.id] || 'present';
                
                let nameHtml = `<a href="#" class="profile-btn" data-student-id="${student.id}" style="color:var(--color-primary); font-weight:500; text-decoration:none;">${student.name}</a>`;
                
                // Strictly render OD Note only when status is 'od'
                if (status === 'od' && this.odRemarksState[student.id]) {
                    nameHtml += `<br><span class="badge badge--od" style="margin-top:3px; font-size:0.75rem; display:inline-block;">OD Note: ${this.odRemarksState[student.id]}</span>`;
                }

                const override = overrides[student.id];
                if (override && override.reason) {
                    const safeReason = override.reason.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    nameHtml += `<br><small style="color:var(--color-text-muted); font-size:0.8rem;">Admin Note: ${safeReason}</small>`;
                }

                tr.innerHTML = `
                    <td style="padding: 1rem;">${index + 1}</td>
                    <td style="padding: 1rem;">${student.regNo}</td>
                    <td style="padding: 1rem;">${nameHtml}</td>
                    <td style="padding: 1rem;">
                        <div class="attendance-btn-group" data-id="${student.id}">
                            <button type="button" class="btn-present ${status === 'present' ? 'active' : ''}">Present</button>
                            <button type="button" class="btn-absent ${status === 'absent' ? 'active' : ''}">Absent</button>
                            <button type="button" class="btn-od ${status === 'od' ? 'active' : ''}">OD</button>
                        </div>
                    </td>
                `;

                const btnGroup = tr.querySelector('.attendance-btn-group');
                const btnP = btnGroup.querySelector('.btn-present');
                const btnA = btnGroup.querySelector('.btn-absent');
                const btnOD = btnGroup.querySelector('.btn-od');

                btnP.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.attendanceState[student.id] = 'present';
                    delete this.odRemarksState[student.id]; // Completely remove OD remark
                    this.updateSummary();
                    this.renderAttendanceTable();
                });
                
                btnA.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.attendanceState[student.id] = 'absent';
                    delete this.odRemarksState[student.id]; // Completely remove OD remark
                    this.updateSummary();
                    this.renderAttendanceTable();
                });

                btnOD.addEventListener('click', (e) => {
                    e.preventDefault();
                    const existingRemark = this.odRemarksState[student.id] || '';
                    const remark = prompt(`Enter On-Duty (OD) / Exemption Reason for ${student.name}:`, existingRemark || 'Technical Symposium / Sports / Medical');
                    if (remark !== null) {
                        this.odRemarksState[student.id] = remark.trim() || 'On-Duty Exemption';
                        this.attendanceState[student.id] = 'od';
                        this.updateSummary();
                        this.renderAttendanceTable();
                    }
                });

                tbody.appendChild(tr);
            });
        },

        markAllPresent: function() {
            this.studentsList.forEach(s => {
                this.attendanceState[s.id] = 'present';
                delete this.odRemarksState[s.id];
            });
            this.updateSummary();
            this.renderAttendanceTable();
            this.showToast('All students marked present');
        },

        saveAttendance: function() {
            if(!this.selectedPeriod) return;

            const periodData = this.selectedPeriod;
            const year = this.currentDate.getFullYear();
            const month = String(this.currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(this.currentDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            const pNum = periodData.period.num || periodData.period;
            
            const storageKey = `scad_period_att_${dateStr}_${periodData.classGroup}_${pNum}`;
            const remarksKey = `scad_period_od_remarks_${dateStr}_${periodData.classGroup}_${pNum}`;
            
            // Persist both attendance state and OD remarks
            localStorage.setItem(storageKey, JSON.stringify(this.attendanceState));
            localStorage.setItem(remarksKey, JSON.stringify(this.odRemarksState));
            
            // Log to Audit Trail
            if (window.AuditLogger) {
                let pCount = 0, aCount = 0, oCount = 0;
                for (const k in this.attendanceState) {
                    if (this.attendanceState[k] === 'present') pCount++;
                    else if (this.attendanceState[k] === 'absent') aCount++;
                    else if (this.attendanceState[k] === 'od') oCount++;
                }
                window.AuditLogger.log(
                    'ATTENDANCE_UPDATED',
                    `${periodData.classGroup} (Period ${pNum})`,
                    `Updated attendance: ${pCount} Present, ${aCount} Absent, ${oCount} On-Duty on ${dateStr}`
                );
            }
            
            // Track submission for HOD dashboard
            let facultySubmissions = JSON.parse(localStorage.getItem(`scad_faculty_sub_${dateStr}`) || '{}');
            if(!facultySubmissions[this.user.facultyId]) {
                facultySubmissions[this.user.facultyId] = [];
            }
            if(!facultySubmissions[this.user.facultyId].includes(pNum)) {
                facultySubmissions[this.user.facultyId].push(pNum);
            }
            localStorage.setItem(`scad_faculty_sub_${dateStr}`, JSON.stringify(facultySubmissions));

            // Update save button to reflect updated status
            const saveBtn = document.getElementById('saveAttendanceBtn');
            if (saveBtn) saveBtn.textContent = 'Update Attendance';

            this.updateSummary();
            this.renderScheduleStrip();
            this.showToast('Attendance saved & updated successfully!');
        },

        updateSummary: function() {
            const sumBox = document.getElementById('attendanceSummary');
            if(!sumBox) return;

            let total = this.studentsList.length;
            let present = 0;
            let absent = 0;
            let od = 0;

            for(const studentId in this.attendanceState) {
                const status = this.attendanceState[studentId];
                if(status === 'present') present++;
                else if(status === 'absent') absent++;
                else if(status === 'od') od++;
            }

            document.getElementById('summaryTotal').textContent = total;
            document.getElementById('summaryPresent').textContent = present;
            document.getElementById('summaryAbsent').textContent = absent;
            document.getElementById('summaryOD').textContent = od;

            sumBox.style.display = 'grid';
        },

        showToast: function(msg) {
            const toast = document.getElementById('toast');
            if(!toast) return;
            toast.textContent = msg;
            toast.style.display = 'block';
            setTimeout(() => {
                toast.style.display = 'none';
            }, 3000);
        },

        openReallocationModal: function(item) {
            const modal = document.getElementById('reallocModal');
            const select = document.getElementById('reallocFacultySelect');
            const reason = document.getElementById('reallocReason');
            const info = document.getElementById('reallocPeriodInfo');
            if(!modal || !select || !reason || !info) return;

            info.textContent = `Period ${item.period.num || item.period} - ${item.classLabel} (${this.dateMode === 'today' ? 'Today' : 'Tomorrow'})`;
            
            const allFaculty = (window.Timetable && window.Timetable.getFacultyList) ? window.Timetable.getFacultyList() : (window.Timetable.FACULTY || []);
            const deptFaculty = allFaculty.filter(f => 
                (f.dept === this.user.department || (this.user.department === 'ALL_I' && ['MATH','PHY','ENG','ALL_I'].includes(f.dept))) && 
                f.id !== this.user.facultyId && f.username !== this.user.username
            );
            
            const dateStr = this.currentDate.toISOString().split('T')[0];
            const pNum = Number(item.period.num || item.period);

            select.innerHTML = '<option value="">-- Select Available Faculty --</option>' + 
                deptFaculty.map(f => {
                    const sched = window.Timetable.getFacultySchedule ? window.Timetable.getFacultySchedule(f.id, dateStr) : [];
                    const isBusy = sched.some(s => Number(s.period.num || s.period) === pNum);
                    if (isBusy) {
                        return `<option value="${f.id}" disabled style="color:#999;">${f.name} (Busy in Period ${pNum})</option>`;
                    } else {
                        return `<option value="${f.id}">${f.name} (Available)</option>`;
                    }
                }).join('');
                
            reason.value = '';
            modal.classList.add('open');

            const sendBtn = document.getElementById('reallocSendBtn');
            const cancelBtn = document.getElementById('reallocCancelBtn');

            const closeModal = () => { modal.classList.remove('open'); };
            cancelBtn.onclick = closeModal;
            
            sendBtn.onclick = () => {
                if(!select.value) return alert('Please select a faculty member');
                const pNum = item.period.num || item.period;
                const dateStr = this.currentDate.toISOString().split('T')[0];
                window.Reallocation.createRequest(this.user.facultyId, select.value, dateStr, pNum, item.classGroup, reason.value);
                this.showToast('Reallocation request sent');
                closeModal();
            };
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        if (window.FacultyDashboard) window.FacultyDashboard.init();
    });
})();
