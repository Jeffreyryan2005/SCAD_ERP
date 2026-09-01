(function () {
    'use strict';

    const CUSTOM_TIMETABLE_KEY = 'scad_custom_timetables';

    window.AdminTimetable = {
        init: function () {
            this.user = window.Auth ? window.Auth.requireAuth('admin') : null;
            if (!this.user) return;

            if (window.Theme) window.Theme.init();
            
            const headerUserName = document.getElementById('user-display');
            if (headerUserName) headerUserName.textContent = this.user.name;

            this.customTimetables = this.loadCustomTimetables();
            
            this.setupSelectors();
            
            document.getElementById('saveBtn').addEventListener('click', () => this.saveTimetable());
            document.getElementById('resetBtn').addEventListener('click', () => this.resetTimetable());
            
            const logoutBtns = [document.getElementById('sidebar-logout-btn'), document.getElementById('logout-btn')];
            logoutBtns.forEach(btn => {
                if(btn) btn.addEventListener('click', (e) => { e.preventDefault(); window.Auth.logout(); });
            });
        },

        loadCustomTimetables: function() {
            const data = localStorage.getItem(CUSTOM_TIMETABLE_KEY);
            return data ? JSON.parse(data) : {};
        },

        setupSelectors: function() {
            const classSelect = document.getElementById('class-select');
            if(!classSelect || !window.Timetable) return;

            // Generate class list from DEPARTMENTS and YEARS
            const deptCodes = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL'];
            const years = ['I', 'II', 'III', 'IV'];
            const sections = ['A', 'B', 'C']; // Simplified for mockup
            
            deptCodes.forEach(dept => {
                years.forEach(year => {
                    sections.forEach(sec => {
                        // In reality, check if section exists, but we'll list common ones
                        if(year === 'I' || ['CSE'].includes(dept) || sec === 'A') {
                            const key = dept + '-' + year + '-' + sec;
                            const option = document.createElement('option');
                            option.value = key;
                            option.textContent = key;
                            classSelect.appendChild(option);
                        }
                    });
                });
            });

            classSelect.addEventListener('change', (e) => {
                this.currentClass = e.target.value;
                this.renderEditor();
            });
        },

        renderEditor: function() {
            const tbody = document.getElementById('editor-body');
            if(!tbody) return;

            if(!this.currentClass) {
                tbody.innerHTML = '<tr><td colspan="8">Please select a class group.</td></tr>';
                return;
            }

            // Get subjects for this class
            const parts = this.currentClass.split('-');
            const dept = parts[0];
            const year = parts[1];
            
            // For Year I, subjects are under 'ALL' dept
            const searchDept = year === 'I' ? 'ALL' : dept;
            
            const availableSubjects = window.Timetable.SUBJECTS.filter(s => s.dept === searchDept && s.year === year);
            
            // Build options HTML
            let optionsHtml = '<option value="">-- Free --</option>';
            availableSubjects.forEach(s => {
                optionsHtml += '<option value="' + s.code + '">' + s.code + ' (' + s.name + ')</option>';
            });

            // Get current timetable (custom or default)
            let timetable = this.customTimetables[this.currentClass];
            if(!timetable && window.Timetable.TIMETABLES[this.currentClass]) {
                timetable = window.Timetable.TIMETABLES[this.currentClass];
            } else if (!timetable) {
                // Empty timetable
                timetable = { MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [] };
            }

            const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
            let html = '';

            days.forEach(day => {
                html += '<tr><td><strong>' + day + '</strong></td>';
                for(let p = 0; p < 7; p++) {
                    const currentCode = (timetable[day] && timetable[day][p]) ? timetable[day][p] : '';
                    html += '<td><select class="editor-select" data-day="' + day + '" data-period="' + p + '">';
                    
                    // Inject options and select current
                    const selectedOptions = optionsHtml.replace('value="' + currentCode + '"', 'value="' + currentCode + '" selected');
                    html += selectedOptions;
                    
                    html += '</select></td>';
                }
                html += '</tr>';
            });

            tbody.innerHTML = html;
        },

        saveTimetable: function() {
            if(!this.currentClass) return;

            const newTimetable = { MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [] };
            const selects = document.querySelectorAll('.editor-select');
            
            selects.forEach(sel => {
                const day = sel.dataset.day;
                const p = parseInt(sel.dataset.period);
                if(!newTimetable[day]) newTimetable[day] = [];
                newTimetable[day][p] = sel.value;
            });

            this.customTimetables[this.currentClass] = newTimetable;
            localStorage.setItem(CUSTOM_TIMETABLE_KEY, JSON.stringify(this.customTimetables));
            
            this.showToast('Timetable saved successfully');
            
            // Update global Timetable so it reflects immediately
            if(window.Timetable) {
                window.Timetable.TIMETABLES[this.currentClass] = newTimetable;
            }
        },

        resetTimetable: function() {
            if(!this.currentClass || !confirm('Reset this timetable to factory defaults?')) return;
            
            delete this.customTimetables[this.currentClass];
            localStorage.setItem(CUSTOM_TIMETABLE_KEY, JSON.stringify(this.customTimetables));
            
            this.showToast('Reset to default');
            this.renderEditor();
        },

        showToast: function(msg) {
            const toast = document.getElementById('toast');
            if(!toast) return;
            toast.textContent = msg;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 3000);
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        window.AdminTimetable.init();
    });

})();
