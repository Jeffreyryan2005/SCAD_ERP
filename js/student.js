(function() {
    window.StudentDashboard = {
        init: function() {
            // Require student authentication
            this.user = window.Auth ? window.Auth.requireAuth('student') : null;
            if (!this.user) return; // auth.js will handle redirect

            // Init Theme
            if (window.Theme) {
                window.Theme.init();
                const themeToggleBtn = document.getElementById('themeToggle');
                if (themeToggleBtn) {
                    themeToggleBtn.addEventListener('click', () => window.Theme.toggle());
                }
            }

            // Setup Logout
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => {
                    if (window.Auth) window.Auth.logout();
                });
            }

            // Setup Clock
            this.updateClock();
            setInterval(() => this.updateClock(), 1000);

            // Populate Sidebar/Header User Info
            const headerUserName = document.getElementById('user-display');
            if (headerUserName) headerUserName.textContent = this.user.name;
            const userRole = document.getElementById('user-role');
            if (userRole) userRole.textContent = 'Student';

            const sidebarAvatar = document.getElementById('sidebar-avatar');
            if (sidebarAvatar) sidebarAvatar.textContent = this.user.name.charAt(0).toUpperCase();
            const sidebarUserName = document.getElementById('sidebar-user-name');
            if (sidebarUserName) sidebarUserName.textContent = this.user.name;
            const sidebarUserRole = document.getElementById('sidebar-user-role');
            if (sidebarUserRole) sidebarUserRole.textContent = this.user.regNo;

            // Fixed date for testing against mock data
            this.todayStr = '2026-08-13'; 

            this.renderProfile();
            this.renderSchedule();
            this.renderSubjectStats();
            this.renderCalendar();
            this.renderHistoryTable();
        },

        updateClock: function() {
            const now = new Date();
            const clockEl = document.getElementById('realtimeClock');
            if (clockEl) {
                // Showing seconds as requested
                clockEl.textContent = now.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    second: '2-digit',
                    hour12: true 
                });
            }
        },

        renderProfile: function() {
            const profileCard = document.getElementById('profileCard');
            if (!profileCard) return;

            const initial = this.user.name.charAt(0).toUpperCase();
            
            // Get gate data for today
            let gateStatusHtml = '';
            if (window.MockData && window.MockData.generateGateData) {
                const gateData = window.MockData.generateGateData(this.todayStr);
                const myGate = gateData[this.user.studentId];
                if (myGate) {
                    if (myGate.checkIn) {
                        const checkInTime = new Date(`2026-08-13T${myGate.checkIn}`);
                        const lateTime = new Date(`2026-08-13T09:00:00`);
                        if (checkInTime > lateTime) {
                            gateStatusHtml = `<div class="gate-status" style="background-color: rgba(255, 179, 0, 0.2); color: #F57F17;">
                                ⏳ Late (In: ${myGate.checkIn})
                            </div>`;
                        } else {
                            gateStatusHtml = `<div class="gate-status" style="background-color: rgba(76, 175, 80, 0.2); color: var(--color-present, #4CAF50);">
                                 Present (In: ${myGate.checkIn})
                            </div>`;
                        }
                    } else {
                        gateStatusHtml = `<div class="gate-status" style="background-color: rgba(244, 67, 54, 0.2); color: var(--color-absent, #F44336);">
                             Absent
                        </div>`;
                    }
                }
            }

            profileCard.innerHTML = `
                <div class="profile-avatar">${initial}</div>
                <div class="profile-info" style="display:flex; flex-direction:column; gap:0.5rem; width:100%;">
                    <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                        <h2 style="margin:0;">${this.user.name}</h2>
                        <div id="overall-percentage" class="badge" style="font-size:1.1rem; padding:0.5rem 1rem;">...</div>
                    </div>
                    <div class="profile-details">
                        <div><strong>Reg No:</strong> ${this.user.regNo || 'N/A'}</div>
                        <div><strong>Department:</strong> ${this.user.department || 'N/A'}</div>
                        <div><strong>Year:</strong> ${this.user.year || 'N/A'}</div>
                        <div><strong>Section:</strong> ${this.user.section || 'N/A'}</div>
                        <div><strong>Email:</strong> ${this.user.email || 'N/A'}</div>
                        <div><strong>Phone:</strong> ${this.user.phone || 'N/A'}</div>
                    </div>
                    ${gateStatusHtml}
                </div>
            `;
        },

        renderSchedule: function() {
            const timelineEl = document.getElementById('scheduleTimeline');
            if (!timelineEl || !window.Timetable) return;

            const schedule = window.Timetable.getTodayTimetable(
                this.user.department, 
                this.user.year, 
                this.user.section, 
                this.todayStr
            );
            const periods = window.Timetable.PERIODS || [];
            const breaks = window.Timetable.BREAKS || [];
            const currentPeriod = window.Timetable.getCurrentPeriod ? window.Timetable.getCurrentPeriod() : null;

            let mockAtt = {};
            if (window.MockData && window.MockData.generatePeriodAttendance) {
                const groupKey = `${this.user.department}_${this.user.year}_${this.user.section}`;
                mockAtt = window.MockData.generatePeriodAttendance(this.todayStr, groupKey)[this.user.studentId] || {};
            }

            const allSlots = [];
            
            periods.forEach(p => {
                allSlots.push({ type: 'period', data: p, sched: schedule.find(s => s.period === p.num) });
            });
            breaks.forEach(b => {
                allSlots.push({ type: 'break', data: b });
            });
            
            // Sort chronologically
            allSlots.sort((a, b) => {
                const timeA = a.data.start.padStart(5, '0');
                const timeB = b.data.start.padStart(5, '0');
                return timeA.localeCompare(timeB);
            });

            let html = '';

            allSlots.forEach(slot => {
                if (slot.type === 'break') {
                    html += `
                        <div class="timeline-item break">
                            <div class="timeline-time">${slot.data.start} - ${slot.data.end}</div>
                            <div class="timeline-content">${slot.data.label}</div>
                        </div>
                    `;
                } else {
                    const p = slot.data;
                    const sched = slot.sched;
                    
                    if (!sched) return;

                    let statusClass = 'upcoming';
                    let statusIcon = '⏳';
                    let statusText = 'Upcoming';

                    // 1. Check localStorage first
                    const groupKey = `${this.user.department}_${this.user.year}_${this.user.section}`;
                    const storageKey = `scad_period_att_${this.todayStr}_${groupKey}_${p.num}`;
                    const savedAtt = localStorage.getItem(storageKey);
                    
                    let isPresent = null;
                    if (savedAtt) {
                        const parsed = JSON.parse(savedAtt);
                        if (parsed[this.user.studentId] !== undefined) {
                            isPresent = parsed[this.user.studentId] === 'present';
                        }
                    } 
                    
                    // 2. Fall back to mock data
                    if (isPresent === null && mockAtt[p.num] !== undefined) {
                        isPresent = mockAtt[p.num] === 'present';
                    }

                    if (isPresent === true) {
                        statusClass = 'present';
                        statusIcon = '';
                        statusText = 'Present';
                    } else if (isPresent === false) {
                        statusClass = 'absent';
                        statusIcon = '';
                        statusText = 'Absent';
                    }

                    let isCurrent = false;
                    if (currentPeriod && currentPeriod.num === p.num) {
                        statusClass = 'current';
                        isCurrent = true;
                        // If it's the current period and attendance isn't marked, keep as upcoming but highlighted
                        if (isPresent === null) {
                            statusIcon = '';
                            statusText = 'In Progress';
                        }
                    }

                    html += `
                        <div class="timeline-item ${statusClass}">
                            <div class="timeline-time">${p.start} - ${p.end}</div>
                            <div class="timeline-content">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                                    <div>
                                        <strong style="font-size: 1.1rem; display: block;">${sched.subjectName}</strong>
                                        <span style="font-size: 0.8rem; color: var(--color-text-light);">${sched.subjectCode}</span>
                                    </div>
                                    <span title="${statusText}" style="font-size: 1.25rem;">${statusIcon}</span>
                                </div>
                                <div style="color: var(--color-text-light); font-size: 0.875rem; display: flex; align-items: center; gap: 0.5rem;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                    ${sched.facultyName} 
                                    <span style="background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; margin-left: auto;">
                                        ${sched.type === 'lab' ? 'Lab' : 'Lecture'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    `;
                }
            });

            timelineEl.innerHTML = html;
        },

        renderSubjectStats: function() {
            const subjectGrid = document.getElementById('subjectGrid');
            if (!subjectGrid || !window.Timetable) return;

            const schedule = window.Timetable.getTodayTimetable(
                this.user.department, 
                this.user.year, 
                this.user.section, 
                this.todayStr
            );
            
            const subjects = {};
            schedule.forEach(s => {
                if (s.subjectCode && s.subjectName) {
                    subjects[s.subjectCode] = s.subjectName;
                }
            });

            // Mock subjects if schedule is empty
            if (Object.keys(subjects).length === 0) {
                subjects['CS101'] = 'Data Structures';
                subjects['CS102'] = 'Algorithms';
                subjects['CS103'] = 'Operating Systems';
                subjects['CS104'] = 'Database Systems';
            }

            const seededRandom = function(seed) {
                let x = Math.sin(seed++) * 10000;
                return x - Math.floor(x);
            };

            const baseSeed = parseInt((this.user.studentId || '1234').toString().replace(/\D/g, ''), 10) || 1234;

            let html = '';
            let totalAttended = 0;
            let totalClassesAll = 0;

            Object.keys(subjects).forEach((code, index) => {
                const name = subjects[code];
                const totalClasses = 30; // 30 classes for simulation
                
                // Deterministic random based on student and subject
                const seed = baseSeed + index + code.charCodeAt(0);
                const rand = seededRandom(seed);
                
                // Attendance between 50% and 100%
                const attendRatio = 0.5 + (rand * 0.5); 
                const attendedClasses = Math.round(totalClasses * attendRatio);
                const percentage = Math.round((attendedClasses / totalClasses) * 100);
                
                totalAttended += attendedClasses;
                totalClassesAll += totalClasses;

                let color = 'var(--color-absent, #F44336)'; // red
                if (percentage >= 75) color = 'var(--color-present, #4CAF50)'; // green
                else if (percentage >= 60) color = '#FF9800'; // orange

                html += `
                    <div class="subject-card">
                        <div class="subject-header">
                            <span class="subject-name" title="${name}">${name}</span>
                            <span class="subject-percentage" style="color: ${color}">${percentage}%</span>
                        </div>
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill" style="width: ${percentage}%; background-color: ${color};"></div>
                        </div>
                        <div class="subject-details">
                            <span>Attended: <strong>${attendedClasses}</strong></span>
                            <span>Total: <strong>${totalClasses}</strong></span>
                        </div>
                    </div>
                `;
            });

            subjectGrid.innerHTML = html;
            
            // Update Overall Percentage Badge
            const overallBadge = document.getElementById('overall-percentage');
            if(overallBadge && totalClassesAll > 0) {
                const overallPct = Math.round((totalAttended / totalClassesAll) * 100);
                overallBadge.textContent = overallPct + '% Overall';
                if(overallPct >= 75) {
                    overallBadge.className = 'badge badge--success';
                    overallBadge.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
                    overallBadge.style.color = 'var(--color-present, #4CAF50)';
                } else if(overallPct >= 60) {
                    overallBadge.className = 'badge badge--warning';
                    overallBadge.style.backgroundColor = 'rgba(255, 152, 0, 0.1)';
                    overallBadge.style.color = '#FF9800';
                } else {
                    overallBadge.className = 'badge badge--danger';
                    overallBadge.style.backgroundColor = 'rgba(244, 67, 54, 0.1)';
                    overallBadge.style.color = 'var(--color-absent, #F44336)';
                }
            }
        },

        renderCalendar: function() {
            const container = document.getElementById('calendar-container');
            const title = document.getElementById('calendar-month-title');
            if (!container) return;
            
            container.innerHTML = '';
            const currDateObj = new Date(this.todayStr);
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
            
            const baseSeed = parseInt((this.user.studentId || '1234').toString().replace(/\D/g, ''), 10) || 1234;
            
            // Days
            for (let d = 1; d <= daysInMonth; d++) {
                const cell = document.createElement('div');
                cell.className = 'calendar-cell';
                const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                
                if (dateStr === this.todayStr) {
                    cell.classList.add('today');
                }
                
                cell.innerHTML = `<span>${d}</span>`;
                
                // Deterministic random attendance for the calendar
                const dateObj = new Date(year, month, d);
                // Skip weekends
                if (dateObj.getDay() !== 0 && dateObj.getDay() !== 6 && dateStr <= this.todayStr) {
                    const seed = baseSeed + d * 13;
                    const x = Math.sin(seed) * 10000;
                    const rand = x - Math.floor(x);
                    
                    const isPresent = rand < 0.85;
                    const status = isPresent ? 'present' : 'absent';
                    
                    cell.classList.add(status);
                    cell.title = status.toUpperCase();
                }
                
                container.appendChild(cell);
            }
        },

        renderHistoryTable: function() {
            const tbody = document.getElementById('historyTableBody');
            if (!tbody || !window.Timetable) return;

            const periods = window.Timetable.PERIODS || [];
            let html = '';
            
            // Generate last 5 days
            const baseSeed = parseInt((this.user.studentId || '1234').toString().replace(/\D/g, ''), 10) || 1234;
            
            for (let i = 0; i < 5; i++) {
                const date = new Date(this.todayStr);
                date.setDate(date.getDate() - i);
                // Skip weekends
                if (date.getDay() === 0 || date.getDay() === 6) continue;
                
                const dateStr = this._dateToStr(date);
                const dateFmt = date.toLocaleDateString();
                
                // Get timetable for that day
                const schedule = window.Timetable.getTodayTimetable(this.user.department, this.user.year, this.user.section, dateStr);
                
                // Generate attendance
                let mockAtt = {};
                if (window.MockData && window.MockData.generatePeriodAttendance) {
                    const groupKey = `${this.user.department}_${this.user.year}_${this.user.section}`;
                    mockAtt = window.MockData.generatePeriodAttendance(dateStr, groupKey)[this.user.studentId] || {};
                }

                periods.forEach(p => {
                    const s = schedule.find(sch => sch.period === p.num);
                    if(!s) return;
                    
                    const statusVal = mockAtt[p.num] || 'present';
                    const isPresent = statusVal === 'present';
                    const badgeClass = isPresent ? 'present' : 'absent';
                    const statusText = isPresent ? 'Present' : 'Absent';
                    
                    html += `<tr>
                        <td>${dateFmt}</td>
                        <td>${p.num}</td>
                        <td><small>${p.start} - ${p.end}</small></td>
                        <td><strong>${s.subjectName}</strong><br><small>${s.subjectCode}</small></td>
                        <td><span class="badge ${badgeClass}">${statusText}</span></td>
                    </tr>`;
                });
            }

            tbody.innerHTML = html;
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.StudentDashboard.init());
    } else {
        window.StudentDashboard.init();
    }
})();
