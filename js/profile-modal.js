(function() {
    'use strict';

    window.ProfileModal = {
        open: function(studentId) {
            const student = window.MockData ? window.MockData.getStudentById(studentId) : null;
            if (!student) return;

            const modal = document.getElementById('profile-modal');
            if (!modal) return;

            const setEl = (id, text) => { 
                const el = document.getElementById(id); 
                if (el) el.textContent = text || 'N/A'; 
            };
            
            setEl('profile-name', student.name);
            setEl('profile-regno', student.regNo);
            setEl('profile-dept', (student.department || '') + ' - Year ' + (student.year || 'I') + ' (' + (student.section || 'A') + ')');
            
            const avatar = document.getElementById('profile-avatar');
            if (avatar) avatar.textContent = (student.name || 'U').charAt(0).toUpperCase();
            
            setEl('profile-year-val', (student.year || 'I') + ' Year (' + (student.section || 'A') + ')');
            
            const statusEl = document.getElementById('profile-status-val');
            if (statusEl) {
                const isActive = (student.status || 'active').toLowerCase() === 'active';
                statusEl.innerHTML = isActive 
                    ? '<span class="badge badge--present" style="background:rgba(46,125,50,0.12); color:#2E7D32; padding:3px 8px; border-radius:12px; font-weight:600; font-size:0.78rem;">Active</span>'
                    : '<span class="badge badge--absent" style="background:rgba(198,40,40,0.12); color:#C62828; padding:3px 8px; border-radius:12px; font-weight:600; font-size:0.78rem;">Inactive</span>';
            }
            
            setEl('profile-email-val', student.email || (student.regNo.toLowerCase() + '@scadcet.ac.in'));
            setEl('profile-phone-val', student.phone || '+91 98765 43210');
            setEl('profile-parent-name', student.parentName || 'Mr. ' + (student.name.split(' ')[0] || 'Parent'));
            setEl('profile-parent-phone', student.parentPhone || '+91 99887 76655');
            
            // Generate deterministic stats for this student
            let seed = 0;
            const str = String(student.regNo || student.id);
            for (let i = 0; i < str.length; i++) seed += str.charCodeAt(i);
            
            const total = 90;
            const seedFactor = (seed % 25); // 0 to 24
            const absent = 4 + (seedFactor % 12); // 4 to 15
            const late = 2 + (seedFactor % 6);    // 2 to 7
            const present = total - absent - late;
            const pct = Math.round((present / total) * 100);
            
            setEl('profile-stat-total', total);
            setEl('profile-stat-present', present);
            setEl('profile-stat-late', late);
            setEl('profile-stat-absent', absent);
            setEl('profile-pct-text', pct + '%');
            
            // Progress ring calculation (r=48, circ=301.59)
            const ring = document.getElementById('profile-ring');
            if (ring) {
                const radius = (ring.r && ring.r.baseVal) ? ring.r.baseVal.value : 48;
                const circumference = 2 * Math.PI * radius;
                ring.style.strokeDasharray = `${circumference} ${circumference}`;
                const offset = circumference - (pct / 100) * circumference;
                ring.style.strokeDashoffset = offset;
                if (pct >= 75) ring.style.stroke = '#2E7D32';
                else if (pct >= 65) ring.style.stroke = '#F57C00';
                else ring.style.stroke = '#C62828';
            }

            // Copy Phone Button
            const copyBtn = document.getElementById('profile-copy-phone');
            if (copyBtn) {
                copyBtn.onclick = () => {
                    const ph = student.parentPhone || '+91 99887 76655';
                    navigator.clipboard.writeText(ph).then(() => {
                        copyBtn.textContent = '✓';
                        setTimeout(() => { copyBtn.textContent = '📋'; }, 1500);
                    });
                };
            }

            // SMS Parent Button
            const parentPhoneRaw = (student.parentPhone || '9988776655').replace(/[^0-9]/g, '');
            const smsBtn = document.getElementById('profile-sms-btn');
            if (smsBtn) {
                smsBtn.onclick = () => {
                    const todayStr = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
                    const message = `Dear Parent, this is SCAD College. Attendance notification for your ward ${student.name} (${student.regNo}). Total Attendance: ${pct}%. For inquiries, please contact department.`;
                    window.location.href = `sms:${parentPhoneRaw}?body=${encodeURIComponent(message)}`;
                };
            }

            // Call Parent Button
            const callBtn = document.getElementById('profile-call-btn');
            if (callBtn) {
                callBtn.onclick = () => {
                    window.location.href = `tel:${parentPhoneRaw}`;
                };
            }

            // Render Monthly Calendar
            this.renderCalendar(seed);

            modal.style.display = 'block';
            setTimeout(() => { modal.classList.add('active'); }, 10);
        },

        renderCalendar: function(seed) {
            const container = document.getElementById('calendar-container');
            const title = document.getElementById('calendar-month-title');
            if (!container) return;
            
            container.innerHTML = '';
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            
            if (title) {
                const monthName = now.toLocaleString('default', { month: 'long' });
                title.textContent = `${monthName} ${year} Attendance Calendar`;
            }
            
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const currentDay = now.getDate();
            
            // Empty slots before 1st of month
            for (let i = 0; i < firstDay; i++) {
                const cell = document.createElement('div');
                cell.className = 'calendar-cell empty';
                container.appendChild(cell);
            }
            
            // Days of the month
            for (let d = 1; d <= daysInMonth; d++) {
                const cell = document.createElement('div');
                cell.className = 'calendar-cell';
                const dayOfWeek = new Date(year, month, d).getDay();
                const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
                
                cell.innerHTML = `<span>${d}</span>`;
                
                if (d === currentDay) {
                    cell.classList.add('today');
                }
                
                if (!isWeekend && d <= currentDay) {
                    const daySeed = (seed * 37 + d * 19) % 100;
                    if (daySeed < 78) {
                        cell.classList.add('present');
                        cell.title = `Day ${d}: Present`;
                    } else if (daySeed < 88) {
                        cell.classList.add('late');
                        cell.title = `Day ${d}: Late`;
                    } else {
                        cell.classList.add('absent');
                        cell.title = `Day ${d}: Absent`;
                    }
                } else if (isWeekend) {
                    cell.style.opacity = '0.4';
                    cell.title = 'Weekend';
                }
                
                container.appendChild(cell);
            }
        },

        close: function() {
            const modal = document.getElementById('profile-modal');
            if (modal) {
                modal.classList.remove('active');
                modal.style.display = 'none';
            }
        },
        
        init: function() {
            // Setup close buttons
            const pCloseBtn = document.getElementById('profile-close-btn');
            const pCancelBtn = document.getElementById('profile-cancel-btn');
            const pOverlay = document.getElementById('profile-overlay');

            if (pCloseBtn) pCloseBtn.addEventListener('click', this.close);
            if (pCancelBtn) pCancelBtn.addEventListener('click', this.close);
            if (pOverlay) pOverlay.addEventListener('click', this.close);
            
            // Global click delegation for profile-btn
            document.body.addEventListener('click', (e) => {
                const btn = e.target.closest('.profile-btn');
                if (btn) {
                    e.preventDefault();
                    const sid = btn.getAttribute('data-student-id');
                    if (sid) {
                        this.open(sid);
                    }
                }
            });
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        window.ProfileModal.init();
    });
})();
