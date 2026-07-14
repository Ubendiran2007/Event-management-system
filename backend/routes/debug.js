const express = require('express');
const nodemailer = require('nodemailer');
const net = require('net');
const router = express.Router();

router.get('/email', async (req, res) => {
  const providedToken = req.headers['x-debug-token'] || req.query.token;
  const expectedToken = process.env.DEBUG_TOKEN;
  
  if (!expectedToken || providedToken !== expectedToken) {
    return res.status(403).json({ success: false, message: 'Forbidden. Invalid or missing debug token.' });
  }

  const logs = [];
  const log = (msg) => {
    console.log(`[DEBUG ENDPOINT] ${msg}`);
    logs.push(`[${new Date().toISOString()}] ${msg}`);
  };

  log('--- Starting /debug/email Endpoint (Advanced Networking) ---');

  // 1. Validate environment variables
  log('Validating Environment Variables...');
  const envVars = {
    SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
    SMTP_PORT: process.env.SMTP_PORT || '587',
    SMTP_SECURE: process.env.SMTP_SECURE || 'undefined',
  };
  for (const [key, val] of Object.entries(envVars)) {
    log(`${key}: ${val}`);
  }

  // 2. TCP Reachability Test (Ping)
  log(`Testing raw TCP connection to ${envVars.SMTP_HOST}:${envVars.SMTP_PORT}...`);
  const tcpResult = await new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 10000; // 10s TCP timeout
    
    socket.setTimeout(timeout);
    
    let isResolved = false;
    
    socket.on('connect', () => {
      log('TCP connection SUCCESS.');
      socket.destroy();
      if (!isResolved) { isResolved = true; resolve('SUCCESS'); }
    });
    
    socket.on('timeout', () => {
      log(`TCP connection TIMEOUT after ${timeout}ms.`);
      socket.destroy();
      if (!isResolved) { isResolved = true; resolve('TIMEOUT'); }
    });
    
    socket.on('error', (err) => {
      log(`TCP connection ERROR: ${err.message}`);
      if (!isResolved) { isResolved = true; resolve(`ERROR: ${err.message}`); }
    });
    
    socket.connect(parseInt(envVars.SMTP_PORT), envVars.SMTP_HOST);
  });
  log(`TCP reachability result: ${tcpResult}`);

  // 3. Create Transporter with Logging
  log('Creating SMTP Transporter with logger: true and debug: true...');
  const transporterConfig = {
    host: envVars.SMTP_HOST,
    port: parseInt(envVars.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    dnsOptions: { family: 4 },
    logger: true,
    debug: true
  };
  
  const transporter = nodemailer.createTransport(transporterConfig);

  // 4. Run transporter.verify() with Promise.race 15s timeout
  log('Running transporter.verify() with 15-second timeout limit...');
  
  const verifyPromise = transporter.verify();
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('TRANSPORTER_VERIFY_TIMEOUT_15S')), 15000)
  );
  
  try {
    await Promise.race([verifyPromise, timeoutPromise]);
    log('transporter.verify() SUCCESS.');
  } catch (error) {
    log(`transporter.verify() FAILED: ${error.message}`);
    
    // Check if it's our timeout or a true error
    const isTimeout = error.message === 'TRANSPORTER_VERIFY_TIMEOUT_15S' || tcpResult === 'TIMEOUT';
    
    let recommendation = '';
    if (isTimeout) {
      recommendation = "RECOMMENDATION: The connection timed out indefinitely. Many cloud platforms (like Render or Vercel) block outbound SMTP connections on port 25, 465, and 587 by default to prevent spam. Switch EMAIL_PROVIDER from 'smtp' to 'resend' to use the HTTP-based Resend API. HTTP APIs (like Resend) use standard port 443 which is never blocked, avoids all SMTP networking/IP reputation issues, and is highly reliable on cloud platforms.";
      log(recommendation);
    }
    
    return res.status(500).json({
      success: false,
      message: 'SMTP Verification Failed',
      logs,
      recommendation,
      error: {
        message: error.message,
        code: error.code,
      }
    });
  }

  // 5. Attempt to send test email (if it didn't fail)
  log('Attempting to send test email...');
  try {
    const toEmail = process.env.EMAIL_TEST_RECIPIENT || process.env.GMAIL_USER;
    if (!toEmail) {
        log('No recipient found. Set EMAIL_TEST_RECIPIENT or GMAIL_USER.');
        throw new Error('No recipient configured for test email.');
    }
    
    const sendPromise = transporter.sendMail({
      from: '"Event Management Debug" <' + process.env.GMAIL_USER + '>',
      to: toEmail,
      subject: "Render Production Runtime Debug Test",
      text: "Testing complete.",
    });
    
    const sendTimeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TRANSPORTER_SEND_TIMEOUT_15S')), 15000)
    );
    
    const info = await Promise.race([sendPromise, sendTimeoutPromise]);
    
    log(`sendMail() SUCCESS! Message ID: ${info.messageId}`);
    return res.json({
      success: true,
      message: 'Email debug completed successfully',
      logs,
      messageId: info.messageId
    });
  } catch (error) {
    log(`sendMail() FAILED: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'SMTP SendMail Failed',
      logs,
      error: { message: error.message }
    });
  }
});

module.exports = router;
