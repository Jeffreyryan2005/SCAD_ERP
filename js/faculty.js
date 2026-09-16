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
            const classEl = document.getElementById('unlockPeriodClass');
            const numEl = document.getElementById('unlockPeriodNumber');
            const categorySelect = document.getElementById('unlockReasonCategory');
            const reasonInput = document.getElementById('unlockReasonInput');

            const pNum = item.period.num || item.period;
            const timeStr = item.period && item.period.time ? item.period.time : '09:00 - 09:50';

            if (classEl) classEl.textContent = `${item.classLabel || item.classGroup} — ${item.subjectName || item.subjectCode}`;
            if (numEl) numEl.textContent = `Period ${pNum} (${timeStr})`;
            if (categorySelect) categorySelect.selectedIndex = 0;
            if (reasonInput) reasonInput.value = 'Laboratory / Practical Session Overrun';
            if (modal) modal.style.display = 'block';
        },

        onUnlockPresetChange: function(val) {
            const reasonInput = document.getElementById('unlockReasonInput');
            if (reasonInput) {
                if (val !== 'Other Academic Reason') {
                    reasonInput.value = val;
                } else {
                    reasonInput.value = '';
                    reasonInput.focus();
                }
            }
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

            // Real-time synchronization when HOD unlocks or requests are updated
            window.addEventListener('storage', (e) => {
                if (e.key && (e.key.startsWith('scad_unlocked_') || e.key === 'scad_unlock_requests')) {
                    this.renderScheduleStrip();
                }
            });

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

        menteesData: [],
        menteeFilters: {
            search: '',
            year: 'ALL',
            att: 'ALL',
            arrears: 'ALL',
            sort: 'cgpa_desc'
        },
        periodFilterStatus: 'ALL',
        periodSearchQuery: '',

        renderMyMentees: function() {
            const tbody = document.getElementById('faculty-mentees-tbody');
            if (!tbody || !window.MockData) return;

            const fid = this.user ? (this.user.facultyId || this.user.username) : 'faculty_cse_1';
            let mentees = window.MockData.getMenteesForFaculty ? window.MockData.getMenteesForFaculty(fid) : [];

            if ((!mentees || mentees.length === 0) && window.MockData.getAllStudents) {
                const all = window.MockData.getAllStudents();
                mentees = all.slice(0, 16);
            }

            this.menteesData = mentees.map((m, idx) => {
                const attPct = m.attendancePct || Math.round(74 + ((m.id || idx) % 24));
                const phoneStr = m.parentPhone || `+91 94432 ${String(10000 + (m.id || idx) * 11).substring(0, 5)}`;
                const cgpaVal = parseFloat(m.cgpa || (6.8 + ((m.id || idx) % 25) * 0.1).toFixed(2));
                const arrearsVal = m.arrears !== undefined ? m.arrears : ((m.id || idx) % 6 === 0 ? 1 : 0);
                return {
                    ...m,
                    attendancePct: attPct,
                    parentPhone: phoneStr,
                    cgpa: cgpaVal,
                    arrears: arrearsVal
                };
            });

            // Update Summary Stats Pills
            const total = this.menteesData.length;
            const defaulters = this.menteesData.filter(m => m.attendancePct < 75).length;
            const topCgpa = this.menteesData.filter(m => m.cgpa >= 8.0).length;
            const withArrears = this.menteesData.filter(m => m.arrears > 0).length;

            const elTotal = document.getElementById('mentee-stat-total');
            const elDef = document.getElementById('mentee-stat-defaulters');
            const elCgpa = document.getElementById('mentee-stat-high-cgpa');
            const elArr = document.getElementById('mentee-stat-arrears');

            if (elTotal) elTotal.textContent = total;
            if (elDef) elDef.textContent = defaulters;
            if (elCgpa) elCgpa.textContent = topCgpa;
            if (elArr) elArr.textContent = withArrears;

            this.applyMenteeFilteringAndRendering();
        },

        applyMenteeFilteringAndRendering: function() {
            const tbody = document.getElementById('faculty-mentees-tbody');
            const badge = document.getElementById('faculty-mentees-count');
            if (!tbody) return;

            let list = [...this.menteesData];
            const { search, year, att, arrears, sort } = this.menteeFilters;

            // Search filter
            if (search) {
                const q = search.toLowerCase();
                list = list.filter(m => (m.name && m.name.toLowerCase().includes(q)) || (m.regNo && m.regNo.toLowerCase().includes(q)));
            }

            // Year filter
            if (year !== 'ALL') {
                list = list.filter(m => m.year === year);
            }

            // Attendance category filter
            if (att === 'DEFAULTER') {
                list = list.filter(m => m.attendancePct < 75);
            } else if (att === 'BORDERLINE') {
                list = list.filter(m => m.attendancePct >= 75 && m.attendancePct <= 80);
            } else if (att === 'GOOD') {
                list = list.filter(m => m.attendancePct >= 80);
            }

            // Arrears filter
            if (arrears === 'HAS_ARREARS') {
                list = list.filter(m => m.arrears > 0);
            } else if (arrears === 'CLEAR') {
                list = list.filter(m => m.arrears === 0);
            }

            // Sorting logic
            list.sort((a, b) => {
                if (sort === 'cgpa_desc') return b.cgpa - a.cgpa;
                if (sort === 'cgpa_asc') return a.cgpa - b.cgpa;
                if (sort === 'att_asc') return a.attendancePct - b.attendancePct;
                if (sort === 'att_desc') return b.attendancePct - a.attendancePct;
                if (sort === 'arrears_desc') return b.arrears - a.arrears;
                if (sort === 'arrears_asc') return a.arrears - b.arrears;
                if (sort === 'name_asc') return (a.name || '').localeCompare(b.name || '');
                if (sort === 'name_desc') return (b.name || '').localeCompare(a.name || '');
                if (sort === 'reg_asc') return (a.regNo || '').localeCompare(b.regNo || '');
                if (sort === 'reg_desc') return (b.regNo || '').localeCompare(a.regNo || '');
                return 0;
            });

            if (badge) badge.textContent = `${list.length} / ${this.menteesData.length} Mentees`;

            this.updateMenteeSortIcons(sort);

            if (list.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:1.5rem; color:var(--color-text-muted);">No mentees matching current filters. <button class="btn btn--sm btn--outline" onclick="window.FacultyDashboard.resetMenteeFilters()" style="margin-left:8px;">Reset Filters</button></td></tr>';
                return;
            }

            tbody.innerHTML = list.map((m) => {
                const attPct = m.attendancePct;
                const pctColor = attPct < 75 ? '#C62828' : '#2E7D32';
                const parentPhoneClean = m.parentPhone.replace(/\s+/g, '');
                const cgpaFormatted = Number(m.cgpa).toFixed(2);
                const smsMsg = encodeURIComponent(`Dear Parent, SCAD CET Mentor Update: Your ward ${m.name} (${m.regNo}) current attendance is ${attPct}%, CGPA: ${cgpaFormatted}, Arrears: ${m.arrears}. Please contact mentor.`);

                return `<tr>
                    <td><strong>${m.regNo}</strong></td>
                    <td><a href="#" class="profile-btn" data-student-id="${m.id}" style="color:var(--color-primary); font-weight:600;">${m.name}</a></td>
                    <td>Year ${m.year} (${m.section})</td>
                    <td><span style="font-weight:700; color:${pctColor}; font-size:0.95rem;">${attPct}%</span></td>
                    <td><strong style="color:${m.cgpa >= 8.0 ? '#2E7D32' : 'inherit'};">${cgpaFormatted}</strong></td>
                    <td><span style="color:${m.arrears > 0 ? '#C62828' : '#2E7D32'}; font-weight:600;">${m.arrears}</span></td>
                    <td><a href="tel:${parentPhoneClean}" style="color:var(--color-primary);">${m.parentPhone}</a></td>
                    <td>
                        <div style="display:flex; gap:4px;">
                            <button class="btn btn--sm btn--secondary" onclick="window.location.href='tel:${parentPhoneClean}'">Call</button>
                            <button class="btn btn--sm btn--outline" onclick="window.location.href='sms:${parentPhoneClean}?body=${smsMsg}'">SMS</button>
                        </div>
                    </td>
                </tr>`;
            }).join('');
        },

        updateMenteeSortIcons: function(sort) {
            const icons = {
                regNo: document.getElementById('sort-icon-regNo'),
                name: document.getElementById('sort-icon-name'),
                year: document.getElementById('sort-icon-year'),
                att: document.getElementById('sort-icon-att'),
                cgpa: document.getElementById('sort-icon-cgpa'),
                arrears: document.getElementById('sort-icon-arrears')
            };
            Object.values(icons).forEach(icon => { if (icon) icon.textContent = '↕'; });
            if (sort === 'cgpa_desc' && icons.cgpa) icons.cgpa.textContent = '▼';
            else if (sort === 'cgpa_asc' && icons.cgpa) icons.cgpa.textContent = '▲';
            else if (sort === 'att_asc' && icons.att) icons.att.textContent = '▲';
            else if (sort === 'att_desc' && icons.att) icons.att.textContent = '▼';
            else if (sort === 'arrears_desc' && icons.arrears) icons.arrears.textContent = '▼';
            else if (sort === 'name_asc' && icons.name) icons.name.textContent = '▲';
            else if (sort === 'name_desc' && icons.name) icons.name.textContent = '▼';
            else if (sort === 'reg_asc' && icons.regNo) icons.regNo.textContent = '▲';
            else if (sort === 'reg_desc' && icons.regNo) icons.regNo.textContent = '▼';
        },

        onMenteeSearch: function(val) {
            this.menteeFilters.search = (val || '').trim();
            this.applyMenteeFilteringAndRendering();
        },

        onMenteeFilterChange: function() {
            const yEl = document.getElementById('mentee-year-filter');
            const aEl = document.getElementById('mentee-att-filter');
            const arrEl = document.getElementById('mentee-arrears-filter');
            if (yEl) this.menteeFilters.year = yEl.value;
            if (aEl) this.menteeFilters.att = aEl.value;
            if (arrEl) this.menteeFilters.arrears = arrEl.value;
            this.applyMenteeFilteringAndRendering();
        },

        onMenteeSortChange: function(val) {
            this.menteeFilters.sort = val;
            this.applyMenteeFilteringAndRendering();
        },

        toggleMenteeHeaderSort: function(field) {
            const select = document.getElementById('mentee-sort-select');
            let nextSort = 'cgpa_desc';
            if (field === 'cgpa') {
                nextSort = this.menteeFilters.sort === 'cgpa_desc' ? 'cgpa_asc' : 'cgpa_desc';
            } else if (field === 'att') {
                nextSort = this.menteeFilters.sort === 'att_asc' ? 'att_desc' : 'att_asc';
            } else if (field === 'arrears') {
                nextSort = this.menteeFilters.sort === 'arrears_desc' ? 'arrears_asc' : 'arrears_desc';
            } else if (field === 'name') {
                nextSort = this.menteeFilters.sort === 'name_asc' ? 'name_desc' : 'name_asc';
            } else if (field === 'regNo') {
                nextSort = this.menteeFilters.sort === 'reg_asc' ? 'reg_desc' : 'reg_asc';
            }
            this.menteeFilters.sort = nextSort;
            if (select) select.value = nextSort;
            this.applyMenteeFilteringAndRendering();
        },

        setMenteeFilter: function(category) {
            const aEl = document.getElementById('mentee-att-filter');
            const arrEl = document.getElementById('mentee-arrears-filter');
            const sEl = document.getElementById('mentee-sort-select');
            this.resetMenteeFilters(false);

            if (category === 'DEFAULTER') {
                this.menteeFilters.att = 'DEFAULTER';
                this.menteeFilters.sort = 'att_asc';
                if (aEl) aEl.value = 'DEFAULTER';
                if (sEl) sEl.value = 'att_asc';
            } else if (category === 'TOP_CGPA') {
                this.menteeFilters.sort = 'cgpa_desc';
                if (sEl) sEl.value = 'cgpa_desc';
            } else if (category === 'HAS_ARREARS') {
                this.menteeFilters.arrears = 'HAS_ARREARS';
                this.menteeFilters.sort = 'arrears_desc';
                if (arrEl) arrEl.value = 'HAS_ARREARS';
                if (sEl) sEl.value = 'arrears_desc';
            }
            this.applyMenteeFilteringAndRendering();
        },

        resetMenteeFilters: function(render = true) {
            this.menteeFilters = { search: '', year: 'ALL', att: 'ALL', arrears: 'ALL', sort: 'cgpa_desc' };
            const sIn = document.getElementById('mentee-search-input');
            const yEl = document.getElementById('mentee-year-filter');
            const aEl = document.getElementById('mentee-att-filter');
            const arrEl = document.getElementById('mentee-arrears-filter');
            const sEl = document.getElementById('mentee-sort-select');
            if (sIn) sIn.value = '';
            if (yEl) yEl.value = 'ALL';
            if (aEl) aEl.value = 'ALL';
            if (arrEl) arrEl.value = 'ALL';
            if (sEl) sEl.value = 'cgpa_desc';
            if (render) this.applyMenteeFilteringAndRendering();
        },

        exportMenteesCSV: function() {
            if (!this.menteesData || this.menteesData.length === 0) {
                alert('No mentee data available to export.');
                return;
            }
            let csv = 'Reg No,Student Name,Year,Section,Attendance (%),CGPA,Arrears,Parent Phone\n';
            this.menteesData.forEach(m => {
                csv += `"${m.regNo}","${m.name}","${m.year}","${m.section}",${m.attendancePct},${Number(m.cgpa).toFixed(2)},${m.arrears},"${m.parentPhone}"\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `SCAD_Mentees_${(this.user ? this.user.name : 'Faculty').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        },

        onPeriodStudentSearch: function(query) {
            this.periodSearchQuery = (query || '').trim().toLowerCase();
            this.renderAttendanceTable();
        },

        filterPeriodStatus: function(status) {
            this.periodFilterStatus = status;
            ['all', 'present', 'absent', 'od'].forEach(s => {
                const btn = document.getElementById(`filter-btn-${s}`);
                if (btn) {
                    if (s.toUpperCase() === status.toUpperCase() || (s === 'all' && status === 'ALL')) {
                        btn.className = 'btn btn--sm btn--primary';
                    } else {
                        btn.className = 'btn btn--sm btn--outline';
                    }
                }
            });
            this.renderAttendanceTable();
        },

        markAllAbsent: function() {
            this.studentsList.forEach(s => {
                this.attendanceState[s.id] = 'absent';
                delete this.odRemarksState[s.id];
            });
            this.updateSummary();
            this.renderAttendanceTable();
        },

        invertAttendance: function() {
            this.studentsList.forEach(s => {
                const current = this.attendanceState[s.id] || 'present';
                if (current === 'present') this.attendanceState[s.id] = 'absent';
                else if (current === 'absent') this.attendanceState[s.id] = 'present';
            });
            this.updateSummary();
            this.renderAttendanceTable();
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
                    const hasSavedData = localStorage.getItem(storageKey) !== null;
                    const lockStatus = this.checkPeriodLockStatus(pNum, item.classGroup);
                    const isHODUnlocked = lockStatus.isHODUnlocked;
                    const isReadOnly = hasSavedData && !isHODUnlocked;

                    const allUnlockReqs = JSON.parse(localStorage.getItem('scad_unlock_requests') || '[]');
                    const pendingUnlock = allUnlockReqs.find(r => r.date === dateStr && r.classGroup === item.classGroup && r.period === pNum && r.status === 'pending');

                    let badge = '';
                    if (isHODUnlocked) {
                        badge = '<span class="badge badge--present" style="background:#E8F5E9; color:#2E7D32; border:1px solid #A5D6A7; font-weight:600;">HOD Unlocked</span>';
                    } else if (hasSavedData) {
                        badge = '<span class="badge badge--present">Submitted</span>';
                    } else if (pendingUnlock) {
                        badge = '<span class="badge badge--late" style="background:#FFF3E0; color:#E65100; border:1px solid #FFE0B2; font-weight:600;">Awaiting HOD Unlock</span>';
                    } else if (lockStatus.locked) {
                        badge = '<span class="badge badge--absent" style="background:rgba(198,40,40,0.1); color:#C62828; border:1px solid #EF9A9A;">Locked (10m Expired)</span>';
                    } else {
                        badge = '<span class="badge badge--late">Pending</span>';
                    }

                    let markBtnText = 'Mark Attendance';
                    let markBtnClass = 'btn btn--sm btn--primary';

                    if (isHODUnlocked) {
                        markBtnText = 'Mark Attendance';
                        markBtnClass = 'btn btn--sm btn--primary';
                    } else if (hasSavedData) {
                        markBtnText = 'View Attendance';
                        markBtnClass = 'btn btn--sm btn--outline';
                    } else if (pendingUnlock) {
                        markBtnText = 'Pending Approval';
                        markBtnClass = 'btn btn--sm btn--secondary';
                    } else if (lockStatus.locked) {
                        markBtnText = 'Request HOD Unlock';
                        markBtnClass = 'btn btn--sm btn--outline';
                    } else if (this.dateMode !== 'today') {
                        markBtnText = 'Preview Class';
                        markBtnClass = 'btn btn--sm btn--primary';
                    }

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

            const lockStatus = this.checkPeriodLockStatus(pNum, periodData.classGroup);
            const isHODUnlocked = lockStatus.isHODUnlocked;
            const hasSavedData = savedData !== null;
            const isReadOnly = hasSavedData && !isHODUnlocked;

            const markAllBtn = document.getElementById('markAllPresentBtn');
            const saveBtn = document.getElementById('saveAttendanceBtn');
            const actionContainer = document.getElementById('attendanceActionButtons') || (saveBtn ? saveBtn.parentElement : null);

            let statusBadge = document.getElementById('submittedLockBadge');

            if (isReadOnly) {
                this.attendanceState = JSON.parse(savedData);
                if (markAllBtn) markAllBtn.style.display = 'none';
                if (saveBtn) saveBtn.style.display = 'none';
                
                if (!statusBadge && actionContainer) {
                    statusBadge = document.createElement('span');
                    statusBadge.id = 'submittedLockBadge';
                    statusBadge.className = 'badge badge--present';
                    statusBadge.style.cssText = 'font-size:0.85rem; padding:6px 14px; font-weight:600; display:inline-flex; align-items:center; gap:4px;';
                    statusBadge.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Attendance Submitted (Locked)';
                    actionContainer.appendChild(statusBadge);
                } else if (statusBadge) {
                    statusBadge.style.display = 'inline-flex';
                    statusBadge.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Attendance Submitted (Locked)';
                }
            } else {
                // Editable mode (either not marked yet or HOD Unlocked)
                if (markAllBtn) markAllBtn.style.display = 'inline-block';
                if (saveBtn) {
                    saveBtn.style.display = 'inline-block';
                    saveBtn.textContent = isHODUnlocked ? 'Submit Unlocked Attendance' : 'Submit Attendance';
                }
                
                if (isHODUnlocked) {
                    if (!statusBadge && actionContainer) {
                        statusBadge = document.createElement('span');
                        statusBadge.id = 'submittedLockBadge';
                        statusBadge.className = 'badge badge--present';
                        statusBadge.style.cssText = 'font-size:0.85rem; padding:6px 14px; font-weight:600; display:inline-flex; align-items:center; gap:4px; background:#E8F5E9; color:#2E7D32; border:1px solid #A5D6A7;';
                        statusBadge.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> HOD Unlocked (Ready to Mark)';
                        actionContainer.appendChild(statusBadge);
                    } else if (statusBadge) {
                        statusBadge.style.display = 'inline-flex';
                        statusBadge.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> HOD Unlocked (Ready to Mark)';
                    }
                } else if (statusBadge) {
                    statusBadge.style.display = 'none';
                }

                if (hasSavedData) {
                    this.attendanceState = JSON.parse(savedData);
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
                }
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
            const pNum = this.selectedPeriod ? (this.selectedPeriod.period.num || this.selectedPeriod.period) : null;
            const storageKey = pNum ? `scad_period_att_${dateStr}_${this.selectedPeriod.classGroup}_${pNum}` : null;
            const lockStatus = pNum ? this.checkPeriodLockStatus(pNum, this.selectedPeriod.classGroup) : { locked: false };
            const isHODUnlocked = lockStatus.isHODUnlocked;
            const hasSavedData = storageKey ? (localStorage.getItem(storageKey) !== null) : false;
            const isMarked = hasSavedData && !isHODUnlocked;
            let displayList = this.studentsList;
            if (this.periodSearchQuery) {
                displayList = displayList.filter(s =>
                    (s.name && s.name.toLowerCase().includes(this.periodSearchQuery)) ||
                    (s.regNo && s.regNo.toLowerCase().includes(this.periodSearchQuery))
                );
            }
            if (this.periodFilterStatus && this.periodFilterStatus !== 'ALL') {
                displayList = displayList.filter(s => {
                    const st = this.attendanceState[s.id] || 'present';
                    return st.toLowerCase() === this.periodFilterStatus.toLowerCase();
                });
            }

            if (displayList.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--color-text-muted);">No students matching current filter.</td></tr>';
                return;
            }

            displayList.forEach((student, index) => {
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

                const disabledAttr = isMarked ? 'disabled' : '';
                const btnGroupStyle = isMarked ? 'style="pointer-events:none; opacity:0.92;"' : '';

                tr.innerHTML = `
                    <td style="padding: 1rem;">${index + 1}</td>
                    <td style="padding: 1rem;">${student.regNo}</td>
                    <td style="padding: 1rem;">${nameHtml}</td>
                    <td style="padding: 1rem;">
                        <div class="attendance-btn-group" data-id="${student.id}" ${btnGroupStyle}>
                            <button type="button" class="btn-present ${status === 'present' ? 'active' : ''}" ${disabledAttr}>Present</button>
                            <button type="button" class="btn-absent ${status === 'absent' ? 'active' : ''}" ${disabledAttr}>Absent</button>
                            <button type="button" class="btn-od ${status === 'od' ? 'active' : ''}" ${disabledAttr}>OD</button>
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

            // Clear HOD unlock permission token so period locks into Read-Only mode after submission
            const unlockKey = `scad_unlocked_${dateStr}_${periodData.classGroup}_${pNum}`;
            localStorage.removeItem(unlockKey);

            // Refresh period to lock in Read-Only mode immediately
            this.showToast('Attendance submitted & locked successfully!');
            this.loadPeriodAttendance(periodData);
            this.renderScheduleStrip();
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
