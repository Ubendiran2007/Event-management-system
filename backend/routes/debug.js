const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();

router.get('/email', async (req, res) => {
  // Security check: require a debug token in production to prevent unauthorized access
  const providedToken = req.headers['x-debug-token'] || req.query.token;
  const expectedToken = process.env.DEBUG_TOKEN;
  
  if (!expectedToken || providedToken !== expectedToken) {
    return res.status(403).json({ success: false, message: 'Forbidden. Invalid or missing debug token.' });
  }

  const logs = [];
  const log = (msg) => {
    console.log([DEBUG ENDPOINT] );
    logs.push([] );
  };

  log('--- Starting /debug/email Endpoint ---');

  // 1. Validate environment variables (without exposing secrets)
  log('Validating Environment Variables...');
  const envVars = {
    NODE_ENV: process.env.NODE_ENV || 'undefined',
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || 'undefined',
    SMTP_HOST: process.env.SMTP_HOST || 'undefined',
    SMTP_PORT: process.env.SMTP_PORT || 'undefined',
    SMTP_SECURE: process.env.SMTP_SECURE || 'undefined',
    GMAIL_USER: process.env.GMAIL_USER ? true : false,
    GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD ? true : false,
    EMAIL_TEST_MODE: process.env.EMAIL_TEST_MODE || 'undefined',
    EMAIL_TEST_RECIPIENT: process.env.EMAIL_TEST_RECIPIENT || 'undefined',
  };
  
  for (const [key, val] of Object.entries(envVars)) {
    log(${key}: );
  }

  // 2. Create the email transporter
  log('Creating SMTP Transporter...');
  const transporterConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    dnsOptions: { family: 4 }, // Force IPv4 as per the original codebase
  };
  
  // Don't log the password or user in the response, but log the rest of the config
  log(Transporter config: {"host":"","port":,"secure":,"auth":{"user":"***","pass":"***"}});
  
  const transporter = nodemailer.createTransport(transporterConfig);

  // 3. Run transporter.verify()
  log('Running transporter.verify()...');
  try {
    await transporter.verify();
    log('transporter.verify() SUCCESS: SMTP connection established and authenticated.');
  } catch (error) {
    log(	ransporter.verify() FAILED: );
    log(Error details: Code=, Command=);
    log(Stack Trace:\n);
    return res.status(500).json({
      success: false,
      message: 'SMTP Verification Failed',
      logs,
      error: {
        message: error.message,
        code: error.code,
        command: error.command
      }
    });
  }

  // 4. Attempt to send a simple test email
  log('Attempting to send a test email...');
  try {
    const toEmail = process.env.EMAIL_TEST_RECIPIENT || process.env.GMAIL_USER;
    if (!toEmail) {
        log('No recipient found. Set EMAIL_TEST_RECIPIENT or GMAIL_USER.');
        throw new Error('No recipient configured for test email.');
    }
    log(Sending test email...);
    
    const info = await transporter.sendMail({
      from: '"Event Management Debug" <' + process.env.GMAIL_USER + '>',
      to: toEmail,
      subject: "Render Production Runtime Debug Test",
      text: "If you receive this email, the SMTP transporter works correctly from Render.",
    });
    
    log(sendMail() SUCCESS! Message ID: );
    log(Provider Response: );
    
    return res.json({
      success: true,
      message: 'Email debug completed successfully',
      logs,
      providerResponse: info.response,
      messageId: info.messageId
    });
  } catch (error) {
    log(sendMail() FAILED: );
    log(Error details: Code=, Command=);
    log(Stack Trace:\n);
    return res.status(500).json({
      success: false,
      message: 'SMTP SendMail Failed',
      logs,
      error: {
        message: error.message,
        code: error.code,
        command: error.command
      }
    });
  }
});

module.exports = router;
