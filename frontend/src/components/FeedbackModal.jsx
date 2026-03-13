
import { useState } from 'react';
import { X, Star, MessageSquare, Loader2, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FeedbackModal = ({ odRequestId, eventTitle, onClose }) => {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a rating before submitting.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const res = await fetch(`http://localhost:5001/api/od-requests/${odRequestId}/feedback`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment }),
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

          <div className="p-6">
            {submitted ? (
              /* Success state */
              <div className="text-center py-6">
                <CheckCircle className="mx-auto text-emerald-500 mb-3" size={48} />
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
                <p className="text-sm text-slate-500 mb-5">
                  Share your experience for <span className="font-semibold text-slate-700">{eventTitle}</span>
                </p>

                {/* Star Rating */}
                <div className="mb-5">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Overall Rating <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setHovered(star)}
                        onMouseLeave={() => setHovered(0)}
                        onClick={() => setRating(star)}
                        className="transition-transform hover:scale-110"
                      >
                        <Star
                          size={32}
                          className={`transition-colors ${
                            star <= (hovered || rating)
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-200 fill-slate-200'
                          }`}
                        />
                      </button>
                    ))}
                    {rating > 0 && (
                      <span className="ml-2 text-sm font-medium text-slate-600">
                        {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
                      </span>
                    )}
                  </div>
                </div>

                {/* Comment */}
                <div className="mb-5">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Your Comments <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    rows={4}
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="What did you enjoy? What could be improved?"
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
