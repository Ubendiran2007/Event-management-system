const getEventDateTime = (event) => {
  const dateStr = event?.requisition?.step1?.eventStartDate || event?.date;
  const timeStr = event?.requisition?.step1?.eventStartTime || event?.startTime || '00:00';
  if (!dateStr) return 0;
  try {
    const [y, m, d] = dateStr.split('-');
    const [h, min] = timeStr.split(':');
    return new Date(y, m - 1, d, h, min).getTime();
  } catch (e) {
    return 0;
  }
};

const getEventEndDateTime = (event) => {
  const dateStr = event?.requisition?.step1?.eventEndDate || event?.date;
  const timeStr = event?.requisition?.step1?.eventEndTime || event?.endTime || '23:59';
  if (!dateStr) return 0;
  try {
    const [y, m, d] = dateStr.split('-');
    const [h, min] = timeStr.split(':');
    return new Date(y, m - 1, d, h, min).getTime();
  } catch (e) {
    return 0;
  }
};

const getFallbackSort = (a, b) => {
  const aCreated = new Date(a.createdAt || 0).getTime();
  const bCreated = new Date(b.createdAt || 0).getTime();
  return bCreated - aCreated;
};

export const sortEventsByEventDateDesc = (a, b) => {
  const timeA = getEventDateTime(a);
  const timeB = getEventDateTime(b);
  if (timeB !== timeA) return timeB - timeA;
  return getFallbackSort(a, b);
};

export const sortEventsBySubmissionDesc = (a, b) => {
  const timeA = new Date(a.submittedAt || a.createdAt || 0).getTime();
  const timeB = new Date(b.submittedAt || b.createdAt || 0).getTime();
  if (timeB !== timeA) return timeB - timeA;
  return getFallbackSort(a, b);
};

export const sortEventsByEndDateDesc = (a, b) => {
  const timeA = getEventEndDateTime(a);
  const timeB = getEventEndDateTime(b);
  if (timeB !== timeA) return timeB - timeA;
  return getFallbackSort(a, b);
};
