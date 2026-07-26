require('dotenv').config();
const { admin, dbAdmin: db } = require('./firebaseAdmin');

const seedData = async () => {
  try {
    console.log('Fetching venues...');
    const venuesSnap = await db.collection('venues').limit(3).get();
    
    if (venuesSnap.empty) {
      console.log('No venues found! Please seed venues first.');
      process.exit(1);
    }

    const venues = venuesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Get today and tomorrow dates
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 5);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    console.log(`Seeding data for dates: ${todayStr} to ${nextWeekStr}`);

    // 1. Seed an APPROVED EVENT
    if (venues[0]) {
      const eventRef = db.collection('events').doc();
      await eventRef.set({
        title: 'Tech Innovation Summit 2026',
        venueId: venues[0].id,
        status: 'APPROVED',
        date: todayStr,
        startTime: '09:00',
        endTime: '13:00',
        description: 'Annual gathering for tech innovations.',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Created EVENT in venue ${venues[0].name}`);
    }

    // 2. Seed a RESERVATION (Hold)
    if (venues[1]) {
      const resRef = db.collection('venueReservations').doc();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 2); // expires in 2 hours
      
      await resRef.set({
        venueId: venues[1].id,
        status: 'RESERVED',
        date: tomorrowStr,
        startTime: '14:00',
        endTime: '16:00',
        reservedBy: 'test_user_123',
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Created RESERVATION (Hold) in venue ${venues[1].name}`);
    }

    // 3. Seed a MAINTENANCE block
    if (venues[2]) {
      const maintRef = db.collection('venueMaintenance').doc();
      await maintRef.set({
        venueId: venues[2].id,
        startDate: todayStr,
        endDate: nextWeekStr,
        reason: 'HVAC System Upgrade',
        createdBy: 'admin_123',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Update the venue status to MAINTENANCE if it spans today
      await db.collection('venues').doc(venues[2].id).update({
        status: 'MAINTENANCE'
      });
      console.log(`Created MAINTENANCE block in venue ${venues[2].name}`);
    }

    console.log('Successfully seeded calendar and history data!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedData();
