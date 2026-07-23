const eventBus = require('../../events/eventBus');
const deliveryManager = require('../delivery/deliveryManager');
const { NOTIFICATION_TYPES, NOTIFICATION_CATEGORIES, PRIORITY_LEVELS, CHANNELS } = require('../../utils/notificationConstants');

class NotificationOrchestrator {
  constructor() {
    this.setupListeners();
  }

  setupListeners() {
    // 0. Listen to EVENT_CREATED
    eventBus.on('EVENT_CREATED', async (payload) => {
      await this.processEvent(payload, {
        type: 'EVENT_CREATED',
        category: NOTIFICATION_CATEGORIES.EVENT,
        priority: PRIORITY_LEVELS.MEDIUM,
        title: `New Event Created: ${payload.metadata?.eventTitle || 'Untitled'}`,
        message: `An event requires your approval in department ${payload.metadata?.department || 'GEN'}.`,
        icon: 'calendar-plus',
        color: 'blue',
        deepLink: `/dashboard/approvals`,
        channels: [CHANNELS.IN_APP, CHANNELS.EMAIL]
      });
    });

    // 1. Listen to EVENT_APPROVED
    eventBus.on(NOTIFICATION_TYPES.EVENT_APPROVED, async (payload) => {
      await this.processEvent(payload, {
        type: NOTIFICATION_TYPES.EVENT_APPROVED,
        category: NOTIFICATION_CATEGORIES.EVENT,
        priority: PRIORITY_LEVELS.HIGH,
        title: `Event Approved: ${payload.metadata?.eventTitle || 'Untitled'}`,
        message: `Your event request has been approved by ${payload.metadata?.approverRole}.`,
        icon: 'calendar-check',
        color: 'green',
        deepLink: `/dashboard/events/${payload.entityId}`,
        channels: [CHANNELS.IN_APP, CHANNELS.EMAIL]
      });
    });

    // 2. Listen to REGISTRATION_SUBMITTED
    eventBus.on(NOTIFICATION_TYPES.REGISTRATION_SUBMITTED, async (payload) => {
      await this.processEvent(payload, {
        type: NOTIFICATION_TYPES.REGISTRATION_SUBMITTED,
        category: NOTIFICATION_CATEGORIES.REGISTRATION,
        priority: PRIORITY_LEVELS.MEDIUM,
        title: `New Registration: ${payload.metadata?.eventTitle}`,
        message: `${payload.metadata?.studentName} has registered for your event.`,
        icon: 'user-plus',
        color: 'blue',
        deepLink: `/dashboard/events/${payload.metadata?.eventId}/registrations`,
        channels: [CHANNELS.IN_APP] // Organizers don't need emails for every single registration, just in-app
      });
    });

    // 2.1 Listen to REGISTRATION_CANCELLED
    eventBus.on(NOTIFICATION_TYPES.REGISTRATION_CANCELLED, async (payload) => {
      await this.processEvent(payload, {
        type: NOTIFICATION_TYPES.REGISTRATION_CANCELLED,
        category: NOTIFICATION_CATEGORIES.REGISTRATION,
        priority: PRIORITY_LEVELS.LOW,
        title: `Registration Cancelled`,
        message: `${payload.metadata?.studentName} has withdrawn from ${payload.metadata?.eventTitle}.`,
        icon: 'user-minus',
        color: 'gray',
        deepLink: `/dashboard/events/${payload.metadata?.eventId}/registrations`,
        channels: [CHANNELS.IN_APP]
      });
    });

    // 2.2 Listen to REGISTRATION_APPROVED
    eventBus.on(NOTIFICATION_TYPES.REGISTRATION_APPROVED, async (payload) => {
      await this.processEvent(payload, {
        type: NOTIFICATION_TYPES.REGISTRATION_APPROVED,
        category: NOTIFICATION_CATEGORIES.REGISTRATION,
        priority: PRIORITY_LEVELS.MEDIUM,
        title: `Registration Approved`,
        message: `Your registration for ${payload.metadata?.eventTitle} is confirmed.`,
        icon: 'user-check',
        color: 'blue',
        deepLink: `/dashboard/my-registrations`,
        channels: [CHANNELS.IN_APP, CHANNELS.EMAIL]
      });
    });

    // 3. Listen to OD_REQUESTED
    eventBus.on(NOTIFICATION_TYPES.OD_REQUESTED, async (payload) => {
      await this.processEvent(payload, {
        type: NOTIFICATION_TYPES.OD_REQUESTED,
        category: NOTIFICATION_CATEGORIES.OD,
        priority: PRIORITY_LEVELS.MEDIUM,
        title: `OD Request: ${payload.metadata?.studentName}`,
        message: `${payload.metadata?.studentName} requested OD for ${payload.metadata?.eventTitle}.`,
        icon: 'file-text',
        color: 'blue',
        deepLink: `/dashboard/od-requests/${payload.entityId}`,
        channels: [CHANNELS.IN_APP, CHANNELS.EMAIL]
      });
    });

    // 3.1 Listen to OD_FACULTY_APPROVED
    eventBus.on(NOTIFICATION_TYPES.OD_FACULTY_APPROVED, async (payload) => {
      await this.processEvent(payload, {
        type: NOTIFICATION_TYPES.OD_FACULTY_APPROVED,
        category: NOTIFICATION_CATEGORIES.OD,
        priority: PRIORITY_LEVELS.MEDIUM,
        title: `OD HOD Approval Required`,
        message: `Faculty approved OD for ${payload.metadata?.studentName}. HOD review required.`,
        icon: 'check-circle',
        color: 'blue',
        deepLink: `/dashboard/od-requests/${payload.entityId}`,
        channels: [CHANNELS.IN_APP, CHANNELS.EMAIL]
      });
    });

    // 3.2 Listen to OD_HOD_APPROVED
    eventBus.on(NOTIFICATION_TYPES.OD_HOD_APPROVED, async (payload) => {
      await this.processEvent(payload, {
        type: NOTIFICATION_TYPES.OD_HOD_APPROVED,
        category: NOTIFICATION_CATEGORIES.OD,
        priority: PRIORITY_LEVELS.HIGH,
        title: `OD Approved`,
        message: `Your OD for ${payload.metadata?.eventTitle} is fully approved.`,
        icon: 'check-square',
        color: 'green',
        deepLink: `/dashboard/my-od/${payload.entityId}`,
        channels: [CHANNELS.IN_APP, CHANNELS.EMAIL]
      });
    });

    // 3.3 Listen to OD_REJECTED
    eventBus.on(NOTIFICATION_TYPES.OD_REJECTED, async (payload) => {
      await this.processEvent(payload, {
        type: NOTIFICATION_TYPES.OD_REJECTED,
        category: NOTIFICATION_CATEGORIES.OD,
        priority: PRIORITY_LEVELS.HIGH,
        title: `OD Rejected`,
        message: `Your OD for ${payload.metadata?.eventTitle} was rejected: ${payload.metadata?.reason}`,
        icon: 'x-circle',
        color: 'red',
        deepLink: `/dashboard/my-od/${payload.entityId}`,
        channels: [CHANNELS.IN_APP, CHANNELS.EMAIL]
      });
    });

    // 4. Listen to Post-Event Reports
    eventBus.on(NOTIFICATION_TYPES.REPORT_SUBMITTED, async (payload) => {
      await this.processEvent(payload, {
        type: NOTIFICATION_TYPES.REPORT_SUBMITTED,
        category: NOTIFICATION_CATEGORIES.EVENT,
        priority: PRIORITY_LEVELS.MEDIUM,
        title: `Report Submitted: ${payload.metadata?.eventTitle}`,
        message: `The post-event report for ${payload.metadata?.eventTitle} has been submitted for IQAC review.`,
        icon: 'file',
        color: 'blue',
        deepLink: `/dashboard/iqac-review/${payload.entityId}`,
        channels: [CHANNELS.IN_APP, CHANNELS.EMAIL]
      });
    });

    eventBus.on(NOTIFICATION_TYPES.IQAC_REVIEW_STARTED, async (payload) => {
      await this.processEvent(payload, {
        type: NOTIFICATION_TYPES.IQAC_REVIEW_STARTED,
        category: NOTIFICATION_CATEGORIES.EVENT,
        priority: PRIORITY_LEVELS.LOW,
        title: `Report Review Started`,
        message: `IQAC has started reviewing your report for ${payload.metadata?.eventTitle}.`,
        icon: 'eye',
        color: 'gray',
        deepLink: `/dashboard/events/${payload.entityId}/report`,
        channels: [CHANNELS.IN_APP]
      });
    });

    eventBus.on(NOTIFICATION_TYPES.REPORT_APPROVED, async (payload) => {
      await this.processEvent(payload, {
        type: NOTIFICATION_TYPES.REPORT_APPROVED,
        category: NOTIFICATION_CATEGORIES.EVENT,
        priority: PRIORITY_LEVELS.MEDIUM,
        title: `Report Approved`,
        message: `Your report for ${payload.metadata?.eventTitle} has been approved by IQAC.`,
        icon: 'check-circle',
        color: 'green',
        deepLink: `/dashboard/events/${payload.entityId}/report`,
        channels: [CHANNELS.IN_APP, CHANNELS.EMAIL]
      });
    });

    eventBus.on(NOTIFICATION_TYPES.REPORT_REJECTED, async (payload) => {
      await this.processEvent(payload, {
        type: NOTIFICATION_TYPES.REPORT_REJECTED,
        category: NOTIFICATION_CATEGORIES.EVENT,
        priority: PRIORITY_LEVELS.HIGH,
        title: `Report Needs Revision`,
        message: `Your report for ${payload.metadata?.eventTitle} was returned for revision: ${payload.metadata?.reason}`,
        icon: 'x-circle',
        color: 'red',
        deepLink: `/dashboard/events/${payload.entityId}/report`,
        channels: [CHANNELS.IN_APP, CHANNELS.EMAIL]
      });
    });

    // 5. Listen to SYSTEM_ALERT (Reminders)
    eventBus.on(NOTIFICATION_TYPES.SYSTEM_ALERT, async (payload) => {
      // The payload for SYSTEM_ALERT already includes title, message, and severity
      const priority = payload.metadata?.severity === 'CRITICAL' ? PRIORITY_LEVELS.CRITICAL : 
                      payload.metadata?.severity === 'HIGH' ? PRIORITY_LEVELS.HIGH : 
                      PRIORITY_LEVELS.MEDIUM;

      await this.processEvent(payload, {
        type: NOTIFICATION_TYPES.SYSTEM_ALERT,
        category: NOTIFICATION_CATEGORIES.SYSTEM, // Or ANNOUNCEMENT
        priority: priority,
        title: payload.title || 'System Alert',
        message: payload.message || 'You have a new system alert.',
        icon: 'alert-triangle',
        color: 'amber',
        deepLink: `/dashboard`,
        channels: payload.forceChannels || [CHANNELS.IN_APP, CHANNELS.EMAIL]
      });
    });

    // Future listeners...
  }

  /**
   * Core orchestrator method to build and route the notification.
   */
  async processEvent(eventPayload, config) {
    try {
      const {
        _eventId,
        entityId,
        recipientId,
        recipients,
        recipientRole,
        metadata = {},
        correlationId
      } = eventPayload;

      // Support either singular recipientId or standard array of recipients
      const targetRecipients = recipients && Array.isArray(recipients) && recipients.length > 0 
        ? recipients 
        : (recipientId ? [recipientId] : []);

      if (targetRecipients.length === 0) {
        console.warn(`[NotificationOrchestrator] No recipients found for event ${_eventId}. Skipping.`);
        return;
      }

      // Determine TTL Expiry Date based on Category
      const now = new Date();
      let expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // Default 90 days
      if (config.category === NOTIFICATION_CATEGORIES.REGISTRATION) {
        expiresAt = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days
      } else if (config.category === NOTIFICATION_CATEGORIES.OD) {
        expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year (Academic Year)
      } else if (config.category === NOTIFICATION_CATEGORIES.SYSTEM) {
        expiresAt = new Date(now.getTime() + 3650 * 24 * 60 * 60 * 1000); // 10 years (Keep forever)
      }

      // const prefs = await getUserPreferences(recipientId);
      // if (!prefs.wantsEmail) notification.channels = notification.channels.filter(c => c !== CHANNELS.EMAIL);

      for (const targetRecipientId of targetRecipients) {
        // 1. Build standard schema
        const notification = {
          _eventId: `${_eventId}_${targetRecipientId}`, // Ensure idempotency key is unique per recipient
          type: config.type,
          category: config.category,
          priority: config.priority,
          title: config.title,
          message: config.message,
          icon: config.icon || 'bell',
          color: config.color || 'blue',
          deepLink: config.deepLink || null,
          recipientId: targetRecipientId,
          recipientRole: recipientRole || 'USER',
          entityType: config.category, // E.g., EVENT, OD
          entityId,
          channels: config.channels,
          expiresAt: expiresAt.toISOString(),
          metadata
        };

        // 3. Dispatch to Delivery Manager (handles IN_APP, EMAIL, etc.)
        await deliveryManager.dispatch(notification);
      }

    } catch (error) {
      console.error(`[Orchestrator] Failed to process event ${config.type}:`, error);
    }
  }
}

// Instantiate to start listening
const orchestrator = new NotificationOrchestrator();

module.exports = orchestrator;
