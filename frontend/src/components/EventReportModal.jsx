
import { X, Printer, FileText, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SECELogo from '../assets/sece.avif';
import SECEHeader from '../assets/sece header.jpeg';

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
          id="printable-report-modal"
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto print:max-h-none print:h-auto print:overflow-visible print:shadow-none print:rounded-none relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Final Viewport-Shift Print Engine */}
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              /* 1. Global Page Reset */
              @page { size: portrait; margin: 15mm; }
              
              /* 2. Reset Document Tree Flow */
              html, body {
                height: auto !important;
                overflow: visible !important;
                position: static !important;
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
              }

              /* 3. Hide Unrelated Visuals */
              .print\\:hidden, button, .bg-black\\/60, .backdrop-blur-md, .sticky, div[role="dialog"] > div:not(#printable-report-modal) { 
                display: none !important;
              }

              /* 4. Force Modal to behaves as the Page Body */
              #printable-report-modal {
                display: block !important;
                position: static !important;
                width: 100% !important;
                height: auto !important;
                max-height: none !important;
                overflow: visible !important;
                padding: 0 !important;
                margin: 0 !important;
                background: white !important;
                box-shadow: none !important;
                transform: none !important; /* Fix for Framer Motion transforms */
                border: none !important;
              }

              /* 5. Pagination & Audit-ready Styles */
              section { page-break-inside: auto !important; margin-bottom: 2rem !important; }
              .page-break-after-always { page-break-after: always !important; }
              .page-break-before-page { page-break-before: page !important; }
              .page-break-inside-avoid { page-break-inside: avoid !important; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
          ` }} />
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
              <button onClick={onClose} className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Report Content Wrapper */}
          <div className="p-12 text-slate-900 print:p-0 font-serif" id="printable-report">
            {/* Formal College Header */}
            <div className="text-center mb-8 border-b-2 border-slate-900 pb-6 print:mt-0">
              <div className="flex justify-center mb-6">
                <img src={SECEHeader} className="w-full max-h-52 object-contain" alt="SECE Header" />
              </div>

              <div className="inline-block px-10 py-1.5 border-[3px] border-slate-900 font-sans font-black text-2xl uppercase tracking-tighter mb-4">
                Academic Event Report
              </div>

              <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-500 tracking-wider font-sans">
                <span>Ref No: {event.requisition?.iqacNumber || `SEC/IQAC/${academicYear}/${event.id?.slice(-4).toUpperCase() || '000'}`}</span>
                <span>Academic Year: {academicYear}</span>
                <span>Date: {new Date().toLocaleDateString('en-GB')}</span>
              </div>
            </div>

            <section className="mb-6 page-break-inside-avoid">
              <h3 className="text-xs font-black bg-slate-900 text-white px-3 py-1 mb-2 uppercase tracking-widest font-sans inline-block">01. General Information</h3>

              <div className="grid grid-cols-1 border-[1.5px] border-slate-900 overflow-hidden font-sans">
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

            {/* Event Brochure / Poster Page */}
            <section className="mb-6">
              <h3 className="text-xs font-black bg-slate-900 text-white px-3 py-1 mb-4 uppercase tracking-widest font-sans inline-block">02. Event Brochure / Flyer</h3>
              <div className="flex justify-center flex-col items-center gap-4">
                <div className="relative w-full max-w-[650px] border-[2px] border-slate-900 p-1 bg-white shadow-sm overflow-hidden rounded-sm">
                  <img
                    src={event.posterDataUrl || event.posterUrl || SECELogo}
                    className="w-full h-auto object-contain"
                    alt="Event Brochure"
                  />
                </div>
                <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Fig 1: Official Publication Material</p>
              </div>
            </section>

            {/* Resource Person Info */}
            <section className="mb-6">
              <h3 className="text-xs font-black bg-slate-900 text-white px-3 py-1 mb-4 uppercase tracking-widest font-sans inline-block">03. Resource Person Details</h3>
              <div className="border-[1.5px] border-slate-900 overflow-hidden font-sans bg-slate-50/20">
                {resourcePersons.length > 0 ? resourcePersons.map((rp, idx) => (
                  <div key={idx} className={`flex gap-6 p-5 ${idx !== resourcePersons.length - 1 ? 'border-b-[1.5px] border-slate-900' : ''}`}>
                    {rp.photo?.dataUrl && <img src={rp.photo.dataUrl} className="w-24 h-24 rounded-sm object-cover border-[1.5px] border-slate-900 shadow-sm" alt="rp" />}
                    <div className="flex-1">
                      <div className="font-black uppercase text-[15px] text-slate-900 mb-1">{rp.name}</div>
                      <div className="text-[11px] font-black text-indigo-700 uppercase tracking-tight mb-0.5">{rp.designation}</div>
                      <div className="text-[11px] font-bold text-slate-600 mb-3">{rp.organization}</div>
                      {rp.bio && <div className="text-[10px] text-slate-500 leading-relaxed italic border-l-2 border-slate-300 pl-3">“{rp.bio}”</div>}
                    </div>
                  </div>
                )) : (
                  <div className="p-6 text-center italic text-slate-500 text-xs font-bold uppercase tracking-widest">Nil / Handled by Internal Faculty</div>
                )}
              </div>
            </section>

            <div className="space-y-6">
              {reportDetails?.objectives?.length > 0 && (
                <section>
                  <h3 className="text-xs font-black bg-slate-900 text-white px-3 py-1 mb-4 uppercase tracking-widest font-sans inline-block">04. Event Objectives</h3>
                  <div className="border-[1.5px] border-slate-900 p-5 bg-slate-50/20 font-sans">
                    <ul className="list-decimal list-outside ml-6 space-y-2 text-[12px] leading-relaxed text-slate-800 font-bold">
                      {reportDetails.objectives.map((obj, i) => (
                        <li key={i} className="pl-2">{obj}</li>
                      ))}
                    </ul>
                  </div>
                </section>
              )}

              {reportDetails?.description && (
                <section>
                  <h3 className="text-xs font-black bg-slate-900 text-white px-3 py-1 mb-4 uppercase tracking-widest font-sans inline-block">05. Detailed Description of the Event</h3>
                  <div className="border-[1.5px] border-slate-900 p-6 bg-white text-[12px] leading-[1.8] text-slate-800 text-justify indent-12 whitespace-pre-wrap font-serif">
                    {reportDetails.description}
                  </div>
                </section>
              )}

              {reportDetails?.outcomes?.length > 0 && (
                <section>
                  <h3 className="text-xs font-black bg-slate-900 text-white px-3 py-1 mb-4 uppercase tracking-widest font-sans inline-block">06. Summary of Outcomes</h3>
                  <div className="border-[1.5px] border-slate-900 p-5 bg-slate-50/20 font-sans">
                    <ul className="list-disc list-outside ml-6 space-y-2 text-[12px] leading-relaxed text-slate-800 font-bold">
                      {reportDetails.outcomes.map((out, i) => (
                        <li key={i} className="pl-2">{out}</li>
                      ))}
                    </ul>
                  </div>
                </section>
              )}

              {reportDetails?.benefits && (
                <section className="bg-slate-50 border-[1.5px] border-slate-900 p-6 page-break-inside-avoid font-sans">
                  <h3 className="text-[11px] font-black mb-4 uppercase tracking-widest text-slate-900 border-b-[1.5px] border-slate-900 pb-2">07. Learning Benefits</h3>
                  <div className="grid grid-cols-2 gap-8 mt-4">
                    <div className="border-r-[1.5px] border-slate-200 pr-8">
                      <p className="text-[10px] font-black uppercase text-indigo-700 mb-2 tracking-tighter">Technical Skills Gained</p>
                      <p className="text-[12px] text-slate-900 font-bold leading-relaxed">{reportDetails.benefits.technical}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-indigo-700 mb-2 tracking-tighter">Impact on Employability</p>
                      <p className="text-[12px] text-slate-900 font-bold leading-relaxed">{reportDetails.benefits.industry}</p>
                    </div>
                  </div>
                </section>
              )}

              <section>
                <h3 className="text-xs font-black bg-slate-900 text-white px-3 py-1 mb-4 uppercase tracking-widest font-sans inline-block">08. Participant Statistics & Feedback</h3>

                <div className="grid grid-cols-3 gap-0 border-[1.5px] border-slate-900 overflow-hidden font-sans mb-6 bg-white">
                  <div className="p-4 text-center border-r-[1.5px] border-slate-900">
                    <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Registered Students</p>
                    <p className="text-3xl font-black text-slate-900">{registrationDetails.studentsCount || 0}</p>
                  </div>
                  <div className="p-4 text-center border-r-[1.5px] border-slate-900">
                    <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Internal Faculty</p>
                    <p className="text-3xl font-black text-slate-900">{registrationDetails.facultyCount || 0}</p>
                  </div>
                  <div className="p-4 text-center">
                    <p className="text-[10px] font-black uppercase text-slate-500 mb-1">External Members</p>
                    <p className="text-3xl font-black text-slate-900">{registrationDetails.externalCount || 0}</p>
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
                              <td className="px-4 py-2.5 text-slate-400">{idx + 1}</td>
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
                  <h3 className="text-xs font-black bg-slate-900 text-white px-3 py-1 mb-4 uppercase tracking-widest font-sans inline-block">09. Expert Observations & Guest Feedback</h3>
                  <div className="border-[1.5px] border-slate-900 overflow-hidden font-sans">
                    {guestFeedback.map((f, i) => (
                      <div key={i} className={`p-5 bg-slate-50/20 ${i !== guestFeedback.length - 1 ? 'border-b-[1.5px] border-slate-900' : ''}`}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-black uppercase text-slate-900 text-[12px] tracking-tight">{f.name}{f.designation ? ` (${f.designation})` : ''}</span>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map(s => <Star key={s} size={11} className={f.rating >= s ? 'text-amber-500 fill-amber-500' : 'text-slate-200'} />)}
                          </div>
                        </div>
                        <p className="italic font-bold text-slate-700 text-[11px] leading-relaxed border-l-2 border-slate-300 pl-3">"{f.feedback}"</p>
                        {f.highlights && <p className="mt-2 text-[9px] font-black text-indigo-700 uppercase tracking-tighter">Key Highlights: {f.highlights}</p>}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h3 className="text-xs font-black bg-slate-900 text-white px-3 py-1 mb-4 uppercase tracking-widest font-sans inline-block">10. Strategic Alignment (SDG & POs)</h3>
                <div className="grid grid-cols-2 border-[1.5px] border-slate-900 overflow-hidden font-sans">
                  <div className="p-6 border-r-[1.5px] border-slate-900 flex gap-5 items-center bg-white">
                    <div className="w-16 h-16 bg-slate-900 text-white rounded-sm shadow-md flex items-center justify-center font-black text-2xl">
                      {String(reportDetails.mapping?.sdg || '04').padStart(2, '0')}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-indigo-700 mb-0.5">Goal Mapping</p>
                      <p className="text-[13px] font-black text-slate-900 leading-tight">SDG {reportDetails.mapping?.sdg || '4'}: {SDG_NAMES[reportDetails.mapping?.sdg] || 'Quality Education'}</p>
                    </div>
                  </div>
                  <div className="p-6 bg-slate-50/30">
                    <p className="text-[10px] font-black uppercase text-slate-500 mb-2">Academic Alignment</p>
                    <p className="text-[12px] font-black text-slate-900 tracking-tight leading-relaxed">POs: {reportDetails.mapping?.po || '1, 3, 5, 8, 9, 12'}</p>
                    <p className="text-[12px] font-black text-slate-900 tracking-tight leading-relaxed">PSOs: {reportDetails.mapping?.pso || '1, 2'}</p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-xs font-black bg-slate-900 text-white px-3 py-1 mb-4 uppercase tracking-widest font-sans inline-block">11. Event Documentation / Photos</h3>
                {gallery.length > 0 ? (
                  <div className="border-[1.5px] border-slate-900 p-8 bg-slate-50/10">
                    <div className="grid grid-cols-2 gap-8">
                      {gallery.map((img, idx) => (
                        <div key={idx} className="space-y-4 font-sans">
                          <div className="aspect-video w-full border-[1.5px] border-slate-900 shadow-sm bg-white overflow-hidden">
                            <img src={img.url || img.dataUrl} className="w-full h-full object-cover" alt="event" />
                          </div>
                          <div className="text-center font-black">
                            <p className="text-[10px] text-slate-900 uppercase">Fig {idx + 1}: {img.dayTag || 'Event Session'}</p>
                            <p className="text-[9px] text-slate-500 italic mt-1 uppercase tracking-tighter">{img.title || ''}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-16 border-[1.5px] border-dashed border-slate-400 text-center font-sans text-slate-400 font-bold uppercase tracking-widest text-xs">No photographs available for this event records</div>
                )}
              </section>

              <section>
                <h3 className="text-xs font-black text-center py-2 bg-slate-900 text-white mb-6 uppercase tracking-widest font-sans border-[1.5px] border-slate-900">Checklist of Enclosures</h3>
                <div className="grid grid-cols-2 gap-x-12 gap-y-3 px-6 py-6 border-[1.5px] border-slate-900 font-sans uppercase bg-slate-50/10">
                  {[
                    ['Event Approval Letter (Original)', true],
                    ['Resource Person CV & Acceptance', resourcePersons.length > 0],
                    ['Student Attendance Records', registrationDetails.studentsCount > 0],
                    ['Feedback Analysis Summary', feedbackStats?.totalResponses > 0],
                    ['Geotagged Event Photographs', gallery.length > 0],
                    ['Impact / Media Coverage', !!reportDetails?.socialMedia?.social]
                  ].map(([item, valid], i) => (
                    <div key={i} className="flex items-center justify-between border-b border-slate-300 pb-1.5">
                      <span className="text-[10px] font-black text-slate-800">{i + 1}. {item}</span>
                      {valid ? <div className="text-slate-900 font-black text-base">✓</div> : <div className="w-4 h-4 border-[1.5px] border-slate-900"></div>}
                    </div>
                  ))}
                </div>
              </section>

              {/* Verified Signatures */}
              <div className="mt-20 grid grid-cols-2 gap-40 text-center font-sans px-4">
                <div className="space-y-5">
                  <div className="h-[2px] bg-slate-900 w-full mb-2"></div>
                  <p className="text-[12px] font-black uppercase text-slate-900 tracking-tighter">Event Coordinator</p>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">(Name & Signature)</p>
                </div>
                <div className="space-y-5">
                  <div className="h-[2px] bg-slate-900 w-full mb-2"></div>
                  <p className="text-[12px] font-black uppercase text-slate-900 tracking-tighter">Head of the Department</p>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">(Seal & Signature)</p>
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
