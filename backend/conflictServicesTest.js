require('dotenv').config();
const ScheduleService = require('./services/ScheduleService');
const RegistrationConflictService = require('./services/RegistrationConflictService');
const ManagerAvailabilityService = require('./services/ManagerAvailabilityService');
const ManagerRecommendationService = require('./services/ManagerRecommendationService');
const SchedulingEngine = require('./services/SchedulingEngine');
const eventBus = require('./events/eventBus');

async function runTests() {
  console.log('====================================================');
  console.log('STARTING CONFLICT & SCHEDULE SERVICES VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} ${details ? '-> ' + details : ''}`);
      failed++;
    }
  }

  try {
    // 1. Test Time Overlap Logic
    console.log('--- 1. Testing ScheduleService._isTimeOverlapping ---');
    const overlap1 = ScheduleService._isTimeOverlapping('2026-08-10', '10:00', '12:00', '2026-08-10', '11:00', '13:00');
    assert(overlap1 === true, 'Overlapping time windows (10:00-12:00 and 11:00-13:00 on same day)');

    const overlap2 = ScheduleService._isTimeOverlapping('2026-08-10', '10:00', '12:00', '2026-08-10', '12:30', '14:00');
    assert(overlap2 === false, 'Non-overlapping time windows on same day');

    const overlap3 = ScheduleService._isTimeOverlapping('2026-08-10', '10:00', '12:00', '2026-08-11', '10:00', '12:00');
    assert(overlap3 === false, 'Same time window on different days');

    const overlap4 = ScheduleService._isTimeOverlapping('2026-08-10', '09:00', '17:00', '2026-08-10', '10:00', '11:00');
    assert(overlap4 === true, 'Inner time window fully contained within outer window');

    // 2. Test EventBus Telemetry Integration
    console.log('\n--- 2. Testing EventBus Emissions & Idempotency ---');
    let emittedEvent = null;
    const testListener = (payload) => { emittedEvent = payload; };
    eventBus.on('test.conflict.event', testListener);

    const emitted = eventBus.publish('test.conflict.event', {
      entityId: 'test_entity_123',
      timestamp: Date.now(),
      message: 'Test conflict emission'
    });
    assert(emitted !== false && emittedEvent?.entityId === 'test_entity_123', 'EventBus published and delivered event with correlation tracking');

    // Test Idempotency
    const duplicateEmit = eventBus.publish('test.conflict.event', {
      entityId: 'test_entity_123',
      timestamp: emittedEvent.timestamp,
      message: 'Duplicate emission'
    });
    assert(duplicateEmit === false, 'EventBus caught duplicate event and enforced idempotency');
    eventBus.off('test.conflict.event', testListener);

    // 3. Test RegistrationConflictService with Mock Schedule Override
    console.log('\n--- 3. Testing RegistrationConflictService ---');
    // Save original method
    const originalCheckOverlap = ScheduleService.checkOverlap;
    
    // Mock checkOverlap for testing conflict throw
    ScheduleService.checkOverlap = async (userId, date, startTime, endTime, excludeEventId) => {
      if (userId === 'student_with_conflict') {
        return {
          hasConflict: true,
          conflicts: [{
            eventId: 'existing_ev_101',
            eventName: 'Annual Tech Symposium',
            date: '2026-08-15',
            startTime: '09:00',
            endTime: '16:00',
            type: 'REGISTRATION',
            role: 'Participant',
            reason: 'Already participating in another event'
          }]
        };
      }
      return { hasConflict: false, conflicts: [] };
    };

    let regFailEmitted = false;
    eventBus.on('registration.validation.failed', () => { regFailEmitted = true; });

    try {
      await RegistrationConflictService.validateRegistration(
        'student_with_conflict',
        'new_ev_202',
        '2026-08-15',
        '10:00',
        '12:00',
        'Rahul Sharma'
      );
      assert(false, 'Should throw CONFLICT error when overlapping commitment exists');
    } catch (err) {
      assert(
        err.status === 409 && err.message.includes('Annual Tech Symposium') && regFailEmitted,
        'Threw 409 CONFLICT with event name details and emitted registration.validation.failed EventBus event'
      );
    }

    let regSuccessEmitted = false;
    eventBus.on('registration.success', () => { regSuccessEmitted = true; });
    const successRes = await RegistrationConflictService.validateRegistration(
      'free_student',
      'new_ev_202',
      '2026-08-15',
      '10:00',
      '12:00',
      'Priya Patel'
    );
    assert(successRes.success === true && regSuccessEmitted, 'Validated registration successfully for free student and emitted registration.success');

    // 4. Test ManagerAvailabilityService
    console.log('\n--- 4. Testing ManagerAvailabilityService ---');
    let mgrConflictEmitted = false;
    eventBus.on('manager.assignment.conflict', () => { mgrConflictEmitted = true; });

    try {
      await ManagerAvailabilityService.validateManagerAssignments(
        'new_ev_303',
        '2026-08-15',
        '10:00',
        '14:00',
        [{ userId: 'student_with_conflict', status: 'ACCEPTED', name: 'Rahul Sharma' }],
        { userId: 'admin_1' }
      );
      assert(false, 'Should throw CONFLICT when manager candidate has overlapping commitment');
    } catch (err) {
      assert(
        err.status === 409 && err.conflicts?.length > 0 && mgrConflictEmitted,
        'Threw 409 CONFLICT for manager availability and emitted manager.assignment.conflict EventBus event'
      );
    }

    // Restore original method
    ScheduleService.checkOverlap = originalCheckOverlap;

    console.log('\n--- 5. Testing Unified SchedulingEngine Orchestration ---');
    // Mock checkOverlap to simulate clean vs conflict scenarios
    const originalCheckOverlap2 = ScheduleService.checkOverlap;
    ScheduleService.checkOverlap = async (userId, date, startTime, endTime, excludeEventId) => {
      if (userId === 'busy_student') {
        return {
          hasConflict: true,
          conflicts: [{ eventId: 'ev_busy', eventName: 'Existing Lab', date, startTime, endTime, type: 'REGISTRATION', reason: 'Already participating in another event' }]
        };
      }
      return { hasConflict: false, conflicts: [] };
    };

    const cleanResult = await SchedulingEngine.validateEventSchedule({
      date: '2026-08-15',
      startTime: '10:00',
      endTime: '12:00',
      managerIds: ['free_student']
    });
    assert(
      cleanResult.valid && cleanResult.summary.managers && cleanResult.conflicts.managers.length === 0 && Array.isArray(cleanResult.warnings) && typeof cleanResult.metadata?.durationMs === 'number',
      'SchedulingEngine validated clean schedule returning standardized SchedulingResult contract with performance metadata'
    );

    const conflictResult = await SchedulingEngine.validateEventSchedule({
      date: '2026-08-15',
      startTime: '10:00',
      endTime: '12:00',
      managerIds: ['busy_student']
    });
    assert(
      !conflictResult.valid && !conflictResult.summary.managers && conflictResult.conflicts.managers.length > 0 && conflictResult.recommendations && conflictResult.conflicts.managers[0].code && conflictResult.conflicts.managers[0].ruleId,
      'SchedulingEngine detected manager conflict returning structured conflicts, error codes, rule identifiers, and recommendations'
    );

    ScheduleService.checkOverlap = originalCheckOverlap2;

    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal error during testing:', err);
    process.exit(1);
  }
}

runTests();
