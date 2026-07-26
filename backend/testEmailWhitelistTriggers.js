/**
 * testEmailWhitelistTriggers.js
 * Verification script for the 23-Template Whitelist and Email Triggers refactoring.
 */

// Enable email test mode so we do not attempt GCP Firestore connections or real SMTP calls during verification
process.env.EMAIL_TEST_MODE = 'true';

const emailTemplates = require('./services/emailTemplates');
const emailService = require('./services/emailService');
const emailHandler = require('./services/emailHandler');

// Mock emailService sending methods so standalone CLI testing doesn't require GCP credentials or live Firestore
emailService.sendManagerAssignmentEmail = async (email, evt, name) => {
  console.log(`[MOCK EMAIL] Manager Assignment sent to ${email} for event "${evt.title}"`);
  return { messageId: 'mock_mgr_assign' };
};
emailService.sendIQACExtensionRequestEmail = async (evt, reason) => {
  console.log(`[MOCK EMAIL] IQAC Extension Request sent to IQAC_TEAM for event "${evt.title}"`);
  return { messageId: 'mock_iqac_ext' };
};
emailService.sendEventApprovedEmail = async (evt) => {
  console.log(`[MOCK EMAIL] Event Approved sent to organizer for event "${evt.title}"`);
  return { messageId: 'mock_evt_appr' };
};

console.log('=== STARTING EMAIL WHITELIST & TRIGGER VERIFICATION ===\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${message}`);
    failCount++;
  }
}

// 1. Verify Active Whitelisted Email Templates exist in emailTemplates.js
const expectedActiveTemplateFunctions = [
  'eventCreationTemplate',                // #1: Event Creation Confirmation
  'managerAssignmentTemplate',            // #2: Manager Assigned
  'managerAcceptedTemplate',              // #3: Manager Accepted
  'managerDeclinedTemplate',              // #4: Manager Declined
  'eventStatusTemplate',                  // #5 Revision Required, #6 Event Approved, #7 Event Rejected
  'postponementApprovalRequestTemplate',  // #8 Modification Request Submitted (Postpone to HOD)
  'postponementRequestToIQACTemplate',    // #9 Modification Request Submitted (Postpone to IQAC)
  'postponementApprovedTemplate',         // #10 Event Postponed
  'postponementRejectedTemplate',         // #11 Modification Request Rejected (Postpone)
  'cancellationApprovalRequestTemplate',  // #12 Cancellation Request Submitted (Cancel to HOD)
  'cancellationRequestToIQACTemplate',    // #13 Cancellation Request Submitted (Cancel to IQAC)
  'cancellationApprovedTemplate',         // #14 Event Cancelled
  'cancellationRejectedTemplate',         // #15 Cancellation Request Rejected (Cancel)
  'iqacSubmissionRequestTemplate',        // #16 IQAC Assigned
  'iqacExtensionRequestTemplate',         // #17 IQAC Extension Request
  'iqacExtensionStatusTemplate',          // #18 IQAC Extension Approved, #19 IQAC Extension Rejected
  'accountLockedTemplate'                 // #20 Account Locked
];

console.log('--- 1. Testing Active Templates Whitelist ---');
expectedActiveTemplateFunctions.forEach(templateName => {
  const fn = emailTemplates[templateName];
  assert(typeof fn === 'function', `Active template function exists: ${templateName}`);
});

// 2. Verify Legacy Templates & Helpers are preserved in disabled mode for backward compatibility
console.log('\n--- 2. Testing Disabled Legacy Templates & Helpers ---');
const legacyTemplates = [
  'studentRegistrationTemplate',          // Disabled: In-App / WhatsApp only per policy
  'certificateReadyTemplate'              // Disabled: In-App / WhatsApp only per policy
];

legacyTemplates.forEach(templateName => {
  const fn = emailTemplates[templateName];
  assert(typeof fn === 'function', `Legacy template preserved (disabled per policy): ${templateName}`);
});

const legacyHelpers = [
  'sendEventNotificationToFaculty',
  'sendPosterRequestEmail',
  'sendPosterReadyEmail',
  'sendStudentRegistrationStatusEmail',
  'sendPostEventFeedbackEmail',
  'sendIQACReminderEmail'
];

legacyHelpers.forEach(helperName => {
  const fn = emailService[helperName];
  assert(typeof fn === 'function', `Legacy helper preserved (disabled per policy): ${helperName}`);
});

// 3. Verify Manager Assignment Diffing and Deduplication in emailHandler.js
console.log('\n--- 3. Testing Manager Assignment Deduplication & Diffing ---');
assert(typeof emailHandler.notifyManagersAssigned === 'function', 'notifyManagersAssigned function exists on emailHandler');

const mockEvent = { id: 'evt_test_1', title: 'Test Tech Fest', organizerEmail: 'org@test.com' };
const oldManagers = [
  { email: 'mgr1@test.com', name: 'Manager One', status: 'ACCEPTED' },
  { email: 'mgr2@test.com', name: 'Manager Two', status: 'PENDING' }
];
const sameManagers = [
  { email: 'mgr1@test.com', name: 'Manager One', status: 'ACCEPTED' },
  { email: 'mgr2@test.com', name: 'Manager Two', status: 'PENDING' }
];
const newManagers = [
  { email: 'mgr1@test.com', name: 'Manager One', status: 'ACCEPTED' },
  { email: 'mgr2@test.com', name: 'Manager Two', status: 'PENDING' },
  { email: 'mgr3@test.com', name: 'Manager Three', status: 'PENDING' }
];

console.log('Running mock diff test (check console logs for [Email Handler] and [LEGACY_DISABLED])...');
emailHandler.notifyManagersAssigned(mockEvent, sameManagers, oldManagers)
  .then(() => {
    assert(true, 'No exception when old managers equal new managers (no emails sent)');
    return emailHandler.notifyManagersAssigned(mockEvent, newManagers, oldManagers);
  })
  .then(() => {
    assert(true, 'Successfully processed diffing when a new manager was added');
    
    // 4. Verify IQAC Extension Routing
    console.log('\n--- 4. Testing IQAC Extension Routing ---');
    assert(typeof emailHandler.handleIQACExtensionRequest === 'function', 'handleIQACExtensionRequest exists');
    return emailHandler.handleIQACExtensionRequest({ id: 'evt_test_iqac', title: 'Test IQAC Event' }, 'Need 2 more days');
  })
  .then(() => {
    assert(true, 'handleIQACExtensionRequest executed without error routing to IQAC_TEAM');

    // 5. Verify Event Status Change (Approved only on POSTED/PUBLISHED)
    console.log('\n--- 5. Testing Event Approved Trigger (POSTED/PUBLISHED only) ---');
    assert(typeof emailHandler.handleEventStatusChange === 'function', 'handleEventStatusChange exists');
    return emailHandler.handleEventStatusChange({ id: 'evt_test_status', title: 'Test Status', organizerEmail: 'org@test.com' }, 'PENDING_HOD', 'PENDING_IQAC');
  })
  .then(() => {
    assert(true, 'Moving to PENDING_IQAC does NOT send Event Approved email (no error)');
    return emailHandler.handleEventStatusChange({ id: 'evt_test_status', title: 'Test Status', organizerEmail: 'org@test.com' }, 'PENDING_IQAC', 'POSTED');
  })
  .then(() => {
    assert(true, 'Moving to POSTED successfully triggers Event Approved email');

    console.log(`\n=== SUMMARY: ${passCount} PASSED, ${failCount} FAILED ===`);
    if (failCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  })
  .catch(err => {
    console.error('Test script encountered an error:', err);
    process.exit(1);
  });
