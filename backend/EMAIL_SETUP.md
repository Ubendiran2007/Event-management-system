# Email Notification Setup

## Overview
This document explains the email notification system for the CSE Event Management Portal. The system sends automatic email notifications when:
1. An event is created by a student organizer (notification sent to faculty coordinator)
2. An event status changes (notification sent to event organizer)

## Configuration

### 1. Environment Variables (.env)
The `.env` file in the `backend/` directory contains the Gmail SMTP credentials:

```env
# Gmail SMTP Configuration
GMAIL_USER=ubendiran2007@gmail.com
GMAIL_APP_PASSWORD=brri koka uztn qvnl

# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
```

**Important:** Never commit the `.env` file to version control. Add it to `.gitignore` to prevent credential leakage.

### 2. Gmail App Password Setup
The app uses a Gmail App Password (not the regular password) for security:
- Enable 2-Factor Authentication on your Gmail account
- Generate an App Password at: https://myaccount.google.com/apppasswords
- Use this password in the `GMAIL_APP_PASSWORD` field, NOT your regular Gmail password

## Email Service Architecture

### Files Modified/Created

1. **backend/services/emailService.js** (NEW)
   - Centralized email sending module
   - Manages SMTP transporter configuration
   - Provides two main functions:
     - `sendEventNotificationToFaculty()` - Sends notification when event is created
     - `sendEventStatusNotification()` - Sends notification when event status changes

2. **backend/routes/events.js** (MODIFIED)
   - POST /api/events - Now sends email to faculty after event creation
   - PATCH /api/events/:id/status - Now sends email to organizer after status update
   - POST /api/events/test-email - NEW test endpoint to verify email configuration

### Email Sending Flow

#### Event Creation
```
Student Organizer Creates Event
↓
Event saved to Firestore
↓
sendEventNotificationToFaculty() called with event data
↓
Email sent to faculty coordinator with event details
↓
Response returned (even if email fails)
```

#### Event Status Update
```
Faculty/HOD/Principal approves/rejects event
↓
Event status updated in Firestore
↓
sendEventStatusNotification() called
↓
Email sent to event organizer with status
↓
Response returned (even if email fails)
```

## Testing the Email Setup

### Option 1: Using the Test Endpoint (Recommended)
Send a POST request to test the email configuration:

```bash
curl -X POST http://localhost:5000/api/events/test-email \
  -H "Content-Type: application/json" \
  -d '{"emailAddress":"recipient@example.com"}'
```

**Success Response:**
```json
{
  "success": true,
  "message": "Test email sent successfully",
  "messageId": "<message-id>"
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Failed to send test email",
  "error": "Error details here"
}
```

### Option 2: Create a Real Event
1. Log in as a student organizer
2. Create a new event
3. The system will automatically send an email to the faculty coordinator
4. Check the console logs for email delivery status

### Common Issues & Solutions

**Issue: "SMTP AUTH failed"**
- Verify Gmail credentials are correct in .env
- Ensure the Gmail App Password (not regular password) is used
- Enable 2-Factor Authentication on Gmail account

**Issue: "SMTP connection timeout"**
- Check internet connection
- Verify SMTP_HOST and SMTP_PORT are correct
- Firewall might be blocking port 587

**Issue: "Email sent but not received"**
- Check spam/junk folder in email
- Verify the recipient email address is correct
- Gmail might reject emails from untrusted apps initially

**Issue: "Service not connecting"**
- Ensure nodemailer is installed: `npm install nodemailer`
- Check .env file exists in backend directory
- Restart the server after updating .env

## Email Content

### Event Creation Email
Contains:
- Event title and description
- Event type, date, time
- Venue and organizer details
- Department information
- Call-to-action to review in portal

### Event Status Change Email
Contains:
- Event title
- New status and reason
- Status-specific message
- Call-to-action based on status

## Production Deployment Notes

1. **Environment Variables**
   - Store credentials securely (never in code)
   - Use environment-specific values
   - Rotate credentials periodically

2. **Email Limits**
   - Gmail SMTP has rate limits (depends on account type)
   - Monitor email delivery logs
   - Consider alternate SMTP provider for high volume

3. **Error Handling**
   - Email failures don't block event operations
   - Check console logs for email-related errors
   - Implement additional logging if needed

4. **Security**
   - Never log or expose email credentials
   - Use SMTP_SECURE=true for production (port 465)
   - Implement email validation before sending

## Troubleshooting Checklist

- [ ] .env file exists in backend directory
- [ ] GMAIL_USER and GMAIL_APP_PASSWORD are set correctly
- [ ] Gmail account has 2FA enabled
- [ ] App Password generated (not regular password)
- [ ] nodemailer is installed (`npm install nodemailer`)
- [ ] Backend server is running (`npm run dev`)
- [ ] Test endpoint returns success
- [ ] Check browser console for errors
- [ ] Check server console logs for email errors

## Code Examples

### Sending a Custom Email
If you need to send emails from other parts of the app:

```javascript
const { sendEventNotificationToFaculty } = require('../services/emailService');

// Send email
const result = await sendEventNotificationToFaculty(eventData, facultyEmail);

if (result.success) {
  console.log('Email sent:', result.messageId);
} else {
  console.error('Email failed:', result.error);
}
```

## Support
For SMTP issues, refer to:
- Nodemailer Documentation: https://nodemailer.com/
- Gmail Support: https://support.google.com/mail/
- SMTP Protocol: https://tools.ietf.org/html/rfc5321
