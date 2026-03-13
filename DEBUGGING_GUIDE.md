# Event Approval Workflow - Debugging Guide

## Issue: Events Not Showing in HOD Dashboard After Faculty Approval

### How to Debug:

1. **Open Browser Console** (F12 → Console tab)

2. **Login as Faculty** and approve an event:
   - Click "Approve & Forward"
   - Check console for these logs:

```
=== Approval Debug ===
Event ID: [event_id]
Current Status: PENDING_FACULTY
Approve: true
New Status: PENDING_HOD
====================
Firebase Service - Updating Event: [event_id]
Firebase Service - New Status: PENDING_HOD
Firebase Service - Update successful
Status updated successfully in Firebase
```

3. **Check Firebase Real-time Update**:
   - After approval, you should see:
```
Firebase Real-time Update - Events: [{id: '...', title: '...', status: 'PENDING_HOD'}, ...]
```

4. **Login as HOD** and check dashboard:
   - Check console for:
```
=== Dashboard Debug ===
Current User Role: HOD
Total Events: [number]
All Event Statuses: [{id: '...', title: '...', status: 'PENDING_HOD'}, ...]
Filtered Events for Role: [{...}]
=====================
```

### Common Issues & Fixes:

#### Issue 1: Status not updating in Firebase
**Symptom**: Console shows "Firebase Service - Update successful" but real-time update still shows old status
**Fix**: Check Firebase Firestore rules - ensure write permissions are granted

#### Issue 2: HOD role not matching
**Symptom**: Console shows `Current User Role: HOD` but filtered events is empty
**Fix**: Check if the status in Firebase is exactly 'PENDING_HOD' (case-sensitive)

#### Issue 3: Events not loaded
**Symptom**: `Total Events: 0` in HOD console
**Fix**: Real-time listener might not be working. Refresh the page.

### Status Flow Verification:

```
PENDING_FACULTY → Faculty Approves → PENDING_HOD
PENDING_HOD → HOD Approves → PENDING_PRINCIPAL  
PENDING_PRINCIPAL → Principal Approves → POSTED
```

### Firestore Query to Verify:

Open Firebase Console → Firestore Database → `events` collection

Check that the event document has:
- `status: "PENDING_HOD"` (after faculty approval)
- `updatedAt: [recent timestamp]`

### Next Steps:

1. Share the console logs from both Faculty and HOD sessions
2. Verify the event status in Firebase Firestore directly
3. Check if there are any errors in the console (red text)
