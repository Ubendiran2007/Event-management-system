
import { X, Printer, FileText, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const EventReportModal = ({ 
  event, 
  resourcePersons = [], 
  registrationDetails = {}, 
  reportDetails = {},
  feedbackStats = null,
  guestFeedback = [],
  onClose 
}) => {
  if (!event) return null;

  const s1 = event.requisition?.step1 || {};
  const currentYear = new Date().getFullYear();
  const academicYear = s1.academicYear || `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
  
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  const handlePrint = () => {
    window.print();
  };

  // Helper for dynamic report content with fallbacks
  const getRep = (key, fallback) => {
    if (reportDetails && reportDetails[key] && reportDetails[key].length > 0) return reportDetails[key];
    return fallback;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 print:p-0 print:bg-white"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto print:max-h-full print:shadow-none print:rounded-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-slate-100 px-8 py-5 flex items-center justify-between z-10 print:hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cse-accent/10 text-cse-accent rounded-xl flex items-center justify-center">
                <FileText size={22} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Event Report</h2>
                <p className="text-xs text-slate-500 font-medium tracking-tight uppercase">Academic Format Generation</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition-all"
              >
                <Printer size={16} /> Print / PDF
              </button>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Report Content */}
          <div className="p-12 text-slate-900 print:p-6" id="printable-report">
            {/* Academic Header */}
            <div className="text-center mb-10 border-b-2 border-slate-900 pb-8">
              <h1 className="text-2xl font-black uppercase tracking-widest mb-2">Event Report</h1>
              <div className="text-sm font-bold text-slate-600 uppercase tracking-widest">
                {event.department || s1.organizerDetails?.department || 'Department of Computer Science and Engineering'}
              </div>
              <div className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Academic Year: {academicYear} | Semester: {s1.semester || 'N/A'}</div>
            </div>

            {/* details section */}
            <div className="space-y-3 mb-12">
              <h3 className="text-sm font-black border-l-4 border-slate-900 pl-3 mb-4 uppercase tracking-wider">Event Information</h3>
              <div className="grid grid-cols-1 gap-y-2 text-[11px] leading-relaxed">
                <div className="grid grid-cols-5 gap-4"><span className="font-bold uppercase text-slate-500">Event Title</span><span className="col-span-4 font-black uppercase text-slate-900">{event.title || s1.eventName || 'N/A'}</span></div>
                <div className="grid grid-cols-5 gap-4"><span className="font-bold uppercase text-slate-500">Event Type</span><span className="col-span-4">{event.eventType || s1.eventType || 'N/A'}</span></div>
                <div className="grid grid-cols-5 gap-4"><span className="font-bold uppercase text-slate-500">Resource Person(s)</span>
                  <div className="col-span-4 space-y-2">
                    {resourcePersons.length > 0 ? resourcePersons.map((p, i) => (
                      <div key={i} className="flex gap-4 items-start bg-slate-50/50 p-2 rounded-lg border border-slate-100 print:bg-white print:border-none print:p-0">
                         {p.photo?.dataUrl && <img src={p.photo.dataUrl} className="w-10 h-10 rounded-lg object-cover border border-slate-200" alt="rp" />}
                         <div>
                            <div className="font-black uppercase text-slate-900">{p.name}</div>
                            <div className="text-[10px] text-slate-600">{p.designation}, {p.organization}</div>
                            {p.expertise && <div className="text-[9px] text-cse-accent font-bold mt-0.5">Expertise: {p.expertise}</div>}
                            {Array.isArray(p.topicsByDay) && p.topicsByDay.some(t => t) && (
                              <div className="text-[8px] text-slate-400 mt-1 uppercase font-bold">
                                Topics: {p.topicsByDay.filter(Boolean).join(' | ')}
                              </div>
                            )}
                         </div>
                      </div>
                    )) : 'Nil'}
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-4"><span className="font-bold uppercase text-slate-500">Date & Duration</span><span className="col-span-4 font-bold">{formatDate(s1.eventStartDate)} {s1.eventEndDate && s1.eventEndDate !== s1.eventStartDate ? ` to ${formatDate(s1.eventEndDate)}` : ''} ({s1.eventStartTime} - {s1.eventEndTime})</span></div>
                <div className="grid grid-cols-5 gap-4">
                  <span className="font-bold uppercase text-slate-500">Total Participants</span>
                  <div className="col-span-4 flex gap-6">
                    <span className="flex gap-2"><strong>Students:</strong> {registrationDetails.studentsCount || 0}</span>
                    <span className="flex gap-2"><strong>Faculty:</strong> {registrationDetails.facultyCount || 'Nil'}</span>
                    <span className="flex gap-2"><strong>External:</strong> {registrationDetails.externalCount || 'Nil'}</span>
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-4"><span className="font-bold uppercase text-slate-500">Mode & Venue</span><span className="col-span-4">{registrationDetails.mode || 'Offline'} @ {event.venue || 'N/A'}</span></div>
                <div className="grid grid-cols-5 gap-4"><span className="font-bold uppercase text-slate-500">IIC & Society</span><span className="col-span-4">{s1.isIIC ? 'IIC Certified ' : ''}{Array.isArray(s1.professionalSocieties) && s1.professionalSocieties.length > 0 ? `| ${s1.professionalSocieties.join(', ')}` : ''}</span></div>
              </div>
            </div>

            <div className="space-y-10">
              <section>
                <h4 className="text-sm font-black border-b-2 border-slate-900 pb-1 mb-3 uppercase tracking-wider">1. Objectives</h4>
                <ul className="list-decimal list-inside space-y-1.5 text-[11px] leading-relaxed text-slate-700 font-medium">
                  {getRep('objectives', [
                    'To introduce participants to the core concepts of the event.',
                    'To explore advanced methodologies and modern tools within this domain.',
                    'To facilitate academic and industrial interactions.'
                  ]).map((obj, i) => (
                    <li key={i}>{obj}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h4 className="text-sm font-black border-b-2 border-slate-900 pb-1 mb-3 uppercase tracking-wider">2. Description of the Event</h4>
                <div className="text-[11px] leading-relaxed font-medium text-slate-700 whitespace-pre-wrap">
                   {getRep('description', 'The event was conducted successfully. The sessions was highly interactive.')}
                </div>
              </section>

              <section className="print:break-before-page">
                <h4 className="text-sm font-black border-b-2 border-slate-900 pb-1 mb-3 uppercase tracking-wider">3. Outcomes</h4>
                <ul className="list-disc list-inside space-y-1.5 text-[11px] leading-relaxed text-slate-700 font-medium">
                  {getRep('outcomes', [
                    'Understand the fundamental principles discussed.',
                    'Acquire practical skills in relevant frameworks.'
                  ]).map((out, i) => (
                    <li key={i}>{out}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h4 className="text-sm font-black border-b-2 border-slate-900 pb-1 mb-3 uppercase tracking-wider">4. Benefits in terms of Learning/Skill</h4>
                <div className="grid grid-cols-2 gap-6 text-[11px]">
                  <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl relative">
                    <h5 className="font-black mb-2 uppercase text-slate-500 text-[10px] tracking-tight">Technical Skills</h5>
                    <p className="text-slate-700 font-semibold">{reportDetails?.benefits?.technical || 'Practical implementation expertise in the domain.'}</p>
                  </div>
                  <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl">
                    <h5 className="font-black mb-2 uppercase text-slate-500 text-[10px] tracking-tight">Industry Relevance</h5>
                    <p className="text-slate-700 font-semibold">{reportDetails?.benefits?.industry || 'Alignment with current market expectations.'}</p>
                  </div>
                </div>
              </section>

              {/* Student Feedback Table */}
              {feedbackStats?.comments?.length > 0 && (
                <section className="print:break-before-page">
                  <h4 className="text-sm font-black border-b-2 border-slate-900 pb-1 mb-3 uppercase tracking-wider">5. Student Feedback Summary</h4>
                  <div className="overflow-hidden border border-slate-200 rounded-xl">
                    <table className="min-w-full text-[10px] leading-normal">
                      <thead className="bg-slate-900 text-white font-black uppercase">
                        <tr>
                          <th className="px-3 py-2 text-left">S.No</th>
                          <th className="px-3 py-2 text-left">Name</th>
                          <th className="px-3 py-2 text-left">Roll No</th>
                          <th className="px-3 py-2 text-left">Feedback / Comments</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-100 italic">
                        {feedbackStats.comments.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 text-slate-500 font-bold">{idx + 1}</td>
                            <td className="px-3 py-2 font-black text-slate-900 uppercase">{item.student}</td>
                            <td className="px-3 py-2 text-slate-600">{item.rollNo}</td>
                            <td className="px-3 py-2 text-slate-700 leading-snug">"{item.comment || 'N/A'}"</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Guest Feedback Section */}
              {guestFeedback && guestFeedback.length > 0 && (
                <section>
                  <h4 className="text-sm font-black border-b-2 border-slate-900 pb-1 mb-3 uppercase tracking-wider">6. Guest / Speaker Feedback</h4>
                  <div className="space-y-4">
                    {guestFeedback.map((f, i) => (
                      <div key={i} className="bg-slate-50 p-4 border-l-4 border-cse-accent rounded-r-xl">
                        <div className="flex justify-between items-start mb-2">
                           <div>
                              <p className="font-black text-slate-900 uppercase text-[11px]">{f.name}</p>
                              <p className="text-[10px] text-slate-500">{f.designation} @ {f.organization}</p>
                           </div>
                           <div className="flex">
                              {[1,2,3,4,5].map(s => <Star key={s} size={10} className={f.rating >= s ? 'text-amber-400 fill-amber-400' : 'text-slate-200'} />)}
                           </div>
                        </div>
                        <p className="text-[11px] italic font-medium leading-relaxed text-slate-700">"{f.feedback}"</p>
                        {f.highlights && <div className="mt-2 text-[10px] font-black text-blue-600 uppercase tracking-tighter">Key Highlights: {f.highlights}</div>}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="flex flex-col gap-6 ">
                <div className="flex items-center gap-10">
                  <div className="flex-1">
                    <h4 className="text-sm font-black border-b-2 border-slate-900 pb-1 mb-3 uppercase tracking-wider">7. SDG Goals Mapping</h4>
                    <div className="flex items-center gap-4 text-[11px] bg-slate-50 p-4 border border-slate-200 rounded-xl">
                      <div className="w-12 h-12 bg-cse-accent text-white flex items-center justify-center font-black text-2xl rounded-lg">4</div>
                      <div>
                        <p className="font-black text-slate-900">Goal 4: Quality Education</p>
                        <p className="font-medium text-slate-600">Ensuring inclusive and equitable quality education and promoting lifelong learning opportunities.</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-black border-b-2 border-slate-900 pb-1 mb-3 uppercase tracking-wider">8. POs & PSOs Mapping</h4>
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <p className="text-[11px] font-black text-slate-900 uppercase mb-1">Programme Outcomes</p>
                      <p className="text-[10px] font-bold text-cse-accent bg-cse-accent/5 px-2 py-1 rounded-lg">POs: 1, 3, 5, 8, 9, 12 | PSOs: 1, 2</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-10 pt-6 border-t border-slate-200">
                  <section>
                    <h4 className="text-sm font-black mb-3 uppercase tracking-tighter">9. Resource & Funding</h4>
                    <p className="text-[11px] font-bold text-slate-700">{s1.fundingSource ? `${s1.fundingSource}: ₹${s1.fundingAmount}` : 'Department Funded / Self Supported'}</p>
                  </section>
                  <section>
                    <h4 className="text-sm font-black mb-3 uppercase tracking-tighter">10. Media Coverage</h4>
                    <div className="space-y-1">
                      {reportDetails?.socialMedia?.website && <p className="text-[10px] text-blue-600 font-bold truncate">Web: {reportDetails.socialMedia.website}</p>}
                      {reportDetails?.socialMedia?.social && <p className="text-[10px] text-blue-600 font-bold truncate">Social: {reportDetails.socialMedia.social}</p>}
                      {(!reportDetails?.socialMedia?.website && !reportDetails?.socialMedia?.social) && <p className="text-[11px] italic text-slate-400">Nil / Institutional Documentation Only</p>}
                    </div>
                  </section>
                </div>
              </section>

              <section className="print:break-before-page">
                <h4 className="text-sm font-black mb-4 uppercase tracking-widest text-center py-2 bg-slate-900 text-white rounded">Enclosures</h4>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 px-6">
                  {[
                    ['Approval Copy', true],
                    ['Event Brochure', (event.posterUrl || event.posterDataUrl)],
                    ['Full Attendance Sheet', registrationDetails.studentsCount > 0],
                    ['Resource Person CV', resourcePersons.length > 0],
                    ['Feedback Analysis', feedbackStats?.totalResponses > 0],
                    ['Geotagged Event Photos', true]
                  ].map(([label, active], idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                       <span className="text-[11px] font-bold uppercase text-slate-600">{idx+1}. {label}</span>
                       {active ? <CheckCircle2 size={14} className="text-emerald-500" /> : <div className="w-3 h-3 rounded-full border-2 border-slate-200" />}
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* signatures */}
            <div className="mt-32 grid grid-cols-2 gap-32 text-center overflow-visible">
              <div className="relative">
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 print:opacity-0 transition-opacity">Signature</div>
                <div className="border-t-2 border-slate-900 pt-3 font-black text-[11px] uppercase tracking-wider">Event Coordinator</div>
              </div>
              <div className="relative">
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 print:opacity-0 transition-opacity">HOD Seal</div>
                <div className="border-t-2 border-slate-900 pt-3 font-black text-[11px] uppercase tracking-wider">Head of the Department</div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const Star = ({ size, className, fill }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill || "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

export default EventReportModal;
