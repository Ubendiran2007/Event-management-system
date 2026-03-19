const emails = [
  'kavin90437@gmail.com',
  'ubendiran2007@gmail.com',
  'ubendirankumar@gmail.com',
  'ubendiran.lakshmanan007@gmail.com',
  'raj220707ram@gmail.com'
];

async function sendTestEmails() {
  console.log('Starting sequential test email delivery...\n');
  
  for (const email of emails) {
    console.log(`Sending to: ${email}...`);
    try {
      const response = await fetch('http://localhost:5001/api/events/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailAddress: email })
      });
      
      const data = await response.json();
      if (data.success) {
        console.log(`✅ Success! Msg ID: ${data.messageId}`);
      } else {
        console.error(`❌ Failed: ${data.message || data.error}`);
      }
    } catch (err) {
      console.error(`❌ Error connecting to server: ${err.message}`);
    }
    // Small delay between sends
    await new Promise(r => setTimeout(r, 1000));
  }
}

sendTestEmails();
