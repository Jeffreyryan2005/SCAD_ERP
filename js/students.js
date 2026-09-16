(function () {
    'use strict';

    window.StudentsManager = {
        currentSort: 'name_asc',
        lastFiltered: [],

        init: function () {
            this.user = window.Auth ? window.Auth.getCurrentUser() : null;
            if (!this.user || (this.user.role !== 'admin' && this.user.role !== 'hod')) {
                window.location.href = 'index.html';
                return;
            }

            if (window.Theme) window.Theme.init();
            
            this.students = window.MockData ? window.MockData.getStudentsList() : [];
            
            this.renderTable();
            
            // Search & Filter
            const searchEl = document.getElementById('searchInput');
            if (searchEl) searchEl.addEventListener('input', () => this.renderTable());
            
            const deptFilter = document.getElementById('filterDept');
            if (deptFilter) {
                deptFilter.addEventListener('change', () => this.renderTable());
                
                // Limit department filter for HOD
                if (this.user.role === 'hod') {
                    if (this.user.department === 'ALL_I') {
                        // S&H manages all first years across depts
                    } else {
                        deptFilter.value = this.user.department;
                        deptFilter.disabled = true; // Lock it
                    }
                }
            }

            const yearFilter = document.getElementById('filterYear');
            if (yearFilter) yearFilter.addEventListener('change', () => this.renderTable());

            const secFilter = document.getElementById('filterSection');
            if (secFilter) secFilter.addEventListener('change', () => this.renderTable());

            const sortSelect = document.getElementById('sortStudents');
            if (sortSelect) sortSelect.addEventListener('change', (e) => {
                this.currentSort = e.target.value;
                this.renderTable();
            });

            const exportBtn = document.getElementById('exportStudentsBtn');
            if (exportBtn) exportBtn.addEventListener('click', () => this.exportCSV());

            // Modal setup
            const addBtn = document.getElementById('addStudentBtn');
            if (addBtn) addBtn.addEventListener('click', () => this.openModal());
            
            const cancelBtn = document.getElementById('cancelBtn');
            if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeModal());
            
            const closeXBtn = document.getElementById('closeModalBtn');
            if (closeXBtn) closeXBtn.addEventListener('click', () => this.closeModal());
            
            const modal = document.getElementById('studentModal');
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) this.closeModal();
                });
            }
            
            const form = document.getElementById('studentForm');
            if (form) form.addEventListener('submit', (e) => this.saveStudent(e));
        },

        renderTable: function() {
            const tbody = document.getElementById('students-body');
            if (!tbody) return;

            const searchEl = document.getElementById('searchInput');
            const search = searchEl ? searchEl.value.toLowerCase().trim() : '';
            
            const deptEl = document.getElementById('filterDept');
            const dept = deptEl ? deptEl.value : '';

            const yearEl = document.getElementById('filterYear');
            const year = yearEl ? yearEl.value : '';

            const secEl = document.getElementById('filterSection');
            const sec = secEl ? secEl.value : '';
            
            let filtered = (this.students || []).filter(s => {
                // Role-based filtering
                if (this.user.role === 'hod') {
                    if (this.user.department === 'ALL_I') {
                        if (s.year !== 'I') return false; // S&H manages only 1st year
                    } else {
                        // Core dept HOD manages II, III, IV years of their dept
                        if (s.department !== this.user.department || s.year === 'I') return false;
                    }
                }

                // UI filtering
                const matchSearch = !search || (s.name && s.name.toLowerCase().includes(search)) || (s.regNo && s.regNo.toLowerCase().includes(search));
                const matchDept = !dept || s.department === dept;
                const matchYear = !year || s.year === year;
                const matchSec = !sec || s.section === sec;
                return matchSearch && matchDept && matchYear && matchSec;
            });

            this.lastFiltered = filtered;

            // Sort
            filtered.sort((a, b) => {
                switch (this.currentSort) {
                    case 'name_asc': return (a.name || '').localeCompare(b.name || '');
                    case 'name_desc': return (b.name || '').localeCompare(a.name || '');
                    case 'reg_asc': return (a.regNo || '').localeCompare(b.regNo || '');
                    case 'reg_desc': return (b.regNo || '').localeCompare(a.regNo || '');
                    case 'year_asc': return (a.year || '').localeCompare(b.year || '');
                    case 'dept_asc': return (a.department || '').localeCompare(b.department || '');
                    case 'dept_desc': return (b.department || '').localeCompare(a.department || '');
                    default: return (a.name || '').localeCompare(b.name || '');
                }
            });

            this.updateSortIcons();

            if (filtered.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--color-text-muted);">No students found matching filters.</td></tr>';
                return;
            }

            const pageSlice = filtered.slice(0, 100); // Limit to 100 for performance

            let html = '';
            pageSlice.forEach(s => {
                const statusColor = s.status === 'active' || !s.status ? '#2E7D32' : '#C62828';
                html += `<tr>
                    <td><strong>${s.regNo || ''}</strong></td>
                    <td><a href="#" class="profile-btn" data-student-id="${s.id}" style="color:var(--color-primary);font-weight:500;text-decoration:none;">${s.name || ''}</a></td>
                    <td>${s.department || ''} - ${s.year || ''} yr ${s.section ? '('+s.section+')' : ''}</td>
                    <td>${s.phone || 'N/A'}</td>
                    <td style="color:${statusColor}">${s.status || 'active'}</td>
                    <td>
                        <button type="button" class="btn btn--sm btn--outline" onclick="window.StudentsManager.openModal('${s.id}')">Edit</button>
                        <button type="button" class="btn btn--sm btn--outline" style="margin-left:4px" onclick="window.StudentsManager.resetPassword('${s.id}')">Reset Pass</button>
                        <button type="button" class="btn btn--sm btn--danger" style="margin-left:4px" onclick="window.StudentsManager.deleteStudent('${s.id}')">Del</button>
                    </td>
                </tr>`;
            });
            
            tbody.innerHTML = html;
        },

        toggleSort: function(field) {
            if (field === 'reg') {
                this.currentSort = this.currentSort === 'reg_asc' ? 'reg_desc' : 'reg_asc';
            } else if (field === 'name') {
                this.currentSort = this.currentSort === 'name_asc' ? 'name_desc' : 'name_asc';
            } else if (field === 'dept') {
                this.currentSort = this.currentSort === 'dept_asc' ? 'dept_desc' : 'dept_asc';
            }
            const sel = document.getElementById('sortStudents');
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
            setI('ssort-reg', 'reg_asc', 'reg_desc');
            setI('ssort-name', 'name_asc', 'name_desc');
            setI('ssort-dept', 'dept_asc', 'dept_desc');
        },

        exportCSV: function() {
            const list = this.lastFiltered || this.students || [];
            if (list.length === 0) {
                alert('No students to export.');
                return;
            }
            let csv = 'Reg No,Name,Department,Year,Section,Phone,Status,Parent Name,Parent Phone\n';
            list.forEach(s => {
                csv += `"${s.regNo || ''}","${(s.name || '').replace(/"/g, '""')}","${s.department || ''}","${s.year || ''}","${s.section || ''}","${s.phone || ''}","${s.status || 'active'}","${(s.parentName || '').replace(/"/g, '""')}","${s.parentPhone || ''}"\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `students_list_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },

        openModal: function(id = null) {
            const modal = document.getElementById('studentModal');
            const title = document.getElementById('modalTitle');
            const form = document.getElementById('studentForm');
            
            if (form) form.reset();
            
            const setVal = (elId, val) => {
                const el = document.getElementById(elId);
                if (el) el.value = (val !== undefined && val !== null) ? val : '';
            };

            if (id !== null && id !== undefined && id !== '') {
                const s = (this.students || []).find(st => String(st.id) === String(id) || st.regNo === String(id));
                if (s) {
                    if (title) title.textContent = 'Edit Student';
                    setVal('studentId', s.id);
                    setVal('studentName', s.name);
                    setVal('studentRegNo', s.regNo);
                    setVal('studentEmail', s.email);
                    setVal('studentDept', s.department);
                    setVal('studentYear', s.year);
                    setVal('studentSection', s.section || 'A');
                    setVal('studentPhone', s.phone);
                    setVal('studentStatus', s.status || 'active');
                    setVal('parentName', s.parentName);
                    setVal('parentPhone', s.parentPhone);
                }
            } else {
                if (title) title.textContent = 'Add Student';
                setVal('studentId', '');
                
                // Pre-fill department for HODs
                if (this.user && this.user.role === 'hod' && this.user.department !== 'ALL_I') {
                    setVal('studentDept', this.user.department);
                }
            }
            
            if (modal) {
                modal.style.display = 'flex';
            }
        },

        closeModal: function() {
            const modal = document.getElementById('studentModal');
            if (modal) modal.style.display = 'none';
        },

        saveStudent: function(e) {
            if (e && e.preventDefault) e.preventDefault();
            
            const getVal = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
            const idVal = getVal('studentId');
            const isNew = !idVal;
            
            const name = getVal('studentName');
            const regNo = getVal('studentRegNo');
            const department = getVal('studentDept');
            const year = getVal('studentYear');
            const section = getVal('studentSection') || 'A';
            const email = getVal('studentEmail') || (regNo.toLowerCase() + '@scadcet.ac.in');
            const phone = getVal('studentPhone');
            const status = getVal('studentStatus') || 'active';
            const parentName = getVal('parentName');
            const parentPhone = getVal('parentPhone');

            if (!regNo || !name) {
                this.showToast('Please enter Register Number and Name');
                return;
            }

            const sData = {
                id: isNew ? Date.now() : (isNaN(Number(idVal)) ? idVal : Number(idVal)),
                name: name,
                regNo: regNo,
                department: department,
                year: year,
                section: section,
                email: email,
                phone: phone,
                status: status,
                parentName: parentName,
                parentPhone: parentPhone,
                classGroup: `${department}-${year}-${section}`
            };
            
            if (isNew) {
                sData.password = sData.regNo;
                sData.mustChangePassword = true;
                this.students.unshift(sData);
            } else {
                const idx = this.students.findIndex(st => String(st.id) === String(sData.id) || st.regNo === sData.regNo);
                if (idx > -1) {
                    sData.password = this.students[idx].password || this.students[idx].regNo;
                    this.students[idx] = sData;
                } else {
                    this.students.unshift(sData);
                }
            }
            
            if (window.MockData && window.MockData.saveStudentsList) {
                window.MockData.saveStudentsList(this.students);
            }
            
            this.renderTable();
            this.closeModal();
            this.showToast('Student saved successfully');
        },

        resetPassword: function(id) {
            var self = this;
            if (window.Auth && window.Auth.verifyCurrentUser) {
                window.Auth.verifyCurrentUser("reset this student's password").then(function(verified) {
                    if (!verified) return;
                    const s = (self.students || []).find(st => String(st.id) === String(id) || st.regNo === String(id));
                    if (s) {
                        s.password = s.regNo;
                        s.mustChangePassword = true;
                        if (window.MockData && window.MockData.saveStudentsList) {
                            window.MockData.saveStudentsList(self.students);
                        }
                        self.showToast('Password reset successfully. Temp Password: ' + s.regNo);
                    }
                });
            }
        },

        deleteStudent: function(id) {
            var self = this;
            if (window.Auth && window.Auth.verifyCurrentUser) {
                window.Auth.verifyCurrentUser('remove this student').then(function(verified) {
                    if (!verified) return;
                    if (!confirm('Are you sure you want to remove this student? This cannot be undone.')) return;
                    self.students = (self.students || []).filter(st => String(st.id) !== String(id) && st.regNo !== String(id));
                    if (window.MockData && window.MockData.saveStudentsList) {
                        window.MockData.saveStudentsList(self.students);
                    }
                    self.renderTable();
                    self.showToast('Student removed');
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
        window.StudentsManager.init();
    });

})();
