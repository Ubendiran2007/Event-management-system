const nodemailer = require('nodemailer');
const net = require('net');

console.log('--- STANDALONE SMTP TEST ---');

// Validate environment variables manually to avoid dotenv dependency logic if possible, 
// though we can load dotenv if needed. We assume the environment variables are injected by Render.
const host = process.env.SMTP_HOST || 'smtp-relay.brevo.com';
const port = parseInt(process.env.SMTP_PORT || '587');
const secure = process.env.SMTP_SECURE === 'true' ? true : false;
const user = process.env.EMAIL_USER;
const pass = process.env.EMAIL_PASS;
const from = process.env.EMAIL_FROM || user;
const to = process.env.EMAIL_TEST_RECIPIENT || user;

console.log('Config:', { host, port, secure, user_exists: !!user, pass_exists: !!pass, from, to });

(async () => {
  // 1. TCP Reachability Test
  console.log('\n--- 1. TCP CONNECTIVITY TEST ---');
  await new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(10000);
    
    socket.on('lookup', (err, address, family, resolvedHost) => {
      console.log(`DNS lookup: Resolved IP ${address} (IPv${family}) for ${resolvedHost || host}`);
    });
    
    socket.on('connect', () => {
      console.log('Socket Connected');
      socket.destroy();
    });
    
    socket.on('timeout', () => {
      console.log('Socket Timeout');
      socket.destroy();
    });
    
    socket.on('error', (err) => {
      console.log('Socket Error:', err.message);
    });
    
    socket.on('close', () => {
      console.log('Socket Closed');
      resolve();
    });
    
    socket.connect(port, host);
  });

  // 2. Nodemailer Setup
  console.log('\n--- 2. NODEMAILER SETUP ---');
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    dnsOptions: { family: 4 },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    logger: true,
    debug: true
  });

  // 3. Verify
  console.log('\n--- 3. TRANSPORTER VERIFY ---');
  try {
    console.log('Calling transporter.verify() with 15s timeout...');
    const verifyPromise = transporter.verify();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TRANSPORTER_VERIFY_TIMEOUT_15S')), 15000)
    );
    await Promise.race([verifyPromise, timeoutPromise]);
    console.log('transporter.verify() SUCCESS');
  } catch (error) {
    console.error('transporter.verify() FAILED:', error.message);
  }

  // 4. SendMail
  if (to && user) {
    console.log('\n--- 4. TRANSPORTER SENDMAIL ---');
    try {
      console.log('Calling transporter.sendMail() with 15s timeout...');
      const sendPromise = transporter.sendMail({
        from,
        to,
        subject: 'Standalone SMTP Test',
        text: 'This is a test from the standalone script.'
      });
      const sendTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TRANSPORTER_SEND_TIMEOUT_15S')), 15000)
      );
      
      const res = await Promise.race([sendPromise, sendTimeoutPromise]);
      console.log('Email sent successfully');
      console.log('Provider Result:', {
        messageId: res.messageId,
        accepted: res.accepted,
        rejected: res.rejected,
        response: res.response
      });
    } catch (error) {
      console.error('sendMail() threw an error!');
      console.error('error.name:', error.name);
      console.error('error.code:', error.code);
      console.error('error.command:', error.command);
      console.error('error.response:', error.response);
      console.error('error.responseCode:', error.responseCode);
      console.error('error.message:', error.message);
      console.error('stack trace:', error.stack);
    }
  } else {
    console.log('\n--- 4. TRANSPORTER SENDMAIL SKIPPED (No Recipient) ---');
  }
})();
