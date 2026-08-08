require('dotenv').config();
const { dbAdmin } = require('./firebaseAdmin');

async function migrate() {
  console.log('Starting migration...');
  const eventsSnap = await dbAdmin.collection('events').get();
  console.log(`Found ${eventsSnap.size} events to check.`);
  let updatedCount = 0;

  const batch = dbAdmin.batch();
  let operations = 0;

  for (const doc of eventsSnap.docs) {
    const data = doc.data();
    if (data.managers && Array.isArray(data.managers)) {
      const managerIds = data.managers.map(m => m.userId || m.id).filter(Boolean);
      
      // Check if managerIds differ from what's currently in DB
      const currentManagerIds = data.managerIds || [];
      const needsUpdate = managerIds.length !== currentManagerIds.length || 
                          !managerIds.every(id => currentManagerIds.includes(id));

      if (needsUpdate || !data.managerIds) {
        batch.update(doc.ref, { managerIds });
        operations++;
        updatedCount++;
        
        if (operations >= 400) {
          await batch.commit();
          operations = 0;
          console.log(`Committed batch, total updated: ${updatedCount}`);
        }
      }
    } else if (!data.managerIds) {
      batch.update(doc.ref, { managerIds: [] });
      operations++;
      updatedCount++;
      if (operations >= 400) {
        await batch.commit();
        operations = 0;
      }
    }
  }

  if (operations > 0) {
    await batch.commit();
    console.log(`Committed final batch, total updated: ${updatedCount}`);
  }

  console.log('Migration completed successfully!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
