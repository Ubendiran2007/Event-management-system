const { canUploadMedia } = require('../utils/permissions');
const { UserRole, EventStatus } = require('../events/constants/eventTypes');

describe('PermissionEngine - Media Permissions', () => {
  const mediaTeamUser = { uid: 'u1', role: UserRole.MEDIA };
  const organizerUser = { uid: 'u2', role: UserRole.STUDENT_ORGANIZER };
  const randomStudent = { uid: 'u3', role: UserRole.STUDENT_GENERAL };

  it('should DENY all uploads if event is not ENDED', () => {
    const event = { status: EventStatus.POSTED, needsMediaSupport: true, ownerId: 'u2' };
    
    expect(canUploadMedia(mediaTeamUser, event)).toBe(false);
    expect(canUploadMedia(organizerUser, event)).toBe(false);
  });

  describe('When Event is ENDED', () => {
    it('should ALLOW Media Team if mediaRequested is true', () => {
      const event = { status: EventStatus.ENDED, mediaRequested: true };
      expect(canUploadMedia(mediaTeamUser, event)).toBe(true);
    });

    it('should DENY Organizer if mediaRequested is true', () => {
      const event = { status: EventStatus.ENDED, mediaRequested: true, ownerId: 'u2' };
      expect(canUploadMedia(organizerUser, event)).toBe(false);
    });

    it('should ALLOW Organizer if mediaRequested is false', () => {
      const event = { status: EventStatus.ENDED, mediaRequested: false, ownerId: 'u2' };
      expect(canUploadMedia(organizerUser, event)).toBe(true);
    });

    it('should DENY Random Student always', () => {
      const event1 = { status: EventStatus.ENDED, mediaRequested: false, ownerId: 'u2' };
      const event2 = { status: EventStatus.ENDED, mediaRequested: true, ownerId: 'u2' };
      expect(canUploadMedia(randomStudent, event1)).toBe(false);
      expect(canUploadMedia(randomStudent, event2)).toBe(false);
    });
  });
});
