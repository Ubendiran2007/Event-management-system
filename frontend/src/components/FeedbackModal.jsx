import { X, MessageSquare, Loader2, CheckCircle2, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FeedbackModal = ({ odRequestId, eventTitle, onClose, googleFormLink }) => {
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!comment.trim()) {
      setError('Please provide your feedback comments before submitting.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const res = await fetch(`http://localhost:5001/api/od-requests/${odRequestId}/feedback`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: 5, comment }), // Default rating to 5 internally
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setSubmitted(true);
    } catch (err) {
      setError('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-cse-accent/10 text-cse-accent rounded-xl flex items-center justify-center">
                <MessageSquare size={18} />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Event Feedback</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Google Form Link Alert */}
          {googleFormLink && (
            <div className="px-6 pt-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col gap-2">
                 <p className="text-xs font-bold text-blue-800 uppercase tracking-tight">Primary Feedback Method</p>
                 <p className="text-[11px] text-blue-600 leading-relaxed">The organizer has provided a Google Form for feedback. Please fill that out first.</p>
                 <a 
                   href={googleFormLink} 
                   target="_blank" 
                   rel="noreferrer" 
                   className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
                 >
                   Open Google Form
                 </a>
                 <p className="text-[10px] text-blue-500 text-center italic mt-1 font-bold italic">Please prioritize using the Google Form link above.</p>
              </div>
            </div>
          )}

          <div className="p-6">
            {submitted ? (
              /* Success state */
              <div className="text-center py-6">
                <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={48} />
                <h3 className="text-xl font-bold text-slate-900 mb-1">Thank you!</h3>
                <p className="text-slate-500 text-sm mb-6">
                  Your feedback for <strong>{eventTitle}</strong> has been recorded.
                </p>
                <button onClick={onClose} className="btn-primary w-full">
                  Close
                </button>
              </div>
            ) : (
              <>
                {/* Comment */}
                <div className="mb-5">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Your Feedback <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={6}
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Tell us about your experience..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cse-accent/30 focus:border-cse-accent resize-none text-sm"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-500 mb-4">{error}</p>
                )}

                <div className="flex gap-3">
                  <button onClick={onClose} className="flex-1 btn-secondary">
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {isSubmitting && <Loader2 size={15} className="animate-spin" />}
                    Submit Feedback
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default FeedbackModal;
