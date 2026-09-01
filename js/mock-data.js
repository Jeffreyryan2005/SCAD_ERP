/**
 * SCAD College Attendance ERP - Mock Data Layer
 * Simulates eSSL biometric device data + period-wise class attendance.
 */
(function () {
  'use strict';

  // Seeded pseudo-random number generator for consistent mock data
  function seededRandom(seed) {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }

  const tamilNames = [
    'Karthik S', 'Priya M', 'Arun Kumar R', 'Divya B', 'Sathish K',
    'Nandhini V', 'Rajesh P', 'Meena G', 'Vikram T', 'Anitha L',
    'Surya N', 'Kavitha D', 'Manoj K', 'Deepa S', 'Ganesh R',
    'Lavanya P', 'Suresh M', 'Saranya K', 'Dinesh A', 'Ramya C',
    'Vignesh S', 'Geetha N', 'Prabhu M', 'Swetha P', 'Prakash R',
    'Revathi V', 'Ashok K', 'Vidya S', 'Balaji M', 'Sangeetha G',
    'Kumar V', 'Anand K', 'Nithya R', 'Murali D', 'Roopa T',
    'Siva P', 'Preethi A', 'Ramesh N', 'Malathi S', 'Kannan V',
    'Shanthi K', 'Hari R', 'Aarthi M', 'Gopi S', 'Naveen P',
    'Jaya N', 'Babu T', 'Sujatha L', 'Ravi D', 'Kamala A',
    'Venkatesh S', 'Gowri R', 'Selvam V', 'Pavithra M', 'Raj K',
    'Lakshmi G', 'Dhanush N', 'Sindhu P', 'Raghav R', 'Kala S',
    'Mohan V', 'Divya R', 'Harish K', 'Sowmya P', 'Mani S',
    'Bhavani T', 'Senthil R', 'Ganga M', 'Vivek P', 'Ranjitha K',
    'Aravind S', 'Suganya M', 'Karthikeyan R', 'Jeyalakshmi V', 'Vasanth K',
    'Indira N', 'Saravanan M', 'Thenmozhi P', 'Srinivas R', 'Uma S',
    'Muthu K', 'Bhuvana R', 'Ramkumar V', 'Gayathri S', 'Devan P',
    'Chitra M', 'Logesh R', 'Meenakshi K', 'Tharun S', 'Niranjana V',
    'Karthiga P', 'Jayakumar R', 'Sumathi M', 'Varun S', 'Swathi K',
    'Dharani P', 'Shankar R', 'Vanitha M', 'Ajith K', 'Premalatha S'
  ];

  // ========== GENERATE STUDENTS ==========
  // Uses departments and sections from Timetable module
  let idCounter = 1;
  let nameIndex = 0;

  const deptConfigs = [
    { code: 'CSE',   deptId: '104', sections: ['A', 'B', 'C'], studentsPerSection: 10 },
    { code: 'ECE',   deptId: '106', sections: ['A'],           studentsPerSection: 12 },
    { code: 'EEE',   deptId: '105', sections: ['A'],           studentsPerSection: 10 },
    { code: 'MECH',  deptId: '114', sections: ['A'],           studentsPerSection: 10 },
    { code: 'CIVIL', deptId: '110', sections: ['A'],           studentsPerSection: 10 }
  ];

  const years = ['I', 'II', 'III', 'IV'];

  function generateDefaultStudents() {
    const defaultStudents = [];
    let idCounter = 1;
    let nameIndex = 0;

    deptConfigs.forEach(dept => {
      years.forEach(year => {
        dept.sections.forEach(section => {
          for (let i = 1; i <= dept.studentsPerSection; i++) {
            const name = tamilNames[nameIndex % tamilNames.length];
            const nameParts = name.toLowerCase().split(' ');
            const email = `${nameParts[0]}.${nameParts[nameParts.length - 1]}@scadcet.ac.in`;

            const yearNum = years.indexOf(year) + 1;
            const rollNumStr = i.toString().padStart(3, '0');
            const regNo = `9214${yearNum}${dept.deptId}${section}${rollNumStr}`;

            const phoneBase = 9876500000 + idCounter * 7;
            const phone = `+91 ${String(phoneBase).substring(0,5)} ${String(phoneBase).substring(5)}`;

            const parentPhoneBase = 9443200000 + idCounter * 11;
            const parentPhone = `+91 ${String(parentPhoneBase).substring(0,5)} ${String(parentPhoneBase).substring(5)}`;

            defaultStudents.push({
              id: idCounter,
              name: name,
              regNo: regNo,
              email: email,
              phone: phone,
              parentPhone: parentPhone,
              department: dept.code,
              year: year,
              section: section,
              classGroup: `${dept.code}-${year}-${section}`,
              cgpa: (6.5 + (idCounter % 30) * 0.1).toFixed(2),
              arrears: idCounter % 7 === 0 ? 1 : (idCounter % 23 === 0 ? 2 : 0),
              password: regNo,
              mustChangePassword: true
            });
            idCounter++;
            nameIndex++;
          }
        });
      });
    });
    return defaultStudents;
  }

  function getStudentsList() {
    let savedStudents = localStorage.getItem('scad_students');
    if (!savedStudents) {
      const defaultStudents = generateDefaultStudents();
      localStorage.setItem('scad_students', JSON.stringify(defaultStudents));
      return defaultStudents;
    }
    return JSON.parse(savedStudents);
  }

  function saveStudentsList(studentsList) {
    localStorage.setItem('scad_students', JSON.stringify(studentsList));
    students = studentsList;
  }

  let students = getStudentsList();

  // ========== GATE (BIOMETRIC) DATA ==========
  /**
   * Generates mock biometric gate data for a specific date.
   * @param {string} dateStr - Date string in YYYY-MM-DD format.
   * @returns {Object} Object mapping student ID to { checkIn, checkOut }.
   */
  function generateGateData(dateStr) {
    const gateData = {};
    const dateParts = dateStr.split('-');
    const seedBase = parseInt(dateParts.join(''), 10);

    students.forEach(student => {
      const seed = seedBase + student.id;
      const rand = seededRandom(seed);

      let checkIn = null;
      let checkOut = null;
      const baseDate = new Date(dateStr + 'T00:00:00');

      if (rand < 0.05) {
        // 5% Early birds (8:00 - 8:15 AM)
        const minutes = Math.floor(seededRandom(seed + 1) * 15);
        checkIn = new Date(baseDate.getTime() + (8 * 60 + minutes) * 60000);
      } else if (rand < 0.78) {
        // 73% Present (8:15 - 8:55 AM)
        const minutes = Math.floor(seededRandom(seed + 1) * 40) + 15;
        checkIn = new Date(baseDate.getTime() + (8 * 60 + minutes) * 60000);
      } else if (rand < 0.90) {
        // 12% Late/Grace (9:00 - 9:10 AM)
        const minutes = Math.floor(seededRandom(seed + 1) * 10);
        checkIn = new Date(baseDate.getTime() + (9 * 60 + minutes) * 60000);
      }
      // Remaining 10% are absent (checkIn = null)

      // Generate check-out for those who checked in
      if (checkIn) {
        const outRand = seededRandom(seed + 2);
        if (outRand < 0.85) {
          const minutes = Math.floor(seededRandom(seed + 3) * 25);
          checkOut = new Date(baseDate.getTime() + (15 * 60 + 50 + minutes) * 60000);
        }
      }

      gateData[student.id] = { checkIn, checkOut };
    });

    return gateData;
  }

  // ========== PERIOD-WISE ATTENDANCE DATA ==========
  /**
   * Generates mock period-wise attendance for a class group on a date.
   * Students who are present at gate have ~92% chance of being in each period.
   * Students absent at gate are always absent in periods.
   * @param {string} dateStr
   * @param {string} classGroupKey - e.g., "CSE-II-A"
   * @returns {Object} { [studentId]: { [periodNum]: 'present'|'absent' } }
   */
  function generatePeriodAttendance(dateStr, classGroupKey) {
    const dateParts = dateStr.split('-');
    const seedBase = parseInt(dateParts.join(''), 10);
    const gateData = generateGateData(dateStr);

    const classStudents = students.filter(s => s.classGroup === classGroupKey);
    const periodData = {};

    classStudents.forEach(student => {
      const hasGateEntry = !!gateData[student.id].checkIn;
      const periods = {};

      for (let p = 1; p <= 7; p++) {
        const pSeed = seedBase + student.id * 10 + p;
        if (!hasGateEntry) {
          // Absent at gate = absent everywhere
          periods[p] = 'absent';
        } else {
          // Present at gate but might skip individual periods
          const r = seededRandom(pSeed);
          if (r < 0.92) {
            periods[p] = 'present';
          } else {
            periods[p] = 'absent'; // Bunking!
          }
        }
      }

      periodData[student.id] = periods;
    });

    return periodData;
  }

  /**
   * Retrieves students by class group key.
   */
  function getStudentsByClassGroup(classGroupKey) {
    return students.filter(s => s.classGroup === classGroupKey);
  }

  /**
   * Retrieves a student by their ID.
   */
  function getStudentById(id) {
    return students.find(s => String(s.id) === String(id) || s.regNo === String(id));
  }

  /**
   * Retrieves a student by register number.
   */
  function getStudentByRegNo(regNo) {
    return students.find(s => s.regNo === regNo);
  }

  /**
   * Gets students filtered by department, year, section.
   */
  function getStudentsFiltered(filters) {
    return students.filter(s => {
      if (filters.department && filters.department !== 'ALL' && s.department !== filters.department) return false;
      if (filters.year && filters.year !== 'ALL' && s.year !== filters.year) return false;
      if (filters.section && filters.section !== 'ALL' && s.section !== filters.section) return false;
      if (filters.classGroup && s.classGroup !== filters.classGroup) return false;
      return true;
    });
  }

  // ========== BIOMETRIC DEVICES ==========
  const devices = [
    {
      id: 'DEV-01',
      name: 'Main Gate',
      model: 'eSSL X990',
      location: 'Main Entrance',
      status: 'online',
      lastSync: new Date(Date.now() - 2 * 60000).toISOString(),
      uptime: '99.8%',
      issue: null
    },
    {
      id: 'DEV-02',
      name: 'CSE Block',
      model: 'eSSL X990',
      location: 'CSE Department Building',
      status: 'warning',
      lastSync: new Date(Date.now() - 47 * 60000).toISOString(),
      uptime: '94.2%',
      issue: 'Sync lag >200ms — last response delayed'
    },
    {
      id: 'DEV-03',
      name: 'Library',
      model: 'eSSL X990',
      location: 'Central Library Entrance',
      status: 'online',
      lastSync: new Date(Date.now() - 1 * 60000).toISOString(),
      uptime: '99.5%',
      issue: null
    },
    {
      id: 'DEV-04',
      name: 'Hostel Gate',
      model: 'eSSL X990',
      location: 'Hostel Main Gate',
      status: 'offline',
      lastSync: new Date(Date.now() - 3 * 3600000).toISOString(),
      uptime: '87.1%',
      issue: 'Offline since ' + new Date(Date.now() - 3 * 3600000).toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit', hour12:true})
    },
    {
      id: 'DEV-05',
      name: 'Admin Block',
      model: 'eSSL X990',
      location: 'Administrative Office',
      status: 'online',
      lastSync: new Date(Date.now() - 30000).toISOString(),
      uptime: '99.9%',
      issue: null
    }
  ];

  function getDeviceAlerts() {
    return devices.filter(d => d.status !== 'online');
  }

  function getActiveDeviceCount() {
    return devices.filter(d => d.status === 'online').length;
  }

  // Export to window
  window.MockData = {
    students,
    devices,
    generateGateData,
    generatePeriodAttendance,
    getStudentsByClassGroup,
    getStudentById,
    getStudentByRegNo,
    getStudentsList,
    saveStudentsList,
    STUDENTS: students,
    getStudentsFiltered,
    getDeviceAlerts,
    getActiveDeviceCount,
    getAllStudents: function () { return students; }
  };

})();
