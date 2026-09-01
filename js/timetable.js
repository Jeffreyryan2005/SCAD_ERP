/**
 * SCAD College Attendance ERP - Timetable & Subject Data
 * Defines periods, subjects, faculty, sections, and timetable mappings.
 */
(function () {
  'use strict';

  // ========== PERIOD DEFINITIONS ==========
  const PERIODS = [
    { num: 1, start: '09:00', end: '09:50', label: 'Period 1' },
    { num: 2, start: '09:50', end: '10:40', label: 'Period 2' },
    // Break 10:40 - 11:00
    { num: 3, start: '11:00', end: '11:50', label: 'Period 3' },
    { num: 4, start: '11:50', end: '12:40', label: 'Period 4' },
    // Lunch 12:40 - 1:30
    { num: 5, start: '13:30', end: '14:20', label: 'Period 5' },
    { num: 6, start: '14:20', end: '15:10', label: 'Period 6' },
    { num: 7, start: '15:10', end: '16:00', label: 'Period 7' }
  ];

  const BREAKS = [
    { after: 2, start: '10:40', end: '11:00', label: 'Morning Break' },
    { after: 4, start: '12:40', end: '13:30', label: 'Lunch Break' }
  ];

  // ========== DEPARTMENTS & SECTIONS ==========
  const DEPARTMENTS = [
    { code: 'CSE',   name: 'Computer Science & Engineering',      deptId: '104', sections: ['A', 'B', 'C'] },
    { code: 'ECE',   name: 'Electronics & Communication Engg.',    deptId: '106', sections: ['A'] },
    { code: 'EEE',   name: 'Electrical & Electronics Engg.',       deptId: '105', sections: ['A'] },
    { code: 'MECH',  name: 'Mechanical Engineering',               deptId: '114', sections: ['A'] },
    { code: 'CIVIL', name: 'Civil Engineering',                    deptId: '110', sections: ['A'] }
  ];

  const YEARS = ['I', 'II', 'III', 'IV'];

  // ========== FACULTY SEED ==========
  const DEFAULT_FACULTY = [
    { id: 'faculty_cse_1',  name: 'Dr. S. Ramesh',       designation: 'Professor',       dept: 'CSE',   username: 'faculty_cse_1',  password: 'faculty123' },
    { id: 'faculty_cse_2',  name: 'Mrs. K. Priya',       designation: 'Asst. Professor', dept: 'CSE',   username: 'faculty_cse_2',  password: 'faculty123' },
    { id: 'faculty_cse_3',  name: 'Mr. R. Vignesh',      designation: 'Asst. Professor', dept: 'CSE',   username: 'faculty_cse_3',  password: 'faculty123' },
    { id: 'faculty_ece',    name: 'Dr. M. Anitha',       designation: 'Professor',       dept: 'ECE',   username: 'faculty_ece',    password: 'faculty123' },
    { id: 'faculty_ece_2',  name: 'Mr. P. Suresh',       designation: 'Asst. Professor', dept: 'ECE',   username: 'faculty_ece_2',  password: 'faculty123' },
    { id: 'faculty_eee',    name: 'Dr. V. Kumar',        designation: 'Professor',       dept: 'EEE',   username: 'faculty_eee',    password: 'faculty123' },
    { id: 'faculty_mech',   name: 'Mr. T. Ganesh',       designation: 'Asst. Professor', dept: 'MECH',  username: 'faculty_mech',   password: 'faculty123' },
    { id: 'faculty_civil',  name: 'Mrs. L. Sangeetha',   designation: 'Asst. Professor', dept: 'CIVIL', username: 'faculty_civil',  password: 'faculty123' },
    { id: 'faculty_math',   name: 'Dr. N. Lakshmi',      designation: 'Professor',       dept: 'MATH',  username: 'faculty_math',   password: 'faculty123' },
    { id: 'faculty_eng',    name: 'Mrs. S. Kavitha',     designation: 'Asst. Professor', dept: 'ENG',   username: 'faculty_eng',    password: 'faculty123' },
    { id: 'faculty_phy',    name: 'Dr. R. Mohan',        designation: 'Professor',       dept: 'PHY',   username: 'faculty_phy',    password: 'faculty123' }
  ];

  function getFacultyList() {
    let faculty = localStorage.getItem('scad_faculty');
    if (!faculty) {
      localStorage.setItem('scad_faculty', JSON.stringify(DEFAULT_FACULTY));
      return DEFAULT_FACULTY;
    }
    return JSON.parse(faculty);
  }

  function saveFacultyList(faculty) {
    localStorage.setItem('scad_faculty', JSON.stringify(faculty));
    FACULTY = faculty;
  }

  let FACULTY = getFacultyList();

  function getFacultyById(id) {
    return getFacultyList().find(f => f.id === id || f.username === id);
  }

  // ========== SUBJECTS ==========
  // Mapped to departments and years. Faculty teaches specific subjects.
  const SUBJECTS = [
    // CSE Year II
    { code: 'CS201', name: 'Data Structures',             dept: 'CSE', year: 'II', faculty: 'faculty_cse_1', type: 'theory' },
    { code: 'CS202', name: 'Object Oriented Programming', dept: 'CSE', year: 'II', faculty: 'faculty_cse_2', type: 'theory' },
    { code: 'CS203', name: 'Computer Organization',       dept: 'CSE', year: 'II', faculty: 'faculty_cse_3', type: 'theory' },
    { code: 'CS204', name: 'Discrete Mathematics',        dept: 'CSE', year: 'II', faculty: 'faculty_math',  type: 'theory' },
    { code: 'CS205', name: 'Environmental Science',       dept: 'CSE', year: 'II', faculty: 'faculty_eng',   type: 'theory' },
    { code: 'CS2L1', name: 'DS Lab',                      dept: 'CSE', year: 'II', faculty: 'faculty_cse_1', type: 'lab' },
    { code: 'CS2L2', name: 'OOP Lab',                     dept: 'CSE', year: 'II', faculty: 'faculty_cse_2', type: 'lab' },

    // CSE Year III
    { code: 'CS301', name: 'Database Management Systems', dept: 'CSE', year: 'III', faculty: 'faculty_cse_1', type: 'theory' },
    { code: 'CS302', name: 'Computer Networks',           dept: 'CSE', year: 'III', faculty: 'faculty_cse_2', type: 'theory' },
    { code: 'CS303', name: 'Operating Systems',           dept: 'CSE', year: 'III', faculty: 'faculty_cse_3', type: 'theory' },
    { code: 'CS304', name: 'Software Engineering',        dept: 'CSE', year: 'III', faculty: 'faculty_cse_1', type: 'theory' },
    { code: 'CS305', name: 'Theory of Computation',       dept: 'CSE', year: 'III', faculty: 'faculty_math',  type: 'theory' },
    { code: 'CS3L1', name: 'DBMS Lab',                    dept: 'CSE', year: 'III', faculty: 'faculty_cse_1', type: 'lab' },

    // ECE Year II
    { code: 'EC201', name: 'Signals & Systems',           dept: 'ECE', year: 'II', faculty: 'faculty_ece',   type: 'theory' },
    { code: 'EC202', name: 'Electronic Circuits',         dept: 'ECE', year: 'II', faculty: 'faculty_ece_2', type: 'theory' },
    { code: 'EC203', name: 'Electromagnetic Theory',      dept: 'ECE', year: 'II', faculty: 'faculty_ece',   type: 'theory' },
    { code: 'EC204', name: 'Digital Electronics',         dept: 'ECE', year: 'II', faculty: 'faculty_ece_2', type: 'theory' },
    { code: 'EC205', name: 'Mathematics III',             dept: 'ECE', year: 'II', faculty: 'faculty_math',  type: 'theory' },

    // EEE Year II
    { code: 'EE201', name: 'Electrical Machines I',       dept: 'EEE', year: 'II', faculty: 'faculty_eee', type: 'theory' },
    { code: 'EE202', name: 'Power Systems',               dept: 'EEE', year: 'II', faculty: 'faculty_eee', type: 'theory' },
    { code: 'EE203', name: 'Control Systems',             dept: 'EEE', year: 'II', faculty: 'faculty_eee', type: 'theory' },
    { code: 'EE204', name: 'Circuit Theory',              dept: 'EEE', year: 'II', faculty: 'faculty_phy', type: 'theory' },

    // MECH Year II
    { code: 'ME201', name: 'Thermodynamics',              dept: 'MECH', year: 'II', faculty: 'faculty_mech', type: 'theory' },
    { code: 'ME202', name: 'Fluid Mechanics',             dept: 'MECH', year: 'II', faculty: 'faculty_mech', type: 'theory' },
    { code: 'ME203', name: 'Strength of Materials',       dept: 'MECH', year: 'II', faculty: 'faculty_mech', type: 'theory' },
    { code: 'ME204', name: 'Engineering Drawing',         dept: 'MECH', year: 'II', faculty: 'faculty_mech', type: 'theory' },

    // CIVIL Year II
    { code: 'CE201', name: 'Surveying',                   dept: 'CIVIL', year: 'II', faculty: 'faculty_civil', type: 'theory' },
    { code: 'CE202', name: 'Structural Analysis',         dept: 'CIVIL', year: 'II', faculty: 'faculty_civil', type: 'theory' },
    { code: 'CE203', name: 'Concrete Technology',         dept: 'CIVIL', year: 'II', faculty: 'faculty_civil', type: 'theory' },
    { code: 'CE204', name: 'Geotechnical Engineering',    dept: 'CIVIL', year: 'II', faculty: 'faculty_civil', type: 'theory' },

    // Common Year I (all departments share these)
    { code: 'MA101', name: 'Engineering Mathematics I',   dept: 'ALL', year: 'I', faculty: 'faculty_math', type: 'theory' },
    { code: 'PH101', name: 'Engineering Physics',         dept: 'ALL', year: 'I', faculty: 'faculty_phy',  type: 'theory' },
    { code: 'EN101', name: 'Technical English',           dept: 'ALL', year: 'I', faculty: 'faculty_eng',  type: 'theory' },
    { code: 'CS101', name: 'Problem Solving & Python',    dept: 'ALL', year: 'I', faculty: 'faculty_cse_3', type: 'theory' },
    { code: 'GE101', name: 'Engineering Graphics',        dept: 'ALL', year: 'I', faculty: 'faculty_mech', type: 'theory' }
  ];

  // ========== TIMETABLES ==========
  // Key format: "DEPT-YEAR-SECTION" e.g. "CSE-II-A"
  // Each day has 7 subject codes.
  const TIMETABLES = {
    'CSE-II-A': {
      MON: ['CS201', 'CS202', 'CS203', 'CS204', 'CS205', 'CS2L1', 'CS2L1'],
      TUE: ['CS202', 'CS201', 'CS204', 'CS203', 'CS2L2', 'CS2L2', 'CS205'],
      WED: ['CS203', 'CS204', 'CS201', 'CS202', 'CS205', 'CS201', 'CS203'],
      THU: ['CS204', 'CS203', 'CS202', 'CS201', 'CS2L1', 'CS2L1', 'CS204'],
      FRI: ['CS201', 'CS205', 'CS204', 'CS203', 'CS202', 'CS2L2', 'CS2L2']
    },
    'CSE-II-B': {
      MON: ['CS202', 'CS203', 'CS201', 'CS205', 'CS204', 'CS2L2', 'CS2L2'],
      TUE: ['CS201', 'CS204', 'CS202', 'CS203', 'CS205', 'CS201', 'CS204'],
      WED: ['CS204', 'CS201', 'CS203', 'CS202', 'CS2L1', 'CS2L1', 'CS205'],
      THU: ['CS203', 'CS202', 'CS204', 'CS201', 'CS205', 'CS203', 'CS202'],
      FRI: ['CS205', 'CS201', 'CS202', 'CS204', 'CS2L2', 'CS2L2', 'CS203']
    },
    'CSE-II-C': {
      MON: ['CS203', 'CS201', 'CS205', 'CS202', 'CS204', 'CS201', 'CS203'],
      TUE: ['CS204', 'CS202', 'CS203', 'CS201', 'CS2L1', 'CS2L1', 'CS205'],
      WED: ['CS201', 'CS205', 'CS204', 'CS203', 'CS2L2', 'CS2L2', 'CS202'],
      THU: ['CS202', 'CS204', 'CS201', 'CS205', 'CS203', 'CS204', 'CS201'],
      FRI: ['CS203', 'CS201', 'CS202', 'CS204', 'CS205', 'CS203', 'CS2L1']
    },
    'CSE-III-A': {
      MON: ['CS301', 'CS302', 'CS303', 'CS304', 'CS305', 'CS3L1', 'CS3L1'],
      TUE: ['CS302', 'CS301', 'CS305', 'CS303', 'CS304', 'CS301', 'CS302'],
      WED: ['CS303', 'CS305', 'CS301', 'CS302', 'CS304', 'CS303', 'CS305'],
      THU: ['CS304', 'CS303', 'CS302', 'CS301', 'CS3L1', 'CS3L1', 'CS305'],
      FRI: ['CS305', 'CS304', 'CS301', 'CS302', 'CS303', 'CS304', 'CS301']
    },
    'CSE-III-B': {
      MON: ['CS302', 'CS301', 'CS304', 'CS305', 'CS303', 'CS301', 'CS304'],
      TUE: ['CS301', 'CS303', 'CS302', 'CS304', 'CS3L1', 'CS3L1', 'CS305'],
      WED: ['CS305', 'CS302', 'CS303', 'CS301', 'CS304', 'CS302', 'CS303'],
      THU: ['CS303', 'CS304', 'CS305', 'CS302', 'CS301', 'CS305', 'CS301'],
      FRI: ['CS304', 'CS305', 'CS301', 'CS303', 'CS302', 'CS3L1', 'CS3L1']
    },
    'CSE-III-C': {
      MON: ['CS303', 'CS305', 'CS302', 'CS301', 'CS304', 'CS302', 'CS305'],
      TUE: ['CS305', 'CS304', 'CS301', 'CS303', 'CS302', 'CS3L1', 'CS3L1'],
      WED: ['CS301', 'CS303', 'CS304', 'CS302', 'CS305', 'CS301', 'CS304'],
      THU: ['CS302', 'CS301', 'CS303', 'CS305', 'CS304', 'CS303', 'CS302'],
      FRI: ['CS304', 'CS302', 'CS305', 'CS301', 'CS3L1', 'CS3L1', 'CS303']
    },
    'ECE-II-A': {
      MON: ['EC201', 'EC202', 'EC203', 'EC204', 'EC205', 'EC201', 'EC204'],
      TUE: ['EC202', 'EC203', 'EC201', 'EC205', 'EC204', 'EC202', 'EC203'],
      WED: ['EC203', 'EC204', 'EC202', 'EC201', 'EC205', 'EC203', 'EC201'],
      THU: ['EC204', 'EC201', 'EC205', 'EC203', 'EC202', 'EC204', 'EC205'],
      FRI: ['EC205', 'EC202', 'EC204', 'EC201', 'EC203', 'EC201', 'EC202']
    },
    'EEE-II-A': {
      MON: ['EE201', 'EE202', 'EE203', 'EE204', 'EE201', 'EE203', 'EE204'],
      TUE: ['EE202', 'EE203', 'EE201', 'EE204', 'EE202', 'EE201', 'EE203'],
      WED: ['EE203', 'EE201', 'EE204', 'EE202', 'EE203', 'EE204', 'EE201'],
      THU: ['EE204', 'EE202', 'EE201', 'EE203', 'EE204', 'EE202', 'EE201'],
      FRI: ['EE201', 'EE204', 'EE203', 'EE202', 'EE201', 'EE203', 'EE202']
    },
    'MECH-II-A': {
      MON: ['ME201', 'ME202', 'ME203', 'ME204', 'ME201', 'ME203', 'ME202'],
      TUE: ['ME202', 'ME203', 'ME201', 'ME204', 'ME202', 'ME204', 'ME201'],
      WED: ['ME203', 'ME201', 'ME204', 'ME202', 'ME203', 'ME201', 'ME204'],
      THU: ['ME204', 'ME202', 'ME201', 'ME203', 'ME204', 'ME202', 'ME203'],
      FRI: ['ME201', 'ME204', 'ME203', 'ME202', 'ME201', 'ME203', 'ME204']
    },
    'CIVIL-II-A': {
      MON: ['CE201', 'CE202', 'CE203', 'CE204', 'CE201', 'CE203', 'CE202'],
      TUE: ['CE202', 'CE203', 'CE201', 'CE204', 'CE202', 'CE204', 'CE201'],
      WED: ['CE203', 'CE201', 'CE204', 'CE202', 'CE203', 'CE201', 'CE204'],
      THU: ['CE204', 'CE202', 'CE201', 'CE203', 'CE204', 'CE202', 'CE203'],
      FRI: ['CE201', 'CE204', 'CE203', 'CE202', 'CE201', 'CE203', 'CE204']
    }
  };

  // Also create generic timetables for Year I (all depts share common subjects)
  DEPARTMENTS.forEach(dept => {
    dept.sections.forEach(sec => {
      const key = dept.code + '-I-' + sec;
      if (!TIMETABLES[key]) {
        TIMETABLES[key] = {
          MON: ['MA101', 'PH101', 'EN101', 'CS101', 'GE101', 'MA101', 'PH101'],
          TUE: ['PH101', 'MA101', 'CS101', 'EN101', 'GE101', 'PH101', 'CS101'],
          WED: ['EN101', 'CS101', 'MA101', 'GE101', 'PH101', 'EN101', 'MA101'],
          THU: ['CS101', 'GE101', 'PH101', 'MA101', 'EN101', 'CS101', 'GE101'],
          FRI: ['GE101', 'EN101', 'MA101', 'PH101', 'CS101', 'GE101', 'EN101']
        };
      }
    });
  });

  // Load custom timetables if available
  const CUSTOM_TIMETABLE_KEY = 'scad_custom_timetables';
  try {
      const customData = localStorage.getItem(CUSTOM_TIMETABLE_KEY);
      if (customData) {
          const parsed = JSON.parse(customData);
          Object.keys(parsed).forEach(key => {
              TIMETABLES[key] = parsed[key];
          });
      }
  } catch (e) { console.error('Error loading custom timetables', e); }

  // ========== HELPER FUNCTIONS ==========

  /**
   * Gets the timetable key for a class group.
   */
  function getTimetableKey(dept, year, section) {
    return dept + '-' + year + '-' + section;
  }

  /**
   * Gets all class groups (e.g., CSE-II-A, CSE-II-B, etc.)
   */
  function getAllClassGroups() {
    const groups = [];
    DEPARTMENTS.forEach(dept => {
      YEARS.forEach(year => {
        dept.sections.forEach(sec => {
          groups.push({
            key: getTimetableKey(dept.code, year, sec),
            dept: dept.code,
            deptName: dept.name,
            year: year,
            section: sec,
            label: dept.code + ' ' + year + ' Year - Sec ' + sec
          });
        });
      });
    });
    return groups;
  }

  /**
   * Gets the day name for a date string.
   */
  function getDayName(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()];
  }

  /**
   * Gets today's timetable for a class group.
   */
  function getTodayTimetable(dept, year, section, dateStr) {
    const key = getTimetableKey(dept, year, section);
    const tt = TIMETABLES[key];
    if (!tt) return [];
    const day = getDayName(dateStr);
    const subjectCodes = tt[day] || [];
    return subjectCodes.map((code, idx) => {
      const subject = SUBJECTS.find(s => s.code === code) || { code, name: code, faculty: 'unknown' };
      const faculty = FACULTY.find(f => f.id === subject.faculty);
      return {
        period: PERIODS[idx],
        subjectCode: code,
        subjectName: subject.name,
        type: subject.type || 'theory',
        facultyId: subject.faculty,
        facultyName: faculty ? faculty.name : 'TBA'
      };
    });
  }

  /**
   * Gets the current period number based on time.
   */
  function getCurrentPeriod() {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    for (let i = 0; i < PERIODS.length; i++) {
      const [sh, sm] = PERIODS[i].start.split(':').map(Number);
      const [eh, em] = PERIODS[i].end.split(':').map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      if (currentMinutes >= startMin && currentMinutes < endMin) {
        return PERIODS[i].num;
      }
    }
    return null; // Outside class hours
  }

  /**
   * Gets all subjects taught by a specific faculty.
   */
  function getSubjectsByFaculty(facultyId) {
    return SUBJECTS.filter(s => s.faculty === facultyId);
  }

  /**
   * Gets all class groups that have a specific subject in their timetable.
   */
  function getClassGroupsForSubject(subjectCode) {
    const groups = [];
    Object.keys(TIMETABLES).forEach(key => {
      const tt = TIMETABLES[key];
      const hasSubject = Object.values(tt).some(day => day.includes(subjectCode));
      if (hasSubject) {
        const parts = key.split('-');
        groups.push({ key, dept: parts[0], year: parts[1], section: parts[2] });
      }
    });
    return groups;
  }

  /**
   * Gets the faculty's schedule for a specific day.
   * Returns an array of { period, subjectCode, subjectName, classGroup } sorted by period.
   */
  function getFacultySchedule(facultyId, dateStr) {
    const facultySubjects = getSubjectsByFaculty(facultyId);
    const subjectCodes = facultySubjects.map(s => s.code);
    const day = getDayName(dateStr);
    
    // Initialize with 7 free periods
    const schedule = PERIODS.map(p => ({
      period: p,
      subjectCode: 'FREE',
      subjectName: 'Free Period',
      classGroup: '',
      classLabel: '-',
      type: 'free'
    }));

    Object.keys(TIMETABLES).forEach(key => {
      const tt = TIMETABLES[key];
      const daySchedule = tt[day];
      if (!daySchedule) return;

      daySchedule.forEach((code, idx) => {
        if (subjectCodes.includes(code)) {
          const subject = facultySubjects.find(s => s.code === code);
          const parts = key.split('-');
          schedule[idx] = {
            period: PERIODS[idx],
            subjectCode: code,
            subjectName: subject.name,
            classGroup: key,
            classLabel: parts[0] + ' ' + parts[1] + '-' + parts[2],
            type: subject.type || 'theory'
          };
        }
      });
    });

    return schedule;
  }

  /**
   * Get a subject by code.
   */
  function getSubjectByCode(code) {
    return SUBJECTS.find(s => s.code === code) || null;
  }

  /**
   * Get a faculty by ID.
   */
  function getFacultyById(id) {
    return FACULTY.find(f => f.id === id) || null;
  }

  // Export to window
  window.Timetable = {
    PERIODS,
    BREAKS,
    DEPARTMENTS,
    YEARS,
    FACULTY,
    SUBJECTS,
    TIMETABLES,
    getTimetableKey,
    getAllClassGroups,
    getDayName,
    getTodayTimetable,
    getCurrentPeriod,
    getSubjectsByFaculty,
    getClassGroupsForSubject,
    getFacultySchedule,
    getSubjectByCode,
    getFacultyById,
    getFacultyList,
    saveFacultyList
  };

})();
