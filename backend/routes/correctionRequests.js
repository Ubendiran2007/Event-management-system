const express = require('express');
const router = express.Router();

const {
  collection, addDoc, getDocs, doc, updateDoc,
  getDoc, query, where,
} = require('../firebaseClientWrapper');
const { sendEmail } = require('../services/emailService');
const { requireAuth, requireRole } = require('../middleware/auth');


const normalizeRollNo = (value) =>
  String(value || '')
    .trim()
    .replace(/^student_/i, '')
    .toUpperCase();

// ─── Guards ──────────────────────────────────────────────────────────────────
const checkDb = (res) => {
  if (!db) {
    res.status(503).json({ success: false, message: 'Firebase is not configured' });
    return true;
  }
  return false;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function getUsersByRole(role, dept = null) {
  if (!db) return [];
  try {
    let q = query(collection(db, 'users'), where('role', '==', role));
    if (dept) q = query(q, where('department', '==', dept));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.email);
  } catch (err) {
    console.warn('[correctionRequests] getUsersByRole error:', err.message);
    return [];
  }
}

function fmtDate(iso) {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

// ─── Email Helpers ────────────────────────────────────────────────────────────
async function safeMail(opts) {
  try { await sendEmail(opts); }
  catch (e) { console.warn('[correctionRequests] Email failed:', e.message); }
}

function buildEmailHtml({ heading, subheading, color = '#2563eb', rows = [], alertHtml = '', footerNote = '' }) {
  const rowsHtml = rows.map(([label, val]) => `
    <tr>
      <td style="padding:10px 16px;font-weight:600;color:#475569;width:38%;font-size:13px;border-bottom:1px solid #e2e8f0;">${label}</td>
      <td style="padding:10px 16px;color:#0f172a;font-weight:500;font-size:13px;border-bottom:1px solid #e2e8f0;">${val || '—'}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',sans-serif;}
    .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,.08);}
    .hdr{background:${color};padding:28px 32px;color:#fff;}
    .hdr h1{margin:0;font-size:22px;font-weight:700;}
    .hdr p{margin:6px 0 0;font-size:14px;opacity:.85;}
    .body{padding:28px 32px;}
    table{width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:16px 0;}
    .alert{border-radius:8px;padding:14px 18px;margin:20px 0;font-size:14px;line-height:1.5;}
    .footer{background:#0f172a;padding:18px 32px;text-align:center;color:#64748b;font-size:11px;}
  </style></head><body>
  <div class="wrap">
    <div class="hdr"><h1>${heading}</h1>${subheading ? `<p>${subheading}</p>` : ''}</div>
    <div class="body">
      ${rows.length ? `<table><tbody>${rowsHtml}</tbody></table>` : ''}
      ${alertHtml}
      ${footerNote ? `<p style="font-size:13px;color:#475569;margin-top:16px;">${footerNote}</p>` : ''}
    </div>
    <div class="footer">© ${new Date().getFullYear()} Sri Eshwar College of Engineering — OD Correction Workflow</div>
  </div></body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/correction-requests
// Query params: role, department, userId, view (pending | history)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  if (checkDb(res)) return;
  const { role, department, userId, view = 'pending' } = req.query;

  try {
    const ref = collection(db, 'correctionRequests');
    let q;

    if (role === 'STUDENT_GENERAL' || role === 'STUDENT_ORGANIZER') {
      // Students see all their own requests regardless of view
      q = query(ref, where('studentId', '==', userId));
    } else if (view === 'history') {
      // Staff history: requests they processed (approved/rejected/completed)
      const STAGE_MAP = { FACULTY: 'faculty', HOD: 'hod', IQAC_TEAM: 'iqac' };
      const stage = STAGE_MAP[role];
      if (!stage) return res.status(403).json({ success: false, message: 'Unauthorized' });

      // Fetch all non-pending statuses in the department
      const terminalStatuses = ['COMPLETED', 'REJECTED'];
      // We need approved-by-this-stage too — easiest is to pull by dept and filter in memory
      const deptFilter = department && role !== 'IQAC_TEAM'
        ? query(ref, where('department', '==', department))
        : ref;
      const snap = await getDocs(deptFilter);
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Include requests where this stage has a decision recorded
      const history = all.filter(r => r[`${stage}Decision`]);
      return res.json({ success: true, requests: history });
    } else {
      // Pending requests for this role
      const STATUS_MAP = {
        FACULTY:   'PENDING_FACULTY',
        HOD:       'PENDING_HOD',
        IQAC_TEAM: 'PENDING_IQAC',
      };
      const pendingStatus = STATUS_MAP[role];
      if (!pendingStatus) return res.status(403).json({ success: false, message: 'Unauthorized' });

      if (role === 'IQAC_TEAM') {
        q = query(ref, where('status', '==', pendingStatus));
      } else {
        q = query(ref,
          where('status', '==', pendingStatus),
          where('department', '==', department)
        );
      }
    }

    const snap = q ? await getDocs(q) : { docs: [] };
    const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ success: true, requests });
  } catch (err) {
    console.error('[correctionRequests/GET] Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/correction-requests
// Student submits a new OD correction request
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  if (checkDb(res)) return;
  const {
    studentId, studentName, rollNo, className, department,
    description, requestedCount, requestedLimit,
    currentOdUsed, currentOdLimit,
  } = req.body;

  if (!studentId || !studentName || !description) {
    return res.status(400).json({ success: false, message: 'studentId, studentName and description are required.' });
  }

  try {
    const now = new Date().toISOString();
    
    // Fetch real-time student details from DB to ensure accuracy
    let dbRollNo = rollNo || '';
    let dbOdUsed = Number(currentOdUsed) || 0;
    let dbOdLimit = Number(currentOdLimit) || 0;
    let dbEmail = '';
    
    if (className) {
      const studentQuery = query(collection(db, 'students', className, 'members'), where('rollNo', '==', dbRollNo));
      const studentSnap = await getDocs(studentQuery);
      if (!studentSnap.empty) {
        const studentData = studentSnap.docs[0].data();
        dbRollNo = studentData.rollNo || dbRollNo;
        dbOdUsed = studentData.odUsed !== undefined ? Number(studentData.odUsed) : dbOdUsed;
        dbOdLimit = studentData.odLimit !== undefined ? Number(studentData.odLimit) : dbOdLimit;
        dbEmail = studentData.email || '';
      }
    }

    const newRequest = {
      studentId,
      studentName,
      email: dbEmail,
      rollNo: dbRollNo,
      className: className || '',
      department: department || '',
      description,
      requestedCount: Number(requestedCount) || 0,
      requestedLimit: Number(requestedLimit) || 0,
      currentOdUsed: dbOdUsed,
      currentOdLimit: dbOdLimit,
      status: 'PENDING_FACULTY',
      createdAt: now,
      updatedAt: now,
      // Stage decisions — populated as each approver acts
      facultyDecision: null,
      hodDecision: null,
      iqacDecision: null,
      history: [{ status: 'PENDING_FACULTY', time: now, user: studentName, action: 'SUBMITTED' }],
    };

    const docRef = await addDoc(collection(db, 'correctionRequests'), newRequest);

    // ── Email: Student confirmation ───────────────────────────────────────────
    const facultyUsers = await getUsersByRole('FACULTY', department);
    const facultyNameStr = facultyUsers.map(f => f.name || f.email).join(', ') || 'Your Faculty Advisor';

    if (dbEmail) {
      await safeMail({
        to: dbEmail,
        subject: `OD Correction Request Submitted — Pending Faculty Verification`,
        html: buildEmailHtml({
          heading: 'OD Correction Request Submitted',
          subheading: 'Your request has been received and is pending Faculty verification.',
          color: '#2563eb',
          rows: [
            ['Student Name',    studentName],
            ['Roll Number',     normalizeRollNo(dbRollNo)],
            ['Department',      department],
            ['Current OD Used', dbOdUsed],
            ['Current OD Limit',dbOdLimit],
            ['Requested Used',  requestedCount],
            ['Requested Limit', requestedLimit],
            ['Reason',          description],
            ['Current Status',  'Pending Faculty Verification'],
            ['Assigned To',     facultyNameStr],
            ['Submitted On',    fmtDate(now)],
          ],
          alertHtml: `<div class="alert" style="background:#eff6ff;border-left:4px solid #3b82f6;color:#1e3a8a;">
            <strong>What happens next?</strong><br>Your Faculty Advisor will review your request. You will receive an email at each stage of the approval process.
          </div>`,
        }),
        text: `OD Correction Request Submitted\nStatus: Pending Faculty Verification\nAssigned To: ${facultyNameStr}`,
      });
    }

    // ── Email: Faculty notification ───────────────────────────────────────────
    for (const faculty of facultyUsers) {
      await safeMail({
        to: faculty.email,
        subject: `OD Correction Verification Required — ${studentName} (${dbRollNo})`,
        html: buildEmailHtml({
          heading: 'OD Correction Request — Action Required',
          subheading: `A student has submitted an OD count correction request requiring your verification.`,
          color: '#1e293b',
          rows: [
            ['Student Name',    studentName],
            ['Roll Number',     normalizeRollNo(dbRollNo)],
            ['Class',           className],
            ['Department',      department],
            ['Current OD Used', dbOdUsed],
            ['Current OD Limit',dbOdLimit],
            ['Requested Used',  requestedCount],
            ['Requested Limit', requestedLimit],
            ['Reason',          description],
            ['Submitted On',    fmtDate(now)],
          ],
          alertHtml: `<div class="alert" style="background:#fffbeb;border-left:4px solid #f59e0b;color:#92400e;">
            <strong>⚡ Action Required</strong><br>Please log into the portal to review, approve, or reject this request. A rejection reason is mandatory if you reject.
          </div>`,
        }),
        text: `OD Correction Verification Required for ${studentName} (${dbRollNo}). Please log into the portal.`,
      });
    }

    res.json({ success: true, id: docRef.id });
  } catch (err) {
    console.error('[correctionRequests/POST] Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/correction-requests/:id/status
// Faculty / HOD / IQAC approves or rejects
// Auth: role and approverName are resolved from the verified JWT token — NOT req.body
// ─────────────────────────────────────────────────────────────────────────────
const CORRECTION_ALLOWED_ROLES = ['FACULTY', 'HOD', 'IQAC_TEAM'];
router.patch('/:id/status', requireAuth, requireRole(CORRECTION_ALLOWED_ROLES), async (req, res) => {
  if (checkDb(res)) return;
  const { id } = req.params;
  const { action, comments = '', rejectionReason = '' } = req.body;

  // Role and identity come from the verified session token — cannot be spoofed
  const role = req.user.role;
  const approverName = req.user.name || req.user.role;
  const approverDept = req.user.department;

  if (!action || !['APPROVE', 'REJECT'].includes(action)) {
    return res.status(400).json({ success: false, message: 'action must be APPROVE or REJECT' });
  }
  if (action === 'REJECT' && !rejectionReason.trim()) {
    return res.status(400).json({ success: false, message: 'Rejection reason is mandatory.' });
  }

  const STAGE_MAP = { FACULTY: 'faculty', HOD: 'hod', IQAC_TEAM: 'iqac' };
  const stage = STAGE_MAP[role];
  if (!stage) return res.status(403).json({ success: false, message: 'Unauthorized role' });

  try {
    const reqRef  = doc(db, 'correctionRequests', id);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) return res.status(404).json({ success: false, message: 'Request not found' });
    const data = reqSnap.data();

    const now = new Date().toISOString();

    // ── Determine next status ─────────────────────────────────────────────────
    let nextStatus;
    if (action === 'REJECT') {
      nextStatus = 'REJECTED';
    } else {
      if (role === 'FACULTY')    nextStatus = 'PENDING_HOD';
      else if (role === 'HOD')   nextStatus = 'PENDING_IQAC';
      else if (role === 'IQAC_TEAM') nextStatus = 'COMPLETED';
    }

    // ── Build decision object ─────────────────────────────────────────────────
    const decision = {
      action,
      approverName: approverName || role,
      approverRole: role,
      approverDept: approverDept || data.department || 'N/A',
      comments: comments.trim(),
      rejectionReason: action === 'REJECT' ? rejectionReason.trim() : null,
      decidedAt: now,
    };

    const historyEntry = {
      status: nextStatus,
      time: now,
      user: approverName || role,
      action,
      role,
      comments: comments.trim(),
      rejectionReason: decision.rejectionReason,
    };

    const updates = {
      status: nextStatus,
      updatedAt: now,
      [`${stage}Decision`]: decision,
      history: [...(data.history || []), historyEntry],
    };

    // ── OD count update ONLY on IQAC COMPLETE ────────────────────────────────
    if (nextStatus === 'COMPLETED') {
      updates.odUpdatedAt = now;
      updates.odUpdatedBy = approverName || 'IQAC';
      updates.finalOdUsed  = data.requestedCount;
      updates.finalOdLimit = data.requestedLimit;

      // Update the student document in the structured members collection and the users collection
      try {
        let updatedUsers = false;
        if (data.rollNo) {
          const odQuery = query(collection(db, 'odRequests'), where('rollNo', '==', data.rollNo), where('status', '==', 'APPROVED'));
          const odSnap = await getDocs(odQuery);
          const actualApproved = odSnap.size;
          const newOffset = data.requestedCount - actualApproved;

          if (data.className) {
            const studentQuery = query(collection(db, 'students', data.className, 'members'), where('rollNo', '==', data.rollNo));
            const studentSnap = await getDocs(studentQuery);
            
            if (!studentSnap.empty) {
              await updateDoc(studentSnap.docs[0].ref, {
                odUsed:  data.requestedCount,
                odLimit: data.requestedLimit,
                odCorrectionOffset: newOffset,
                odResetTimestamp: now
              });
              updatedUsers = true;
            }
          }

          const usersQuery = query(collection(db, 'users'), where('rollNo', '==', data.rollNo));
          const usersSnap = await getDocs(usersQuery);
          if (!usersSnap.empty) {
            await updateDoc(usersSnap.docs[0].ref, {
              odUsed:  data.requestedCount,
              odLimit: data.requestedLimit,
              odCorrectionOffset: newOffset,
              odResetTimestamp: now
            });
            updatedUsers = true;
          }
            
          if (updatedUsers) {
            console.log('[correctionRequests] OD counts updated for student:', data.rollNo);
          }
        }
        
        if (!updatedUsers) {
          console.warn('[correctionRequests] Student user doc not found for rollNo:', data.rollNo);
        }
      } catch (odErr) {
        console.error('[correctionRequests] OD update error:', odErr.message);
      }
    }

    await updateDoc(reqRef, updates);

    // ── Send Emails ───────────────────────────────────────────────────────────
    const studentEmail = data.email || null;

    if (action === 'APPROVE') {
      // — Notify Student of this stage's approval ——————————————————————————
      const stageLabel = { FACULTY: 'Faculty', HOD: 'HOD', IQAC_TEAM: 'IQAC' }[role] || role;
      const nextLabel  = { PENDING_HOD: 'HOD Verification', PENDING_IQAC: 'IQAC Review', COMPLETED: 'Completed' }[nextStatus] || nextStatus;

      if (studentEmail) {
        const isCompleted = nextStatus === 'COMPLETED';
        let fetchedUpdatedOdUsed = data.requestedCount;
        let fetchedUpdatedOdLimit = data.requestedLimit;
        
        if (isCompleted && data.rollNo) {
          try {
            const usersSnap = await getDocs(query(collection(db, 'users'), where('rollNo', '==', data.rollNo)));
            if (!usersSnap.empty) {
              const userData = usersSnap.docs[0].data();
              fetchedUpdatedOdUsed = userData.odUsed !== undefined ? userData.odUsed : data.requestedCount;
              fetchedUpdatedOdLimit = userData.odLimit !== undefined ? userData.odLimit : data.requestedLimit;
            }
          } catch (e) {
            console.error('[correctionRequests] Failed to fetch latest OD count for email:', e.message);
          }
        }

        await safeMail({
          to: studentEmail,
          subject: isCompleted
            ? `✅ OD Correction Approved — Your OD Count Has Been Updated`
            : `OD Correction Verified by ${stageLabel} — Pending ${nextLabel}`,
          html: buildEmailHtml({
            heading: isCompleted ? 'OD Correction Approved' : `Verified by ${stageLabel}`,
            subheading: isCompleted
              ? 'Your OD correction has been fully approved and your OD count has been updated.'
              : `Your request has passed ${stageLabel} verification and is now pending ${nextLabel}.`,
            color: isCompleted ? '#10b981' : '#2563eb',
            rows: [
              ['Approved By',   approverName || stageLabel],
              ['Role',          stageLabel],
              ['Department',    approverDept || data.department],
              ['Comments',      comments ? comments : 'No additional comments.'],
              ['Approved On',   fmtDate(now)],
              ...(isCompleted ? [
                ['Previous OD Used',  data.currentOdUsed],
                ['OD Limit',          data.currentOdLimit],
                ['Updated OD Used',   fetchedUpdatedOdUsed],
                ['Current OD Limit',  fetchedUpdatedOdLimit]
              ] : [
                ['Next Stage', nextLabel],
              ]),
            ],
            alertHtml: isCompleted
              ? `<div class="alert" style="background:#f0fdf4;border-left:4px solid #10b981;color:#065f46;">
                  <strong>✅ Your OD count has been officially updated.</strong><br>The new values are now reflected in your student profile.
                 </div>`
              : `<div class="alert" style="background:#eff6ff;border-left:4px solid #3b82f6;color:#1e3a8a;">
                  Your request is progressing through the approval workflow. You will be notified at each stage.
                 </div>`,
          }),
          text: `OD Correction ${isCompleted ? 'Approved' : 'Verified by ' + stageLabel}. Status: ${nextStatus}`,
        });
      }

      // — Notify next approver ————————————————————————————————————————————
      if (nextStatus === 'PENDING_HOD') {
        const hodUsers = await getUsersByRole('HOD', data.department);
        for (const hod of hodUsers) {
          await safeMail({
            to: hod.email,
            subject: `OD Correction Requires HOD Review — ${data.studentName} (${data.rollNo})`,
            html: buildEmailHtml({
              heading: 'OD Correction Request — HOD Review Required',
              subheading: 'Faculty has verified this request. Your approval is now required.',
              color: '#334155',
              rows: [
                ['Student Name',       data.studentName],
                ['Roll Number',        normalizeRollNo(data.rollNo)],
                ['Department',         data.department],
                ['Current OD Used',    data.currentOdUsed],
                ['Current OD Limit',   data.currentOdLimit],
                ['Requested Used',     data.requestedCount],
                ['Requested Limit',    data.requestedLimit],
                ['Reason',             data.description],
                ['Faculty Approved By',approverName],
                ['Faculty Comments',   comments ? comments : 'No additional comments.'],
                ['Faculty Approved On',fmtDate(now)],
              ],
              alertHtml: `<div class="alert" style="background:#fffbeb;border-left:4px solid #f59e0b;color:#92400e;">
                <strong>⚡ Action Required</strong><br>Please log into the portal to approve or reject this request. Rejection reason is mandatory.
              </div>`,
            }),
            text: `OD Correction HOD Review Required for ${data.studentName} (${data.rollNo}).`,
          });
        }
      } else if (nextStatus === 'PENDING_IQAC') {
        const iqacUsers = await getUsersByRole('IQAC_TEAM');
        const targets = iqacUsers.length > 0 ? iqacUsers : [{ email: 'iqac@sece.ac.in' }];
        const facultyDec = data.facultyDecision || {};
        for (const iqac of targets) {
          await safeMail({
            to: iqac.email,
            subject: `OD Correction Awaiting IQAC Approval — ${data.studentName} (${data.rollNo})`,
            html: buildEmailHtml({
              heading: 'OD Correction Request — IQAC Final Approval',
              subheading: 'Faculty and HOD have verified this request. IQAC final approval is required.',
              color: '#0ea5e9',
              rows: [
                ['Student Name',       data.studentName],
                ['Roll Number',        normalizeRollNo(data.rollNo)],
                ['Department',         data.department],
                ['Current OD Used',    data.currentOdUsed],
                ['Current OD Limit',   data.currentOdLimit],
                ['Requested Used',     data.requestedCount],
                ['Requested Limit',    data.requestedLimit],
                ['Reason',             data.description],
                ['Faculty Approved By',facultyDec.approverName || '—'],
                ['Faculty Comments',   facultyDec.comments ? facultyDec.comments : 'No additional comments.'],
                ['HOD Approved By',    approverName],
                ['HOD Comments',       comments ? comments : 'No additional comments.'],
                ['HOD Approved On',    fmtDate(now)],
              ],
              alertHtml: `<div class="alert" style="background:#fffbeb;border-left:4px solid #f59e0b;color:#92400e;">
                <strong>⚡ Final Approval Required</strong><br>This request has completed Faculty and HOD verification. Please log into the portal to give final approval.
              </div>`,
            }),
            text: `OD Correction IQAC Approval Required for ${data.studentName} (${data.rollNo}).`,
          });
        }
      }
    } else {
      // — REJECTED: Notify Student —————————————————————————————————————————
      const stageLabel = { FACULTY: 'Faculty Advisor', HOD: 'Head of Department', IQAC_TEAM: 'IQAC' }[role] || role;
      if (studentEmail) {
        await safeMail({
          to: studentEmail,
          subject: `OD Correction Request Rejected by ${stageLabel}`,
          html: buildEmailHtml({
            heading: 'OD Correction Request Rejected',
            subheading: `Your OD correction request has been rejected at the ${stageLabel} stage.`,
            color: '#ef4444',
            rows: [
              ['Rejected By',       approverName || stageLabel],
              ['Role / Designation',stageLabel],
              ['Department',        approverDept || data.department],
              ['Rejection Reason',  rejectionReason],
              ['Comments',          comments ? comments : 'No additional comments.'],
              ['Rejected On',       fmtDate(now)],
              ['Your Request',      data.description],
              ['Requested OD Used', data.requestedCount],
              ['Requested Limit',   data.requestedLimit],
            ],
            alertHtml: `<div class="alert" style="background:#fef2f2;border-left:4px solid #ef4444;color:#991b1b;">
              <strong>Status: Rejected</strong><br>Your OD count has not been changed. If you believe this rejection is incorrect, please contact your ${stageLabel} directly.
            </div>`,
          }),
          text: `OD Correction Request Rejected by ${stageLabel}. Reason: ${rejectionReason}`,
        });
      }
    }

    res.json({ success: true, nextStatus, requestId: id });
  } catch (err) {
    console.error('[correctionRequests/PATCH] Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
