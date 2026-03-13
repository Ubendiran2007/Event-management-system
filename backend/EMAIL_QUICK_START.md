# Email System - Quick Start Guide

## ✅ Setup Complete

Your event management system now sends automatic email notifications using Gmail SMTP. Here's what was configured:

### What's Been Set Up

1. **Gmail SMTP Configuration**
   - Email: `ubendiran2007@gmail.com`
   - App Password: Configured in `.env` file
   - SMTP Server: `smtp.gmail.com:587`

2. **Email Triggers**
   - **Event Creation**: When an event organizer creates an event, faculty coordinator receives a notification
   - **Status Changes**: When faculty/HOD/Principal approves or rejects an event, the organizer is notified

3. **New Endpoints**
   - `POST /api/events/test-email` - Test email configuration

## 🧪 Testing the Email System

### Step 1: Test Email Configuration

Before creating a real event, test that email is working:

```bash
# Test endpoint to verify SMTP configuration
curl -X POST http://localhost:5000/api/events/test-email \
  -H "Content-Type: application/json" \
  -d '{"emailAddress":"your-email@example.com"}'
```

**Expected Response (Success):**
```json
{
  "success": true,
  "message": "Test email sent successfully",
  "messageId": "<automated-message-id>"
}
```

**Expected Response (Failure):**
```json
{
  "success": false,
  "message": "Failed to send test email",
  "error": "SMTP authentication failed"
}
```

### Step 2: Create Test Event

1. Log in as a Student Organizer
2. Go to "Create Event"
3. Fill in all required fields:
   - **Faculty Coordinator Email** - This will receive the notification
   - Other event details as needed
4. Click "Submit"
5. You should see the confirmation message
6. Check the faculty coordinator's email inbox (and spam folder)

### Step 3: Test Status Updates

1. Log in as Faculty
2. Go to Dashboard → Pending Approvals
3. Click on an event
4. Click "Approve" or "Reject"
5. The event organizer should receive a status notification email

## 📋 Email Content Examples

### Event Creation Email (Sent to Faculty)
- Event title and description
- Event type, date, time, venue
- Organizer name and department
- Link: "Log into portal to review"

### Event Status Email (Sent to Organizer)
- Event title
- New status (e.g., "Approved by Faculty")
- Reason/message based on action
- Next steps

## 🔧 Configuration Files

### .env (Backend)
```env
GMAIL_USER=ubendiran2007@gmail.com
GMAIL_APP_PASSWORD=brri koka uztn qvnl
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
```

### Email Service Module
- **File**: `backend/services/emailService.js`
- **Functions**:
  - `sendEventNotificationToFaculty()` - Send notification when event created
  - `sendEventStatusNotification()` - Send notification on status change

### Modified Files
- `backend/routes/events.js` - Added email sending logic
- `frontend/src/pages/CreateEvent.jsx` - Added organizer email to form data

## ⚠️ Troubleshooting

### Email Not Received?

1. **Check Console Logs**
   ```bash
   # In terminal where backend is running
   # Look for [Email Service] messages
   ```

2. **Check Available Credentials**
   - Verify .env file has correct Gmail and App Password
   - Ensure 2FA is enabled on Gmail account
   - App Password must be generated (not regular password)

3. **Check Spam Folder**
   - First-time emails might go to spam
   - Add sender to contacts to prevent future spam classification

4. **Verify Network**
   - Test internet connectivity
   - Check if firewall allows port 587

### Common Errors

| Error | Solution |
|-------|----------|
| SMTP AUTH failed | Verify credentials in .env |
| SMTP timeout | Check port 587 is not blocked |
| Service unavailable | Restart backend server |
| Email not received | Check spam folder, verify recipient email |

## 📧 Manual Testing Command

```bash
# Using curl to test email endpoint
curl -X POST http://localhost:5000/api/events/test-email \
  -H "Content-Type: application/json" \
  -d '{"emailAddress":"test@example.com"}' \
  -v

# Using PowerShell
$body = @{'emailAddress'='test@example.com'} | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:5000/api/events/test-email' `
  -Method POST `
  -Body $body `
  -ContentType 'application/json'
```

## 🔐 Security Notes

1. **Never commit .env** - Add to .gitignore
2. **Keep Gmail App Password private** - Never push to repositories
3. **Use HTTPS in production** - Set SMTP_SECURE=true, port 465
4. **Monitor email logs** - Check for failures regularly

## 📞 Need Help?

1. Check `backend/EMAIL_SETUP.md` for detailed documentation
2. Review console logs: `[Email Service]` messages
3. Test endpoint: `POST /api/events/test-email`
4. Verify .env configuration

## ✨ What Happens Automatically

### When Event is Created:
```
Student Organizer → Submits Event → Faculty receives Email
```

### When Event is Approved:
```
Faculty Approves → Status Updated → Organizer receives Email
```

### When Event is Rejected:
```
Faculty Rejects → Status Updated → Organizer receives Rejection Email
```

---

**Status**: ✅ Email system is fully configured and ready to use!

**Test It Now**: 
```bash
curl -X POST http://localhost:5000/api/events/test-email \
  -H "Content-Type: application/json" \
  -d '{"emailAddress":"ubendiran2007@gmail.com"}'
```
