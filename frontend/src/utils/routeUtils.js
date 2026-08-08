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
    case 'IQAC':
      return 'iqac';
    case UserRole.HR_TEAM:
    case 'HR':
      return 'hr';
    case UserRole.AUDIO_TEAM:
    case 'AUDIO':
      return 'audio';
    case UserRole.PRINCIPAL:
      return 'principal';
    case UserRole.SYSTEM_ADMIN:
    case 'ADMIN':
      return 'admin';
    case UserRole.TRANSPORT_TEAM:
    case 'TRANSPORT':
      return 'transport';
    case UserRole.BOYS_WARDEN:
    case 'WARDEN/BOYS':
      return 'warden/boys';
    case UserRole.GIRLS_WARDEN:
    case 'WARDEN/GIRLS':
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
  'principal',
  'transport',
  'warden/boys',
  'warden/girls',
  'media'
];
