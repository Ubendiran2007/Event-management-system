const { db } = require('../config/firebase');
const { doc, getDoc, updateDoc, collection, query, where, getDocs, runTransaction } = require('firebase-admin/firestore');
const PermissionEngine = require('../utils/permissions');
const { logActivity, logAudit } = require('../utils/logger');
const eventBus = require('../events/eventBus');

class PostEventService {
  /**
   * Update a specific section of the post-event workspace
   * Sections: 'summary', 'attendance', 'resourcePerson', 'media', 'budget', 'certificates', 'feedback', 'documents'
   * State: 'DRAFT', 'SUBMITTED', 'VERIFIED'
   */
  static async updateSection(eventId, section, data, state, user) {
    const eventRef = doc(db, 'events', eventId);
    
    return await runTransaction(db, async (t) => {
      const snap = await t.get(eventRef);
      if (!snap.exists) throw new Error('NOT_FOUND:Event not found');
      
      const event = snap.data();
      
      // Ownership check based on section
      const isManager = event.managerIds?.includes(user.uid) || event.ownerId === user.uid;
      const isOrganizer = event.ownerId === user.uid;
      const isMediaTeam = user.role === 'MEDIA_TEAM';
      
      let allowed = false;
      if (['summary', 'attendance', 'resourcePerson'].includes(section)) allowed = isManager;
      if (['budget', 'certificates'].includes(section)) allowed = isOrganizer;
      if (section === 'media') allowed = PermissionEngine.canUploadMedia(user, event);
      if (['feedback', 'documents'].includes(section)) allowed = isOrganizer || isManager; // Fallback
      
      if (!allowed && user.role !== 'SUPER_ADMIN') {
        throw new Error('FORBIDDEN:You do not have permission to update this section.');
      }

      const postEventData = event.postEventData || {};
      const sectionData = postEventData[section] || {};
      
      const oldState = sectionData.state || 'PENDING';
      
      const newSectionData = {
        ...sectionData,
        ...data,
        state,
        updatedAt: new Date().toISOString(),
        updatedBy: user.uid
      };
      
      const updatePayload = {
        [`postEventData.${section}`]: newSectionData,
        updatedAt: new Date().toISOString()
      };
      
      t.update(eventRef, updatePayload);
      
      // Audit log
      logAudit({
        category: 'POST_EVENT',
        action: `UPDATE_SECTION_${section.toUpperCase()}`,
        actor: { userId: user.uid, name: user.name, role: user.role },
        target: { entityType: 'EVENT', entityId: eventId },
        details: { section, oldState, newState: state }
      });
      
      // Activity timeline
      logActivity({
        category: 'POST_EVENT',
        action: `SECTION_UPDATED`,
        actor: { userId: user.uid, name: user.name, role: user.role },
        target: { entityType: 'EVENT', entityId: eventId },
        details: { section, state }
      });
      
      return { success: true, section, state };
    });
  }

  /**
   * Validate if all required sections are completed (SUBMITTED or VERIFIED)
   */
  static canCompleteEvent(event) {
    const requiredSections = ['summary', 'attendance', 'budget', 'feedback'];
    // Media and Resource Person might be optional based on event configuration
    if (event.supportRequests?.media || event.mediaRequested) requiredSections.push('media');
    
    const postEventData = event.postEventData || {};
    
    for (const req of requiredSections) {
      const state = postEventData[req]?.state;
      if (state !== 'SUBMITTED' && state !== 'VERIFIED') {
        return { complete: false, missing: req };
      }
    }
    
    return { complete: true };
  }

  /**
   * Submit the entire post-event workspace, transitioning to PENDING_FACULTY_VERIFICATION
   */
  static async submitPostEventWorkspace(eventId, user) {
    const eventRef = doc(db, 'events', eventId);
    
    return await runTransaction(db, async (t) => {
      const snap = await t.get(eventRef);
      if (!snap.exists) throw new Error('NOT_FOUND:Event not found');
      
      const event = snap.data();
      
      if (event.status !== 'POST_EVENT_IN_PROGRESS' && event.status !== 'ENDED') {
        throw new Error('BAD_REQUEST:Event is not in a valid state for post-event submission.');
      }
      
      const validation = this.canCompleteEvent(event);
      if (!validation.complete) {
        throw new Error(`BAD_REQUEST:Cannot submit. Section '${validation.missing}' is incomplete.`);
      }
      
      const newStatus = 'PENDING_FACULTY_VERIFICATION';
      
      t.update(eventRef, {
        status: newStatus,
        postEventSubmittedAt: new Date().toISOString(),
        postEventSubmittedBy: user.uid,
        updatedAt: new Date().toISOString()
      });
      
      logActivity({
        action: 'POST_EVENT_SUBMITTED',
        actor: { userId: user.uid, name: user.name, role: user.role },
        target: { entityType: 'EVENT', entityId: eventId }
      });
      
      // Domain event for Notifications
      eventBus.emit('POST_EVENT_SUBMITTED', { eventId, submitter: user.uid });
      
      return { success: true, status: newStatus };
    });
  }
}

module.exports = PostEventService;
