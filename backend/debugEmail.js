require('dotenv').config();
const nodemailer = require('nodemailer');

async function run() {
  console.log('=== RUNTIME INVESTIGATION ===');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('EMAIL_PROVIDER:', process.env.EMAIL_PROVIDER);
  console.log('GMAIL_USER:', process.env.GMAIL_USER ? 'SET' : 'MISSING');
  console.log('GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? 'SET' : 'MISSING');
  console.log('SMTP_HOST:', process.env.SMTP_HOST);
  console.log('SMTP_PORT:', process.env.SMTP_PORT);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true' ? true : false,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    dnsOptions: { family: 4 },
  });

  try {
    console.log('Verifying transporter...');
    await transporter.verify();
    console.log('Transporter verified successfully.');
    
    console.log('Attempting to send test email...');
    const info = await transporter.sendMail({
      from: 'Event Management <' + process.env.GMAIL_USER + '>',
      to: process.env.GMAIL_USER,
      subject: 'Runtime Investigation Test',
      text: 'This is a test from the runtime investigation script.'
    });
    console.log('Email sent successfully! Message ID:', info.messageId);
    console.log('Provider Response:', info.response);
  } catch (err) {
    console.error('Error during execution:', err);
  }
}
run();
