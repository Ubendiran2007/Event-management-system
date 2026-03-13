# Faculty Coordinator Email Management

This document explains how the system now fetches faculty emails dynamically from Firestore and sends notifications to them when events are created.

## Architecture Overview

### How It Works

1. **Event Creation**: When a student organizer creates an event, they provide the faculty coordinator's name
2. **Dynamic Email Lookup**: The system queries Firestore to find the faculty coordinator's email by name
3. **Email Notification**: Once found, an email notification is sent to that faculty coordinator
4. **Graceful Fallback**: If the email is not found in the database, the system logs a warning but still creates the event

## Managing Faculty Coordinators

### 1. Add a Faculty Coordinator

**Endpoint**: `POST /api/events/coordinators/add`

**Request Body**:
```json
{
  "name": "Dr. Arul Kumar",
  "email": "arul.kumar@sece.ac.in",
  "department": "CSE"
}
```

**Response** (Success):
```json
{
  "success": true,
  "message": "Coordinator added successfully",
  "coordinator": {
    "id": "coord_unique_id",
    "name": "Dr. Arul Kumar",
    "email": "arul.kumar@sece.ac.in",
    "department": "CSE",
    "createdAt": "2026-03-10T10:30:00.000Z",
    "updatedAt": "2026-03-10T10:30:00.000Z"
  }
}
```

**Example with cURL**:
```bash
curl -X POST http://localhost:5000/api/events/coordinators/add \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dr. Arul Kumar",
    "email": "arul.kumar@sece.ac.in",
    "department": "CSE"
  }'
```

### 2. List All Faculty Coordinators

**Endpoint**: `GET /api/events/coordinators/list`

**Response**:
```json
{
  "success": true,
  "count": 3,
  "coordinators": [
    {
      "id": "coord_id_1",
      "name": "Dr. Arul Kumar",
      "email": "arul.kumar@sece.ac.in",
      "department": "CSE",
      "createdAt": "2026-03-10T10:30:00.000Z",
      "updatedAt": "2026-03-10T10:30:00.000Z"
    },
    {
      "id": "coord_id_2",
      "name": "Dr. Priya Sharma",
      "email": "priya.sharma@sece.ac.in",
      "department": "CSE",
      "createdAt": "2026-03-10T10:35:00.000Z",
      "updatedAt": "2026-03-10T10:35:00.000Z"
    }
  ]
}
```

**Example with cURL**:
```bash
curl -X GET http://localhost:5000/api/events/coordinators/list
```

### 3. Delete a Faculty Coordinator

**Endpoint**: `DELETE /api/events/coordinators/:id`

**Parameters**:
- `id` (string): The unique ID of the coordinator to delete

**Response** (Success):
```json
{
  "success": true,
  "message": "Coordinator deleted successfully"
}
```

**Example with cURL**:
```bash
curl -X DELETE http://localhost:5000/api/events/coordinators/coord_unique_id
```

## Email Lookup Process

When an event is created with a faculty coordinator name, the system performs the following lookup:

### Step 1: Search in Coordinators Collection
```
Query: coordinators collection where name == "Dr. Arul Kumar"
Returns: Email from matching coordinator record
```

### Step 2: Fallback - Search in Users Collection
If not found in Step 1:
```
Query: users collection where name == "Dr. Arul Kumar" AND role == "FACULTY"
Returns: Email from matching user record
```

### Step 3: Log and Continue
If not found in either collection:
```
Log: Warning message with faculty name
Action: Event is still created, but no email is sent
```

## Setup Instructions

### Quick Start

1. **Add your faculty coordinators** to the database:
   ```bash
   curl -X POST http://localhost:5000/api/events/coordinators/add \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Dr. Arul Kumar",
       "email": "kavin88701@gmail.com",
       "department": "CSE"
     }'
   ```

2. **Verify coordinators are saved**:
   ```bash
   curl http://localhost:5000/api/events/coordinators/list
   ```

3. **Create an event** with the faculty coordinator's name in the form
   - The system will automatically find the email and send it
   - Check server logs for confirmation: `[events/create] Email sent to faculty: kavin88701@gmail.com`

## Console Logging

The system logs various messages to help with debugging:

### Success Case
```
[events/create] Email sent to faculty: arul.kumar@sece.ac.in
```

### Warning Cases
```
[events/create] Could not find email for faculty: Dr. Unknown Name
[events/create] Email notification failed: SMTP connection error
```

### Error Cases
```
[events/create] Error sending email: [error details]
```

## Common Issues & Solutions

### Issue: "Could not find email for faculty: [Name]"

**Cause**: The faculty name in the form doesn't match any coordinator in the database

**Solution**:
1. Check the exact spelling of the faculty name
2. Verify the coordinator exists: `curl http://localhost:5000/api/events/coordinators/list`
3. Add the coordinator if missing:
   ```bash
   curl -X POST http://localhost:5000/api/events/coordinators/add \
     -H "Content-Type: application/json" \
     -d '{"name": "Correct Name", "email": "email@domain.com"}'
   ```

### Issue: Email form dropdown shows different names than database

**Solution**:
- Ensure the form dropdown values match the exact names in the coordinators collection
- Update the frontend form to fetch coordinator list from `/api/events/coordinators/list`

### Issue: Email sent but faculty didn't receive it

**Cause**: Email configuration issue (not related to coordinator lookup)

**Solution**:
1. Test email configuration: `curl -X POST http://localhost:5000/api/events/test-email -H "Content-Type: application/json" -d '{"emailAddress": "kavin88701@gmail.com"}'`
2. Check SMTP settings in `.env` file (GMAIL_USER should be ubendiran2007@gmail.com for sending, but faculty receives at kavin88701@gmail.com)
3. Verify Gmail app password is correct
4. Check spam/junk folder

## Database Schema

### Coordinators Collection

```
coordinators/ (collection)
├── doc1 (document with auto-generated ID)
│   ├── name: "Dr. Arul Kumar"
│   ├── email: "arul.kumar@sece.ac.in"
│   ├── department: "CSE"
│   ├── createdAt: ISO timestamp
│   └── updatedAt: ISO timestamp
├── doc2
│   └── ...
```

## Integration with Event Creation

### Frontend (CreateEvent.jsx)

**Current behavior**:
- Form accepts faculty coordinator name (dropdown or text input)
- Name is sent to backend in payload: `coordinator.facultyName`

**To make dropdown dynamic**:
```javascript
// Fetch coordinators from API
const [coordinators, setCoordinators] = useState([]);

useEffect(() => {
  fetch('http://localhost:5000/api/events/coordinators/list')
    .then(res => res.json())
    .then(data => setCoordinators(data.coordinators))
    .catch(err => console.error('Failed to fetch coordinators:', err));
}, []);

// Render as dropdown
<select name="faculty_coordinator_name">
  <option value="">Select Faculty Coordinator</option>
  {coordinators.map(coord => (
    <option key={coord.id} value={coord.name}>{coord.name}</option>
  ))}
</select>
```

### Backend (events.js)

**New flow**:
1. Event POST request received with `coordinator.facultyName`
2. `getFacultyEmailByName(facultyName)` called
3. Email fetched from coordinators collection
4. Email notification sent using fetched email
5. Event created regardless of email success/failure

## Testing

### Test 1: Add Coordinator and Create Event

```bash
# Step 1: Add coordinator
curl -X POST http://localhost:5000/api/events/coordinators/add \
  -H "Content-Type: application/json" \
  -d '{"name": "Dr. Arul Kumar", "email": "kavin88701@gmail.com"}'

# Step 2: Create event with that coordinator name
# (Use the CreateEvent form or API with faculty_coordinator_name: "Dr. Arul Kumar")

# Step 3: Check server logs for email sent message
```

### Test 2: Non-existent Coordinator

```bash
# Try creating event with coordinator name not in database
# Expected: Warning in logs, but event is still created
# Check: tail -f server.log | grep "Could not find email"
```

## Future Enhancements

- [ ] Add optional status to coordinators (active/inactive)
- [ ] Add department filtering to coordinator lookup
- [ ] Implement coordinator approval workflows
- [ ] Add bulk import of coordinators from CSV
- [ ] Send coordinator statistics and summaries
- [ ] Add coordinator editing endpoint: PATCH /api/events/coordinators/:id

## Support

For issues or questions:
1. Check console logs for `[events/`  prefixed messages
2. Verify coordinator exists: `GET /api/events/coordinators/list`
3. Test SMTP: `POST /api/events/test-email`
4. Review this documentation
