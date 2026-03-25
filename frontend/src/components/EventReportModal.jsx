
import { X, Printer, FileText, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SDG_NAMES = {
  1: "No Poverty",
  2: "Zero Hunger",
  3: "Good Health and Well-being",
  4: "Quality Education",
  5: "Gender Equality",
  6: "Clean Water and Sanitation",
  7: "Affordable and Clean Energy",
  8: "Decent Work and Economic Growth",
  9: "Industry, Innovation and Infrastructure",
  10: "Reduced Inequality",
  11: "Sustainable Cities and Communities",
  12: "Responsible Consumption and Production",
  13: "Climate Action",
  14: "Life Below Water",
  15: "Life on Land",
  16: "Peace, Justice and Strong Institutions",
  17: "Partnerships for the Goals"
};

const EventReportModal = ({ 
  event, 
  resourcePersons = [], 
  registrationDetails = {}, 
  reportDetails = {},
  feedbackStats = null,
  guestFeedback = [],
  gallery = [],
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
          className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto print:max-h-full print:shadow-none print:rounded-none relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Action Bar */}
          <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-4 flex items-center justify-between z-20 print:hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-md">
                <FileText size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 leading-tight">Academic Event Report</h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">IQAC Standard Format v2.0</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handlePrint}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all"
              >
                <Printer size={16} /> Print Report
              </button>
              <button onClick={onClose} className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Report Content Wrapper */}
          <div className="p-12 text-slate-900 print:p-0 font-serif" id="printable-report">
            {/* Formal College Header */}
            <div className="text-center mb-12 border-b-4 border-double border-slate-900 pb-8">
              <div className="flex justify-center mb-4">
                 <div className="w-16 h-16 border-2 border-slate-900 rounded-lg flex items-center justify-center font-black text-2xl tracking-tighter print:w-20 print:h-20">LOGO</div>
              </div>
              <h1 className="text-2xl font-black uppercase tracking-tight mb-1 font-sans">Sample Engineering College (SEC)</h1>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-4 font-sans">Approved by AICTE, New Delhi & Affiliated to Anna University</p>
              
              <div className="inline-block px-8 py-2 border-2 border-slate-900 font-sans font-black text-xl uppercase tracking-widest mb-6">
                Event Report
              </div>
              
              <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-500 tracking-wider font-sans">
                 <span>Ref No: SEC/IQAC/{academicYear}/{event.id?.slice(-4).toUpperCase() || '000'}</span>
                 <span>Academic Year: {academicYear}</span>
                 <span>Date: {new Date().toLocaleDateString('en-GB')}</span>
              </div>
            </div>

            {/* Core Section: Basic Information */}
            <section className="mb-10">
              <h3 className="text-sm font-black bg-slate-900 text-white px-4 py-1.5 mb-6 uppercase tracking-wider font-sans inline-block">01. General Information</h3>
              
              <div className="grid grid-cols-1 border border-slate-300 rounded-lg overflow-hidden font-sans">
                <div className="grid grid-cols-4 border-b border-slate-300">
                  <div className="bg-slate-50 p-3 font-bold text-[11px] uppercase text-slate-600 border-r border-slate-300">Title of the Event</div>
                  <div className="col-span-3 p-3 font-black text-[12px] uppercase text-slate-900">{event.title || s1.eventName || 'N/A'}</div>
                </div>
                <div className="grid grid-cols-4 border-b border-slate-300">
                  <div className="bg-slate-50 p-3 font-bold text-[11px] uppercase text-slate-600 border-r border-slate-300">Department / Cell</div>
                  <div className="col-span-1 p-3 font-bold text-[11px] border-r border-slate-300">{event.department || s1.organizerDetails?.department || 'N/A'}</div>
                  <div className="bg-slate-50 p-3 font-bold text-[11px] uppercase text-slate-600 border-r border-slate-300">Category</div>
                  <div className="col-span-1 p-3 font-bold text-[11px]">{event.eventType || s1.eventType || 'N/A'}</div>
                </div>
                <div className="grid grid-cols-4 border-b border-slate-300">
                  <div className="bg-slate-50 p-3 font-bold text-[11px] uppercase text-slate-600 border-r border-slate-300">Period & Time</div>
                  <div className="col-span-1 p-3 font-bold text-[11px] border-r border-slate-300">{formatDate(s1.eventStartDate)} {s1.eventEndDate && s1.eventEndDate !== s1.eventStartDate ? ` - ${formatDate(s1.eventEndDate)}` : ''}</div>
                  <div className="bg-slate-50 p-3 font-bold text-[11px] uppercase text-slate-600 border-r border-slate-300">Total Hours</div>
                  <div className="col-span-1 p-3 font-bold text-[11px] font-mono">{s1.eventStartTime} - {s1.eventEndTime}</div>
                </div>
                <div className="grid grid-cols-4">
                  <div className="bg-slate-50 p-3 font-bold text-[11px] uppercase text-slate-600 border-r border-slate-300">Target Audience</div>
                  <div className="col-span-1 p-3 font-bold text-[11px] border-r border-slate-300">{registrationDetails.studentsCount > 0 ? 'Students' : ''} {registrationDetails.facultyCount > 0 ? '& Faculty' : ''}</div>
                  <div className="bg-slate-50 p-3 font-bold text-[11px] uppercase text-slate-600 border-r border-slate-300">Venue / Location</div>
                  <div className="col-span-1 p-3 font-bold text-[11px]">{registrationDetails.mode || 'In-person'} @ {registrationDetails.venue || event.venue || 'N/A'}</div>
                </div>
              </div>
            </section>

            {/* Resource Person Info */}
            <section className="mb-10 page-break-inside-avoid">
              <h3 className="text-sm font-black bg-slate-100 text-slate-900 border-l-4 border-slate-900 px-4 py-1.5 mb-6 uppercase tracking-wider font-sans">02. Resource Person Details</h3>
              <div className="space-y-4 font-sans">
                {resourcePersons.length > 0 ? resourcePersons.map((rp, idx) => (
                  <div key={idx} className="flex gap-6 p-4 border border-slate-200 rounded-xl bg-slate-50/30">
                     {rp.photo?.dataUrl && <img src={rp.photo.dataUrl} className="w-20 h-20 rounded-lg object-cover border-2 border-white shadow-sm" alt="rp" />}
                     <div className="flex-1">
                        <div className="font-black uppercase text-[13px] text-slate-900">{rp.name}</div>
                        <div className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">{rp.designation}</div>
                        <div className="text-[11px] text-slate-500 mb-2">{rp.organization}</div>
                        {rp.bio && <div className="text-[10px] text-slate-400 leading-relaxed line-clamp-2 italic">“{rp.bio}”</div>}
                        {Array.isArray(rp.topicsByDay) && rp.topicsByDay.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {rp.topicsByDay.filter(Boolean).map((t, i) => (
                               <span key={i} className="text-[9px] bg-white border border-slate-200 px-2 py-0.5 rounded font-bold uppercase text-slate-500">Day {i+1}: {t}</span>
                            ))}
                          </div>
                        )}
                     </div>
                  </div>
                )) : (
                  <div className="p-4 border border-slate-200 rounded-lg italic text-slate-500 text-sm">Nil / Handled by Internal Faculty</div>
                )}
              </div>
            </section>

            <div className="space-y-10">
              <section>
                <h3 className="text-sm font-black border-b border-slate-300 pb-2 mb-4 uppercase tracking-wider font-sans">03. Event Objectives</h3>
                <ul className="list-decimal list-outside ml-6 space-y-2 text-[12px] leading-relaxed text-slate-800">
                  {getRep('objectives', ['Standard event objective placeholder.']).map((obj, i) => (
                    <li key={i} className="pl-2">{obj}</li>
                  ))}
                </ul>
              </section>

              <section className="print:break-before-page">
                <h3 className="text-sm font-black border-b border-slate-300 pb-2 mb-4 uppercase tracking-wider font-sans">04. Detailed Description of the Event</h3>
                <div className="text-[12px] leading-[1.8] text-slate-800 text-justify indent-12 whitespace-pre-wrap">
                   {getRep('description', 'The event was successfully structured to provide maximum value...')}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-black border-b border-slate-300 pb-2 mb-4 uppercase tracking-wider font-sans">05. Summary of Outcomes</h3>
                <ul className="list-disc list-outside ml-6 space-y-2 text-[12px] leading-relaxed text-slate-800">
                  {getRep('outcomes', ['Standard outcome placeholder.']).map((out, i) => (
                    <li key={i} className="pl-2">{out}</li>
                  ))}
                </ul>
              </section>

              <section className="bg-slate-50 p-6 rounded-2xl border border-slate-200 page-break-inside-avoid font-sans">
                <h3 className="text-sm font-black mb-4 uppercase tracking-wider text-slate-900">06. Learning Benefits</h3>
                <div className="grid grid-cols-2 gap-8">
                   <div>
                      <p className="text-[10px] font-black uppercase text-indigo-600 mb-1">Technical Skills Gained</p>
                      <p className="text-[12px] text-slate-700 font-bold">{reportDetails?.benefits?.technical || 'Practical exposure in the specific domain.'}</p>
                   </div>
                   <div>
                      <p className="text-[10px] font-black uppercase text-indigo-600 mb-1">Impact on Employability</p>
                      <p className="text-[12px] text-slate-700 font-bold">{reportDetails?.benefits?.industry || 'Alignment with current industrial competency standards.'}</p>
                   </div>
                </div>
              </section>

              <section className="print:break-before-page">
                <h3 className="text-sm font-black border-b border-slate-300 pb-2 mb-6 uppercase tracking-wider font-sans">07. Participant Statistics & Feedback</h3>
                
                <div className="grid grid-cols-3 gap-0 border border-slate-300 rounded overflow-hidden font-sans mb-8">
                   <div className="bg-slate-100 p-4 text-center border-r border-slate-300">
                      <p className="text-[10px] font-black uppercase text-slate-500">Students</p>
                      <p className="text-2xl font-black text-slate-900">{registrationDetails.studentsCount || 0}</p>
                   </div>
                   <div className="bg-slate-50 p-4 text-center border-r border-slate-300">
                      <p className="text-[10px] font-black uppercase text-slate-500">Faculty</p>
                      <p className="text-2xl font-black text-slate-900">{registrationDetails.facultyCount || 0}</p>
                   </div>
                   <div className="bg-white p-4 text-center">
                      <p className="text-[10px] font-black uppercase text-slate-500">External</p>
                      <p className="text-2xl font-black text-slate-900">{registrationDetails.externalCount || 0}</p>
                   </div>
                </div>

                {feedbackStats?.comments?.length > 0 && (
                  <div className="mb-8">
                    <p className="text-[11px] font-black uppercase text-slate-600 mb-3 ml-1">Student Feedback Summary</p>
                    <div className="border border-slate-300 rounded overflow-hidden">
                      <table className="min-w-full text-[11px] font-medium font-sans">
                        <thead className="bg-slate-100 border-b border-slate-300">
                          <tr>
                            <th className="px-4 py-2.5 text-left w-12">No</th>
                            <th className="px-4 py-2.5 text-left w-1/4">Student Name</th>
                            <th className="px-4 py-2.5 text-left">Feedback Extract</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 italic">
                          {feedbackStats.comments.slice(0, 10).map((item, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-2.5 text-slate-400">{idx+1}</td>
                              <td className="px-4 py-2.5 font-bold uppercase text-slate-900">{item.student}</td>
                              <td className="px-4 py-2.5 text-slate-700 leading-tight">"{item.comment}"</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>

              {guestFeedback.length > 0 && (
                <section>
                  <h3 className="text-sm font-black border-b border-slate-300 pb-2 mb-6 uppercase tracking-wider font-sans">08. Expert Observations & Guest Feedback</h3>
                  <div className="space-y-4 font-sans">
                    {guestFeedback.map((f, i) => (
                      <div key={i} className="bg-slate-50 border border-slate-200 p-4 rounded-xl relative text-[11px]">
                         <div className="flex justify-between items-center mb-2">
                            <span className="font-black uppercase text-slate-900 tracking-tight">{f.name} ({f.designation})</span>
                            <div className="flex">
                              {[1,2,3,4,5].map(s => <Star key={s} size={10} className={f.rating >= s ? 'text-amber-400 fill-amber-400' : 'text-slate-100'} />)}
                            </div>
                         </div>
                         <p className="italic font-medium text-slate-700 leading-relaxed">"{f.feedback}"</p>
                         {f.highlights && <p className="mt-2 text-[9px] font-black text-indigo-600 uppercase tracking-tighter">Key Highlights: {f.highlights}</p>}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="print:break-before-page">
                <h3 className="text-sm font-black border-b border-slate-300 pb-2 mb-6 uppercase tracking-wider font-sans">09. Strategic Alignment (SDG & POs)</h3>
                <div className="grid grid-cols-2 gap-6 font-sans">
                   <div className="border border-slate-200 p-5 rounded-2xl flex gap-4 items-center">
                      <div className="w-14 h-14 bg-indigo-600 text-white rounded-xl shadow-lg flex items-center justify-center font-black text-2xl">
                        {String(reportDetails.mapping?.sdg || '04').padStart(2, '0')}
                      </div>
                      <div>
                         <p className="text-[11px] font-black uppercase text-indigo-600">Goal Mapping</p>
                         <p className="text-[13px] font-bold text-slate-900 leading-tight">SDG {reportDetails.mapping?.sdg || '4'}: {SDG_NAMES[reportDetails.mapping?.sdg] || 'Quality Education'}</p>
                      </div>
                   </div>
                   <div className="border border-slate-200 p-5 rounded-2xl">
                      <p className="text-[10px] font-black uppercase text-slate-500 mb-2">Academic Alignment</p>
                      <p className="text-[12px] font-black text-slate-900 tracking-tight">POs: {reportDetails.mapping?.po || '1, 3, 5, 8, 9, 12'} | PSOs: {reportDetails.mapping?.pso || '1, 2'}</p>
                   </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-black border-b border-slate-300 pb-2 mb-6 uppercase tracking-wider font-sans">10. Event Documentation / Photos</h3>
                {gallery.length > 0 ? (
                  <div className="grid grid-cols-2 gap-6">
                    {gallery.map((img, idx) => (
                      <div key={idx} className="space-y-3 font-sans">
                         <div className="aspect-video w-full rounded-xl overflow-hidden border-2 border-slate-100 shadow-lg bg-slate-50">
                            <img src={img.url || img.dataUrl} className="w-full h-full object-cover" alt="event" />
                         </div>
                         <div className="text-center font-bold">
                            <p className="text-[10px] text-slate-900 uppercase">Fig {idx + 1}: {img.dayTag || 'Event Session'}</p>
                            <p className="text-[9px] text-slate-500 italic mt-0.5">{img.title || ''}</p>
                         </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 border-2 border-dashed border-slate-200 rounded-2xl text-center font-sans text-slate-400 italic">No photographs available for this event records</div>
                )}
              </section>

              <section className="print:break-before-page">
                <h3 className="text-sm font-black text-center py-2.5 bg-slate-900 text-white rounded-lg mb-8 uppercase tracking-widest font-sans">Checklist of Enclosures</h3>
                <div className="grid grid-cols-2 gap-x-12 gap-y-4 px-4 font-sans uppercase">
                   {[
                    ['Event Approval Copy', true],
                    ['Resource Person Profiles', resourcePersons.length > 0],
                    ['Participant Attendance', registrationDetails.studentsCount > 0],
                    ['Feedback Analysis', feedbackStats?.totalResponses > 0],
                    ['Geotagged Photographs', gallery.length > 0],
                    ['Press Coverage (If any)', !!reportDetails?.socialMedia?.social]
                   ].map(([item, valid], i) => (
                     <div key={i} className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-[11px] font-bold text-slate-600">{i+1}. {item}</span>
                        {valid ? <div className="text-indigo-600 font-black text-sm">✓</div> : <div className="w-4 h-4 border border-slate-300 rounded"></div>}
                     </div>
                   ))}
                </div>
              </section>

              {/* Verified Signatures */}
              <div className="mt-40 grid grid-cols-2 gap-48 text-center font-sans">
                 <div className="space-y-4">
                    <div className="h-0.5 bg-slate-900 w-full mb-3 shadow-sm"></div>
                    <p className="text-[12px] font-black uppercase text-slate-900 leading-none">Event Coordinator</p>
                    <p className="text-[10px] text-slate-500 font-bold">(Name & Signature)</p>
                 </div>
                 <div className="space-y-4">
                    <div className="h-0.5 bg-slate-900 w-full mb-3 shadow-sm"></div>
                    <p className="text-[12px] font-black uppercase text-slate-900 leading-none">Head of the Department</p>
                    <p className="text-[10px] text-slate-500 font-bold">(Seal & Signature)</p>
                 </div>
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
