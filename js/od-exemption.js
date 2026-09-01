/**
 * SCAD College Attendance ERP - On-Duty (OD) & Exemption Workflow
 * Manages official exemptions (Symposiums, Sports, Medical Leaves) and recalculates Effective Attendance.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'scad_od_requests';

  function getRequests() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        // Seed default OD requests
        const seedRequests = [
          {
            id: 'od_101',
            studentId: 2,
            studentName: 'Priya M',
            regNo: '92141104A002',
            department: 'CSE',
            year: 'II',
            section: 'A',
            date: '2026-08-13',
            periods: [3, 4, 5, 6, 7],
            category: 'Symposium',
            reason: 'Paper Presentation at Anna University Regional Tech Fest',
            proofNote: 'Certificate Ref #AU-TF-2026',
            status: 'approved', // 'pending', 'approved', 'rejected'
            approver: 'Dr. R. Meena (HOD - CSE)',
            approvedAt: new Date(Date.now() - 86400000).toISOString()
          },
          {
            id: 'od_102',
            studentId: 3,
            studentName: 'Arun Kumar R',
            regNo: '92141104A003',
            department: 'CSE',
            year: 'II',
            section: 'A',
            date: '2026-08-13',
            periods: [1, 2, 3, 4],
            category: 'Sports',
            reason: 'Zonal Inter-College Football Tournament Finals',
            proofNote: 'Physical Director Letter #PD-26-08',
            status: 'pending',
            approver: null,
            approvedAt: null
          }
        ];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seedRequests));
        return seedRequests;
      }
      return JSON.parse(data);
    } catch (e) {
      console.error('Failed to load OD requests:', e);
      return [];
    }
  }

  function saveRequests(reqs) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reqs));
    } catch (e) {
      console.error('Failed to save OD requests:', e);
    }
  }

  window.ODExemption = {
    /**
     * Submit a new OD / Medical Leave request
     */
    createRequest: function (studentId, date, periods, category, reason, proofNote) {
      const student = window.MockData ? window.MockData.getStudentById(studentId) : null;
      const reqs = getRequests();
      
      const newReq = {
        id: 'od_' + Date.now(),
        studentId: student ? student.id : studentId,
        studentName: student ? student.name : 'Unknown Student',
        regNo: student ? student.regNo : String(studentId),
        department: student ? student.department : 'CSE',
        year: student ? student.year : 'I',
        section: student ? (student.section || 'A') : 'A',
        date: date,
        periods: Array.isArray(periods) ? periods : [periods],
        category: category || 'Symposium', // 'Symposium', 'Sports', 'Medical', 'Placement', 'Other'
        reason: reason || '',
        proofNote: proofNote || '',
        status: 'pending',
        approver: null,
        approvedAt: null,
        timestamp: Date.now()
      };

      reqs.unshift(newReq);
      saveRequests(reqs);

      // Audit Log
      if (window.AuditLogger) {
        window.AuditLogger.log(
          'OD_REQUEST_SUBMITTED',
          `${newReq.studentName} (${newReq.regNo})`,
          `Category: ${newReq.category}, Date: ${newReq.date}, Periods: [${newReq.periods.join(', ')}]. Reason: ${newReq.reason}`
        );
      }

      return newReq;
    },

    /**
     * Approve an OD request (HOD/Principal action)
     */
    approveRequest: function (reqId, approverName) {
      const reqs = getRequests();
      const req = reqs.find(r => r.id === reqId);
      if (!req) return false;

      req.status = 'approved';
      req.approver = approverName || 'Department HOD';
      req.approvedAt = new Date().toISOString();
      saveRequests(reqs);

      // Audit log
      if (window.AuditLogger) {
        window.AuditLogger.log(
          'OD_APPROVED',
          `${req.studentName} (${req.regNo})`,
          `Approved ${req.category} exemption for ${req.date} by ${req.approver}`
        );
      }

      return true;
    },

    /**
     * Reject an OD request
     */
    rejectRequest: function (reqId, approverName, reason) {
      const reqs = getRequests();
      const req = reqs.find(r => r.id === reqId);
      if (!req) return false;

      req.status = 'rejected';
      req.approver = approverName || 'Department HOD';
      req.approvedAt = new Date().toISOString();
      req.rejectionReason = reason || 'Documentation insufficient';
      saveRequests(reqs);

      if (window.AuditLogger) {
        window.AuditLogger.log(
          'OD_REJECTED',
          `${req.studentName} (${req.regNo})`,
          `Rejected ${req.category} request for ${req.date}. Reason: ${req.rejectionReason}`
        );
      }

      return true;
    },

    /**
     * Get list of requests filtered by department and/or status
     */
    getRequests: function (filter = {}) {
      const reqs = getRequests();
      return reqs.filter(r => {
        if (filter.department && filter.department !== 'ALL' && filter.department !== 'ALL_I' && r.department !== filter.department) return false;
        if (filter.status && r.status !== filter.status) return false;
        if (filter.studentId && String(r.studentId) !== String(filter.studentId)) return false;
        return true;
      });
    },

    /**
     * Check if a student has an approved OD for a specific date and period
     */
    isStudentOnOD: function (studentId, date, periodNum) {
      const reqs = getRequests();
      return reqs.some(r => 
        (String(r.studentId) === String(studentId) || r.regNo === String(studentId)) &&
        r.date === date &&
        r.status === 'approved' &&
        r.periods.includes(Number(periodNum))
      );
    },

    /**
     * Calculates raw vs. effective attendance for a student taking OD into account
     */
    calculateEffectiveStats: function (studentId, rawTotal, rawPresent, rawLate, rawAbsent) {
      const reqs = getRequests().filter(r => 
        (String(r.studentId) === String(studentId) || r.regNo === String(studentId)) && 
        r.status === 'approved'
      );
      
      let odPeriodCount = 0;
      reqs.forEach(r => { odPeriodCount += (r.periods ? r.periods.length : 1); });

      // Cap OD so present + late + od doesn't exceed total
      const effectivePresent = Math.min(rawTotal, rawPresent + odPeriodCount);
      const effectiveAbsent = Math.max(0, rawTotal - effectivePresent - rawLate);
      const effectivePercentage = rawTotal > 0 ? Math.round((effectivePresent / rawTotal) * 100) : 0;
      const rawPercentage = rawTotal > 0 ? Math.round((rawPresent / rawTotal) * 100) : 0;

      return {
        raw: { total: rawTotal, present: rawPresent, late: rawLate, absent: rawAbsent, percentage: rawPercentage },
        effective: { total: rawTotal, present: effectivePresent, late: rawLate, absent: effectiveAbsent, percentage: effectivePercentage, odGranted: odPeriodCount }
      };
    }
  };

})();
