/**
 * SCAD College Attendance ERP - Defaulter Warning Letter Generator
 * Produces official formal institutional warning letters with print/PDF support.
 */
(function () {
  'use strict';

  function ensureModal() {
    let modal = document.getElementById('warning-letter-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'warning-letter-modal';
      modal.className = 'modal';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="modal__overlay" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.6); z-index:900;" onclick="window.WarningLetterGenerator.close()"></div>
        <div class="modal__card" style="position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#fff; border-radius:12px; z-index:901; max-width:760px; width:94%; max-height:92vh; overflow-y:auto; box-shadow:0 12px 48px rgba(0,0,0,0.3); font-family:'Segoe UI', Arial, sans-serif;">
          <div style="padding:1rem 1.5rem; background:#f8f9fa; border-bottom:1px solid #e0e0e0; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:600; color:#333; font-size:1rem;">Official Institutional Warning Letter</span>
            <div style="display:flex; gap:0.5rem;">
              <button class="btn btn--primary btn--sm" onclick="window.print()" style="display:flex; align-items:center; gap:4px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                Print / Save PDF
              </button>
              <button class="btn btn--outline btn--sm" onclick="window.WarningLetterGenerator.close()">&times; Close</button>
            </div>
          </div>
          <div id="warning-letter-content" style="padding:2.5rem 3rem; color:#111; line-height:1.6;">
            <!-- Rendered by JS -->
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    return modal;
  }

  window.WarningLetterGenerator = {
    /**
     * Generate and display official Warning Letter
     */
    generate: function (studentId) {
      const student = window.MockData ? window.MockData.getStudentById(studentId) : null;
      if (!student) {
        alert('Student record not found.');
        return;
      }

      const modal = ensureModal();
      const container = document.getElementById('warning-letter-content');
      
      const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
      const refNum = `SCAD/ATT/WARN/${new Date().getFullYear()}/${student.department}/${student.regNo.slice(-4)}`;
      
      // Calculate realistic or actual attendance stats
      const total = 90;
      let seed = 0;
      for (let i = 0; i < student.regNo.length; i++) seed += student.regNo.charCodeAt(i);
      const absent = 18 + (seed % 10);
      const present = total - absent;
      const pct = Math.round((present / total) * 100);

      const isSevere = pct < 65;
      const warningType = isSevere ? 'FINAL ATTENDANCE SHORTAGE NOTICE (UNDER 65%)' : 'ATTENDANCE SHORTAGE WARNING NOTICE (UNDER 75%)';
      const warningColor = isSevere ? '#C62828' : '#D84315';

      container.innerHTML = `
        <div style="text-align:center; border-bottom:2px solid #1b5e20; padding-bottom:1.25rem; margin-bottom:1.5rem;">
          <h2 style="margin:0 0 4px 0; color:#1b5e20; font-size:1.45rem; letter-spacing:0.5px; text-transform:uppercase;">SCAD College of Engineering and Technology</h2>
          <p style="margin:0 0 2px 0; font-size:0.85rem; color:#555;">(An Autonomous Institution | Affiliated to Anna University, Chennai)</p>
          <p style="margin:0; font-size:0.82rem; color:#666;">Cheranmahadevi, Tirunelveli District, Tamil Nadu — 627 414</p>
        </div>

        <div style="display:flex; justify-content:space-between; margin-bottom:1.5rem; font-size:0.9rem;">
          <div><strong>Ref:</strong> ${refNum}</div>
          <div><strong>Date:</strong> ${today}</div>
        </div>

        <div style="margin-bottom:1.25rem; font-size:0.92rem;">
          <div><strong>To:</strong></div>
          <div style="margin-left:1.5rem;">
            <div>Mr. / Mrs. ${student.parentName || 'Parent / Guardian'}</div>
            <div>Parent of: <strong>${student.name}</strong> (Reg No: <strong>${student.regNo}</strong>)</div>
            <div>Department of ${student.department} — Year ${student.year} (${student.section || 'A'})</div>
            <div>Phone: ${student.parentPhone || '+91 99887 76655'}</div>
          </div>
        </div>

        <div style="text-align:center; margin:1.5rem 0; font-weight:700; color:${warningColor}; font-size:1.05rem; text-decoration:underline;">
          ${warningType}
        </div>

        <p style="font-size:0.92rem; text-align:justify;">
          Dear Parent / Guardian,
        </p>

        <p style="font-size:0.92rem; text-align:justify; text-indent:2rem;">
          This is to bring to your immediate notice that your ward <strong>${student.name}</strong>, studying in <strong>${student.year} Year ${student.department}</strong>, has secured only <strong>${pct}%</strong> overall attendance up to date, which falls well below the statutory minimum requirement of <strong>75%</strong> mandated by <strong>Anna University</strong> and the Academic Council regulations.
        </p>

        <!-- Attendance Summary Table -->
        <table style="width:100%; border-collapse:collapse; margin:1.25rem 0; font-size:0.88rem; text-align:center;">
          <thead>
            <tr style="background:#f1f8e9; border:1px solid #c8e6c9;">
              <th style="padding:8px; border:1px solid #c8e6c9;">Total Working Periods</th>
              <th style="padding:8px; border:1px solid #c8e6c9;">Periods Attended</th>
              <th style="padding:8px; border:1px solid #c8e6c9;">Periods Absent</th>
              <th style="padding:8px; border:1px solid #c8e6c9;">Attendance %</th>
              <th style="padding:8px; border:1px solid #c8e6c9;">Eligibility Status</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border:1px solid #e0e0e0;">
              <td style="padding:8px; border:1px solid #e0e0e0; font-weight:600;">${total}</td>
              <td style="padding:8px; border:1px solid #e0e0e0; color:#2E7D32; font-weight:700;">${present}</td>
              <td style="padding:8px; border:1px solid #e0e0e0; color:#C62828; font-weight:700;">${absent}</td>
              <td style="padding:8px; border:1px solid #e0e0e0; color:${warningColor}; font-weight:800; font-size:1rem;">${pct}%</td>
              <td style="padding:8px; border:1px solid #e0e0e0; color:${warningColor}; font-weight:700;">${isSevere ? 'Condone / Detained' : 'At Risk'}</td>
            </tr>
          </tbody>
        </table>

        <p style="font-size:0.92rem; text-align:justify;">
          As per university norms, students having less than 75% attendance will <strong>NOT be permitted to appear for the End Semester University Examinations</strong>.
        </p>

        <p style="font-size:0.92rem; text-align:justify;">
          You are hereby requested to meet the undersigned Head of the Department along with your ward on or before <strong>Friday at 03:00 PM</strong> to discuss remedial measures.
        </p>

        <div style="display:flex; justify-content:space-between; margin-top:3.5rem; font-size:0.9rem; text-align:center;">
          <div>
            <div style="border-bottom:1px solid #999; width:160px; margin-bottom:4px;"></div>
            <strong>Class Advisor</strong>
          </div>
          <div>
            <div style="border-bottom:1px solid #999; width:160px; margin-bottom:4px;"></div>
            <strong>Head of the Department</strong><br>
            <small>Department of ${student.department}</small>
          </div>
          <div>
            <div style="border-bottom:1px solid #999; width:160px; margin-bottom:4px;"></div>
            <strong>Principal</strong><br>
            <small>SCAD CET</small>
          </div>
        </div>
      `;

      modal.style.display = 'block';

      // Audit Log
      if (window.AuditLogger) {
        window.AuditLogger.log(
          'WARNING_LETTER_GENERATED',
          `${student.name} (${student.regNo})`,
          `Generated formal notice for ${pct}% attendance shortage (Ref: ${refNum})`
        );
      }
    },

    close: function () {
      const modal = document.getElementById('warning-letter-modal');
      if (modal) modal.style.display = 'none';
    }
  };

})();
