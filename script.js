const fs = require('fs');
const file = 'frontend/src/components/EventDetailModal.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove textareas (using string manipulation since regex can be brittle across lines)
const textareaBlock1 = `                  <div className="mb-3">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                      Reason for Rejection *
                    </label>
                    <textarea
                      rows={1}
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Enter why this requirement is being rejected"
                      disabled={isProcessing}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cse-accent/30 disabled:bg-slate-100"
                    />
                  </div>`;
content = content.replace(textareaBlock1, '');

const textareaBlock2 = `                  <div className="mb-3">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                      Reason for Rejection *
                    </label>
                    <textarea
                      rows={1}
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Enter why this event is being rejected"
                      disabled={isProcessing}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cse-accent/30 disabled:bg-slate-100"
                    />
                  </div>`;
content = content.replace(textareaBlock2, '');

// 2. Replace onClick handlers
content = content.replace(/onClick=\{\(\) => handleDeptReject\('([^']+)'\)\}/g, "onClick={() => setPendingRejectAction({ type: 'DEPARTMENT', department: '$1' })}");
content = content.replace(/onClick=\{handleHRRejectBoth\}/g, "onClick={() => setPendingRejectAction({ type: 'HR_BOTH' })}");
content = content.replace(/onClick=\{handleReject\}/g, "onClick={() => setPendingRejectAction({ type: 'GENERAL' })}");

// 3. Add ReasonPromptModal
const insertPos = content.lastIndexOf('</AnimatePresence>');
if (insertPos !== -1) {
  const modalJSX = `
      <ReasonPromptModal
        isOpen={!!pendingRejectAction}
        onClose={() => setPendingRejectAction(null)}
        onSubmit={(reason) => {
          if (!pendingRejectAction) return;
          if (pendingRejectAction.type === 'DEPARTMENT') {
            handleDeptReject(pendingRejectAction.department, reason);
          } else if (pendingRejectAction.type === 'HR_BOTH') {
            handleHRRejectBoth(reason);
          } else if (pendingRejectAction.type === 'GENERAL') {
            handleReject(reason);
          }
          setPendingRejectAction(null);
        }}
        title="Reject Event/Requirement"
        description="Please provide a reason for rejection. This will be visible to the organizer."
        isDestructive={true}
        submitText="Confirm Rejection"
      />
`;
  content = content.slice(0, insertPos) + modalJSX + content.slice(insertPos);
}

fs.writeFileSync(file, content);
