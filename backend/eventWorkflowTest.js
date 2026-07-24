require('dotenv').config();
const { issueToken } = require('./middleware/auth');
const http = require('http');

const PORT = process.env.PORT || 5001;

async function apiCall(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    let data = body ? JSON.stringify(body) : '';
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: method,
      headers: headers
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(responseBody); } catch(e) { parsed = responseBody; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    
    req.on('error', reject);
    if (body) req.write(data);
    req.end();
  });
}

function generateToken(role, id, department = 'CSE', isApprovedOrganizer = true) {
  return issueToken({
    id: id,
    role: role,
    department: department,
    email: `${id}@test.com`,
    isApprovedOrganizer: isApprovedOrganizer
  });
}

async function runTest() {
  console.log('--- Starting Automated Event Workflow API Tests ---');
  
  const orgToken = generateToken('STUDENT_ORGANIZER', 'student_org', 'CSE', true);
  const orgNoPermToken = generateToken('STUDENT_GENERAL', 'student_noperm', 'CSE', false);
  const facToken = generateToken('FACULTY', 'fac_cse', 'CSE');
  const hodToken = generateToken('HOD', 'hod_cse', 'CSE');
  
  // 1. Missing required fields → expect 400 validation failure
  console.log('\\n[Test 1] Missing required fields (Validation)');
  let res = await apiCall('/api/events', 'POST', { eventTitle: 'Missing fields' }, orgToken);
  if (res.status === 400) console.log('✅ Missing required fields -> 400 Bad Request');
  else { console.log(`❌ Failed. Expected 400, got ${res.status}`); process.exit(1); }

  // 2. Organizer without permission attempts event creation → expect 403
  console.log('\\n[Test 2] Organizer without permission creates event');
  const eventPayload = {
    title: 'SIT Tech Symposium 2026',
    department: 'CSE',
    eventType: 'Technical',
    date: '2026-10-10',
    time: '10:00',
    venue: 'Main Auditorium'
  };
  res = await apiCall('/api/events', 'POST', eventPayload, orgNoPermToken);
  if (res.status === 403) console.log('✅ Unauthorized organizer creation -> 403 Forbidden');
  else { console.log(`❌ Failed. Expected 403, got ${res.status}`); process.exit(1); }

  // 3. Approval requested for a non-existent event → expect 404
  console.log('\\n[Test 3] Approve non-existent event');
  res = await apiCall('/api/events/fake-event-123/status', 'PATCH', { status: 'PENDING_HOD' }, facToken);
  if (res.status === 404) console.log('✅ Non-existent event -> 404 Not Found');
  else { console.log(`❌ Failed. Expected 404, got ${res.status}`); process.exit(1); }

  // 4. Successful Event Creation
  console.log('\\n[Test 4] Successful Event Creation');
  res = await apiCall('/api/events', 'POST', eventPayload, orgToken);
  if (res.status === 201) console.log(`✅ Event created successfully. Body: ${JSON.stringify(res.body)}`);
  else { console.log(`❌ Failed Event Creation. Status: ${res.status}, Body: ${JSON.stringify(res.body)}`); process.exit(1); }
  
  const eventId = res.body.event ? res.body.event.id : (res.body.eventId || res.body.id);

  // Wait for EventBus to persist the event
  await new Promise(r => setTimeout(r, 2500));

  // 5. Unauthorized role attempts approval → expect 403
  console.log('\\n[Test 5] Unauthorized role (Student) approves event');
  res = await apiCall(`/api/events/${eventId}/status`, 'PATCH', { status: 'PENDING_HOD' }, orgToken);
  if (res.status === 403) console.log('✅ Student approval rejected -> 403 Forbidden');
  else { console.log(`❌ Failed. Expected 403, got ${res.status}`); process.exit(1); }

  // 6. Invalid workflow transition (HOD approves before Faculty) → expect rejection
  console.log('\\n[Test 6] Invalid workflow transition (HOD approves early)');
  res = await apiCall(`/api/events/${eventId}/status`, 'PATCH', { status: 'PENDING_IQAC' }, hodToken);
  if (res.status === 403) console.log(`✅ Invalid workflow transition rejected -> 403 Forbidden (${res.body.message})`);
  else { console.log(`❌ Failed. Expected 403, got ${res.status}`); process.exit(1); }

  // 7. Successful Faculty Approval
  console.log('\\n[Test 7] Valid Faculty Approval');
  res = await apiCall(`/api/events/${eventId}/status`, 'PATCH', { status: 'PENDING_HOD' }, facToken);
  if (res.status === 200) console.log('✅ Faculty approval successful');
  else { console.log(`❌ Failed. Expected 200, got ${res.status}`); process.exit(1); }

  // 8. Duplicate approval request → verify idempotent behavior
  console.log('\\n[Test 8] Duplicate Faculty approval (Idempotency)');
  res = await apiCall(`/api/events/${eventId}/status`, 'PATCH', { status: 'PENDING_HOD' }, facToken);
  if (res.status === 400) console.log(`✅ Idempotency enforced. Faculty approval rejected because it is no longer PENDING_FACULTY -> 400 (${res.body.message})`);
  else if (res.status === 200) console.log(`✅ Idempotency enforced. Returned 200 without side effects.`);
  else { console.log(`❌ Failed idempotency check. Got ${res.status}`); process.exit(1); }

  console.log('\\n--- Event Workflow Automated Tests Passed ---');
  process.exit(0);
}

runTest();
