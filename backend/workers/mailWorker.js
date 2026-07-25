const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { collection, getDocs, updateDoc, doc, db, query, where, limit } = require('../firebaseClientWrapper');
const { logEmail } = require('../utils/logger');
const crypto = require('crypto');
require('dotenv').config();

// Create SMTP Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  dnsOptions: { family: 4 },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
  logger: false, // keep false for worker to avoid log bloat
  debug: false
});

const MAX_ATTEMPTS = 3;

async function processMailQueue() {
  try {
    // 1. Fetch pending emails
    const mailQuery = query(
      collection(db, 'mailQueue'),
      where('status', '==', 'PENDING'),
      limit(20) // process in small batches
    );

    const snapshot = await getDocs(mailQuery);
    
    if (snapshot.empty) {
      return;
    }

    console.log(`[MailWorker] Found ${snapshot.size} pending emails in queue. Processing...`);

    for (const d of snapshot.docs) {
      const job = { id: d.id, ...d.data() };
      
      try {
        const attemptCount = (job.attempts || 0) + 1;
        console.log(`[MailWorker] Processing ${job.id} (Attempt ${attemptCount}/${MAX_ATTEMPTS})`);

        // Convert Firestore data back into mailOptions
        const mailOptions = {
          from: job.from,
          to: job.to,
          subject: job.subject,
          text: job.text,
          html: job.html,
        };

        if (job.attachments) {
          mailOptions.attachments = job.attachments;
        }

        // Send Email
        const sendPromise = transporter.sendMail(mailOptions);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('TRANSPORTER_SEND_TIMEOUT_15S')), 15000)
        );
        
        const res = await Promise.race([sendPromise, timeoutPromise]);
        
        // Success -> mark as DELIVERED
        await updateDoc(doc(db, 'mailQueue', job.id), {
          status: 'DELIVERED',
          attempts: attemptCount,
          deliveredAt: new Date().toISOString(),
          smtpMessageId: res.messageId
        });

        console.log(`[MailWorker] Successfully delivered ${job.id}`);

      } catch (error) {
        const attemptCount = (job.attempts || 0) + 1;
        
        if (attemptCount >= MAX_ATTEMPTS) {
          console.error(`[MailWorker] Max retries reached for ${job.id}. Routing to Dead Letter Queue (DLQ).`);
          await updateDoc(doc(db, 'mailQueue', job.id), {
            status: 'DLQ',
            attempts: attemptCount,
            error: error.message,
            failedAt: new Date().toISOString()
          });
        } else {
          console.warn(`[MailWorker] Failed attempt ${attemptCount} for ${job.id}. Retrying next cycle. Error: ${error.message}`);
          await updateDoc(doc(db, 'mailQueue', job.id), {
            attempts: attemptCount,
            lastError: error.message
          });
        }
      }
    }
  } catch (error) {
    console.error('[MailWorker] Fatal error during queue processing:', error);
  }
}

// Start worker via node-cron (Runs every minute)
function start() {
  console.log('[MailWorker] Starting Async Notification Queue Worker (Runs every minute)');
  cron.schedule('* * * * *', async () => {
    await processMailQueue();
  });
}

module.exports = {
  start,
  processMailQueue
};
