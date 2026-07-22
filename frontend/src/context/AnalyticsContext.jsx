import React, { createContext, useContext, useMemo, useState } from 'react';
import { useAppContext } from './AppContext';
import { useCalendarContext } from './CalendarContext';
import { EventStatus } from '../types';

const AnalyticsContext = createContext(null);

export const useAnalyticsContext = () => {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalyticsContext must be used within AnalyticsProvider');
  }
  return context;
};

export const AnalyticsProvider = ({ children }) => {
  const { currentUser, events, students, staffUsers, odRequests } = useAppContext();
  const { academicYears, semesters, holidays, exams, departmentCalendar } = useCalendarContext();

  const [filters, setFilters] = useState({
    academicYear: '',
    department: '',
    category: '',
    status: ''
  });

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
       if (filters.academicYear && e.academicYear !== filters.academicYear) return false;
       if (filters.department && e.department !== filters.department) return false;
       if (filters.category && e.eventType !== filters.category) return false;
       if (filters.status && e.status !== filters.status) return false;
       return true;
    });
  }, [events, filters]);

  const metrics = useMemo(() => {
    if (!currentUser) return null;

    const role = currentUser.role;
    const userDepartment = currentUser.department;

    // Common Computations
    const approvedEvents = filteredEvents.filter(e => e.status === EventStatus.APPROVED);
    const completedEvents = filteredEvents.filter(e => e.status === EventStatus.COMPLETED);
    const pendingEvents = filteredEvents.filter(e => [EventStatus.PENDING_FACULTY, EventStatus.PENDING_HOD, EventStatus.PENDING_IQAC, EventStatus.PENDING_PRINCIPAL].includes(e.status));
    const rejectedEvents = filteredEvents.filter(e => e.status === EventStatus.REJECTED);

    const calcAttendanceAndFeedback = (filteredRequests) => {
      const requests = Array.isArray(filteredRequests) ? filteredRequests : [];
      const withAttendance = requests.filter(r => r.attendanceStatus && r.attendanceStatus !== 'NOT_ATTENDED');
      const withFeedback = requests.filter(r => r.feedback);
      
      const attendanceCount = withAttendance.length;
      const registrationCount = requests.length;
      const attendancePercentage = registrationCount > 0 ? (attendanceCount / registrationCount) * 100 : 0;
      
      let totalRating = 0;
      withFeedback.forEach(r => {
         const fb = r.feedback;
         const avg = (Number(fb.q1) + Number(fb.q2) + Number(fb.q3) + Number(fb.q4) + Number(fb.q5)) / 5;
         totalRating += avg || 0;
      });
      const avgFeedback = withFeedback.length > 0 ? totalRating / withFeedback.length : 0;
      
      return { registrationCount, attendanceCount, attendancePercentage, feedbackCount: withFeedback.length, avgFeedback };
    };

    // Role Specific Metrics
    let data = {
       kpis: {},
       charts: {}
    };

    if (role === 'IQAC_TEAM' || role === 'SYSTEM_ADMIN' || role === 'PRINCIPAL') {
      const stats = calcAttendanceAndFeedback(odRequests);
      
      data.kpis = {
        totalEvents: filteredEvents.length,
        approvedEvents: approvedEvents.length,
        pendingEvents: pendingEvents.length,
        completedEvents: completedEvents.length,
        totalStudents: students.length,
        totalFaculty: staffUsers.length,
        avgAttendance: `${Math.round(stats.attendancePercentage)}%`,
        avgFeedback: stats.avgFeedback.toFixed(1)
      };

      // Charts data
      const deptCounts = {};
      filteredEvents.forEach(e => {
        if(e.department) {
           deptCounts[e.department] = (deptCounts[e.department] || 0) + 1;
        }
      });
      data.charts.deptEvents = Object.keys(deptCounts).map(d => ({ name: d, count: deptCounts[d] }));

      const catCounts = {};
      filteredEvents.forEach(e => {
        if(e.eventType) {
           catCounts[e.eventType] = (catCounts[e.eventType] || 0) + 1;
        }
      });
      data.charts.categoryEvents = Object.keys(catCounts).map(c => ({ name: c, count: catCounts[c] }));

    } else if (role === 'HOD') {
      const deptEvents = filteredEvents.filter(e => e.department === userDepartment);
      const deptRequests = odRequests.filter(r => r.department === userDepartment);
      const stats = calcAttendanceAndFeedback(deptRequests);

      data.kpis = {
        totalEvents: deptEvents.length,
        completedEvents: deptEvents.filter(e => e.status === EventStatus.COMPLETED).length,
        studentParticipation: stats.registrationCount,
        avgAttendance: `${Math.round(stats.attendancePercentage)}%`,
        avgFeedback: stats.avgFeedback.toFixed(1)
      };

      const catCounts = {};
      deptEvents.forEach(e => {
        if(e.eventType) {
           catCounts[e.eventType] = (catCounts[e.eventType] || 0) + 1;
        }
      });
      data.charts.categoryEvents = Object.keys(catCounts).map(c => ({ name: c, count: catCounts[c] }));

    } else if (role === 'CLASS_ADVISOR') {
      // Find assigned class students
      const myStudents = students.filter(s => s.classAdvisorEmail === currentUser.email || (s.department === userDepartment && s.section === currentUser.section && s.academicBatch === currentUser.academicBatch));
      const myStudentRolls = myStudents.map(s => s.rollNo);
      const myRequests = odRequests.filter(r => myStudentRolls.includes(r.rollNo));
      const stats = calcAttendanceAndFeedback(myRequests);

      data.kpis = {
        totalStudents: myStudents.length,
        eventRegistrations: myRequests.length,
        eventParticipation: stats.attendanceCount,
        attendancePercentage: `${Math.round(stats.attendancePercentage)}%`
      };
      
    } else if (role === 'FACULTY' || role === 'STUDENT') { // Organizer or Student
      if (role === 'STUDENT') {
         const myRequests = odRequests.filter(r => r.rollNo === (currentUser.rollNo || currentUser.email));
         const stats = calcAttendanceAndFeedback(myRequests);
         data.kpis = {
           registeredEvents: myRequests.length,
           attendedEvents: stats.attendanceCount,
           participationPercentage: `${Math.round(stats.attendancePercentage)}%`,
           feedbackSubmitted: stats.feedbackCount
         };
      } else {
         const myOrganizedEvents = filteredEvents.filter(e => e.organizerEmail === currentUser.email);
         const eventIds = myOrganizedEvents.map(e => e.id);
         const myRequests = odRequests.filter(r => eventIds.includes(r.eventId));
         const stats = calcAttendanceAndFeedback(myRequests);

         data.kpis = {
           eventsOrganized: myOrganizedEvents.length,
           registrations: stats.registrationCount,
           attendance: stats.attendanceCount,
           avgFeedback: stats.avgFeedback.toFixed(1)
         };
      }
    }

    return data;
  }, [filteredEvents, students, staffUsers, odRequests, currentUser, academicYears, semesters, holidays, exams, departmentCalendar]);

  return (
    <AnalyticsContext.Provider value={{ metrics, filters, setFilters, filteredEvents }}>
      {children}
    </AnalyticsContext.Provider>
  );
};
