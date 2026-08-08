const { dbAdmin } = require('./firebaseAdmin');
const admin = require('firebase-admin');

async function seedNotifications() {
  const recipientId = 'student_24CS251'; // Target user

  const dummyNotifications = [
    {
      title: 'System Maintenance Scheduled',
      message: 'The system will be undergoing maintenance this Saturday from 2:00 AM to 4:00 AM. Please save your work.',
      category: 'SYSTEM',
      priority: 'LOW',
      status: 'DELIVERED',
      icon: 'info',
      color: 'blue'
    },
    {
      title: 'Registration Approved',
      message: 'Your registration for the "AI Workshop" has been approved by your department.',
      category: 'REGISTRATIONS',
      priority: 'MEDIUM',
      status: 'DELIVERED',
      icon: 'check-circle',
      color: 'green',
      deepLink: '/student/dashboard'
    },
    {
      title: 'OD Request Requires Revision',
      message: 'Your OD request for Hackathon needs some revisions. Please update the documentation attached.',
      category: 'OD',
      priority: 'HIGH',
      status: 'DELIVERED',
      icon: 'alert-circle',
      color: 'yellow',
      deepLink: '/student/od-requests'
    },
    {
      title: 'Event Approved by HOD',
      message: 'Your event "technovanam" has been approved by the HOD. It is now pending Principal approval.',
      category: 'EVENTS',
      priority: 'HIGH',
      status: 'DELIVERED',
      icon: 'check-circle',
      color: 'green'
    },
    {
      title: 'Critical Security Alert',
      message: 'We detected a new login from an unrecognized device. If this was not you, please reset your password immediately.',
      category: 'SYSTEM',
      priority: 'CRITICAL',
      status: 'DELIVERED',
      icon: 'alert-triangle',
      color: 'red'
    },
    {
      title: 'New Report Generated',
      message: 'Your requested attendance report for last month is now available for download.',
      category: 'REPORTS',
      priority: 'LOW',
      status: 'DELIVERED',
      icon: 'file-text',
      color: 'blue'
    },
    {
      title: 'Event Manager Request',
      message: 'You have been invited to be a manager for the upcoming "Coding Contest".',
      category: 'EVENTS',
      priority: 'MEDIUM',
      status: 'DELIVERED',
      icon: 'user-plus',
      color: 'blue',
      deepLink: '/student/create-event'
    },
    {
      title: 'OD Request Approved',
      message: 'Your OD for the Inter-College Symposium has been fully approved.',
      category: 'OD',
      priority: 'MEDIUM',
      status: 'DELIVERED',
      icon: 'check-circle',
      color: 'green'
    },
    {
      title: 'Reminder: Registration Closes Soon',
      message: 'Registration for "Tech Fiesta" closes in 24 hours. Complete your payment to secure your spot.',
      category: 'REGISTRATIONS',
      priority: 'HIGH',
      status: 'DELIVERED',
      icon: 'clock',
      color: 'yellow'
    },
    {
      title: 'Event Cancelled',
      message: 'Unfortunately, the "Guest Lecture on IoT" has been cancelled by the organizer.',
      category: 'EVENTS',
      priority: 'HIGH',
      status: 'DELIVERED',
      icon: 'alert-circle',
      color: 'red'
    }
  ];

  try {
    const batch = dbAdmin.batch();
    
    // Create notifications staggered in time over the last few hours
    const now = new Date();
    
    dummyNotifications.forEach((notif, index) => {
      const ref = dbAdmin.collection('notifications').doc();
      const timeOffset = (9 - index) * 45 * 60 * 1000; // stagger by 45 minutes
      
      const notifData = {
        ...notif,
        recipientId,
        createdAt: admin.firestore.Timestamp.fromDate(new Date(now.getTime() - timeOffset)),
        updatedAt: admin.firestore.Timestamp.now()
      };
      
      batch.set(ref, notifData);
    });
    
    await batch.commit();
    console.log('Successfully seeded 10 notifications for user:', recipientId);
    process.exit(0);
  } catch (err) {
    console.error('Error seeding notifications:', err);
    process.exit(1);
  }
}

seedNotifications();
