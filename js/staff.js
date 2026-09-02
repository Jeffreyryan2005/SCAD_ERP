(function () {
    'use strict';

    window.StaffManager = {
        
        openMenteesModal: function(staffId) {
            const staffList = this.getStaffList();
            const staff = staffList.find(s => String(s.id) === String(staffId));
            if (!staff) return;

            const modal = document.getElementById('menteesModal');
            const title = document.getElementById('menteesModalTitle');
            const subtitle = document.getElementById('menteesModalSubtitle');
            const tbody = document.getElementById('menteesModalTableBody');

            if (title) title.textContent = `Assigned Mentees`;
            if (subtitle) subtitle.textContent = `Mentor: ${staff.name} (${staff.department} - ${staff.designation})`;

            const mentees = (window.MockData && window.MockData.getMenteesForFaculty) ? window.MockData.getMenteesForFaculty(staff.id) : [];

            if (tbody) {
                if (mentees.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--color-text-muted);">No students assigned to this mentor yet.</td></tr>';
                } else {
                    tbody.innerHTML = mentees.map(m => {
                        const attPct = Math.round(72 + (m.id % 25));
                        const pctColor = attPct < 75 ? '#C62828' : '#2E7D32';
                        return `<tr>
                            <td><strong>${m.regNo}</strong></td>
                            <td><a href="#" class="profile-btn" data-student-id="${m.id}" style="color:var(--color-primary); font-weight:600;">${m.name}</a></td>
                            <td>Year ${m.year} (${m.section})</td>
                            <td><span style="font-weight:700; color:${pctColor};">${attPct}%</span></td>
                            <td><strong>${m.cgpa || '7.50'}</strong></td>
                            <td><span style="color:${m.arrears > 0 ? '#C62828' : '#2E7D32'}; font-weight:600;">${m.arrears || 0}</span></td>
                            <td><a href="tel:${(m.parentPhone || '').replace(/\s+/g, '')}">${m.parentPhone || '—'}</a></td>
                        </tr>`;
                    }).join('');
                }
            }

            if (modal) modal.style.display = 'block';
        },

        closeMenteesModal: function() {
            const modal = document.getElementById('menteesModal');
            if (modal) modal.style.display = 'none';
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
            const search = searchEl ? searchEl.value.toLowerCase() : '';
            
            const deptEl = document.getElementById('filterDept');
            const dept = deptEl ? deptEl.value : '';
            
            const roleEl = document.getElementById('filterRole');
            const roleFilter = roleEl ? roleEl.value : '';
            
            const filtered = (this.staffList || []).filter(s => {
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

            let html = '';
            filtered.forEach(s => {
                const roleColor = s.role === 'hod' ? '#1565C0' : '#2E7D32';
                html += `<tr>
                    <td><strong>${s.username || ''}</strong></td>
                    <td>${s.name || ''}</td>
                    <td>${s.department || ''}</td>
                    <td>${s.designation || ''}</td>
                    <td style="color:${roleColor}; text-transform:uppercase; font-size:0.85em; font-weight:bold;">${s.role || ''}</td>
                    <td>
                        <button type="button" class="btn btn--sm btn--outline" onclick="window.StaffManager.openModal('${s.id}')">Edit</button>
                        <button type="button" class="btn btn--sm btn--outline" style="margin-left:4px" onclick="window.StaffManager.resetPassword('${s.id}')">Reset Pass</button>
                        <button type="button" class="btn btn--sm btn--danger" style="margin-left:4px" onclick="window.StaffManager.deleteStaff('${s.id}')">Del</button>
                    </td>
                </tr>`;
            });
            
            if (filtered.length === 0) {
                html = '<tr><td colspan="6" style="text-align:center">No staff found</td></tr>';
            }
            
            tbody.innerHTML = html;
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
