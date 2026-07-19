import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  subscribeToAcademicYears,
  subscribeToSemesters,
  subscribeToHolidays,
  subscribeToExams,
  subscribeToWorkingDays,
  subscribeToDepartmentCalendar
} from '../services/firebaseService';

const CalendarContext = createContext(null);

export const useCalendarContext = () => {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendarContext must be used within CalendarProvider');
  }
  return context;
};

export const CalendarProvider = ({ children }) => {
  const [academicYears, setAcademicYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [exams, setExams] = useState([]);
  const [workingDays, setWorkingDays] = useState({});
  const [departmentCalendar, setDepartmentCalendar] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubs = [];

    unsubs.push(subscribeToAcademicYears((data) => {
      setAcademicYears(data);
    }));

    unsubs.push(subscribeToSemesters((data) => {
      setSemesters(data);
    }));

    unsubs.push(subscribeToHolidays((data) => {
      setHolidays(data);
    }));

    unsubs.push(subscribeToExams((data) => {
      setExams(data);
    }));

    unsubs.push(subscribeToWorkingDays((data) => {
      setWorkingDays(data);
    }));

    unsubs.push(subscribeToDepartmentCalendar((data) => {
      setDepartmentCalendar(data);
      setLoading(false); // Approximation
    }));

    return () => {
      unsubs.forEach(unsub => unsub && unsub());
    };
  }, []);

  const getActiveAcademicYear = () => {
    return academicYears.find(ay => ay.status === 'ACTIVE') || null;
  };

  const getActiveSemester = (dateStr) => {
    const ay = getActiveAcademicYear();
    if (!ay) return null;
    const date = new Date(dateStr);
    
    return semesters.find(sem => {
      if (sem.academicYear !== ay.name) return false;
      const start = new Date(sem.startDate);
      const end = new Date(sem.endDate);
      start.setHours(0,0,0,0);
      end.setHours(23,59,59,999);
      return date >= start && date <= end;
    }) || null;
  };

  const getOverlappingHolidays = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0,0,0,0);
    end.setHours(23,59,59,999);

    return holidays.filter(h => {
      const hDate = new Date(h.date);
      return hDate >= start && hDate <= end;
    });
  };

  const getOverlappingExams = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0,0,0,0);
    end.setHours(23,59,59,999);

    return exams.filter(exam => {
      const eStart = new Date(exam.startDate);
      const eEnd = new Date(exam.endDate);
      eStart.setHours(0,0,0,0);
      eEnd.setHours(23,59,59,999);
      return eStart <= end && eEnd >= start;
    });
  };

  const checkWorkingDays = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0,0,0,0);
    end.setHours(23,59,59,999);

    const nonWorking = [];
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    let curr = new Date(start);
    while (curr <= end) {
      const dayName = days[curr.getDay()];
      if (workingDays[dayName] === false) {
        nonWorking.push(new Date(curr).toISOString().split('T')[0]);
      }
      curr.setDate(curr.getDate() + 1);
    }
    return nonWorking;
  };

  const value = {
    academicYears,
    semesters,
    holidays,
    exams,
    workingDays,
    departmentCalendar,
    loading,
    getActiveAcademicYear,
    getActiveSemester,
    getOverlappingHolidays,
    getOverlappingExams,
    checkWorkingDays
  };

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
};
