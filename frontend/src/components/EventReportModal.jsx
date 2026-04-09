
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

  // Derive venue from annexure if not in registrationDetails
  const venueFromAnnexure = (() => {
    const venueMap = event.requisition?.annexureI_venue?.venueSelection || {};
    const selected = Object.entries(venueMap)
      .filter(([, v]) => v?.selected)
      .map(([name]) => name);
    return selected.length > 0 ? selected.join(', ') : '';
  })();

  const resolvedVenue = registrationDetails.venue || venueFromAnnexure || event.venue || '';

  // Resource persons: use IQAC-submitted ones, fallback to event guests from step1
  const resolvedResourcePersons = resourcePersons.length > 0
    ? resourcePersons
    : (s1.guestDetails?.guests || []).map(g => ({ name: g.name, designation: g.designation, organization: g.organization }));

  // Participant counts with fallback to step1 data
  const studentsCount = registrationDetails.studentsCount || s1.participants?.internalParticipants || '';
  const externalCount = registrationDetails.externalCount || s1.participants?.externalParticipants || '';
  const facultyCount = registrationDetails.facultyCount || '';

  // Filter empty strings from objectives/outcomes arrays
  const objectives = (reportDetails?.objectives || []).filter(o => o && o.trim());
  const outcomes = (reportDetails?.outcomes || []).filter(o => o && o.trim());

  // Extra report fields: prefer IQAC input, else fallback to event data if available
  const onlineResource =
    reportDetails?.collaboration?.onlineResource ||
    reportDetails?.onlineResource ||
    s1?.onlineResource ||
    '';

  const collaborators =
    reportDetails?.collaboration?.collaborators ||
    reportDetails?.collaborators ||
    s1?.collaborators ||
    '';

  const conductedThroughMou =
    reportDetails?.collaboration?.conductedThroughMou ||
    reportDetails?.conductedThroughMou ||
    s1?.conductedThroughMou ||
    '';

  const mouName =
    reportDetails?.collaboration?.mouName ||
    reportDetails?.mouName ||
    s1?.mouName ||
    '';

  const iic = reportDetails?.iicDetails || reportDetails?.iic || {};

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
              @page { size: portrait; margin: 10mm 15mm 15mm 15mm; }
              
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
          <div className="px-12 pt-6 pb-12 text-black print:p-0 font-serif" id="printable-report">
            {/* Header */}
            <div className="text-center mb-6 print:mb-4">
              <div className="flex justify-center mb-2">
                <img src={SECEHeader} className="max-w-[80%] max-h-36 object-contain" alt="SECE Header" />
              </div>
              <p className="font-bold text-lg mb-4">Department of {event.department || s1.organizerDetails?.department || 'CSE(CYBERSECURITY)'}</p>
            </div>

            {/* Table 1: General Info */}
            <table className="w-full border-collapse mb-6 text-[13px] leading-relaxed">
              <tbody>
                <tr>
                  <td className="border border-black p-2 font-bold w-1/3">Academic Year</td>
                  <td className="border border-black p-2" colSpan="6">{academicYear}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold">Semester</td>
                  <td className="border border-black p-2" colSpan="6">I / II / III / IV / V / VI / VII / VIII</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold">Event Title</td>
                  <td className="border border-black p-2" colSpan="6">{event.title || s1.eventName || '-'}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold">Event Type</td>
                  <td className="border border-black p-2" colSpan="6">{event.eventType || s1.eventType || '-'}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold">Professional Society involved</td>
                  <td className="border border-black p-2" colSpan="6">{s1.professionalSocieties?.join(', ') || 'Nil'}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold">If the event is associated with CoE, mention the name of the CoE</td>
                  <td className="border border-black p-2" colSpan="6">Nil</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold">Name of the resource person(s) with the organization and contact details:</td>
                  <td className="border border-black p-2" colSpan="6">
                    {resolvedResourcePersons.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-1">
                        {resolvedResourcePersons.map((rp, i) => (
                          <li key={i}>{rp.name}{rp.designation ? `, ${rp.designation}` : ''}{rp.organization ? `, ${rp.organization}` : ''}</li>
                        ))}
                      </ul>
                    ) : 'NIL'}
                  </td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold" rowSpan="2">Date &amp; Duration</td>
                  <td className="border border-black p-2 font-bold">Start Date:</td>
                  <td className="border border-black p-2">{formatDate(s1.eventStartDate || event.date)}</td>
                  <td className="border border-black p-2 font-bold" colSpan="2">Start Time:</td>
                  <td className="border border-black p-2">{s1.eventStartTime || event.startTime || '-'}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold">End Date:</td>
                  <td className="border border-black p-2">{formatDate(s1.eventEndDate || event.date)}</td>
                  <td className="border border-black p-2 font-bold" colSpan="2">End Time:</td>
                  <td className="border border-black p-2">{s1.eventEndTime || event.endTime || '-'}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold" rowSpan="3">Participants</td>
                  <td className="border border-black p-2 font-bold" colSpan="3">No. of Student participants</td>
                  <td className="border border-black p-2" colSpan="3">{studentsCount || 'NIL'}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold" colSpan="3">No. of Faculty participants</td>
                  <td className="border border-black p-2" colSpan="3">{facultyCount || 'NIL'}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold" colSpan="3">No. of External participants</td>
                  <td className="border border-black p-2" colSpan="3">{externalCount || 'NIL'}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold">Mode of Conduct (Online / Offline / Hybrid)</td>
                  <td className="border border-black p-2" colSpan="6">{registrationDetails.mode || 'Offline'}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold">Venue</td>
                  <td className="border border-black p-2" colSpan="6">{resolvedVenue || 'NIL'}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold">Online Resource (Online / Hybrid)</td>
                  <td className="border border-black p-2" colSpan="6">{onlineResource || 'Nil'}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold">Collaborators/ Industry Partners:</td>
                  <td className="border border-black p-2" colSpan="6">{collaborators || 'Nil'}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold">Whether it has been conducted through MoU?</td>
                  <td className="border border-black p-2" colSpan="6">{conductedThroughMou || 'Yes / No'}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold">If yes, please mention the name of MoU</td>
                  <td className="border border-black p-2" colSpan="6">{(conductedThroughMou === 'Yes' ? (mouName || '') : '')}</td>
                </tr>
              </tbody>
            </table>

            {/* Table 2: IIC Details */}
            <div className="mb-6 text-[13px]">
              <p className="mb-2"><strong>Whether the event belongs to: {s1.isIIC === 'Yes' ? <span className="underline">IIC</span> : 'IIC'} / {s1.isIIC === 'No' ? <span className="underline">Non – IIC</span> : 'Non – IIC'}</strong></p>
              <p className="mb-2"><strong>If the event is IIC, please fill the details below:</strong></p>
              <table className="w-full border-collapse border border-black">
                <tbody>
                  <tr>
                    <td className="border border-black p-2 w-1/2">Thrust area</td>
                    <td className="border border-black p-2 w-1/2">{s1?.isIIC === 'Yes' ? (iic?.thrustArea || '') : ''}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2">Activity / Event driven by</td>
                    <td className="border border-black p-2">{s1?.isIIC === 'Yes' ? (iic?.drivenBy || '') : ''}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2">Quarter</td>
                    <td className="border border-black p-2">{s1?.isIIC === 'Yes' ? (iic?.quarter || '') : ''}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2">Event Level</td>
                    <td className="border border-black p-2">{s1?.isIIC === 'Yes' ? (iic?.eventLevel || '') : ''}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2">Event Theme</td>
                    <td className="border border-black p-2">{s1?.isIIC === 'Yes' ? (iic?.eventTheme || '') : ''}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Table 3: Report on the Event */}
            <div className="mb-6 text-[13px]">
              <p className="mb-2"><strong>Report on the Event</strong></p>
              <table className="w-full border-collapse border border-black">
                <tbody>
                  <tr>
                    <td className="border border-black p-4">
                      <p className="font-bold mb-2">Objectives:</p>
                      {objectives.length > 0 ? (
                        <div className="mb-4">
                          {objectives.map((obj, i) => (
                            <p key={i} className="mb-1">{i + 1}. {obj}</p>
                          ))}
                        </div>
                      ) : <p className="mb-4">NIL</p>}

                      <p className="font-bold mb-2">Description of the event:</p>
                      <div className="mb-4 whitespace-pre-wrap leading-relaxed">
                        {reportDetails?.description?.trim() || 'NIL'}
                      </div>

                      <p className="font-bold mb-2">Outcomes:</p>
                      {outcomes.length > 0 ? (
                        <div className="mb-4">
                          {outcomes.map((out, i) => (
                            <p key={i} className="mb-1">{i + 1}. {out}</p>
                          ))}
                        </div>
                      ) : <p className="mb-4">NIL</p>}

                      <p className="font-bold mb-2">Benefit in terms of learning/Skill/Knowledge obtained:</p>
                      {reportDetails?.benefits?.technical || reportDetails?.benefits?.industry ? (
                        <div className="mb-4">
                          {reportDetails.benefits.technical && <p className="mb-1">1. {reportDetails.benefits.technical}</p>}
                          {reportDetails.benefits.industry && <p className="mb-1">2. {reportDetails.benefits.industry}</p>}
                        </div>
                      ) : <p className="mb-4">NIL</p>}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Table 4: SDG Goals */}
            <table className="w-full border-collapse border border-black mb-6 text-[13px]">
              <tbody>
                <tr>
                  <td className="border border-black p-2 font-bold w-1/2">NAME OF THE SDG GOALS MAPPED</td>
                  <td className="border border-black p-2 w-1/2 uppercase">{SDG_NAMES[reportDetails?.mapping?.sdg] || ''}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold">MENTION THE SDG GOALS NUMBER</td>
                  <td className="border border-black p-2">{reportDetails?.mapping?.sdg || ''}</td>
                </tr>
              </tbody>
            </table>

            {/* Table 5: POs & PSOs Mapping */}
            <div className="mb-6 text-[13px] overflow-x-auto">
              <p className="mb-2"><strong>POs &amp; PSOs Mapping (Put a tick mark in the mapped PO's &amp; PSO's):</strong></p>
              <table className="w-full border-collapse border border-black text-center">
                <tbody>
                  <tr>
                    <td className="border border-black p-2 font-bold" colSpan="11">Program Outcomes</td>
                    <td className="border border-black p-2 font-bold" colSpan="2">Program Specific Outcomes</td>
                  </tr>
                  <tr>
                    {Array.from({ length: 11 }).map((_, i) => (
                      <td key={`po-h-${i}`} className="border border-black p-2 font-bold">PO{i + 1}</td>
                    ))}
                    <td className="border border-black p-2 font-bold">PSO1</td>
                    <td className="border border-black p-2 font-bold">PSO2</td>
                  </tr>
                  <tr>
                    {Array.from({ length: 11 }).map((_, i) => {
                      const pos = reportDetails?.mapping?.po ? reportDetails.mapping.po.split(',').map(s=>s.trim()) : [];
                      return (
                        <td key={`po-v-${i}`} className="border border-black p-2 font-bold h-8">
                          {pos.includes((i + 1).toString()) ? '✓' : ''}
                        </td>
                      );
                    })}
                    {(() => {
                      const psos = reportDetails?.mapping?.pso ? reportDetails.mapping.pso.split(',').map(s=>s.trim()) : [];
                      return (
                        <>
                          <td className="border border-black p-2 font-bold h-8">
                            {psos.includes('1') ? '✓' : ''}
                          </td>
                          <td className="border border-black p-2 font-bold h-8">
                            {psos.includes('2') ? '✓' : ''}
                          </td>
                        </>
                      );
                    })()}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Table 6: Funding and Social Media */}
            <table className="w-full border-collapse border border-black mb-8 text-[13px]">
              <tbody>
                <tr>
                  <td className="border border-black p-2 font-bold" colSpan="2">Funding Details:</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 w-1/2">Funding Provided by</td>
                  <td className="border border-black p-2 w-1/2">{reportDetails?.expenditure?.fundingSupport || 'Institute / External / No Funding'}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2">Expenditure amount (in Rs.)</td>
                  <td className="border border-black p-2">{reportDetails?.expenditure?.total ? `₹ ${reportDetails.expenditure.total}` : 'Nil'}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2">Funding agency (if any)</td>
                  <td className="border border-black p-2">{reportDetails?.expenditure?.agency || 'Nil'}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold" colSpan="2">Social media Coverage (Provide links):</td>
                </tr>
                <tr>
                  <td className="border border-black p-2">YouTube</td>
                  <td className="border border-black p-2"></td>
                </tr>
                <tr>
                  <td className="border border-black p-2">Facebook</td>
                  <td className="border border-black p-2"></td>
                </tr>
                <tr>
                  <td className="border border-black p-2">Instagram</td>
                  <td className="border border-black p-2">{reportDetails?.socialMedia?.social || ''}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2">LinkedIn</td>
                  <td className="border border-black p-2">{reportDetails?.socialMedia?.website || ''}</td>
                </tr>
              </tbody>
            </table>

            {/* Photographs */}
            <div className="text-[13px] page-break-inside-avoid">
              {gallery.length > 0 ? (
                gallery.map((img, idx) => (
                  <div key={idx} className="mb-6">
                    <p className="font-bold mb-2">Sample Photograph {idx + 1}:</p>
                    <div className="w-full max-w-[600px] border border-black p-2 mx-auto">
                      <img src={img.url || img.dataUrl} alt={`Photograph ${idx + 1}`} className="w-full h-auto object-contain" />
                    </div>
                    {img.title && <p className="text-center mt-2 italic">{img.title}</p>}
                  </div>
                ))
              ) : (
                  <div className="mb-6">
                    <p className="font-bold mb-2">Sample Photograph 1:</p>
                    <div className="h-48 border border-dashed border-black flex items-center justify-center">
                        <span className="text-slate-400">No Image Provided</span>
                    </div>
                  </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EventReportModal;
