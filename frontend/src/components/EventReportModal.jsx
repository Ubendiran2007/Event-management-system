
import { X, Printer, FileText, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const EventReportModal = ({ 
  event, 
  resourcePersons = [], 
  registrationDetails = {}, 
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
          <div className="p-10 text-slate-900 print:p-0" id="printable-report">
            {/* Academic Header */}
            <div className="text-center mb-10 border-b-2 border-slate-900 pb-8">
              <h1 className="text-2xl font-black uppercase tracking-widest mb-2">Event Report</h1>
              <div className="text-sm font-bold text-slate-600 uppercase">
                {event.department || s1.organizerDetails?.department || 'Department of Computer Science and Engineering'}
              </div>
            </div>

            {/* details section */}
            <div className="space-y-3 mb-10">
              <h3 className="text-lg font-bold border-l-4 border-slate-900 pl-3 mb-4 uppercase">Event Details</h3>
              <div className="grid grid-cols-1 gap-y-1.5 text-xs">
                <div className="grid grid-cols-5 gap-4"><span className="font-bold">Department:</span><span className="col-span-4">{event.department || s1.organizerDetails?.department || 'N/A'}</span></div>
                <div className="grid grid-cols-5 gap-4"><span className="font-bold">Academic Year:</span><span className="col-span-4">{academicYear}</span></div>
                <div className="grid grid-cols-5 gap-4"><span className="font-bold">Semester:</span><span className="col-span-4">{s1.semester || 'N/A'}</span></div>
                <div className="grid grid-cols-5 gap-4"><span className="font-bold">Event Title:</span><span className="col-span-4 font-bold uppercase">{event.title || s1.eventName || 'N/A'}</span></div>
                <div className="grid grid-cols-5 gap-4"><span className="font-bold">Event Type:</span><span className="col-span-4">{event.eventType || s1.eventType || 'N/A'}</span></div>
                <div className="grid grid-cols-5 gap-4"><span className="font-bold">Professional Society:</span><span className="col-span-4">{Array.isArray(s1.professionalSocieties) && s1.professionalSocieties.length > 0 ? s1.professionalSocieties.join(', ') : 'Nil'}</span></div>
                <div className="grid grid-cols-5 gap-4"><span className="font-bold">CoE (if any):</span><span className="col-span-4">{s1.coeName || 'Nil'}</span></div>
                <div className="grid grid-cols-5 gap-4">
                  <span className="font-bold">Resource Person(s):</span>
                  <div className="col-span-4">
                    {resourcePersons.length > 0 ? resourcePersons.map((p, i) => (
                      <div key={i}>{p.name}, {p.organization} ({p.designation})</div>
                    )) : 'Nil'}
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-4"><span className="font-bold">Date & Duration:</span><span className="col-span-4">{formatDate(s1.eventStartDate)} {s1.eventEndDate && s1.eventEndDate !== s1.eventStartDate ? ` to ${formatDate(s1.eventEndDate)}` : ''} ({s1.eventStartTime} - {s1.eventEndTime})</span></div>
                <div className="grid grid-cols-5 gap-4">
                  <span className="font-bold">Participants:</span>
                  <div className="col-span-4 space-x-6">
                    <span><strong>Students:</strong> {registrationDetails.studentsCount || 0}</span>
                    <span><strong>Faculty:</strong> {registrationDetails.facultyCount || 'Nil'}</span>
                    <span><strong>External:</strong> {registrationDetails.externalCount || 'Nil'}</span>
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-4"><span className="font-bold">Mode:</span><span className="col-span-4">{registrationDetails.mode || 'Offline'}</span></div>
                <div className="grid grid-cols-5 gap-4"><span className="font-bold">Venue:</span><span className="col-span-4">{event.venue || 'N/A'}</span></div>
                <div className="grid grid-cols-5 gap-4">
                  <span className="font-bold">Student Feedback:</span>
                  <span className="col-span-4 truncate text-blue-600 underline">{event.studentFeedbackLink || 'Nil'}</span>
                </div>
                <div className="grid grid-cols-5 gap-4">
                  <span className="font-bold">Guest Feedback:</span>
                  <span className="col-span-4 truncate text-blue-600 underline">{event.resourcePersonFeedbackLink || 'Nil'}</span>
                </div>
                <div className="grid grid-cols-5 gap-4"><span className="font-bold">Collaborators:</span><span className="col-span-4">{s1.collaborators || 'Nil'}</span></div>
                <div className="grid grid-cols-5 gap-4"><span className="font-bold">MoU:</span><span className="col-span-4">{s1.isMouSign && s1.mouDetails ? `Yes (+ ${s1.mouDetails})` : 'No'}</span></div>
                <div className="grid grid-cols-5 gap-4"><span className="font-bold">IIC:</span><span className="col-span-4">{s1.isIIC ? `Yes (${s1.iicCategory || 'N/A'})` : 'No'}</span></div>
              </div>
            </div>

            {/* Dynamic content sections */}
            <div className="space-y-8">
              <section>
                <h4 className="font-bold border-b border-slate-900 pb-1 mb-3">1. Objectives</h4>
                <ol className="list-decimal list-inside space-y-1.5 text-xs leading-relaxed">
                  <li>To introduce participants to the core concepts of {event.title || s1.eventName}.</li>
                  <li>To explore advanced methodologies and modern tools within this domain.</li>
                  <li>To provide a platform for hands-on learning and skill enhancement.</li>
                  <li>To facilitate academic and industrial interactions with subject experts.</li>
                  <li>To align the curriculum outcomes with contemporary professional requirements.</li>
                </ol>
              </section>

              <section>
                <h4 className="font-bold border-b border-slate-900 pb-1 mb-3">2. Description of the Event</h4>
                <div className="text-xs leading-relaxed space-y-2">
                   <p>The event "{event.title || s1.eventName}" was organized as part of the department's academic enrichment initiative. The session was conducted in {registrationDetails.mode || 'Offline'} mode at {event.venue || 'the specified venue'}.</p>
                   {resourcePersons.length > 0 && <p>Primary training was facilitated by {resourcePersons[0].name} from {resourcePersons[0].organization}, who discussed {resourcePersons[0].topicsByDay?.[0] || 'the core subject areas'}.</p>}
                   <p>The event followed a structured approach, starting from foundational theory and progressing to {s1.eventType === 'Workshop' ? 'practical implementations' : 'analytical discussions'}. All sessions were highly interactive, allowing students to resolve their technical queries in real-time.</p>
                </div>
              </section>

              <section className="print:break-before-page">
                <h4 className="font-bold border-b border-slate-900 pb-1 mb-3">3. Outcomes</h4>
                <ul className="list-disc list-inside space-y-1.5 text-xs leading-relaxed">
                  <li>Understand the fundamental principles of {event.title || s1.eventName}.</li>
                  <li>Acquire practical skills in the relevant frameworks discussed during the sessions.</li>
                  <li>Identify the scope and applications of these technologies in the current industry.</li>
                  <li>Demonstrate problem-solving abilities within the {event.department || 'specfic'} domain.</li>
                  <li>Strengthen student portfolios with academic certificates and expert-validated knowledge.</li>
                  <li>Synthesize knowledge to propose future projects involving the event's theme.</li>
                </ul>
              </section>

              <section>
                <h4 className="font-bold border-b border-slate-900 pb-1 mb-3">4. Benefits in terms of Learning/Skill/Knowledge</h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-50 p-3 border border-slate-200"><h5 className="font-bold mb-1 underline">Practical/Technical Skills</h5><p>Hands-on exposure to domain-specific tools, methodologies, and technical documentation.</p></div>
                  <div className="bg-slate-50 p-3 border border-slate-200"><h5 className="font-bold mb-1 underline">Industry Relevance</h5><p>Alignment with global market standards and professional role expectations.</p></div>
                </div>
              </section>

              <section className="flex items-center gap-10">
                <div className="flex-1">
                  <h4 className="font-bold border-b border-slate-900 pb-1 mb-3">5. SDG Goals Mapping</h4>
                  <div className="flex items-center gap-3 text-xs bg-slate-50 p-3 border border-slate-200">
                    <div className="w-10 h-10 bg-cse-accent text-white flex items-center justify-center font-black text-xl">4</div>
                    <p><strong>Goal 4:</strong> Quality Education - promoting equitable and inclusive learning opportunities.</p>
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="font-bold border-b border-slate-900 pb-1 mb-3">6. POs & PSOs Mapping</h4>
                  <p className="text-[10px] italic text-slate-600">POs: 1, 3, 5, 9, 12 | PSOs: 1, 2</p>
                </div>
              </section>

              <div className="grid grid-cols-2 gap-10 pt-4 border-t border-slate-300">
                <section>
                  <h4 className="font-bold mb-2 uppercase text-[10px]">7. Funding Details</h4>
                  <p className="text-xs">{s1.fundingSource ? `${s1.fundingSource}: ₹${s1.fundingAmount}` : 'Nil'}</p>
                </section>
                <section>
                  <h4 className="font-bold mb-2 uppercase text-[10px]">8. Social Media Coverage</h4>
                  <p className="text-xs text-slate-500 italic">Documentation placeholders active (Nil)</p>
                </section>
              </div>

              <section>
                <h4 className="font-bold mb-2 uppercase text-[10px]">9. Enclosures</h4>
                <div className="grid grid-cols-4 gap-x-2 gap-y-1 text-[9px] uppercase font-bold text-slate-500">
                  <span className="flex items-center gap-1"><CheckCircle2 size={10} className="text-emerald-500"/> Approval Copy</span>
                  <span className="flex items-center gap-1"><CheckCircle2 size={10} className="text-emerald-500"/> Event Brochure</span>
                  <span className="flex items-center gap-1"><CheckCircle2 size={10} className="text-emerald-500"/> Attendance</span>
                  <span className="flex items-center gap-1"><CheckCircle2 size={10} className="text-emerald-500"/> Geotagged Photos</span>
                  <span className="flex items-center gap-1"><CheckCircle2 size={10} className="text-emerald-500"/> Feedback Form</span>
                </div>
              </section>
            </div>

            {/* signatures */}
            <div className="mt-20 grid grid-cols-2 gap-20 text-center">
              <div><div className="border-t border-slate-900 pt-2 font-black text-[10px] uppercase">Event Coordinator</div></div>
              <div><div className="border-t border-slate-900 pt-2 font-black text-[10px] uppercase">Head of the Department</div></div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EventReportModal;
