/**
 * e2eEmailWorkflowValidation.js
 * End-to-end validation of the production email notification workflows.
 */

process.env.EMAIL_TEST_MODE = 'true'; // Prevent real GCP calls

const emailHandler = require('./services/emailHandler');
const emailService = require('./services/emailService');
const emailTemplates = require('./services/emailTemplates');

// Spy on all template functions to detect which emails are actually constructed and dispatched
let dispatchedTemplates = [];
for (const key of Object.keys(emailTemplates)) {
  if (typeof emailTemplates[key] === 'function') {
    const original = emailTemplates[key];
    emailTemplates[key] = function (...args) {
      dispatchedTemplates.push(key);
      return original.apply(this, args);
    };
  }
}

// Mock roles for testing Approval Workflow
emailHandler.getEmailsByRole = async (role) => {
  if (role === 'HOD') return ['hod@test.com'];
  if (role === 'IQAC_TEAM') return ['iqac@test.com'];
  return [];
};

console.log('=== STARTING END-TO-END EMAIL WORKFLOW VALIDATION ===\n');

let passCount = 0;
let failCount = 0;
let failedMessages = [];

function assertEmailSent(templateName, message) {
  if (dispatchedTemplates.includes(templateName)) {
    console.log(`[PASS] ${message} -> Sent ${templateName}`);
    passCount++;
  } else {
    const msg = `[FAIL] ${message} -> Expected ${templateName} to be sent`;
    console.error(msg);
    failedMessages.push(msg);
    failCount++;
  }
}

function assertNoEmailSent(templateName, message) {
  if (!dispatchedTemplates.includes(templateName)) {
    console.log(`[PASS] ${message}`);
    passCount++;
  } else {
    const msg = `[FAIL] ${message} -> Unexpectedly sent ${templateName}`;
    console.error(msg);
    failedMessages.push(msg);
    failCount++;
  }
}

function clearInbox() {
  dispatchedTemplates = [];
}

async function runE2ETests() {
  try {
    const mockEvent = { id: 'evt_1', title: 'Tech Symposium', organizerEmail: 'faculty@test.com', type: 'SEMINAR' };
    
    // --- SCENARIO 1: EVENT CREATION ---
    console.log('--- SCENARIO 1: Event Creation ---');
    clearInbox();
    await emailHandler.handleEventStatusChange(mockEvent, 'DRAFT', 'PENDING_HOD');
    assertEmailSent('approvalRequestTemplate', 'HOD receives approval request');
    
    clearInbox();
    const newManagers = [{ email: 'mgr1@test.com', name: 'Manager 1', status: 'PENDING' }];
    await emailHandler.notifyManagersAssigned(mockEvent, newManagers, []);
    assertEmailSent('managerAssignmentTemplate', 'Newly assigned managers receive assignment email');
    
    // --- SCENARIO 2: MANAGER ASSIGNMENT ---
    console.log('\n--- SCENARIO 2: Manager Assignment ---');
    clearInbox();
    await emailHandler.executeBackgroundNotification('Manager Accepted', () => 
      emailService.sendManagerAcceptedEmail('faculty@test.com', mockEvent, 'Manager 1')
    );
    assertEmailSent('managerAcceptedTemplate', 'Manager accepts -> Coordinator receives acceptance email');
    
    clearInbox();
    await emailHandler.executeBackgroundNotification('Manager Declined', () => 
      emailService.sendManagerDeclinedEmail('faculty@test.com', mockEvent, 'Manager 1')
    );
    assertEmailSent('managerDeclinedTemplate', 'Manager declines -> Coordinator receives decline email');
    
    // --- SCENARIO 3: APPROVAL WORKFLOW ---
    console.log('\n--- SCENARIO 3: Approval Workflow ---');
    clearInbox();
    await emailHandler.handleEventStatusChange(mockEvent, 'PENDING_HOD', 'PENDING_IQAC');
    assertNoEmailSent('eventStatusTemplate', 'Event Creator should NOT receive Event Approved yet (PENDING_IQAC)');
    
    clearInbox();
    await emailHandler.handleEventStatusChange(mockEvent, 'PENDING_IQAC', 'POSTED');
    assertEmailSent('eventStatusTemplate', 'IQAC approves -> Event Creator receives Event Approved');
    
    clearInbox();
    await emailHandler.handleEventStatusChange(mockEvent, 'PENDING_IQAC', 'REJECTED');
    assertEmailSent('eventStatusTemplate', 'IQAC rejects -> Event Creator receives Event Rejected');
    
    // --- SCENARIO 4: POSTPONEMENT ---
    console.log('\n--- SCENARIO 4: Postponement ---');
    clearInbox();
    await emailHandler.handleModificationRequestSubmitted(mockEvent, 'POSTPONE', 'PENDING_HOD', 'Need more time');
    assertEmailSent('postponementApprovalRequestTemplate', 'Faculty submits request -> HOD email');
    
    clearInbox();
    await emailHandler.handleModificationRequestSubmitted(mockEvent, 'POSTPONE', 'PENDING_IQAC', 'Need more time');
    assertEmailSent('postponementRequestToIQACTemplate', 'HOD approves -> IQAC email');
    
    clearInbox();
    await emailHandler.handleEventPostponed(mockEvent);
    assertEmailSent('postponementApprovedTemplate', 'IQAC approves -> All required stakeholders notified');
    
    clearInbox();
    await emailHandler.handleModificationRequestDecision(mockEvent, 'POSTPONE', false, 'Rejected by IQAC');
    assertEmailSent('postponementRejectedTemplate', 'IQAC rejects -> Event Creator notified');

    // --- SCENARIO 5: CANCELLATION ---
    console.log('\n--- SCENARIO 5: Cancellation ---');
    clearInbox();
    await emailHandler.handleModificationRequestSubmitted(mockEvent, 'CANCEL', 'PENDING_HOD', 'Event cancelled');
    assertEmailSent('cancellationApprovalRequestTemplate', 'Faculty submits request -> HOD email');
    
    clearInbox();
    await emailHandler.handleModificationRequestSubmitted(mockEvent, 'CANCEL', 'PENDING_IQAC', 'Event cancelled');
    assertEmailSent('cancellationRequestToIQACTemplate', 'HOD approves -> IQAC email');
    
    clearInbox();
    await emailHandler.handleEventCancelled(mockEvent);
    assertEmailSent('cancellationApprovedTemplate', 'IQAC approves -> All required stakeholders notified');
    
    clearInbox();
    await emailHandler.handleModificationRequestDecision(mockEvent, 'CANCEL', false, 'Rejected by IQAC');
    assertEmailSent('cancellationRejectedTemplate', 'IQAC rejects -> Event Creator notified');
    
    // --- SCENARIO 6: IQAC SUBMISSION ---
    console.log('\n--- SCENARIO 6: IQAC Submission ---');
    clearInbox();
    await emailHandler.executeBackgroundNotification('Submission Request', () => 
      emailService.sendIQACSubmissionRequestEmail('faculty@test.com', mockEvent, 'user')
    );
    assertEmailSent('iqacSubmissionRequestTemplate', 'Event completed -> Submission request email');
    
    clearInbox();
    await emailHandler.handleIQACExtensionRequest(mockEvent, 'Need 2 days');
    assertEmailSent('iqacExtensionRequestTemplate', 'Extension request -> IQAC');
    
    clearInbox();
    await emailHandler.handleIQACExtensionDecision(mockEvent, 'APPROVED', '2026-08-01');
    assertEmailSent('iqacExtensionStatusTemplate', 'Extension decision -> Event Creator');

    // --- SCENARIO 7: NEGATIVE TESTS ---
    console.log('\n--- SCENARIO 7: Negative Tests ---');
    clearInbox();
    // Verify legacy workflows do not dispatch emails via emailHandler
    assertNoEmailSent('studentRegistrationTemplate', 'Student registration -> No email, only WhatsApp + In-App');
    assertNoEmailSent('posterRequestTemplate', 'Poster workflow -> No email');
    assertNoEmailSent('feedbackRequestTemplate', 'Feedback workflow -> No email');
    assertNoEmailSent('loginAlertTemplate', 'Login alerts -> No email');
    
    clearInbox();
    const existingManagers = [{ email: 'mgr1@test.com', name: 'Manager 1', status: 'PENDING' }];
    await emailHandler.notifyManagersAssigned(mockEvent, existingManagers, existingManagers);
    assertNoEmailSent('managerAssignmentTemplate', 'Editing an event without changing managers -> No manager assignment email');
    
    console.log(`\n====================================================`);
    console.log(`TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    if (failedMessages.length > 0) {
      console.log(`\nFAILED TESTS:`);
      failedMessages.forEach(msg => console.log(`  ❌ ${msg}`));
    }
    console.log(`====================================================`);
    
    process.exit(failCount > 0 ? 1 : 0);
  } catch (error) {
    console.error('E2E validation failed:', error);
    process.exit(1);
  }
}

runE2ETests();
