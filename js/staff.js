(function () {
    'use strict';

    window.StaffManager = {
        currentSort: 'name_asc',
        lastFiltered: [],
        
        getStaffList: function() {
            return this.staffList || [];
        },

        currentStaffModalFacultyId: null,
        currentStaffMentees: [],
        staffMenteeFilters: { search: '', year: 'ALL', status: 'ALL', sort: 'cgpa_desc' },

        openMenteesModal: function(staffId) {
            this.currentStaffModalFacultyId = staffId;
            const staffList = this.getStaffList();
            let staff = staffList.find(s => String(s.id) === String(staffId) || String(s.username) === String(staffId));
            if (!staff) {
                const facList = (window.Timetable && window.Timetable.FACULTY) || [];
                const fac = facList.find(f => f.id === staffId || f.id.replace('faculty_', '') === staffId || f.username === staffId);
                if (fac) {
                    staff = {
                        id: fac.id,
                        name: fac.name,
                        department: fac.dept,
                        designation: fac.designation,
                        role: 'faculty',
                        username: fac.username
                    };
                }
            }
            if (!staff) return;

            const modal = document.getElementById('menteesModal');
            const title = document.getElementById('menteesModalTitle');
            const subtitle = document.getElementById('menteesModalSubtitle');

            if (title) title.textContent = `${staff.name} — Mentee Portfolio`;
            if (subtitle) subtitle.textContent = `${staff.designation || 'Faculty'} • Department of ${staff.department || staff.dept || 'CSE'} • Staff ID: ${staff.id || staff.username}`;

            // Load mentees for this staff member
            let mentees = (window.MockData && window.MockData.getMenteesForFaculty) ? window.MockData.getMenteesForFaculty(staff.id) : [];

            this.currentStaffMentees = mentees.map((m, idx) => {
                const attPct = m.attendancePct !== undefined ? m.attendancePct : Math.round(74 + ((m.id || idx) % 24));
                const cgpaVal = parseFloat(m.cgpa || (6.8 + ((m.id || idx) % 25) * 0.1).toFixed(2));
                const arrearsVal = m.arrears !== undefined ? m.arrears : ((m.id || idx) % 6 === 0 ? 1 : 0);
                const pPhone = m.parentPhone || `+91 94432 ${String(10000 + (m.id || idx) * 11).substring(0, 5)}`;
                const notes = m.mentorNotes || 'Regular academic mentoring in progress.';
                const priority = m.counselingPriority || ((arrearsVal > 0 || cgpaVal < 7.0 || attPct < 75) ? 'Academic Risk' : 'Normal Track');
                return {
                    ...m,
                    attendancePct: attPct,
                    cgpa: cgpaVal,
                    arrears: arrearsVal,
                    parentPhone: pPhone,
                    mentorNotes: notes,
                    counselingPriority: priority
                };
            });

            // Update Metric Chips
            const total = this.currentStaffMentees.length;
            const defCount = this.currentStaffMentees.filter(m => m.attendancePct < 75).length;
            const avgCgpa = total > 0 ? (this.currentStaffMentees.reduce((acc, m) => acc + m.cgpa, 0) / total).toFixed(2) : '0.00';
            const totArrears = this.currentStaffMentees.reduce((acc, m) => acc + m.arrears, 0);

            const elTotal = document.getElementById('menteesModalStatTotal');
            const elDef = document.getElementById('menteesModalStatDefaulters');
            const elCgpa = document.getElementById('menteesModalStatCgpa');
            const elArr = document.getElementById('menteesModalStatArrears');

            if (elTotal) elTotal.textContent = total;
            if (elDef) elDef.textContent = defCount;
            if (elCgpa) elCgpa.textContent = avgCgpa;
            if (elArr) elArr.textContent = totArrears;

            // Reset filters
            this.staffMenteeFilters = { search: '', year: 'ALL', status: 'ALL', sort: 'cgpa_desc' };
            const sIn = document.getElementById('menteesModalSearch');
            const yEl = document.getElementById('menteesModalYear');
            const stEl = document.getElementById('menteesModalStatus');
            const soEl = document.getElementById('menteesModalSort');
            if (sIn) sIn.value = '';
            if (yEl) yEl.value = 'ALL';
            if (stEl) stEl.value = 'ALL';
            if (soEl) soEl.value = 'cgpa_desc';

            this.renderStaffMenteesTable();

            if (modal) modal.style.display = 'block';
        },

        closeMenteesModal: function() {
            const modal = document.getElementById('menteesModal');
            if (modal) modal.style.display = 'none';
        },

        onStaffMenteeSearch: function(val) {
            this.staffMenteeFilters.search = (val || '').trim().toLowerCase();
            this.renderStaffMenteesTable();
        },

        onStaffMenteeFilterChange: function() {
            const yEl = document.getElementById('menteesModalYear');
            const stEl = document.getElementById('menteesModalStatus');
            if (yEl) this.staffMenteeFilters.year = yEl.value;
            if (stEl) this.staffMenteeFilters.status = stEl.value;
            this.renderStaffMenteesTable();
        },

        onStaffMenteeSortChange: function(val) {
            this.staffMenteeFilters.sort = val || 'cgpa_desc';
            this.renderStaffMenteesTable();
        },

        renderStaffMenteesTable: function() {
            const tbody = document.getElementById('menteesModalTableBody');
            if (!tbody) return;

            let list = [...this.currentStaffMentees];

            // Filter search
            if (this.staffMenteeFilters.search) {
                const q = this.staffMenteeFilters.search;
                list = list.filter(m => (m.name && m.name.toLowerCase().includes(q)) || (m.regNo && m.regNo.toLowerCase().includes(q)));
            }

            // Filter year
            if (this.staffMenteeFilters.year !== 'ALL') {
                list = list.filter(m => String(m.year) === String(this.staffMenteeFilters.year));
            }

            // Filter status
            if (this.staffMenteeFilters.status === 'DEFAULTER') {
                list = list.filter(m => m.attendancePct < 75);
            } else if (this.staffMenteeFilters.status === 'GOOD') {
                list = list.filter(m => m.attendancePct >= 80);
            } else if (this.staffMenteeFilters.status === 'HAS_ARREARS') {
                list = list.filter(m => m.arrears > 0);
            }

            // Sort
            list.sort((a, b) => {
                switch (this.staffMenteeFilters.sort) {
                    case 'cgpa_desc': return b.cgpa - a.cgpa;
                    case 'cgpa_asc': return a.cgpa - b.cgpa;
                    case 'att_desc': return b.attendancePct - a.attendancePct;
                    case 'att_asc': return a.attendancePct - b.attendancePct;
                    case 'arrears_desc': return b.arrears - a.arrears;
                    case 'name_asc': return (a.name || '').localeCompare(b.name || '');
                    default: return b.cgpa - a.cgpa;
                }
            });

            if (list.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:1.5rem; color:var(--color-text-muted);">No student records match the selected filters.</td></tr>';
                return;
            }

            tbody.innerHTML = list.map(m => {
                const attPct = m.attendancePct;
                const pctColor = attPct < 75 ? '#C62828' : (attPct < 80 ? '#F57C00' : '#2E7D32');
                const badgeClass = m.counselingPriority === 'High Priority Mentoring' ? 'badge badge--absent' : (m.counselingPriority === 'Academic Risk' || m.counselingPriority === 'Attendance Risk' ? 'badge badge--late' : 'badge badge--present');

                return `<tr>
                    <td><strong>${m.regNo}</strong></td>
                    <td>
                        <a href="#" class="profile-btn" data-student-id="${m.id}" style="color:var(--color-primary); font-weight:600; text-decoration:none;" title="Click to view student profile and mentor history">${m.name}</a>
                    </td>
                    <td>Year ${m.year} (${m.section})</td>
                    <td><span style="font-weight:700; color:${pctColor};">${attPct}%</span></td>
                    <td><strong>${m.cgpa.toFixed(2)}</strong></td>
                    <td><span style="color:${m.arrears > 0 ? '#C62828' : '#2E7D32'}; font-weight:600;">${m.arrears}</span></td>
                    <td><a href="tel:${(m.parentPhone || '').replace(/\s+/g, '')}">${m.parentPhone || '—'}</a></td>
                    <td><span class="${badgeClass}" style="font-size:0.75rem;">${m.counselingPriority}</span></td>
                    <td>
                        <button type="button" class="btn btn--sm btn--outline profile-btn" data-student-id="${m.id}" style="font-size:0.75rem; padding:3px 8px;">View Profile</button>
                    </td>
                </tr>`;
            }).join('');
        },

        exportStaffMenteesCSV: function() {
            if (!this.currentStaffMentees || this.currentStaffMentees.length === 0) {
                this.showToast('No mentee records available to export.');
                return;
            }
            let csv = 'Reg No,Student Name,Department,Year,Section,Attendance %,CGPA,Arrears,Parent Phone,Mentoring Priority,Mentoring Notes\n';
            this.currentStaffMentees.forEach(m => {
                csv += `"${m.regNo}","${m.name}","${m.department || ''}","${m.year}","${m.section}","${m.attendancePct}%","${m.cgpa}","${m.arrears}","${m.parentPhone}","${m.counselingPriority}","${(m.mentorNotes || '').replace(/"/g, '""')}"\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', `mentees_${this.currentStaffModalFacultyId || 'staff'}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            this.showToast('Mentee portfolio exported to CSV.');
        },

        init: function () {
            this.user = window.Auth ? window.Auth.getCurrentUser() : null;
            if (!this.user || (this.user.role !== 'admin' && this.user.role !== 'hod')) {
                window.location.href = 'index.html';
                return;
            }

            if (window.Theme) window.Theme.init();
            
            this.loadStaff();
            this.renderTable();
            
            // Search & Filter
            const searchEl = document.getElementById('searchInput');
            if (searchEl) searchEl.addEventListener('input', () => this.renderTable());
            
            const deptFilter = document.getElementById('filterDept');
            if (deptFilter) {
                deptFilter.addEventListener('change', () => this.renderTable());
                
                // Limit department filter for HOD
                if (this.user.role === 'hod') {
                    if (this.user.department !== 'ALL_I') {
                        deptFilter.value = this.user.department;
                        deptFilter.disabled = true; // Lock it
                    }
                }
            }
            
            const roleFilter = document.getElementById('filterRole');
            if (roleFilter) roleFilter.addEventListener('change', () => this.renderTable());

            const sortSelect = document.getElementById('sortStaff');
            if (sortSelect) sortSelect.addEventListener('change', (e) => {
                this.currentSort = e.target.value;
                this.renderTable();
            });

            const exportBtn = document.getElementById('exportStaffBtn');
            if (exportBtn) exportBtn.addEventListener('click', () => this.exportCSV());

            // Modal setup
            const addBtn = document.getElementById('addStaffBtn');
            if (addBtn) addBtn.addEventListener('click', () => this.openModal());
            
            const cancelBtn = document.getElementById('cancelBtn');
            if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeModal());
            
            const closeXBtn = document.getElementById('closeModalBtn');
            if (closeXBtn) closeXBtn.addEventListener('click', () => this.closeModal());
            
            const modal = document.getElementById('staffModal');
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) this.closeModal();
                });
            }
            
            const form = document.getElementById('staffForm');
            if (form) form.addEventListener('submit', (e) => this.saveStaff(e));
        },

        loadStaff: function() {
            const adminUsers = window.Auth ? window.Auth.getAdminUsers() : [];
            const facultyUsers = (window.Timetable && window.Timetable.getFacultyList) ? window.Timetable.getFacultyList() : [];
            
            this.staffList = [];
            
            // Admin Users (only HODs and Admins for the list)
            adminUsers.forEach(u => {
                if (u.role === 'hod' || u.role === 'admin') {
                    this.staffList.push({
                        ...u,
                        id: u.username,
                        source: 'admin'
                    });
                }
            });
            
            // Faculty Users
            facultyUsers.forEach(f => {
                this.staffList.push({
                    username: f.username,
                    password: f.password,
                    role: 'faculty',
                    name: f.name,
                    designation: f.designation,
                    department: f.dept,
                    id: f.id || f.username,
                    source: 'faculty'
                });
            });
        },

        renderTable: function() {
            const tbody = document.getElementById('staff-body');
            if (!tbody) return;

            const searchEl = document.getElementById('searchInput');
            const search = searchEl ? searchEl.value.toLowerCase().trim() : '';
            
            const deptEl = document.getElementById('filterDept');
            const dept = deptEl ? deptEl.value : '';
            
            const roleEl = document.getElementById('filterRole');
            const roleFilter = roleEl ? roleEl.value : '';
            
            let filtered = (this.staffList || []).filter(s => {
                // Role-based filtering
                if (this.user.role === 'hod') {
                    if (s.role !== 'faculty') return false;
                    
                    if (this.user.department === 'ALL_I') {
                        if (!['ALL_I', 'MATH', 'PHY', 'ENG'].includes(s.department)) return false;
                    } else {
                        if (s.department !== this.user.department) return false;
                    }
                }

                // UI filtering
                const matchSearch = !search || (s.name && s.name.toLowerCase().includes(search)) || (s.username && s.username.toLowerCase().includes(search));
                const matchDept = dept === '' || s.department === dept;
                const matchRole = roleFilter === '' || s.role === roleFilter;
                
                // Hide 'admin' role from list unless explicitly filtered
                if (s.role === 'admin') return false;

                return matchSearch && matchDept && matchRole;
            });

            this.lastFiltered = filtered;

            // Sort
            filtered.sort((a, b) => {
                switch (this.currentSort) {
                    case 'name_asc': return (a.name || '').localeCompare(b.name || '');
                    case 'name_desc': return (b.name || '').localeCompare(a.name || '');
                    case 'user_asc': return (a.username || '').localeCompare(b.username || '');
                    case 'dept_asc': return (a.department || '').localeCompare(b.department || '');
                    case 'role_asc': return (a.role || '').localeCompare(b.role || '');
                    default: return (a.name || '').localeCompare(b.name || '');
                }
            });

            this.updateSortIcons();

            if (filtered.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--color-text-muted);">No staff found matching filters.</td></tr>';
                return;
            }

            let html = '';
            filtered.forEach(s => {
                const roleColor = s.role === 'hod' ? '#1565C0' : '#2E7D32';
                html += `<tr>
                    <td><strong>${s.username || ''}</strong></td>
                    <td><a href="#" onclick="event.preventDefault(); window.StaffManager.openMenteesModal('${s.id}')" style="color:var(--color-primary); font-weight:600; text-decoration:none;" title="Click to view staff details and assigned mentees" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${s.name || ''}</a></td>
                    <td>${s.department || ''}</td>
                    <td>${s.designation || ''}</td>
                    <td style="color:${roleColor}; text-transform:uppercase; font-size:0.85em; font-weight:bold;">${s.role || ''}</td>
                    <td>
                        <button type="button" class="btn btn--sm btn--outline" onclick="window.StaffManager.openMenteesModal('${s.id}')" title="View mentees portfolio">Mentees</button>
                        <button type="button" class="btn btn--sm btn--outline" style="margin-left:4px" onclick="window.StaffManager.openModal('${s.id}')">Edit</button>
                        <button type="button" class="btn btn--sm btn--outline" style="margin-left:4px" onclick="window.StaffManager.resetPassword('${s.id}')">Reset Pass</button>
                        <button type="button" class="btn btn--sm btn--danger" style="margin-left:4px" onclick="window.StaffManager.deleteStaff('${s.id}')">Del</button>
                    </td>
                </tr>`;
            });
            
            tbody.innerHTML = html;
        },

        toggleSort: function(field) {
            if (field === 'user') {
                this.currentSort = this.currentSort === 'user_asc' ? 'user_desc' : 'user_asc';
            } else if (field === 'name') {
                this.currentSort = this.currentSort === 'name_asc' ? 'name_desc' : 'name_asc';
            } else if (field === 'dept') {
                this.currentSort = this.currentSort === 'dept_asc' ? 'dept_desc' : 'dept_asc';
            } else if (field === 'role') {
                this.currentSort = this.currentSort === 'role_asc' ? 'role_desc' : 'role_asc';
            }
            const sel = document.getElementById('sortStaff');
            if (sel) sel.value = this.currentSort;
            this.renderTable();
        },

        updateSortIcons: function() {
            const s = this.currentSort;
            const setI = (id, asc, desc) => {
                const el = document.getElementById(id);
                if (!el) return;
                el.textContent = s === asc ? '▲' : s === desc ? '▼' : '↕';
            };
            setI('stsort-user', 'user_asc', 'user_desc');
            setI('stsort-name', 'name_asc', 'name_desc');
            setI('stsort-dept', 'dept_asc', 'dept_desc');
            setI('stsort-role', 'role_asc', 'role_desc');
        },

        exportCSV: function() {
            const list = this.lastFiltered || this.staffList || [];
            if (list.length === 0) {
                alert('No staff records to export.');
                return;
            }
            let csv = 'Username,Name,Department,Designation,Role\n';
            list.forEach(s => {
                csv += `"${s.username || ''}","${(s.name || '').replace(/"/g, '""')}","${s.department || ''}","${s.designation || ''}","${s.role || ''}"\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `staff_list_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },

        openModal: function(id = null) {
            const modal = document.getElementById('staffModal');
            const title = document.getElementById('modalTitle');
            const form = document.getElementById('staffForm');
            
            if (form) form.reset();
            
            const setVal = (elId, val) => {
                const el = document.getElementById(elId);
                if (el) el.value = (val !== undefined && val !== null) ? val : '';
            };

            if (id !== null && id !== undefined && id !== '') {
                const s = (this.staffList || []).find(st => String(st.id) === String(id) || st.username === String(id));
                if (s) {
                    if (title) title.textContent = 'Edit Staff';
                    setVal('staffId', s.id);
                    setVal('staffName', s.name);
                    setVal('staffUsername', s.username);
                    const userEl = document.getElementById('staffUsername');
                    if (userEl) userEl.readOnly = true;
                    setVal('staffDept', s.department);
                    setVal('staffRole', s.role);
                    setVal('staffDesignation', s.designation);
                }
            } else {
                if (title) title.textContent = 'Add Staff';
                setVal('staffId', '');
                const userEl = document.getElementById('staffUsername');
                if (userEl) userEl.readOnly = false;
                
                // Pre-fill department for HODs
                if (this.user && this.user.role === 'hod' && this.user.department !== 'ALL_I') {
                    setVal('staffDept', this.user.department);
                    setVal('staffRole', 'faculty');
                    const roleEl = document.getElementById('staffRole');
                    if (roleEl) roleEl.disabled = true;
                } else {
                    const roleEl = document.getElementById('staffRole');
                    if (roleEl) roleEl.disabled = false;
                }
            }
            
            if (modal) modal.style.display = 'flex';
        },

        closeModal: function() {
            const modal = document.getElementById('staffModal');
            if (modal) modal.style.display = 'none';
        },

        saveStaff: function(e) {
            if (e && e.preventDefault) e.preventDefault();
            
            const getVal = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
            const idVal = getVal('staffId');
            const isNew = !idVal;
            
            const name = getVal('staffName');
            const username = getVal('staffUsername');
            const department = getVal('staffDept');
            const roleEl = document.getElementById('staffRole');
            const role = (roleEl ? roleEl.value : '') || 'faculty';
            const designation = getVal('staffDesignation');
            
            if (!username || !name) {
                this.showToast('Please enter Username and Full Name');
                return;
            }
            
            // HOD restrictions
            if (this.user && this.user.role === 'hod' && role !== 'faculty') {
                this.showToast('HODs can only add Faculty');
                return;
            }

            if (isNew) {
                const password = username;
                
                if (role === 'hod') {
                    const admins = window.Auth ? window.Auth.getAdminUsers() : [];
                    admins.push({ username, password, role, name, designation, department, mustChangePassword: true });
                    if (window.Auth) window.Auth.saveAdminUsers(admins);
                } else {
                    const faculties = (window.Timetable && window.Timetable.getFacultyList) ? window.Timetable.getFacultyList() : [];
                    faculties.push({ id: username, name, designation, dept: department, username, password, mustChangePassword: true });
                    if (window.Timetable && window.Timetable.saveFacultyList) {
                        window.Timetable.saveFacultyList(faculties);
                    }
                    
                    // Also add to AdminUsers for login compatibility
                    const admins = window.Auth ? window.Auth.getAdminUsers() : [];
                    if (!admins.some(a => a.username === username)) {
                        admins.push({ username, password, role: 'faculty', name, designation, department, facultyId: username, mustChangePassword: true });
                        if (window.Auth) window.Auth.saveAdminUsers(admins);
                    }
                }
            } else {
                const existing = (this.staffList || []).find(s => String(s.id) === String(idVal) || s.username === idVal);
                if (existing) {
                    if (existing.source === 'admin' || existing.role === 'hod') {
                        const admins = window.Auth ? window.Auth.getAdminUsers() : [];
                        const idx = admins.findIndex(a => a.username === idVal || a.username === existing.username);
                        if (idx > -1) {
                            admins[idx].name = name;
                            admins[idx].department = department;
                            admins[idx].designation = designation;
                            admins[idx].role = role;
                            if (window.Auth) window.Auth.saveAdminUsers(admins);
                        }
                    }
                    if (existing.source === 'faculty' || existing.role === 'faculty') {
                        const faculties = (window.Timetable && window.Timetable.getFacultyList) ? window.Timetable.getFacultyList() : [];
                        const idx = faculties.findIndex(f => String(f.id) === String(idVal) || f.username === idVal || f.username === existing.username);
                        if (idx > -1) {
                            faculties[idx].name = name;
                            faculties[idx].dept = department;
                            faculties[idx].designation = designation;
                            if (window.Timetable && window.Timetable.saveFacultyList) {
                                window.Timetable.saveFacultyList(faculties);
                            }
                        }
                        
                        // Update in AdminUsers as well if present
                        const admins = window.Auth ? window.Auth.getAdminUsers() : [];
                        const aIdx = admins.findIndex(a => a.username === idVal || a.username === existing.username);
                        if (aIdx > -1) {
                            admins[aIdx].name = name;
                            admins[aIdx].department = department;
                            admins[aIdx].designation = designation;
                            if (window.Auth) window.Auth.saveAdminUsers(admins);
                        }
                    }
                }
            }
            
            this.loadStaff();
            this.renderTable();
            this.closeModal();
            this.showToast('Staff saved successfully');
        },

        resetPassword: function(id) {
            var self = this;
            if (window.Auth && window.Auth.verifyCurrentUser) {
                window.Auth.verifyCurrentUser("reset this staff member's password").then(function(verified) {
                    if (!verified) return;
                    const existing = (self.staffList || []).find(s => String(s.id) === String(id) || s.username === String(id));
                    if (!existing) return;
                    
                    if (existing.source === 'admin' || existing.role === 'hod') {
                        const admins = window.Auth.getAdminUsers();
                        const idx = admins.findIndex(a => a.username === existing.username);
                        if (idx > -1) {
                            admins[idx].password = admins[idx].username;
                            admins[idx].mustChangePassword = true;
                            window.Auth.saveAdminUsers(admins);
                        }
                    }
                    if (existing.source === 'faculty' || existing.role === 'faculty') {
                        const faculties = window.Timetable.getFacultyList();
                        const idx = faculties.findIndex(f => f.username === existing.username || f.id === existing.id);
                        if (idx > -1) {
                            faculties[idx].password = faculties[idx].username;
                            faculties[idx].mustChangePassword = true;
                            window.Timetable.saveFacultyList(faculties);
                        }
                        const admins = window.Auth.getAdminUsers();
                        const aIdx = admins.findIndex(a => a.username === existing.username);
                        if (aIdx > -1) {
                            admins[aIdx].password = admins[aIdx].username;
                            admins[aIdx].mustChangePassword = true;
                            window.Auth.saveAdminUsers(admins);
                        }
                    }
                    
                    self.loadStaff();
                    self.showToast('Password reset successfully. Temp Password: ' + existing.username);
                });
            }
        },

        deleteStaff: function(id) {
            var self = this;
            if (window.Auth && window.Auth.verifyCurrentUser) {
                window.Auth.verifyCurrentUser('remove this staff member').then(function(verified) {
                    if (!verified) return;
                    if (!confirm('Are you sure you want to remove this staff member? This cannot be undone.')) return;
                    const existing = (self.staffList || []).find(s => String(s.id) === String(id) || s.username === String(id));
                    if (!existing) return;
                    
                    if (existing.source === 'admin' || existing.role === 'hod') {
                        let admins = window.Auth.getAdminUsers();
                        admins = admins.filter(a => a.username !== existing.username);
                        window.Auth.saveAdminUsers(admins);
                    }
                    if (existing.source === 'faculty' || existing.role === 'faculty') {
                        let faculties = window.Timetable.getFacultyList();
                        faculties = faculties.filter(f => f.username !== existing.username && f.id !== existing.id);
                        window.Timetable.saveFacultyList(faculties);
                        
                        let admins = window.Auth.getAdminUsers();
                        admins = admins.filter(a => a.username !== existing.username);
                        window.Auth.saveAdminUsers(admins);
                    }
                    
                    self.loadStaff();
                    self.renderTable();
                    self.showToast('Staff removed');
                });
            }
        },

        showToast: function(msg) {
            const toast = document.getElementById('toast');
            if (!toast) return;
            toast.textContent = msg;
            toast.style.display = 'block';
            setTimeout(() => { toast.style.display = 'none'; }, 4000);
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        window.StaffManager.init();
    });

})();
