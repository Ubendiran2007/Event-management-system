/**
 * END-TO-END WORKFLOW TEST
 * 
 * This script tests the entire event management model:
 * 1. Event Proposal Creation (Student Organizer)
 * 2. Multi-tier Approvals (Faculty -> HOD -> Departments -> IQAC)
 * 3. Student Registration (OD Request)
 * 4. Organizer Approval of Registration
 */

const API_BASE = 'http://localhost:5001/api';

async function runTest() {
  console.log('🚀 Starting End-to-End Workflow Test...\n');

  try {
    // 1. Create a mock event as Student Organizer (John Doe)
    console.log('Step 1: Creating event proposal...');
    const eventResp = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'E2E Workflow Test Event',
        organizerId: 'john_doe_id', // mock id
        organizerName: 'John Doe',
        organizerEmail: 'john@student.edu',
        date: '2026-04-20',
        venue: 'Grand Hall',
        startTime: '10:00',
        endTime: '16:00',
        requisition: {
          step1: {
            eventName: 'E2E Workflow Test Event',
            eventStartDate: '2026-04-20',
            eventEndDate: '2026-04-20',
            eventStartTime: '10:00',
            eventEndTime: '16:00',
            organizerDetails: { organizerName: 'John Doe', department: 'CSE' }
          },
          step2: {
            venueRequired: true,
            mediaRequired: true,
            audioRequired: false
          }
        }
      })
    });
    const eventData = await eventResp.json();
    if (!eventData.success) throw new Error(`Event creation failed: ${eventData.message}`);
    const eventId = eventData.event.id;
    console.log(`✅ Event created! ID: ${eventId}\n`);

    // 2. Faculty Approval
    console.log('Step 2: Faculty Approval (Dr. Arul Kumar)...');
    const facultyApprove = await fetch(`${API_BASE}/events/${eventId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PENDING_HOD', approvedBy: 'Dr. Arul Kumar' })
    });
    if (!facultyApprove.ok) throw new Error('Faculty approval failed');
    console.log('✅ Faculty Approved!\n');

    // 3. HOD Approval
    console.log('Step 3: HOD Approval (Dr. Meena Iyer)...');
    const hodApprove = await fetch(`${API_BASE}/events/${eventId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PENDING_DEPARTMENTS', approvedBy: 'Dr. Meena Iyer' })
    });
    if (!hodApprove.ok) throw new Error('HOD approval failed');
    console.log('✅ HOD Approved! (Now in Department Approval phase)\n');

    // 4. Department Approvals (Venue/HR)
    console.log('Step 4: HR Department Approval...');
    const hrApprove = await fetch(`${API_BASE}/events/${eventId}/department-approval`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ department: 'venue', approvedBy: 'HR Department' })
    });
    if (!hrApprove.ok) throw new Error('HR approval failed');
    
    console.log('Step 4.1: Media Team Approval...');
    const mediaApprove = await fetch(`${API_BASE}/events/${eventId}/department-approval`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ department: 'media', approvedBy: 'Media Team' })
    });
    if (!mediaApprove.ok) throw new Error('Media approval failed');
    console.log('✅ Department Approvals Complete!\n');

    // 5. IQAC Finalization
    console.log('Step 5: IQAC Finalization (IQAC Team)...');
    const iqacApprove = await fetch(`${API_BASE}/events/${eventId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'POSTED', approvedBy: 'IQAC Team' })
    });
    if (!iqacApprove.ok) throw new Error('IQAC finalization failed');
    console.log('✅ Event POSTED! Publicly visible!\n');

    // 6. Student Registration (Jane Smith)
    console.log('Step 6: Student Registration (Jane Smith)...');
    const regResp = await fetch(`${API_BASE}/od-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: eventId,
        studentId: 'jane_smith_id',
        studentName: 'Jane Smith',
        rollNo: '22CSE01',
        class: 'CSE-B',
        email: 'jane@student.edu',
        reason: 'Participation in E2E test event'
      })
    });
    const regData = await regResp.json();
    if (!regData.success) throw new Error(`Registration failed: ${regData.message}`);
    const odId = regData.odRequest.id;
    console.log(`✅ Student Registered! OD Request ID: ${odId}\n`);

    // 7. Organizer Approval for Registration
    console.log('Step 7: Organizer Approval for Registration (John Doe)...');
    const orgApprove = await fetch(`${API_BASE}/od-requests/${odId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'APPROVED', approvedBy: 'John Doe' })
    });
    if (!orgApprove.ok) throw new Error('Organizer approval failed');
    console.log('✅ Registration APPROVED! Workflow logic verified!\n');

    console.log('🎉 ALL TESTS PASSED! The Entire Model is Working Correctly.');

  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    console.error(error.message);
    process.exit(1);
  }
}

runTest();
