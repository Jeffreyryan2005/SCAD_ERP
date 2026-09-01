(function() {
    window.FacultyDashboard = {
        user: null,
        currentDate: null,
        schedule: [],
        currentPeriodSelection: null,
        attendanceState: {},
        studentsList: [],

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
            const logoutBtn = document.getElementById('logoutBtn');
            if(logoutBtn) {
                logoutBtn.addEventListener('click', () => {
                    if(window.Auth && window.Auth.logout) window.Auth.logout();
                });
            }

            const themeToggle = document.getElementById('themeToggle');
            if(themeToggle) {
                themeToggle.addEventListener('click', () => {
                    if(window.Theme && window.Theme.toggle) window.Theme.toggle();
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
            // Format YYYY-MM-DD
            // Use local date properly
            const year = this.currentDate.getFullYear();
            const month = String(this.currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(this.currentDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            
            if(window.Timetable && window.Timetable.getFacultySchedule) {
                this.schedule = window.Timetable.getFacultySchedule(this.user.facultyId, dateStr);
                
                // Process Reallocations
                if(window.Reallocation) {
                    // Remove periods reallocated FROM this faculty
                    const fromReqs = window.Reallocation.getReallocatedPeriodsFromFaculty(this.user.facultyId, dateStr);
                    fromReqs.forEach(req => {
                        this.schedule = this.schedule.filter(s => {
                            const pNum = s.period.num || s.period;
                            return !(pNum === req.period && s.classGroup === req.classGroup);
                        });
                    });

                    // Add periods reallocated TO this faculty
                    const toReqs = window.Reallocation.getReallocatedPeriodsForFaculty(this.user.facultyId, dateStr);
                    toReqs.forEach(req => {
                        // We need the subject info for this classGroup and period
                        const classSched = window.Timetable.getClassSchedule(req.classGroup, dateStr);
                        if(classSched) {
                            const subjectInfo = classSched[req.period - 1]; // periods are 1-indexed
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

                    // Sort schedule by period
                    this.schedule.sort((a, b) => (a.period.num || a.period) - (b.period.num || b.period));
                }
            }
            
            this.renderScheduleStrip();
            this.renderIncomingReallocations();
            
            // Auto-select current period if available
            if(window.Timetable && window.Timetable.getCurrentPeriod) {
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
            const container = document.getElementById('scheduleStrip');
            if(!tableBody) return;

            tableBody.innerHTML = '';

            if(!this.schedule || this.schedule.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5">No classes scheduled for today.</td></tr>';
                return;
            }

            let currPeriodNum = null;
            if(window.Timetable && window.Timetable.getCurrentPeriod) {
                const p = window.Timetable.getCurrentPeriod();
                if(p) currPeriodNum = p.num;
            }

            this.schedule.forEach(item => {
                const pNum = item.period.num || item.period;
                const periodInfo = window.Timetable.PERIODS ? window.Timetable.PERIODS.find(p => p.num === pNum) : null;
                
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
                        <td><strong>${pNum}</strong></td>
                        <td>${periodInfo ? periodInfo.start + ' - ' + periodInfo.end : ''}</td>
                        <td colspan="3">${item.subjectName}</td>
                    `;
                } else {
                    tr.style.cursor = 'pointer';
                    tr.innerHTML = `
                        <td><strong>${pNum}</strong></td>
                        <td>${periodInfo ? periodInfo.start + ' - ' + periodInfo.end : ''}</td>
                        <td><strong>${item.subjectName}</strong><br><small>${item.subjectCode}</small></td>
                        <td>${item.classLabel}</td>
                        <td style="display:flex;gap:0.5rem;align-items:center;">
                            <button class="btn btn--secondary btn--sm btn-mark">Mark Attendance</button>
                            <button class="btn btn--outline btn--sm btn-realloc" style="border:1px solid #FF9800; color:#FF9800;">Reallocate</button>
                        </td>
                    `;
                    const btnMark = tr.querySelector('.btn-mark');
                    const btnRealloc = tr.querySelector('.btn-realloc');

                    btnMark.addEventListener('click', (e) => {
                        e.stopPropagation();
                        document.querySelectorAll('#scheduleStrip tr').forEach(c => c.classList.remove('active'));
                        tr.classList.remove('past');
                        tr.classList.add('active');
                        this.selectPeriod(pNum);
                    });
                    
                    btnRealloc.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.openReallocationModal(item);
                    });
                }

                tableBody.appendChild(tr);
            });
        },

        selectPeriod: function(periodNum) {
            const periodData = this.schedule.find(s => (s.period.num || s.period) === periodNum);
            if(!periodData) return;

            this.currentPeriodSelection = periodData;

            // Show container
            const container = document.getElementById('attendanceContainer');
            if(container) container.style.display = 'block';

            // Set title
            const titleEl = document.getElementById('attendanceTitle');
            if(titleEl) {
                const pNum = periodData.period.num || periodData.period;
                titleEl.textContent = `Period ${pNum} - ${periodData.subjectName} (${periodData.classLabel})`;
            }

            // Load students
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
            const savedData = localStorage.getItem(storageKey);

            if (savedData) {
                this.attendanceState = JSON.parse(savedData);
                this.updateSummary(); // it was saved, so show summary
            } else {
                // Not saved, fetch from mock data if available
                if(window.MockData && window.MockData.generatePeriodAttendance) {
                    const mockAtt = window.MockData.generatePeriodAttendance(dateStr, periodData.classGroup);
                    
                    // extract just this period
                    this.attendanceState = {};
                    const pNum = periodData.period.num || periodData.period;
                    for(const studentId in mockAtt) {
                        if (window.ODExemption && window.ODExemption.isStudentOnOD(studentId, dateStr, pNum)) {
                            this.attendanceState[studentId] = 'od';
                        } else if (mockAtt[studentId][pNum]) {
                            this.attendanceState[studentId] = mockAtt[studentId][pNum];
                        } else {
                            this.attendanceState[studentId] = 'present'; // default
                        }
                    }
                } else {
                    // default all present
                    this.attendanceState = {};
                    this.studentsList.forEach(s => {
                        this.attendanceState[s.id] = 'present';
                    });
                }
                
                // hide summary if not saved yet
                const sumBox = document.getElementById('attendanceSummary');
                if(sumBox) sumBox.style.display = 'none';
            }

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
                const statusClass = status === 'present' ? 'present' : 'absent';
                
                let nameHtml = `<a href="#" class="profile-btn" data-student-id="${student.id}" style="color:var(--color-primary); font-weight:500; text-decoration:none;">${student.name}</a>`;
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
                            <button class="btn-present ${status === 'present' ? 'active' : ''}">Present</button>
                            <button class="btn-absent ${status === 'absent' ? 'active' : ''}">Absent</button>
                            <button class="btn-od ${status === 'od' ? 'active' : ''}">OD</button>
                        </div>
                    </td>
                `;

                const btnGroup = tr.querySelector('.attendance-btn-group');
                const btnP = btnGroup.querySelector('.btn-present');
                const btnA = btnGroup.querySelector('.btn-absent');
                const btnOD = btnGroup.querySelector('.btn-od');

                const clearAll = () => { btnP.classList.remove('active'); btnA.classList.remove('active'); btnOD.classList.remove('active'); };

                btnP.addEventListener('click', () => {
                    this.attendanceState[student.id] = 'present';
                    clearAll(); btnP.classList.add('active');
                });
                
                btnA.addEventListener('click', () => {
                    this.attendanceState[student.id] = 'absent';
                    clearAll(); btnA.classList.add('active');
                });

                btnOD.addEventListener('click', () => {
                    this.attendanceState[student.id] = 'od';
                    clearAll(); btnOD.classList.add('active');
                });

                tbody.appendChild(tr);
            });
        },


        markAllPresent: function() {
            this.studentsList.forEach(s => {
                this.attendanceState[s.id] = 'present';
            });
            // Re-render the student list so buttons update
            this.renderAttendanceTable();
            this.showToast('All students marked present');
        },

        saveAttendance: function() {
            if(!this.currentPeriodSelection) return;

            const periodData = this.currentPeriodSelection;
            const year = this.currentDate.getFullYear();
            const month = String(this.currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(this.currentDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            const pNum = periodData.period.num || periodData.period;
            
            const storageKey = `scad_period_att_${dateStr}_${periodData.classGroup}_${pNum}`;
            
            localStorage.setItem(storageKey, JSON.stringify(this.attendanceState));
            
            // Log to Audit Trail
            if (window.AuditLogger) {
                let pCount = 0, aCount = 0, oCount = 0;
                for (const k in this.attendanceState) {
                    if (this.attendanceState[k] === 'present') pCount++;
                    else if (this.attendanceState[k] === 'absent') aCount++;
                    else if (this.attendanceState[k] === 'od') oCount++;
                }
                window.AuditLogger.log(
                    'ATTENDANCE_MARKED',
                    `${periodData.classGroup} (Period ${pNum})`,
                    `Saved attendance: ${pCount} Present, ${aCount} Absent, ${oCount} On-Duty on ${dateStr}`
                );
            }
            
            // Track submission for HOD dashboard
            if (this.user && (this.user.facultyId || this.user.username)) {
                const facId = this.user.facultyId || this.user.username;
                const submitKey = `scad_submitted_${dateStr}_${facId}_${pNum}`;
                localStorage.setItem(submitKey, 'true');
            }

            this.updateSummary();
            this.showToast();
        },

        updateSummary: function() {
            const summaryBox = document.getElementById('attendanceSummary');
            if(!summaryBox) return;

            summaryBox.style.display = 'flex';
            
            const total = this.studentsList.length;
            let presentCount = 0;
            let absentCount = 0;
            let odCount = 0;

            for(const sid in this.attendanceState) {
                if(this.attendanceState[sid] === 'present') presentCount++;
                else if(this.attendanceState[sid] === 'absent') absentCount++;
                else if(this.attendanceState[sid] === 'od') odCount++;
            }

            const totalEl = document.getElementById('summaryTotal');
            const presentEl = document.getElementById('summaryPresent');
            const absentEl = document.getElementById('summaryAbsent');
            const odEl = document.getElementById('summaryOD');
            
            if(totalEl) totalEl.textContent = total;
            if(presentEl) presentEl.textContent = presentCount;
            if(absentEl) absentEl.textContent = absentCount;
            if(odEl) odEl.textContent = odCount;
        },

        showToast: function(msg = 'Attendance Saved Successfully') {
            const toast = document.getElementById('toast');
            if(!toast) return;
            toast.textContent = msg;
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        },

        /* ============================
           REALLOCATION LOGIC
           ============================ */
        renderIncomingReallocations: function() {
            if(!window.Reallocation) return;
            const requests = window.Reallocation.getIncomingRequests(this.user.facultyId);
            const container = document.getElementById('incomingReallocations');
            const list = document.getElementById('reallocRequestsList');
            if(!container || !list) return;

            if(requests.length === 0) {
                container.style.display = 'none';
                return;
            }

            container.style.display = 'block';
            list.innerHTML = requests.map(req => {
                const fromFac = window.Timetable.FACULTY.find(f => f.id === req.fromFacultyId);
                const fromName = fromFac ? fromFac.name : req.fromFacultyId;
                return `
                <div style="display:flex; justify-content:space-between; align-items:center; background:white; padding:10px; border-radius:4px; border:1px solid #FFCC80;">
                    <div>
                        <strong>${fromName}</strong> requested reallocation for <strong>Period ${req.period}</strong> (${req.classGroup})<br>
                        <span style="font-size:0.8rem; color:var(--color-text-muted);">Reason: ${req.reason || 'None provided'}</span>
                    </div>
                    <div style="display:flex; gap:0.5rem;">
                        <button class="btn btn--sm btn--primary" style="background:#2E7D32;" onclick="window.FacultyDashboard.handleRealloc('${req.id}', 'accept')">Accept</button>
                        <button class="btn btn--sm btn--danger" onclick="window.FacultyDashboard.handleRealloc('${req.id}', 'decline')">Decline</button>
                    </div>
                </div>`;
            }).join('');
        },

        handleRealloc: function(reqId, action) {
            if(action === 'accept') {
                window.Reallocation.acceptRequest(reqId);
                this.showToast('Reallocation Accepted');
            } else {
                window.Reallocation.declineRequest(reqId);
                this.showToast('Reallocation Declined');
            }
            this.renderIncomingReallocations();
            this.loadSchedule(); // reload schedule to show/hide periods
        },

        openReallocationModal: function(item) {
            this.currentReallocItem = item;
            const modal = document.getElementById('reallocModal');
            const info = document.getElementById('reallocPeriodInfo');
            const select = document.getElementById('reallocFacultySelect');
            const reason = document.getElementById('reallocReason');
            
            info.textContent = `Period ${item.period.num || item.period} - ${item.classLabel}`;
            
            // Populate available faculty in same dept (Clash-Free Filter)
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
        window.FacultyDashboard.init();
    });
})();
