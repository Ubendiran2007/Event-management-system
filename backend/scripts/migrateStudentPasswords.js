const { db, collectionGroup, getDocs, writeBatch, doc } = require('../firebaseClientWrapper');
const bcrypt = require('bcryptjs');

async function migratePasswords() {
  console.log('Starting Student Password Migration to bcrypt hashes...');
  
  if (!db) {
    console.error('Firebase DB is not initialized.');
    process.exit(1);
  }

  try {
    const membersQuery = collectionGroup(db, 'members');
    const snapshot = await getDocs(membersQuery);
    
    let totalStudents = snapshot.size;
    let migratedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    
    console.log(`Found ${totalStudents} students in the database. Assessing...`);

    let batch = writeBatch(db);
    let countInBatch = 0;
    
    for (const d of snapshot.docs) {
      const data = d.data();
      const currentPassword = data.password;

      // Ensure the student actually has a password, and check if it's already a bcrypt hash
      // bcrypt hashes typically start with $2a$, $2b$, or $2y$ and are 60 chars long.
      if (!currentPassword) {
        skippedCount++;
        continue;
      }
      
      const isAlreadyHashed = currentPassword.startsWith('$2a$') || 
                              currentPassword.startsWith('$2b$') || 
                              currentPassword.startsWith('$2y$');
                              
      if (isAlreadyHashed) {
        skippedCount++;
        continue;
      }

      // If we reach here, it's a plain-text password. Hash it.
      try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(currentPassword, salt);
        
        batch.update(d.ref, { 
          password: hashedPassword,
          updatedAt: new Date().toISOString()
        });
        
        migratedCount++;
        countInBatch++;
        
        if (countInBatch === 490) {
          console.log(`Committing batch of ${countInBatch} records...`);
          await batch.commit();
          batch = writeBatch(db);
          countInBatch = 0;
        }
      } catch (err) {
        console.error(`Failed to hash password for student ${d.id}:`, err.message);
        failedCount++;
      }
    }
    
    // Commit any remaining records
    if (countInBatch > 0) {
      console.log(`Committing final batch of ${countInBatch} records...`);
      await batch.commit();
    }
    
    console.log('\n--- MIGRATION COMPLETE ---');
    console.log(`Total Assessed: ${totalStudents}`);
    console.log(`Successfully Migrated: ${migratedCount}`);
    console.log(`Skipped (Already hashed or empty): ${skippedCount}`);
    console.log(`Failed: ${failedCount}`);
    
    process.exit(0);

  } catch (error) {
    console.error('Migration crashed:', error);
    process.exit(1);
  }
}

migratePasswords();
