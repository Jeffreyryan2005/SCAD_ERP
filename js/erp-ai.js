(function () {
  'use strict';

  /**
   * SCAD ERP — Inbuilt Local AI Assistant ("SCAD Copilot")
   * 100% Client-Side, Zero Cloud Dependency, Strict ERP Domain Guarded.
   * Tailored dynamically to the authenticated user's role: Student, Faculty, HOD, Admin.
   */

  const AI_STATE = {
    isOpen: false,
    history: [],
    role: null,
    user: null
  };

  // ERP Domain Keywords (Used to verify if a query is within academic/ERP scope)
  const ERP_DOMAIN_KEYWORDS = [
    'attendance', 'percent', 'percentage', '%', 'absent', 'present', 'leave', 'od', 'on duty', 'onduty',
    'timetable', 'schedule', 'period', 'class', 'subject', 'substitute', 'reallocate', 'reallocation',
    'swap', 'unlock', 'lock', '10 min', '10 minute', 'window', 'hod', 'mentor', 'mentee', 'portfolio',
    'defaulter', 'shortage', 'warning', 'letter', 'notice', 'parent', 'exam', 'anna university',
    'eligibility', 'condonation', 'redo', 'arrear', 'cgpa', 'student', 'faculty', 'staff', 'department',
    'dept', 'cse', 'ece', 'eee', 'mech', 'civil', 'math', 'report', 'export', 'password', 'login',
    'security', 'theme', 'dark mode', 'creator', 'developed', 'developer', 'narasimman', 'jeffrey',
    'scad', 'erp', 'portal', 'batch', 'bulk', 'hall ticket', 'rules', 'regulation', 'help', 'hi',
    'hello', 'hey', 'who are you', 'what can you do', 'today', 'tomorrow', 'miss', 'skip', 'bunk'
  ];

  function isErpRelated(query) {
    const q = query.toLowerCase().trim();
    if (q.length <= 2) return true; // short greetings
    // Check if any domain keyword is in query
    return ERP_DOMAIN_KEYWORDS.some(kw => q.includes(kw));
  }

  // Role-Specific Quick Suggestion Chips
  const SUGGESTIONS = {
    student: [
      'What is my current attendance %?',
      'Am I eligible for Anna University exams?',
      'How many classes can I miss safely?',
      'How do I apply for On-Duty (OD)?',
      'Who is my faculty mentor?'
    ],
    faculty: [
      'Show my schedule for today',
      'How do I reallocate a period?',
      'How does the 10-minute lock rule work?',
      'How do I apply Batch OD for students?',
      'Show my mentee defaulters list'
    ],
    hod: [
      'Department attendance health summary',
      'How many defaulters in our department?',
      'How do I approve period unlock requests?',
      'How to generate parent warning letters?',
      'View faculty reallocation status'
    ],
    admin: [
      'Institution-wide attendance overview',
      'Anna University exam compliance summary',
      'Compare department attendance rates',
      'How to manage timetable and faculty',
      'How to export semester attendance reports'
    ]
  };

  /**
   * Core AI Response Generator (Local Reasoning Engine)
   */
  function generateAiResponse(query, user) {
    const q = query.toLowerCase().trim();
    const role = user ? user.role : 'student';

    // 1. Strict Domain Filter
    if (!isErpRelated(q)) {
      return `
        <p>🔒 <strong>SCAD ERP Local Guard:</strong></p>
        <p>I am the inbuilt SCAD ERP Assistant dedicated <em>strictly</em> to college attendance, timetable schedules, Anna University regulations, and campus portal operations.</p>
        <p>I cannot assist with queries outside the SCAD ERP system. Please ask an attendance, schedule, or academic workflow question!</p>
      `;
    }

    // 2. Greetings / Identity
    if (/^(hi|hello|hey|help|who are you|what can you do|about)/i.test(q)) {
      const roleTitles = {
        student: 'Student Academic Copilot',
        faculty: 'Faculty Workflow Assistant',
        hod: 'Department Head Intelligence Copilot',
        admin: 'Institutional ERP Assistant'
      };
      return `
        <p>👋 Hello, <strong>${user ? user.name : 'there'}</strong>! I am your <strong>SCAD ERP ${roleTitles[role] || 'Assistant'}</strong>.</p>
        <p>I provide instant, private, offline answers about:</p>
        <ul>
          <li>Real-time attendance tracking & projections</li>
          <li>Class timetables & period reallocations</li>
          <li>Anna University attendance rules & condonation</li>
          <li>On-Duty (OD) application & batch approvals</li>
        </ul>
        <p>Try clicking one of the suggested questions above or ask me directly!</p>
      `;
    }

    // 3. Creators / Development Query
    if (q.includes('creator') || q.includes('developer') || q.includes('who made') || q.includes('narasimman') || q.includes('jeffrey')) {
      return `
        <p>🎓 <strong>SCAD Attendance ERP Credits:</strong></p>
        <p>This ERP system was designed and developed by:</p>
        <p style="padding:6px 10px; background:rgba(27,94,32,0.08); border-radius:6px; border-left:3px solid #1b5e20;">
          <strong>Narasimman P</strong> and <strong>Jeffrey Ryan R</strong><br>
          <small>Students of Computer Science & Engineering (CSE) Department<br>SCAD College of Engineering & Technology</small>
        </p>
      `;
    }

    // 4. Role-Specific Handlers
    if (role === 'student') {
      return handleStudentQuery(q, user);
    } else if (role === 'faculty') {
      return handleFacultyQuery(q, user);
    } else if (role === 'hod') {
      return handleHodQuery(q, user);
    } else if (role === 'admin') {
      return handleAdminQuery(q, user);
    }

    return handleGeneralQuery(q);
  }

  // ==========================================
  // STUDENT QUERIES HANDLER
  // ==========================================
  function handleStudentQuery(q, user) {
    const students = (window.MockData && typeof window.MockData.getStudentsList === 'function') 
      ? window.MockData.getStudentsList() 
      : [];
    const student = students.find(s => s.regNo === (user ? user.username : '')) || students[0];

    // Attendance % or status query
    if (q.includes('my attendance') || q.includes('attendance %') || q.includes('current attendance') || q.includes('status')) {
      if (!student) return `<p>Could not locate student record. Please ensure you are logged in.</p>`;
      
      const pct = student.attendance || 85;
      const totalHours = student.totalHours || 90;
      const attendedHours = student.attendedHours || Math.round((pct / 100) * totalHours);
      
      let badgeClass = 'scad-ai-msg__badge--ok';
      let statusText = 'Eligible for End-Semester Examinations';
      if (pct < 65) {
        badgeClass = 'scad-ai-msg__badge--danger';
        statusText = 'Critical Shortage — Ineligible (Semester Redo)';
      } else if (pct < 75) {
        badgeClass = 'scad-ai-msg__badge--warn';
        statusText = 'Shortage Warning — Requires Medical/Condonation Approval';
      }

      return `
        <p>📊 <strong>Attendance Status for ${student.name} (${student.regNo}):</strong></p>
        <p>
          Overall Attendance: <strong style="font-size:1.15rem; color:#1b5e20;">${pct}%</strong><br>
          Sessions Attended: <strong>${attendedHours}</strong> / ${totalHours} Total Hours
        </p>
        <div class="scad-ai-msg__badge ${badgeClass}">${statusText}</div>
        <p style="margin-top:6px; font-size:0.8rem; color:#666;">
          ${pct >= 75 ? '✓ You comfortably satisfy the mandatory 75% Anna University requirement.' : '⚠ You need to attend upcoming sessions to reach 75%.'}
        </p>
      `;
    }

    // "How many classes can I miss?" / "What if I miss X classes?"
    if (q.includes('miss') || q.includes('skip') || q.includes('bunk') || q.includes('leave') || q.includes('safe')) {
      if (!student) return `<p>Please log in to calculate class projections.</p>`;
      
      const pct = student.attendance || 85;
      const total = student.totalHours || 90;
      const attended = student.attendedHours || Math.round((pct / 100) * total);

      // Check if specific number requested, e.g. "miss 3 classes"
      const match = q.match(/(\d+)/);
      if (match) {
        const numToMiss = parseInt(match[1], 10);
        const newTotal = total + numToMiss;
        const newPct = Math.round((attended / newTotal) * 100);
        const diff = pct - newPct;
        const safe = newPct >= 75;

        return `
          <p>🧮 <strong>Projection for Missing ${numToMiss} Class${numToMiss > 1 ? 'es' : ''}:</strong></p>
          <p>
            Current Attendance: <strong>${pct}%</strong> (${attended}/${total})<br>
            Projected Attendance: <strong style="color:${safe ? '#2E7D32' : '#C62828'}; font-size:1.05rem;">${newPct}%</strong> (${attended}/${newTotal})<br>
            Impact: <strong>-${diff}%</strong> reduction
          </p>
          <div class="scad-ai-msg__badge ${safe ? 'scad-ai-msg__badge--ok' : 'scad-ai-msg__badge--danger'}">
            ${safe ? `✓ Safe! You remain above the 75% Anna University threshold.` : `✗ Warning! This will drop you below the 75% eligibility mark.`}
          </div>
        `;
      }

      // Calculate maximum safe classes to miss
      // attended / (total + X) >= 0.75  =>  X <= (attended / 0.75) - total
      const maxMiss = Math.max(0, Math.floor((attended / 0.75) - total));
      
      return `
        <p>🎯 <strong>Safe Absence Allowance:</strong></p>
        <p>With your current attendance of <strong>${pct}%</strong> (${attended}/${total} hours):</p>
        <p style="padding:6px 10px; background:rgba(46,125,50,0.1); border-radius:6px;">
          You can safely miss up to <strong style="color:#1b5e20; font-size:1.05rem;">${maxMiss} more hour${maxMiss === 1 ? '' : 's'}</strong> without dropping below the mandatory 75% limit.
        </p>
        <p style="font-size:0.8rem; color:#666;">Tip: Reserve your permitted absences for emergencies or certified On-Duty events.</p>
      `;
    }

    // "How many classes to reach 75% or 80%?"
    if (q.includes('reach 75') || q.includes('reach 80') || q.includes('improve') || q.includes('increase')) {
      if (!student) return `<p>Please log in to view targets.</p>`;
      const total = student.totalHours || 90;
      const attended = student.attendedHours || Math.round((student.attendance / 100) * total);
      
      const targetPct = q.includes('80') ? 80 : 75;
      const targetDec = targetPct / 100;
      
      if (attended / total >= targetDec) {
        return `
          <p>🎉 <strong>Goal Already Achieved!</strong></p>
          <p>Your current attendance is <strong>${student.attendance}%</strong>, which is already above your target of <strong>${targetPct}%</strong>!</p>
        `;
      }

      // (attended + Y) / (total + Y) >= targetDec  =>  Y >= (targetDec*total - attended) / (1 - targetDec)
      const needed = Math.ceil((targetDec * total - attended) / (1 - targetDec));

      return `
        <p>📈 <strong>Recovery Plan to Reach ${targetPct}%:</strong></p>
        <p>Current: <strong>${student.attendance}%</strong> (${attended}/${total})</p>
        <p style="padding:6px 10px; background:rgba(230,81,0,0.1); border-radius:6px; border-left:3px solid #e65100;">
          You must attend the next <strong style="color:#e65100; font-size:1.05rem;">${needed} consecutive sessions</strong> without absence to reach ${targetPct}%.
        </p>
      `;
    }

    // Anna University Rules / Exam Eligibility
    if (q.includes('anna university') || q.includes('exam') || q.includes('rule') || q.includes('regulation') || q.includes('condonation')) {
      return `
        <p>🏛 <strong>Anna University Attendance Regulations:</strong></p>
        <ul>
          <li><strong>75% and Above:</strong> Fully eligible for End-Semester Examinations without restriction.</li>
          <li><strong>65% to 74%:</strong> Ineligible by default. Can apply for <em>Condonation</em> strictly on genuine medical grounds or approved sports/NSS/institutional On-Duty representation with prescribed condonation fee.</li>
          <li><strong>Below 65%:</strong> Critical shortage. Not eligible for condonation; must redo the semester when offered in subsequent academic cycles.</li>
        </ul>
      `;
    }

    // On-Duty (OD)
    if (q.includes('on duty') || q.includes('od') || q.includes('sports') || q.includes('symposium')) {
      return `
        <p>📋 <strong>On-Duty (OD) Application Guidelines:</strong></p>
        <ul>
          <li><strong>What is OD?</strong> Official duty leave granted for sports tournaments, paper presentations, symposiums, or university events.</li>
          <li><strong>Attendance Credit:</strong> Approved OD periods are credited as <strong style="color:#2E7D32;">Present</strong> in your biometric ERP record.</li>
          <li><strong>How to Submit:</strong> Submit your event invitation or Physical Education letter to your Faculty Advisor / HOD. They can apply a <strong>Batch OD</strong> directly onto your timetable slots.</li>
        </ul>
      `;
    }

    // Mentor / Advisor Details
    if (q.includes('mentor') || q.includes('counselor') || q.includes('advisor')) {
      return `
        <p>👨‍🏫 <strong>Your Assigned Faculty Mentor:</strong></p>
        <p>
          Name: <strong>${student.mentor || 'Dr. S. Ramesh'}</strong><br>
          Department: <strong>${student.department || 'CSE'}</strong><br>
          Role: Class Advisor &amp; Academic Mentor
        </p>
        <p style="font-size:0.82rem; color:#666;">You can consult your mentor for attendance condonation, leave approvals, and academic counseling.</p>
      `;
    }

    return handleGeneralQuery(q);
  }

  // ==========================================
  // FACULTY QUERIES HANDLER
  // ==========================================
  function handleFacultyQuery(q, user) {
    const todayStr = new Date().toISOString().split('T')[0];

    // Today's schedule
    if (q.includes('schedule') || q.includes('today') || q.includes('classes') || q.includes('my class')) {
      const sched = (window.Timetable && typeof window.Timetable.getFacultySchedule === 'function')
        ? window.Timetable.getFacultySchedule(user.facultyId || user.username, todayStr)
        : [];

      const activePeriods = sched.filter(s => s.type !== 'free' && s.subjectCode !== 'FREE');

      if (activePeriods.length === 0) {
        return `
          <p>📅 <strong>Today's Schedule:</strong></p>
          <p>You have no scheduled teaching periods for today. All periods are free!</p>
        `;
      }

      let html = `<p>📅 <strong>Your Schedule for Today (${activePeriods.length} Teaching Hours):</strong></p><ul>`;
      activePeriods.forEach(p => {
        html += `<li><strong>Period ${p.period.num || p.period}</strong> (${p.period.time || '09:00 - 09:50'}): <strong>${p.subjectCode}</strong> — ${p.classLabel}</li>`;
      });
      html += `</ul><p style="font-size:0.8rem; color:#666;">Select any period in the table to mark student attendance.</p>`;
      return html;
    }

    // Period Reallocation
    if (q.includes('reallocate') || q.includes('swap') || q.includes('substitute') || q.includes('reallocation')) {
      return `
        <p>🔄 <strong>Period Reallocation &amp; Substitution:</strong></p>
        <ul>
          <li><strong>How it works:</strong> Click the <strong>Reallocate</strong> button next to any of your periods in the schedule table.</li>
          <li><strong>Faculty List:</strong> The dropdown lists all colleagues. Genuinely free faculty are tagged <strong>🟢 Available</strong>; colleagues teaching other classes are tagged <strong>🟡 Class Swap</strong>.</li>
          <li><strong>Acceptance:</strong> When your colleague logs in, an <em>Incoming Reallocation Request</em> card appears on their dashboard. Once accepted, the period transfers into their schedule with <code>(Reallocated)</code>.</li>
        </ul>
      `;
    }

    // 10-Minute Lock Rule
    if (q.includes('lock') || q.includes('10 min') || q.includes('10 minute') || q.includes('window') || q.includes('unlock')) {
      return `
        <p>⏱ <strong>10-Minute Biometric Attendance Rule:</strong></p>
        <ul>
          <li><strong>Attendance Window:</strong> To maintain Anna University audit compliance, faculty can mark attendance strictly within the <strong>first 10 minutes</strong> of each scheduled period.</li>
          <li><strong>Period Expired?</strong> After 10 minutes, the slot locks automatically to prevent retrospective falsification.</li>
          <li><strong>Request Unlock:</strong> Click the <strong>Request HOD Unlock</strong> button to submit an authorization request with an official reason. Your HOD can unlock the slot instantly.</li>
        </ul>
      `;
    }

    // Batch On-Duty (OD)
    if (q.includes('batch od') || q.includes('bulk od') || q.includes('sports od') || q.includes('symposium od')) {
      return `
        <p>📋 <strong>Applying Batch On-Duty (OD):</strong></p>
        <ul>
          <li>Select the relevant period from your schedule.</li>
          <li>Click the <strong>Apply Batch OD</strong> button above the student table.</li>
          <li>Select multiple participating students via checkboxes (e.g. Football Team or Symposium Attendees).</li>
          <li>Enter the official event description and letter reference.</li>
          <li>Click Apply: all selected students will be credited as <strong style="color:#2E7D32;">On-Duty</strong> in one click!</li>
        </ul>
      `;
    }

    // Mentees / Defaulters
    if (q.includes('mentee') || q.includes('portfolio') || q.includes('defaulter')) {
      return `
        <p>👥 <strong>Mentee Portfolio Management:</strong></p>
        <p>Switch to the <strong>My Mentees Portfolio</strong> tab at the top of your portal to:</p>
        <ul>
          <li>View complete academic, CGPA, and attendance profiles for your assigned ward students.</li>
          <li>Filter students by <em>Attendance Defaulters (&lt;75%)</em>, <em>Top CGPA</em>, or <em>Has Arrears</em>.</li>
          <li>Generate and preview formal <strong>Official Warning Letters</strong> for parents with one click.</li>
        </ul>
      `;
    }

    return handleGeneralQuery(q);
  }

  // ==========================================
  // HOD QUERIES HANDLER
  // ==========================================
  function handleHodQuery(q, user) {
    const dept = user.department || 'CSE';

    if (q.includes('health') || q.includes('stats') || q.includes('overview') || q.includes('summary')) {
      const stats = (window.MockData && typeof window.MockData.getStats === 'function') 
        ? window.MockData.getStats(dept) 
        : { totalStudents: 120, avgAttendance: 84.5, defaultersCount: 14 };

      return `
        <p>📊 <strong>${dept} Department Attendance Health:</strong></p>
        <ul>
          <li>Average Department Attendance: <strong style="color:#1b5e20; font-size:1.1rem;">${stats.avgAttendance || 85}%</strong></li>
          <li>Total Enrolled Students: <strong>${stats.totalStudents || 120}</strong></li>
          <li>Students with Shortage (&lt;75%): <strong style="color:#c62828;">${stats.defaultersCount || 12}</strong></li>
        </ul>
        <p style="font-size:0.8rem; color:#666;">Department overall standing complies with Anna University accreditation parameters.</p>
      `;
    }

    if (q.includes('defaulter') || q.includes('shortage') || q.includes('critical')) {
      const defaulters = (window.MockData && typeof window.MockData.getDefaulters === 'function')
        ? window.MockData.getDefaulters(dept, 75)
        : [];

      return `
        <p>⚠ <strong>Department Defaulters (&lt;75% Attendance):</strong></p>
        <p>There are currently <strong>${defaulters.length}</strong> students requiring intervention in ${dept}.</p>
        <p>You can use the <strong>Defaulters Report</strong> table to dispatch automated parent warning letters or summon students for academic counseling.</p>
      `;
    }

    if (q.includes('unlock') || q.includes('extension') || q.includes('approve')) {
      return `
        <p>🔓 <strong>Period Unlock Authorization:</strong></p>
        <p>When a faculty member misses the 10-minute window, their request arrives in your portal:</p>
        <ul>
          <li>Review the faculty member's reason (e.g. lab setup, power glitch).</li>
          <li>Granting an unlock opens a <strong>15-minute grace period</strong> allowing biometric entry to be completed.</li>
          <li>All unlock approvals are logged with timestamp for University audit records.</li>
        </ul>
      `;
    }

    return handleGeneralQuery(q);
  }

  // ==========================================
  // ADMIN QUERIES HANDLER
  // ==========================================
  function handleAdminQuery(q, user) {
    if (q.includes('overview') || q.includes('institution') || q.includes('campus') || q.includes('college')) {
      const stats = (window.MockData && typeof window.MockData.getStats === 'function')
        ? window.MockData.getStats('ALL')
        : { totalStudents: 640, avgAttendance: 86.2, defaultersCount: 48 };

      return `
        <p>🏛 <strong>SCAD College Institutional Overview:</strong></p>
        <ul>
          <li>Total Enrolled Students: <strong>${stats.totalStudents || 640}</strong></li>
          <li>Campus-wide Attendance Average: <strong style="color:#1b5e20; font-size:1.1rem;">${stats.avgAttendance || 86.2}%</strong></li>
          <li>Total Defaulters (&lt;75%): <strong style="color:#c62828;">${stats.defaultersCount || 48}</strong></li>
          <li>Active Engineering Departments: <strong>CSE, ECE, EEE, MECH, CIVIL, S&amp;H</strong></li>
        </ul>
      `;
    }

    if (q.includes('compliance') || q.includes('anna university') || q.includes('audit')) {
      return `
        <p>📜 <strong>Anna University Compliance Dashboard:</strong></p>
        <ul>
          <li><strong>Biometric Integrity:</strong> Enforced with 10-minute automated locking and HOD escalation audits.</li>
          <li><strong>Exam Eligibility:</strong> Calculated as per Regulation 2021 (75% threshold, 65-74% condonation band).</li>
          <li><strong>Reports Export:</strong> You can export Form 4 / University attendance submission reports via the Reports Portal.</li>
        </ul>
      `;
    }

    return handleGeneralQuery(q);
  }

  // ==========================================
  // GENERAL FALLBACK & NAVIGATION QUERIES
  // ==========================================
  function handleGeneralQuery(q) {
    if (q.includes('password') || q.includes('security question') || q.includes('change password')) {
      return `
        <p>🔐 <strong>Password &amp; Account Security:</strong></p>
        <p>You can change your password anytime via the left sidebar menu &rarr; <strong>Change Password</strong>.</p>
        <p>Passwords must contain at least 8 characters, one uppercase letter, one lowercase letter, and a number.</p>
        <a href="change-password.html" class="scad-ai-msg__btn-link">Go to Change Password</a>
      `;
    }

    if (q.includes('dark mode') || q.includes('theme') || q.includes('light mode')) {
      return `
        <p>🌙 <strong>Theme Customization:</strong></p>
        <p>Click the <strong>Theme Toggle</strong> (Moon/Sun icon) at the top right of the topbar to instantly toggle between Dark Mode and Light Mode.</p>
      `;
    }

    return `
      <p>💡 <strong>I can help with:</strong></p>
      <ul>
        <li>Current attendance percentages &amp; exam eligibility</li>
        <li>Safe absence limits &amp; attendance projection calculator</li>
        <li>Class timetable periods &amp; faculty reallocation</li>
        <li>Anna University 75% regulations &amp; condonation rules</li>
        <li>On-Duty (OD) application &amp; 10-minute lock rules</li>
      </ul>
      <p style="font-size:0.8rem; color:#666;">Try clicking one of the suggested chips above!</p>
    `;
  }

  /**
   * DOM Elements Construction & Mounting
   */
  function initAiWidget() {
    // Only init if user is authenticated
    const currentUser = (window.Auth && typeof window.Auth.getCurrentUser === 'function')
      ? window.Auth.getCurrentUser()
      : null;

    if (!currentUser) return; // do not show on unauthenticated login page

    AI_STATE.user = currentUser;
    AI_STATE.role = currentUser.role || 'student';

    // Prevent duplicate injection
    if (document.getElementById('scad-ai-fab')) return;

    // 1. Floating Action Button (FAB)
    const fab = document.createElement('button');
    fab.id = 'scad-ai-fab';
    fab.className = 'scad-ai-fab';
    fab.setAttribute('aria-label', 'Open SCAD ERP AI Assistant');
    fab.innerHTML = `
      <span class="scad-ai-fab__icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
        </svg>
      </span>
      <span class="scad-ai-fab__text">SCAD AI</span>
      <span class="scad-ai-fab__badge">${AI_STATE.role}</span>
    `;

    // 2. Chat Window Container
    const win = document.createElement('div');
    win.id = 'scad-ai-window';
    win.className = 'scad-ai-window';

    const roleLabels = {
      student: 'Student Academic Copilot',
      faculty: 'Faculty Workflow Assistant',
      hod: 'HOD Department Assistant',
      admin: 'Campus Intelligence Copilot'
    };

    win.innerHTML = `
      <div class="scad-ai-header">
        <div class="scad-ai-header__left">
          <div class="scad-ai-header__avatar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10H12V2z"></path>
              <path d="M12 12L2.1 12a10 10 0 0 0 9.9 10"></path>
              <path d="M12 12L19.1 5"></path>
            </svg>
          </div>
          <div class="scad-ai-header__info">
            <h3 class="scad-ai-header__title">SCAD ERP AI</h3>
            <p class="scad-ai-header__subtitle">${roleLabels[AI_STATE.role] || 'Local Inbuilt Assistant'}</p>
          </div>
        </div>
        <div class="scad-ai-header__actions">
          <button type="button" class="scad-ai-btn-icon" id="scad-ai-clear" title="Clear chat history">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
          <button type="button" class="scad-ai-btn-icon" id="scad-ai-close" title="Close AI Assistant">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <div class="scad-ai-body" id="scad-ai-body">
        <div class="scad-ai-msg scad-ai-msg--bot">
          <div class="scad-ai-msg__avatar">✦</div>
          <div class="scad-ai-msg__bubble">
            <p>Hello <strong>${currentUser.name || 'there'}</strong>! I am your <strong>SCAD ERP Assistant</strong>.</p>
            <p>How can I assist you with your attendance, timetable, or academic records today?</p>
            <div class="scad-ai-chips" id="scad-ai-chips"></div>
          </div>
        </div>
      </div>

      <div class="scad-ai-footer">
        <form class="scad-ai-form" id="scad-ai-form" autocomplete="off">
          <input type="text" id="scad-ai-input" class="scad-ai-input" placeholder="Ask about attendance, timetable, rules..." required />
          <button type="submit" class="scad-ai-send" id="scad-ai-send" aria-label="Send query">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>
        <div class="scad-ai-disclaimer">Local Inbuilt AI Engine • Zero Cloud Dependency • Strictly Academic</div>
      </div>
    `;

    document.body.appendChild(fab);
    document.body.appendChild(win);

    // Populate suggestions
    populateSuggestionChips();

    // Event Listeners
    fab.onclick = toggleAiWindow;
    document.getElementById('scad-ai-close').onclick = closeAiWindow;
    document.getElementById('scad-ai-clear').onclick = clearChatHistory;

    document.getElementById('scad-ai-form').onsubmit = function(e) {
      e.preventDefault();
      const input = document.getElementById('scad-ai-input');
      const val = input.value.trim();
      if (!val) return;
      input.value = '';
      sendUserQuery(val);
    };
  }

  function populateSuggestionChips() {
    const container = document.getElementById('scad-ai-chips');
    if (!container) return;
    const chips = SUGGESTIONS[AI_STATE.role] || SUGGESTIONS.student;
    container.innerHTML = chips.map(c => `
      <button type="button" class="scad-ai-chip">${c}</button>
    `).join('');

    container.querySelectorAll('.scad-ai-chip').forEach(btn => {
      btn.onclick = function() {
        sendUserQuery(this.innerText);
      };
    });
  }

  function toggleAiWindow() {
    if (AI_STATE.isOpen) {
      closeAiWindow();
    } else {
      openAiWindow();
    }
  }

  function openAiWindow() {
    const win = document.getElementById('scad-ai-window');
    if (!win) return;
    win.classList.add('open');
    AI_STATE.isOpen = true;
    setTimeout(() => {
      const input = document.getElementById('scad-ai-input');
      if (input && window.innerWidth > 768) input.focus();
    }, 150);
  }

  function closeAiWindow() {
    const win = document.getElementById('scad-ai-window');
    if (!win) return;
    win.classList.remove('open');
    AI_STATE.isOpen = false;
  }

  function clearChatHistory() {
    const body = document.getElementById('scad-ai-body');
    if (!body) return;
    body.innerHTML = `
      <div class="scad-ai-msg scad-ai-msg--bot">
        <div class="scad-ai-msg__avatar">✦</div>
        <div class="scad-ai-msg__bubble">
          <p>Chat cleared. Ask me anything about your SCAD ERP attendance, timetable, or academic records!</p>
          <div class="scad-ai-chips" id="scad-ai-chips"></div>
        </div>
      </div>
    `;
    populateSuggestionChips();
  }

  function sendUserQuery(text) {
    const body = document.getElementById('scad-ai-body');
    if (!body) return;

    // Append User Message
    const userMsg = document.createElement('div');
    userMsg.className = 'scad-ai-msg scad-ai-msg--user';
    userMsg.innerHTML = `<div class="scad-ai-msg__bubble">${escapeHtml(text)}</div>`;
    body.appendChild(userMsg);
    body.scrollTop = body.scrollHeight;

    // Show Typing Indicator
    const typingMsg = document.createElement('div');
    typingMsg.className = 'scad-ai-msg scad-ai-msg--bot scad-ai-typing-wrap';
    typingMsg.innerHTML = `
      <div class="scad-ai-msg__avatar">✦</div>
      <div class="scad-ai-msg__bubble">
        <div class="scad-ai-typing">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    body.appendChild(typingMsg);
    body.scrollTop = body.scrollHeight;

    // Simulate instant local intelligence delay (250-400ms for natural feel)
    setTimeout(() => {
      typingMsg.remove();
      const botResponse = generateAiResponse(text, AI_STATE.user);
      const botMsg = document.createElement('div');
      botMsg.className = 'scad-ai-msg scad-ai-msg--bot';
      botMsg.innerHTML = `
        <div class="scad-ai-msg__avatar">✦</div>
        <div class="scad-ai-msg__bubble">${botResponse}</div>
      `;
      body.appendChild(botMsg);
      body.scrollTop = body.scrollHeight;
    }, 320);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.innerText = str;
    return div.innerHTML;
  }

  // Auto initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAiWidget);
  } else {
    initAiWidget();
  }

  // Export for programmatic access if needed
  window.ScadAi = {
    open: openAiWindow,
    close: closeAiWindow,
    ask: sendUserQuery,
    init: initAiWidget
  };

})();
