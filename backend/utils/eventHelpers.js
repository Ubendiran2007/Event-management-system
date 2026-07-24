function computeRegistrationStatus(eventData) {
  let status = 'OPEN';
  const stats = eventData.stats || {};
  const currentRegisteredCount = stats.registeredCount || 0;
  
  if (eventData.capacity && currentRegisteredCount >= eventData.capacity) {
    status = 'FULL';
    return status;
  }

  const startDateStr = eventData.requisition?.step1?.eventStartDate || eventData.date;
  const startTimeStr = eventData.requisition?.step1?.eventStartTime || eventData.startTime || '00:00';
  let effectiveDeadlineTimestamp = null;
  let eventStartTimestamp = null;

  try {
    if (startDateStr) {
      const sDP = startDateStr.split('-');
      const sTP = startTimeStr.split(':');
      eventStartTimestamp = new Date(parseInt(sDP[0]), parseInt(sDP[1]) - 1, parseInt(sDP[2]), parseInt(sTP[0]), parseInt(sTP[1])).getTime();
    }
  } catch (err) {}

  if (eventData.registrationDeadline) {
    effectiveDeadlineTimestamp = new Date(eventData.registrationDeadline).getTime();
  } else if (eventStartTimestamp) {
    effectiveDeadlineTimestamp = eventStartTimestamp;
  }

  if (effectiveDeadlineTimestamp && Date.now() >= effectiveDeadlineTimestamp) {
    status = 'CLOSED';
  } else if (!effectiveDeadlineTimestamp && startDateStr) {
    const today = new Date().toISOString().split('T')[0];
    if (startDateStr < today) {
      status = 'CLOSED';
    }
  }

  return status;
}

module.exports = { computeRegistrationStatus };

