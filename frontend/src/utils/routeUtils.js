import { UserRole } from '../types';

export const getRolePath = (role) => {
  if (!role) return '';
  switch (role) {
    case UserRole.STUDENT_GENERAL:
      return 'student';
    case UserRole.STUDENT_ORGANIZER:
      return 'student/organizer';
    case UserRole.FACULTY:
      return 'faculty';
    case UserRole.HOD:
      return 'hod';
    case UserRole.IQAC_TEAM:
      return 'iqac';
    case UserRole.HR_TEAM:
      return 'hr';
    case UserRole.AUDIO_TEAM:
      return 'audio';
    case UserRole.SYSTEM_ADMIN:
      return 'admin';
    case UserRole.TRANSPORT_TEAM:
      return 'transport';
    case UserRole.BOYS_WARDEN:
      return 'warden/boys';
    case UserRole.GIRLS_WARDEN:
      return 'warden/girls';
    case UserRole.MEDIA:
      return 'media';
    default:
      return '';
  }
};

export const ROLE_PATHS = [
  'student',
  'student/organizer',
  'faculty',
  'hod',
  'iqac',
  'hr',
  'audio',
  'admin',
  'transport',
  'warden/boys',
  'warden/girls',
  'media'
];
