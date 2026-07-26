const { UserRole, EventStatus } = require('../events/constants/eventTypes');

/**
 * Central Permission Engine
 * Defines all access control rules across the platform to prevent scattered logic.
 */
const PermissionEngine = {
  /**
   * Can a user edit this event?
   */
  canEditEvent: (user, event) => {
    if (!user || !event) return false;
    if (user.role === UserRole.SUPER_ADMIN) return true;
    
    // Only owner can edit, and only in specific states
    const isOwner = event.ownerId === user.uid || event.owner === user.email || event.uid === user.uid;
    const isModifiableState = [
      EventStatus.DRAFT, 
      EventStatus.WAITING_FOR_MANAGER,
      EventStatus.READY_FOR_APPROVAL,
      EventStatus.CHANGES_REQUESTED
    ].includes(event.status);

    return isOwner && isModifiableState;
  },

  /**
   * Can a user submit this event for approval?
   */
  canSubmitForApproval: (user, event, acceptedManagersCount) => {
    if (!user || !event) return false;
    
    const isOwner = event.ownerId === user.uid || event.owner === user.email || event.uid === user.uid;
    if (!isOwner) return false;

    // Must have at least 1 accepted manager
    if (acceptedManagersCount < 1) return false;

    const isSubmittableState = [
      EventStatus.DRAFT, 
      EventStatus.WAITING_FOR_MANAGER,
      EventStatus.READY_FOR_APPROVAL
    ].includes(event.status);

    return isSubmittableState;
  },

  /**
   * Can a user act as an approver (HOD, IQAC, Principal) for this event?
   */
  canApprove: (user, event, requiredRole) => {
    if (!user || !event) return false;
    if (user.role === UserRole.SUPER_ADMIN) return true;
    
    // The user must hold the required role for the current step
    return user.role === requiredRole;
  },

  /**
   * Can a user upload media?
   */
  canUploadMedia: (user, event) => {
    if (!user || !event) return false;
    
    // Only allowed if event has ENDED or POST_EVENT_IN_PROGRESS or PENDING_FACULTY_VERIFICATION, etc.
    const validPostEventStates = [
      EventStatus.ENDED, 
      EventStatus.POST_EVENT_IN_PROGRESS,
      'PENDING_FACULTY_VERIFICATION',
      'PENDING_HOD_VERIFICATION',
      'PENDING_IQAC_VERIFICATION'
    ];

    if (!validPostEventStates.includes(event.status)) {
      return false; // Deny if not ended
    }

    const isMediaTeam = user.role === UserRole.MEDIA_TEAM;
    const isOwnerOrManager = (event.ownerId === user.uid) || !!(event.managerIds && event.managerIds.includes(user.uid));
    const mediaRequested = event.supportRequests?.media === true || event.mediaRequested === true;

    if (mediaRequested) {
      return !!isMediaTeam; // If requested, ONLY Media Team can upload
    } else {
      return !!isOwnerOrManager; // If not requested, ONLY Event Managers can upload
    }
  },

  /**
   * Can a user view/manage the Venue Master (IQAC Read-Only, HR Full)
   */
  canManageVenue: (user) => {
    if (!user) return false;
    return user.role === UserRole.IQAC || user.role === UserRole.IQAC_TEAM || user.role === UserRole.HR_TEAM || user.role === UserRole.SUPER_ADMIN || user.role === 'IQAC';
  },

  /**
   * Can a user edit/delete/create venues (HR Team & Super Admin only)
   */
  canEditVenue: (user) => {
    if (!user) return false;
    return user.role === UserRole.HR_TEAM || user.role === UserRole.SUPER_ADMIN || user.role === UserRole.IQAC_TEAM || user.role === 'IQAC' || user.role === UserRole.IQAC;
  },

  /**
   * Can a user assign volunteers?
   */
  canAssignVolunteer: (user, event) => {
    if (!user || !event) return false;
    // Event must be approved/running to assign volunteers
    if (![EventStatus.PUBLISHED, EventStatus.RUNNING, EventStatus.APPROVED].includes(event.status)) {
      return false;
    }

    const isOwnerOrManager = event.ownerId === user.uid || (event.managerIds && event.managerIds.includes(user.uid));
    return isOwnerOrManager || user.role === UserRole.SUPER_ADMIN;
  },

  /**
   * Can a user archive this event?
   */
  canArchiveEvent: (user, event) => {
    if (!user || !event) return false;
    // Only IQAC or Super Admin can archive completed events
    if (user.role !== UserRole.IQAC && user.role !== UserRole.SUPER_ADMIN) return false;
    return event.status === EventStatus.COMPLETED;
  }
};

module.exports = PermissionEngine;
