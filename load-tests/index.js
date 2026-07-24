require('dotenv').config({ path: 'E:/Event-management-system/backend/.env' });
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    })
  });
}
const db = getFirestore();

const { runDashboardTest } = require('./scenarios/dashboard');
const { runRegistrationTest } = require('./scenarios/registration');
const { runApprovalsTest } = require('./scenarios/approvals');
const { runNotificationsTest } = require('./scenarios/notifications');
const { runMixedTrafficTest } = require('./scenarios/mixed');
const { runStabilityTest } = require('./scenarios/stability');
const { generateMarkdownReport, appendToReport } = require('./utils/reporter');

async function seedTestUsers() {
  console.log('Verifying test users exist...');
  const batch = db.batch();
  let added = 0;
  
  const batchArray = [];
  for (let i = 1; i <= 150; i++) batchArray.push(i);
  
  for (let b = 0; b < batchArray.length; b += 50) {
    const chunk = batchArray.slice(b, b + 50);
    const firestoreBatch = db.batch();
    
    await Promise.all(chunk.map(async (i) => {
      const email = `stu${i}_cse@kce.ac.in`;
      const identifier = `stu${i}_cse`;
      
      try {
        await getAuth().getUserByEmail(email);
      } catch (err) {
        if (err.code === 'auth/user-not-found') {
          const userRecord = await getAuth().createUser({
            email: email,
            password: 'password',
            displayName: `Test Student ${i}`
          });
          
          const userDocRef = db.collection('users').doc(userRecord.uid);
          firestoreBatch.set(userDocRef, {
            email: email,
            password: 'password', // Plain text works due to fallback in comparePassword
            name: `Test Student ${i}`,
            role: 'STUDENT_GENERAL',
            status: 'ACTIVE',
            department: 'CSE'
          });
          
          const profileDocRef = db.collection('students').doc(userRecord.uid);
          firestoreBatch.set(profileDocRef, {
            email: email,
            name: `Test Student ${i}`,
            class: 'CSE',
            section: 'A',
            department: 'CSE',
            year: 'I'
          });
          
          added++;
        }
      }
    }));
    await firestoreBatch.commit();
    console.log(`Processed batch... Total added so far: ${added}`);
  }
  
  if (added % 50 !== 0 && added > 0) {
    await batch.commit();
  }
  console.log(`Seeding complete. Added ${added} new test users.`);
}

async function runAll() {
  console.log('--- Phase B: Load & Stress Testing Orchestrator ---');
  
  // Clean old report
  const fs = require('fs');
  const path = require('path');
  const reportPath = path.join(__dirname, '..', '..', 'load_test_results.md');
  if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);
  
  appendToReport('# Phase B: Load Test Results\n\n');
  
  await seedTestUsers();

  try {
    // 1. Dashboard
    const dbMetrics = await runDashboardTest(100);
    appendToReport(generateMarkdownReport('Dashboard Concurrent Load (100 reqs)', dbMetrics));

    // 2. Registration Contention
    const regMetrics = await runRegistrationTest();
    appendToReport(generateMarkdownReport('Registration Contention (150 students, capacity 50)', regMetrics));

    // 3. Approval Idempotency
    const appMetrics = await runApprovalsTest();
    appendToReport(generateMarkdownReport('Approval Idempotency (50 concurrent identical approvals)', appMetrics));

    // 4. Notifications Burst
    const notifMetrics = await runNotificationsTest();
    appendToReport(`
### Scenario: ${notifMetrics.scenario}
- **Enqueued:** ${notifMetrics.enqueued} messages
- **Enqueue Time:** ${notifMetrics.enqueueTimeMs.toFixed(2)} ms
- **Processing Time:** ${notifMetrics.processingTimeMs.toFixed(2)} ms
- **Failed / Dead-Letter:** ${notifMetrics.failed}

---
`);

    // 5. Mixed Traffic
    await runMixedTrafficTest();

  } catch (error) {
    console.error('Fatal Error during load testing:', error);
  }
  
  console.log('\n--- Load Testing Complete. See load_test_results.md ---');
  process.exit(0);
}

runAll();
