/**
 * SCAD College Attendance ERP - Attendance Engine
 * Core business logic for gate (biometric) and period-wise attendance.
 */
(function () {
  'use strict';

  // Gate cutoff times
  const CUTOFF_HOUR = 9;
  const CUTOFF_MINUTE = 0;
  const GRACE_HOUR = 9;
  const GRACE_MINUTE = 10;
  const CHECKOUT_HOUR = 16;
  const CHECKOUT_MINUTE = 0;

  // ========== GATE STATUS CLASSIFICATION ==========
  function classifyGateStatus(checkInTime) {
    if (!checkInTime) return 'absent';
    const hours = checkInTime.getHours();
    const minutes = checkInTime.getMinutes();
    const timeInMinutes = hours * 60 + minutes;
    const cutoffInMinutes = CUTOFF_HOUR * 60 + CUTOFF_MINUTE;
    const graceInMinutes = GRACE_HOUR * 60 + GRACE_MINUTE;
    if (timeInMinutes < cutoffInMinutes) return 'present';
    else if (timeInMinutes <= graceInMinutes) return 'late';
    else return 'absent';
  }

  function getCheckoutStatus(checkOutTime) {
    return checkOutTime ? 'checked-out' : 'pending';
  }

  // ========== GATE ATTENDANCE RECORDS ==========
  function buildGateRecords(students, gateData, overrides) {
    overrides = overrides || {};
    return students.map(student => {
      const data = gateData[student.id] || { checkIn: null, checkOut: null };
      const originalStatus = classifyGateStatus(data.checkIn);
      const checkoutStatus = getCheckoutStatus(data.checkOut);
      const override = overrides[student.id];
      const isOverridden = !!override;
      const status = isOverridden ? override.status : originalStatus;
      return {
        student,
        checkIn: data.checkIn,
        checkOut: data.checkOut,
        status,
        checkoutStatus,
        isOverridden,
        overrideReason: isOverridden ? override.reason : null,
        originalStatus
      };
    });
  }

  // ========== PERIOD-WISE ATTENDANCE ==========

  /**
   * Gets period attendance from localStorage (faculty-saved) or falls back to mock.
   * @param {string} dateStr
   * @param {string} classGroup - e.g., "CSE-II-A"
   * @param {number} periodNum
   * @returns {Object} { [studentId]: 'present'|'absent' }
   */
  function getPeriodAttendance(dateStr, classGroup, periodNum) {
    // Check localStorage first (faculty-saved)
    const key = `scad_period_att_${dateStr}_${classGroup}_${periodNum}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
    // Fall back to mock data
    if (window.MockData) {
      const mockData = window.MockData.generatePeriodAttendance(dateStr, classGroup);
      const result = {};
      Object.keys(mockData).forEach(sid => {
        result[sid] = mockData[sid][periodNum] || 'absent';
      });
      return result;
    }
    return {};
  }

  /**
   * Saves period attendance to localStorage.
   */
  function savePeriodAttendance(dateStr, classGroup, periodNum, attendanceMap) {
    const key = `scad_period_att_${dateStr}_${classGroup}_${periodNum}`;
    localStorage.setItem(key, JSON.stringify(attendanceMap));
  }

  /**
   * Gets all period statuses for a student on a date.
   * @returns {Object} { 1: 'present', 2: 'absent', ... }
   */
  function getStudentPeriodStatuses(studentId, classGroup, dateStr) {
    const periods = {};
    for (let p = 1; p <= 7; p++) {
      const data = getPeriodAttendance(dateStr, classGroup, p);
      periods[p] = data[studentId] || 'absent';
    }
    return periods;
  }

  // ========== STATS ==========
  function calculateStats(records) {
    const total = records.length;
    let present = 0, late = 0, absent = 0, checkedOut = 0;
    records.forEach(r => {
      if (r.status === 'present') present++;
      else if (r.status === 'late') late++;
      else if (r.status === 'absent') absent++;
      if (r.checkoutStatus === 'checked-out') checkedOut++;
    });
    return {
      total, present, late, absent, checkedOut,
      presentPercent: total ? Math.round((present / total) * 100) : 0,
      latePercent: total ? Math.round((late / total) * 100) : 0,
      absentPercent: total ? Math.round((absent / total) * 100) : 0
    };
  }

  // ========== FILTERING ==========
  function filterRecords(records, filters) {
    return records.filter(r => {
      if (filters.department && filters.department !== 'ALL' && r.student.department !== filters.department) return false;
      if (filters.status && filters.status !== 'ALL' && r.status !== filters.status) return false;
      if (filters.year && filters.year !== 'ALL' && r.student.year !== filters.year) return false;
      if (filters.section && filters.section !== 'ALL' && r.student.section !== filters.section) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase().trim();
        if (!r.student.name.toLowerCase().includes(q) && !r.student.regNo.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }

  // ========== SORTING ==========
  function sortRecords(records, sortBy, sortOrder) {
    sortBy = sortBy || 'regNo';
    sortOrder = sortOrder || 'asc';
    return [...records].sort((a, b) => {
      let valA, valB;
      switch (sortBy) {
        case 'name': valA = a.student.name; valB = b.student.name; break;
        case 'department': valA = a.student.department; valB = b.student.department; break;
        case 'checkIn': valA = a.checkIn ? a.checkIn.getTime() : 0; valB = b.checkIn ? b.checkIn.getTime() : 0; break;
        case 'status': valA = a.status; valB = b.status; break;
        default: valA = a.student.regNo; valB = b.student.regNo; break;
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // ========== CSV EXPORT ==========
  function exportToCSV(records, dateStr) {
    const headers = ['Register No', 'Name', 'Department', 'Year', 'Section', 'Gate Status', 'Check-In', 'Check-Out', 'Overridden', 'Remarks'];
    const rows = records.map(r => {
      return [
        r.student.regNo,
        `"${r.student.name}"`,
        r.student.department,
        r.student.year,
        r.student.section || '',
        r.status.toUpperCase(),
        r.checkIn ? r.checkIn.toLocaleTimeString() : 'N/A',
        r.checkOut ? r.checkOut.toLocaleTimeString() : 'N/A',
        r.isOverridden ? 'YES' : 'NO',
        r.overrideReason ? `"${r.overrideReason}"` : ''
      ].join(',');
    });
    return [`Attendance Report for ${dateStr}`, headers.join(','), ...rows].join('\n');
  }

  // ========== OVERRIDES (Gate) ==========
  function getOverrides(dateStr) {
    const key = `scad_overrides_${dateStr}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : {};
  }

  function saveOverride(dateStr, studentId, newStatus, reason) {
    const overrides = getOverrides(dateStr);
    overrides[studentId] = { status: newStatus, reason };
    localStorage.setItem(`scad_overrides_${dateStr}`, JSON.stringify(overrides));
  }

  // ========== DEFAULTERS ==========
  function getDefaulters(todayStr) {
    if (!window.MockData) return [];
    const students = window.MockData.students;
    const today = new Date(todayStr + 'T00:00:00');
    const DAYS = 30;
    const dateList = [];
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dateList.push(`${y}-${m}-${day}`);
    }
    const workingDays = dateList.length;
    const defaulters = [];

    students.forEach(student => {
      let presentCount = 0, consecutiveAbsences = 0, maxConsecutive = 0;
      dateList.forEach(dateStr => {
        const data = window.MockData.generateGateData(dateStr);
        const overrides = getOverrides(dateStr);
        const checkIn = data[student.id] ? data[student.id].checkIn : null;
        let status = classifyGateStatus(checkIn);
        if (overrides[student.id]) status = overrides[student.id].status;
        if (status === 'present' || status === 'late') {
          presentCount++;
          consecutiveAbsences = 0;
        } else {
          consecutiveAbsences++;
          if (consecutiveAbsences > maxConsecutive) maxConsecutive = consecutiveAbsences;
        }
      });

      const attendancePct = workingDays > 0 ? Math.round((presentCount / workingDays) * 100) : 100;
      if (attendancePct < 75 || maxConsecutive >= 3) {
        let riskLevel = 'medium';
        if (attendancePct < 60 || maxConsecutive >= 5) riskLevel = 'high';
        else if (attendancePct >= 70 && maxConsecutive < 4) riskLevel = 'low';
        defaulters.push({
          student, attendancePct, presentDays: presentCount, workingDays,
          maxConsecutiveAbsences: maxConsecutive, riskLevel,
          isLowAttendance: attendancePct < 75, hasConsecutiveAbsences: maxConsecutive >= 3
        });
      }
    });

    const riskOrder = { high: 0, medium: 1, low: 2 };
    defaulters.sort((a, b) => {
      if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
      return a.attendancePct - b.attendancePct;
    });
    return defaulters;
  }

  // ========== SEMESTER HISTORY ==========
  function getSemesterHistory(studentId, todayStr, days) {
    days = days || 90;
    if (!window.MockData) return null;
    const student = window.MockData.getStudentById(studentId);
    if (!student) return null;

    const today = new Date(todayStr + 'T00:00:00');
    const dateList = [];
    let d = new Date(today);
    while (dateList.length < days) {
      if (d.getDay() !== 0 && d.getDay() !== 6) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        dateList.push(`${y}-${m}-${day}`);
      }
      d.setDate(d.getDate() - 1);
    }
    dateList.reverse();

    const history = [];
    let present = 0, late = 0, absent = 0;
    dateList.forEach(dateStr => {
      const data = window.MockData.generateGateData(dateStr);
      const overrides = getOverrides(dateStr);
      const checkIn = data[student.id] ? data[student.id].checkIn : null;
      let status = classifyGateStatus(checkIn);
      let isOverridden = false;
      if (overrides[student.id]) { status = overrides[student.id].status; isOverridden = true; }
      if (status === 'present') present++;
      else if (status === 'late') late++;
      else absent++;
      history.push({ date: dateStr, status, isOverridden });
    });

    const percentage = days > 0 ? Math.round(((present + late) / days) * 100) : 100;
    return { student, stats: { total: days, present, late, absent, percentage }, history };
  }

  // Export to window
  window.AttendanceEngine = {
    CUTOFF_HOUR, CUTOFF_MINUTE, GRACE_HOUR, GRACE_MINUTE, CHECKOUT_HOUR, CHECKOUT_MINUTE,
    classifyGateStatus,
    classifyStatus: classifyGateStatus, // backward compat
    getCheckoutStatus,
    buildGateRecords,
    buildAttendanceRecords: buildGateRecords, // backward compat
    calculateStats,
    filterRecords,
    sortRecords,
    exportToCSV,
    getOverrides,
    saveOverride,
    getDefaulters,
    getSemesterHistory,
    getPeriodAttendance,
    savePeriodAttendance,
    getStudentPeriodStatuses
  };

})();
