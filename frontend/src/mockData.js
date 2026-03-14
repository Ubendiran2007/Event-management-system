import { UserRole, EventStatus } from './types';

export const MOCK_USERS = [
  { id: 'f1', name: 'Dr. Arul Kumar', email: 'ubendiranl2007@gmail.com', role: UserRole.FACULTY },
  { id: 'h1', name: 'Dr. Meena Iyer', email: 'ubendirankumar@gmail.com', role: UserRole.HOD },
  { id: 'p1', name: 'Dr. S. Rajan', email: 'ubendiran.lakshmanan007@gmail.com', role: UserRole.PRINCIPAL },
  { id: 's1', name: 'John Doe', email: 'john@student.edu', role: UserRole.STUDENT_ORGANIZER, isApprovedOrganizer: true },
  { id: 's2', name: 'Jane Smith', email: 'jane@student.edu', role: UserRole.STUDENT_GENERAL },
  { id: 'm1', name: 'Media Team', email: 'raj220707ram@gmail.com', role: UserRole.MEDIA },
];

export const MOCK_EVENTS = [
  {
    id: 'e1',
    title: 'Hackathon 2024',
    description: 'A 24-hour coding challenge for CSE students.',
    organizerId: 's1',
    organizerName: 'John Doe',
    date: '2024-05-15',
    venue: 'Main Lab 1',
    status: EventStatus.APPROVED,
    media: { poster: true, brochure: true, photo: true, certificate: true },
    food: { available: true, vipMenu: 'Premium Buffet', generalMenu: 'Lunch Box' },
    guest: { name: 'Sundar Pichai (Mock)', details: 'CEO of Google', accommodation: true },
    itSupport: { desktop: true, lanWifi: true, numUsers: 100 },
    avSupport: { display: true, micColor: true, micHand: true, micPodium: true },
    createdAt: '2024-03-01',
  },
  {
    id: 'e2',
    title: 'AI Workshop',
    description: 'Introduction to Machine Learning and Neural Networks.',
    organizerId: 's1',
    organizerName: 'John Doe',
    date: '2024-06-10',
    venue: 'Seminar Hall B',
    status: EventStatus.PENDING_HOD,
    media: { poster: true, brochure: false, photo: true, certificate: true },
    food: { available: false, vipMenu: '', generalMenu: '' },
    guest: { name: 'Dr. Andrew Ng (Mock)', details: 'AI Researcher', accommodation: false },
    itSupport: { desktop: false, lanWifi: true, numUsers: 50 },
    avSupport: { display: true, micColor: false, micHand: true, micPodium: true },
    createdAt: '2024-03-10',
  }
];
