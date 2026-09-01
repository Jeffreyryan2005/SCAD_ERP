/**
 * SCAD College Attendance Dashboard — Charts Module
 * Pure SVG chart rendering for donut and department bar charts.
 */
(function (window) {
  'use strict';

  const Charts = {

    /**
     * Read current theme colours from CSS custom properties.
     */
    _colors: function () {
      const s = getComputedStyle(document.body);
      return {
        present:  s.getPropertyValue('--color-present').trim()  || '#2E7D32',
        late:     s.getPropertyValue('--color-late').trim()     || '#E65100',
        absent:   s.getPropertyValue('--color-absent').trim()   || '#C62828',
        text:     s.getPropertyValue('--color-text').trim()     || '#212121',
        textSec:  s.getPropertyValue('--color-text-secondary').trim() || '#616161',
        border:   s.getPropertyValue('--color-border').trim()   || '#E0E0E0'
      };
    },

    /* ============================
       DONUT CHART
       ============================ */
    renderDonut: function (containerId, stats) {
      const el = document.getElementById(containerId);
      if (!el) return;

      const total = (stats.present || 0) + (stats.late || 0) + (stats.absent || 0);
      if (total === 0) {
        el.innerHTML = '<div style="color:var(--color-text-muted);padding:2rem;text-align:center">No data available</div>';
        return;
      }

      const c = this._colors();
      const size = 200, cx = 100, cy = 100, r = 70, sw = 25;
      const circ = 2 * Math.PI * r;

      const segments = [
        { value: stats.present, color: c.present, label: 'Present' },
        { value: stats.late,    color: c.late,    label: 'Late' },
        { value: stats.absent,  color: c.absent,  label: 'Absent' }
      ].filter(s => s.value > 0);

      let circles = '';
      let offset = 0;
      segments.forEach(seg => {
        const dash = (seg.value / total) * circ;
        circles += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
          stroke="${seg.color}" stroke-width="${sw}"
          stroke-dasharray="${dash} ${circ}" stroke-dashoffset="${offset}"
          transform="rotate(-90 ${cx} ${cy})" />`;
        offset -= dash;
      });

      const pct = Math.round((stats.present / total) * 100);

      const svg = `
        <svg viewBox="0 0 ${size} ${size}" style="max-width:180px;display:block;margin:0 auto">
          ${circles}
          <text x="${cx}" y="${cy - 6}" text-anchor="middle" dominant-baseline="middle"
                font-size="28" font-weight="700" fill="${c.text}">${pct}%</text>
          <text x="${cx}" y="${cy + 18}" text-anchor="middle" dominant-baseline="middle"
                font-size="11" fill="${c.textSec}">Present</text>
        </svg>`;

      const legend = segments.map(seg =>
        `<div style="display:flex;align-items:center;gap:6px">
           <span style="width:10px;height:10px;border-radius:50%;background:${seg.color};flex-shrink:0"></span>
           <span>${seg.label}</span>
           <strong>${seg.value}</strong>
         </div>`
      ).join('');

      el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;width:100%">
          ${svg}
          <div style="display:flex;flex-wrap:wrap;gap:12px 24px;justify-content:center;margin-top:16px;font-size:0.85rem;color:${c.textSec}">
            ${legend}
          </div>
        </div>`;
    },

    /* ============================
       DEPARTMENT BAR CHART
       ============================ */
    renderDepartmentBars: function (containerId, records) {
      const el = document.getElementById(containerId);
      if (!el) return;

      if (!records || records.length === 0) {
        el.innerHTML = '<div style="color:var(--color-text-muted);padding:2rem;text-align:center">No data available</div>';
        return;
      }

      // Group by department — records use r.student.department
      const dept = {};
      records.forEach(r => {
        const d = r.student.department;
        if (!dept[d]) dept[d] = { present: 0, late: 0, absent: 0, total: 0 };
        dept[d].total++;
        if (r.status === 'present') dept[d].present++;
        else if (r.status === 'late') dept[d].late++;
        else dept[d].absent++;
      });

      const depts = Object.keys(dept).sort();
      if (depts.length === 0) return;

      const c = this._colors();
      const W = 400, leftPad = 65, rightPad = 45;
      const usable = W - leftPad - rightPad;
      const barH = 30, gap = 16;
      const H = 30 + depts.length * (barH + gap);
      const maxTotal = Math.max(...depts.map(d => dept[d].total));

      let bars = '';
      depts.forEach((d, i) => {
        const y = 20 + i * (barH + gap);
        const s = dept[d];

        // Label
        bars += `<text x="${leftPad - 12}" y="${y + barH / 2}" text-anchor="end"
                       dominant-baseline="middle" font-size="12" font-weight="500"
                       fill="${c.text}">${d}</text>`;

        if (s.total > 0) {
          let x = leftPad;
          const pw = (s.present / maxTotal) * usable;
          const lw = (s.late / maxTotal) * usable;
          const aw = (s.absent / maxTotal) * usable;

          if (pw > 0) { bars += `<rect x="${x}" y="${y}" width="${pw}" height="${barH}" rx="3" fill="${c.present}" />`; x += pw; }
          if (lw > 0) { bars += `<rect x="${x}" y="${y}" width="${lw}" height="${barH}" rx="0" fill="${c.late}" />`; x += lw; }
          if (aw > 0) { bars += `<rect x="${x}" y="${y}" width="${aw}" height="${barH}" rx="0" fill="${c.absent}" />`; x += aw; }

          bars += `<text x="${x + 8}" y="${y + barH / 2}" dominant-baseline="middle"
                         font-size="11" fill="${c.textSec}">${s.total}</text>`;
        }
      });

      // Legend
      const legendItems = [
        { color: c.present, label: 'Present' },
        { color: c.late, label: 'Late' },
        { color: c.absent, label: 'Absent' }
      ];

      const legendHtml = legendItems.map(item =>
        `<div style="display:flex;align-items:center;gap:6px">
           <span style="width:10px;height:10px;border-radius:3px;background:${item.color};flex-shrink:0"></span>
           <span>${item.label}</span>
         </div>`
      ).join('');

      el.innerHTML = `
        <div style="width:100%;display:flex;flex-direction:column;align-items:center">
          <svg viewBox="0 0 ${W} ${H}" style="max-width:100%;font-family:inherit">${bars}</svg>
          <div style="display:flex;gap:16px;margin-top:12px;font-size:0.8rem;color:${c.textSec}">
            ${legendHtml}
          </div>
        </div>`;
    }
  };

  window.Charts = Charts;

})(window);
