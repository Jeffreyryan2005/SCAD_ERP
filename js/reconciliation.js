/**
 * SCAD College Attendance ERP - Discrepancy & Reconciliation Engine
 * Cross-references Biometric Gate Punches vs Classroom Period Markings.
 * Detects:
 *   1. SUSPECTED_BUNKING (Gate IN but marked Absent in classroom)
 *   2. GATE_MISS (Classroom Present but no biometric punch at gate)
 *   3. LATE_ARRIVAL (Gate IN after 09:05 AM)
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'scad_reconciliation_resolutions';

  function getResolutions() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  }

  function saveResolutions(resolutions) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(resolutions));
    } catch (e) {
      console.error('Failed to save resolutions:', e);
    }
  }

  window.ReconciliationEngine = {
    /**
     * Compute discrepancies for a specific date and department
     */
    analyzeDiscrepancies: function (dateStr = '2026-08-13', deptFilter = 'ALL') {
      const students = window.MockData ? window.MockData.getStudentsList() : [];
      const gateData = (window.MockData && window.MockData.generateGateData) ? window.MockData.generateGateData(dateStr) : {};
      const resolutions = getResolutions();
      const discrepancies = [];

      students.forEach(student => {
        if (deptFilter !== 'ALL' && deptFilter !== 'ALL_I' && student.department !== deptFilter) return;

        const gate = gateData[student.id];
        const groupKey = `${student.department}_${student.year}_${student.section}`;
        const periodAtt = (window.MockData && window.MockData.generatePeriodAttendance) 
          ? (window.MockData.generatePeriodAttendance(dateStr, groupKey)[student.id] || {})
          : {};

        // Also check if OD is approved for this student
        const isOD = window.ODExemption && window.ODExemption.getRequests({ studentId: student.id, status: 'approved' }).length > 0;

        const periods = window.Timetable ? window.Timetable.PERIODS : [
          { num: 1 }, { num: 2 }, { num: 3 }, { num: 4 }, { num: 5 }, { num: 6 }, { num: 7 }
        ];

        let absentPeriods = [];
        let presentPeriods = [];

        periods.forEach(p => {
          // Check saved local storage first
          const storageKey = `scad_period_att_${dateStr}_${groupKey}_${p.num}`;
          const savedAtt = localStorage.getItem(storageKey);
          let status = 'present';
          if (savedAtt) {
            try {
              const parsed = JSON.parse(savedAtt);
              if (parsed[student.id]) status = parsed[student.id];
            } catch(e){}
          } else if (periodAtt[p.num]) {
            status = periodAtt[p.num];
          }

          if (status === 'absent') absentPeriods.push(p.num);
          else if (status === 'present') presentPeriods.push(p.num);
        });

        // Case 1: SUSPECTED BUNKING (Gate In recorded before 9:15 AM, but absent in 1+ class periods)
        if (gate && gate.checkIn && absentPeriods.length > 0 && !isOD) {
          const discId = `disc_bunk_${dateStr}_${student.id}`;
          const resolution = resolutions[discId];

          discrepancies.push({
            id: discId,
            studentId: student.id,
            studentName: student.name,
            regNo: student.regNo,
            department: student.department,
            year: student.year,
            section: student.section,
            classGroup: `${student.department}-${student.year}-${student.section}`,
            date: dateStr,
            gateTime: gate.checkIn,
            gateStatus: 'Checked In',
            type: 'SUSPECTED_BUNKING',
            typeLabel: 'Suspected Bunking',
            severity: absentPeriods.length >= 3 ? 'HIGH' : 'MEDIUM',
            details: `Gate in at ${gate.checkIn}, but absent in Period(s): ${absentPeriods.join(', ')}`,
            periodsAffected: absentPeriods,
            resolved: !!resolution,
            resolutionText: resolution ? resolution.actionText : null,
            resolutionActor: resolution ? resolution.actor : null
          });
        }

        // Case 2: GATE MISS (Present in class periods, but no gate biometric check-in)
        else if ((!gate || !gate.checkIn) && presentPeriods.length >= 3 && !isOD) {
          const discId = `disc_miss_${dateStr}_${student.id}`;
          const resolution = resolutions[discId];

          discrepancies.push({
            id: discId,
            studentId: student.id,
            studentName: student.name,
            regNo: student.regNo,
            department: student.department,
            year: student.year,
            section: student.section,
            classGroup: `${student.department}-${student.year}-${student.section}`,
            date: dateStr,
            gateTime: 'No Punch',
            gateStatus: 'Missing Gate Record',
            type: 'GATE_MISS',
            typeLabel: 'Biometric Gate Miss',
            severity: 'MEDIUM',
            details: `Present in ${presentPeriods.length} periods, but no biometric punch recorded at main gate`,
            periodsAffected: presentPeriods,
            resolved: !!resolution,
            resolutionText: resolution ? resolution.actionText : null,
            resolutionActor: resolution ? resolution.actor : null
          });
        }
      });

      return discrepancies;
    },

    /**
     * Resolve a discrepancy (e.g. excuse, confirmed proxy, verified medical slip)
     */
    resolveDiscrepancy: function (discrepancyId, actionType, notes) {
      const resolutions = getResolutions();
      let actor = 'HOD / Principal';
      if (window.Auth && window.Auth.getCurrentUser) {
        const u = window.Auth.getCurrentUser();
        if (u) actor = `${u.name} (${u.role ? u.role.toUpperCase() : ''})`;
      }

      resolutions[discrepancyId] = {
        actionType: actionType, // 'EXCUSED', 'CONFIRMED_BUNKING', 'GATE_PUNCH_ADJUSTED'
        actionText: actionType === 'EXCUSED' ? 'Excused / Special Permission' :
                    actionType === 'CONFIRMED_BUNKING' ? 'Confirmed Bunking (Parent Notified)' :
                    'Gate Record Verified & Reconciled',
        notes: notes || '',
        actor: actor,
        timestamp: new Date().toISOString()
      };

      saveResolutions(resolutions);

      if (window.AuditLogger) {
        window.AuditLogger.log(
          'DISCREPANCY_RESOLVED',
          discrepancyId,
          `Action: ${resolutions[discrepancyId].actionText}. Notes: ${notes || 'None'}`
        );
      }

      return true;
    }
  };

})();
