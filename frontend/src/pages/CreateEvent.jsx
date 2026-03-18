import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ClipboardList,
  Building2,
  Mic2,
  MonitorSmartphone,
  Car,
  Hotel,
  Camera,
  Eye,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Loader2,
  Send,
} from 'lucide-react';
import { motion } from 'framer-motion';
import Navbar from '../components/Navbar';
import { useAppContext } from '../context/AppContext';
import { EventStatus, UserRole } from '../types';

const EVENT_TYPES = ['FDP', 'Seminar', 'Workshop', 'Guest Lecture', 'Other'];
const PROFESSIONAL_SOCIETIES = ['IEEE', 'IETE', 'ISTE', 'WiCYS', 'IGEN', 'GDG', 'Other'];
const DEPARTMENTS = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'AI&DS', 'IT', 'MBA', 'Other'];

const VENUE_OPTIONS = [
  'Classroom', 'Lab', 'Main Board Room', 'IQAC Board Room', 'Synapse Studio', 'Courtyard',
  'Ignite Board Room', 'Ignite Seminar Hall', 'GF07', 'Placement Board Room', 'IT Centre',
  'OAT', 'Auditorium I Floor', 'Auditorium II Floor', 'Vista Hall', 'Collab Space',
  'Code Studio', 'Drawing Hall',
];

const HALL_REQUIREMENTS = [
  'Guest Chair', 'Water Bottles', 'Notepad', 'Event Standee', 'Dias Table',
  'Name Boards on Dias', 'Pen', 'Front Entrance Banner', 'Audience Chair',
  'Chocolates / Nuts', 'Helpdesk', 'Welcome Banner',
];

const AUDIO_EQUIPMENT = [
  'Hand Mic', 'Collar Mic', 'Podium', 'AC', 'Handheld Speaker', 'Speaker Set', 'Speaker Set with Mixer',
];

const ICT_ADDITIONAL_SERVICES = [
  'Chief Guest AV', 'Stage Streaming Video', 'Stage LED Back Drop', 'Projector / TV', 'Live Streaming',
];

const ACCOMMODATION_TYPES = ['Suite Rooms 1–5', 'Boys Hostel', 'Girls Hostel'];

const MEDIA_CHECKLIST = {
  posterDesign: ['Pre Event Poster', 'Chief Guest Poster', 'Event Poster', 'Post Event Poster'],
  receptionTvDesign: ['Event Poster', 'Chief Guest Welcome Poster'],
  stageDesign: ['Stage LED Back Drop', 'Agenda Items'],
  flexDesign: ['Event Standee', 'Front Entrance Banner', 'Welcome Banner'],
  otherMaterials: ['Certificates', 'Memento Sticker', 'Vinyl Welcome Boards', 'ID Cards'],
  otherMaterialCount: '',
  videoRequirements: [
    'Coming Soon Video', 'Event Launch Video', 'Promotional Video', 'Stage Streaming Video',
    'Chief Guest AV', 'Event Glimpses Video', 'Feedback Video',
  ],
};

const createQtyMap = (items) => Object.fromEntries(items.map((item) => [item, { selected: false, qty: 0 }]));

// Audio Equipment specific map
const createAudioQtyMap = (items) => Object.fromEntries(items.map((item) => [item, { selected: false, qty: 0 }]));

const JOURNEY_FIELD_LABELS = {
  vehicleDate: 'Vehicle Date (Default: Event Date)',
  startingPlace: 'Starting Place',
  startTime: 'Start Time',
  endPlace: 'End Place',
  endTime: 'End Time',
  numberOfPersons: 'Number of Persons',
};

const defaultTransportJourney = {
  vehicleDate: '',
  startingPlace: '',
  startTime: '',
  endPlace: '',
  endTime: '',
  numberOfPersons: '',
};

const createPassenger = (i = 1) => ({ id: Date.now() + i, sno: i, name: '', employeeId: '', designation: '', contactNumber: '' });
const createDiningRow = (i = 1) => ({
  id: Date.now() + i,
  date: '',
  guestCount: '',
  breakfast: false,
  morningRefreshment: false,
  lunchVeg: false,
  lunchNonVeg: false,
  eveningRefreshment: false,
  dinnerVeg: false,
  dinnerNonVeg: false,
});

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const compressImageToDataUrl = (file, maxWidth = 1200, quality = 0.82) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Unable to process image'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = reader.result;
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const STEP_KEYS = {
  EVENT_INFO: 'eventInfo',
  VENUE: 'venue',
  AUDIO: 'audio',
  ICTS: 'icts',
  TRANSPORT: 'transport',
  ACCOMMODATION: 'accommodation',
  MEDIA: 'media',
  REVIEW: 'review',
};

const Card = ({ title, icon: Icon, children }) => (
  <div className="glass-panel p-6 md:p-8 rounded-2xl space-y-5">
    <h3 className="text-lg md:text-xl font-bold flex items-center gap-2">
      {Icon ? <Icon className="text-cse-accent" size={20} /> : null}
      {title}
    </h3>
    {children}
  </div>
);

const YesNoToggle = ({ label, value, onChange }) => (
  <div className="space-y-2">
    <label className="text-sm font-semibold text-slate-700">{label}</label>
    <div className="flex gap-3">
      <button type="button" onClick={() => onChange('Yes')} className={`px-4 py-2 rounded-lg border text-sm font-semibold ${value === 'Yes' ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'border-slate-200 text-slate-600'}`}>
        Yes
      </button>
      <button type="button" onClick={() => onChange('No')} className={`px-4 py-2 rounded-lg border text-sm font-semibold ${value === 'No' ? 'bg-slate-100 border-slate-300 text-slate-700' : 'border-slate-200 text-slate-600'}`}>
        No
      </button>
    </div>
  </div>
);

const formatTime12 = (t24) => {
  if (!t24) return "-";
  try {
    const [h, m] = t24.split(':');
    const hh = parseInt(h, 10);
    const suffix = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 || 12;
    return `${h12.toString().padStart(2, '0')}:${m} ${suffix}`;
  } catch (e) {
    return t24;
  }
};

const TimePicker = ({ id, value, onChange, onBlur, className }) => {
  // Ensure value is HH:mm
  const val = value || '09:00';
  const [h, m] = val.split(':');
  const hh = parseInt(h, 10);
  const hour12 = hh % 12 || 12;
  const ampm = hh >= 12 ? 'PM' : 'AM';

  const updateTime = (newH12, newM, newAmpm) => {
    let h24 = parseInt(newH12, 10);
    if (newAmpm === 'PM' && h24 < 12) h24 += 12;
    if (newAmpm === 'AM' && h24 === 12) h24 = 0;
    const result = `${h24.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
    onChange({ target: { id, value: result } });
  };

  return (
    <div className="flex items-center gap-1">
      <div className="flex-1 flex gap-1 items-center">
        <select
          value={hour12.toString().padStart(2, '0')}
          onChange={(e) => updateTime(e.target.value, m, ampm)}
          onBlur={onBlur}
          className={`${className} flex-1 min-w-[65px] text-center appearance-none`}
        >
          {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0')).map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <span className="font-bold text-slate-400">:</span>
        <select
          value={m}
          onChange={(e) => updateTime(hour12, e.target.value, ampm)}
          onBlur={onBlur}
          className={`${className} flex-1 min-w-[65px] text-center appearance-none`}
        >
          {Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0')).map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <select
          value={ampm}
          onChange={(e) => updateTime(hour12, m, e.target.value)}
          onBlur={onBlur}
          className={`${className} min-w-[56px] px-1 text-center font-bold text-cse-accent appearance-none text-xs`}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
};

const RequirementToggle = ({ label, checked, onToggle }) => (
  <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3 cursor-pointer bg-white">
    <span className="text-sm font-medium text-slate-700">{label}</span>
    <input type="checkbox" checked={checked} onChange={onToggle} className="w-4 h-4" />
  </label>
);

const CreateEvent = () => {
  const { currentUser } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const editingEvent = location.state?.editingEvent || null;
  const isResubmissionEdit = Boolean(editingEvent?.id && editingEvent?.status === EventStatus.REJECTED);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [stepError, setStepError] = useState('');
  // Per-field inline error messages
  const [fieldErrors, setFieldErrors] = useState({});
  // Shows red on qty=0 rows ONLY after user clicks Next and validation fails
  const [qtyErrorsVisible, setQtyErrorsVisible] = useState(false);

  const setFE = (key, msg) => setFieldErrors((prev) => ({ ...prev, [key]: msg || '' }));

  // Returns className for an input: adds .input-error based on fieldErrors
  const fieldCls = (key, base = 'input-field') => {
    if (fieldErrors[key]) return `${base} input-error`;
    return base;
  };

  const [form, setForm] = useState({
    eventName: '',
    eventType: '',
    posterDataUrl: '',
    posterFileName: '',
    posterMimeType: '',
    requirePoster: false,
    posterNeededByDate: '',
    posterNeededByTime: '',
    professionalSocieties: [],
    isIIC: 'No',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    organizerName: currentUser?.name || '',
    department: '',
    mobileNumber: '',
    internalParticipants: '',
    externalParticipants: '',
    // Dynamic guest list (replaces old flat fields noOfGuests/guestNames/guestDesignation/guestOrganization)
    guests: [],

    // Requirement toggles
    venueRequired: true,
    audioRequired: true,
    ictsRequired: true,
    transportRequired: false,
    accommodationRequired: true,
    mediaRequired: true,
    financialRequired: false,

    // Other requirements
    gifts: { selected: false, qty: '' },
    trophy: { selected: false, qty: '' },
    bouquet: { selected: false, qty: '' },

    // Step 2: Venue
    numberOfVenuesRequired: '',
    venueSelection: createQtyMap(VENUE_OPTIONS),
    hallRequirements: createQtyMap(HALL_REQUIREMENTS),
    venueSpecialRequest: '',

    // Step 3: Audio
    audioDate: '',
    audioStartTime: '',
    audioEndTime: '',
    audioVenueName: '',
    audioEquipment: createAudioQtyMap(AUDIO_EQUIPMENT),
    audioSpecialRequest: '',

    // Step 4: ICTS
    desktopLaptopRequired: 'Not Required',
    internetFacility: 'WiFi',
    expectedInternetUsers: '',
    additionalICTServices: ICT_ADDITIONAL_SERVICES.reduce((acc, s) => ({ ...acc, [s]: false }), {}),
    ictsSpecialRequest: '',

    // Step 5: Transport
    externalTransport: {
      facultyId: '',
      organizerDesignation: '',
      contactNumber: '',
      emailId: '',
      guestDetails: '',
      purposeOfVisit: '',
      modeOfTransport: 'Bus',
      onwardJourney: { ...defaultTransportJourney },
      returnJourney: { ...defaultTransportJourney },
    },
    internalTransport: {
      indenterName: '',
      contactNumber: '',
      designation: '',
      employeeId: '',
      department: '',
      emailId: '',
      onwardJourney: { ...defaultTransportJourney },
      returnJourney: { ...defaultTransportJourney },
      numberOfVehicles: '',
      vehicleNumber: '',
      passengers: [createPassenger()],
      purposeOfVisit: '',
      industries: [''],
    },

    // Step 6: Accommodation / Dining
    accommodation: {
      guestNames: '',
      guestDesignation: '',
      industryInstitute: '',
      mobileNumber: '',
      email: '',
      address: '',
      maleGuests: '',
      femaleGuests: '',
      arrivalDate: '',
      arrivalTime: '',
      departureDate: '',
      departureTime: '',
      numberOfRooms: '',
      accommodationTypes: ACCOMMODATION_TYPES.reduce((acc, t) => ({ ...acc, [t]: false }), {}),
      diningRequired: false,
      diningType: 'Hostel Guest Dining',
      mealSchedule: [createDiningRow()],
      specialRequest: '',
    },

    // Step 7: Media
    media: {
      logosRequired: '',
      photographyTime: '',
      videoRecordingTime: '',
      preEventPosterNeededByDate: '',
      preEventPosterNeededByTime: '',
      preEventPosterNotes: '',
      posterDesign: MEDIA_CHECKLIST.posterDesign.reduce((acc, item) => ({ ...acc, [item]: false }), {}),
      receptionTvDesign: MEDIA_CHECKLIST.receptionTvDesign.reduce((acc, item) => ({ ...acc, [item]: false }), {}),
      stageDesign: MEDIA_CHECKLIST.stageDesign.reduce((acc, item) => ({ ...acc, [item]: false }), {}),
      flexDesign: MEDIA_CHECKLIST.flexDesign.reduce((acc, item) => ({ ...acc, [item]: false }), {}),
      otherMaterials: MEDIA_CHECKLIST.otherMaterials.reduce((acc, item) => ({ ...acc, [item]: false }), {}),
      otherMaterialCount: '',
      videoRequirements: MEDIA_CHECKLIST.videoRequirements.reduce((acc, item) => ({ ...acc, [item]: false }), {}),
      websitePostContent: '',
      socialPostContent: '',
      otherMediaRequirement: '',
      specialRequest: '',
    },
  });

  const iqacNumber = useMemo(() => {
    const dept = form.department || 'DEPT';
    return `IQAC/2025-26/${dept}/01`;
  }, [form.department]);

  const numberOfDays = useMemo(() => {
    if (!form.startDate || !form.endDate) return '';
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return '';
    return Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
  }, [form.startDate, form.endDate]);

  const accommodationDays = useMemo(() => {
    const a = form.accommodation;
    if (!a.arrivalDate || !a.departureDate) return '';
    const start = new Date(a.arrivalDate);
    const end = new Date(a.departureDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return '';
    return Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
  }, [form.accommodation]);

  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);
  
  const pastWeekDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  }, []);

  // Update Transport Dates automatically if start date is filled and transport dates are empty
  useEffect(() => {
    if (form.startDate) {
      setForm(prev => {
        let updated = { ...prev };
        if (!updated.externalTransport.onwardJourney.vehicleDate) {
          updated.externalTransport.onwardJourney.vehicleDate = form.startDate;
        }
        if (!updated.externalTransport.returnJourney.vehicleDate) {
          updated.externalTransport.returnJourney.vehicleDate = form.startDate;
        }
        if (!updated.internalTransport.onwardJourney.vehicleDate) {
          updated.internalTransport.onwardJourney.vehicleDate = form.startDate;
        }
        if (!updated.internalTransport.returnJourney.vehicleDate) {
          updated.internalTransport.returnJourney.vehicleDate = form.startDate;
        }
        return updated;
      });
    }
  }, [form.startDate]);

  // Sync Audio Date and Venue automatically
  useEffect(() => {
    setForm(prev => {
      let updated = { ...prev };
      // Sync Date
      if (prev.startDate) {
        updated.audioDate = prev.startDate;
      }
      
      // Sync Venue: Collect all selected venues
      const selectedVenues = Object.entries(prev.venueSelection)
        .filter(([venue, data]) => data.selected)
        .map(([venue]) => venue);
      
      if (selectedVenues.length > 0) {
        updated.audioVenueName = selectedVenues.join(', ');
      }

      return updated;
    });
  }, [form.startDate, form.venueSelection]);

  const eventStartMinDate = todayIso;
  const eventEndMinDate = form.startDate || todayIso;
  const audioMinDate = form.startDate || todayIso;
  const journeyMinDate = pastWeekDate;
  const accommodationArrivalMinDate = pastWeekDate;
  const accommodationDepartureMinDate = form.accommodation.arrivalDate || accommodationArrivalMinDate;
  const diningMinDate = form.accommodation.arrivalDate || form.startDate || pastWeekDate;

  const steps = useMemo(() => {
    return [
      { key: STEP_KEYS.EVENT_INFO, title: 'Event Info', icon: CalendarDays },
      ...(form.venueRequired ? [{ key: STEP_KEYS.VENUE, title: 'Venue', icon: Building2 }] : []),
      ...(form.audioRequired ? [{ key: STEP_KEYS.AUDIO, title: 'Audio', icon: Mic2 }] : []),
      ...(form.ictsRequired ? [{ key: STEP_KEYS.ICTS, title: 'ICTS', icon: MonitorSmartphone }] : []),
      ...(form.transportRequired ? [{ key: STEP_KEYS.TRANSPORT, title: 'Transport', icon: Car }] : []),
      ...(form.accommodationRequired ? [{ key: STEP_KEYS.ACCOMMODATION, title: 'Accommodation', icon: Hotel }] : []),
      ...(form.mediaRequired ? [{ key: STEP_KEYS.MEDIA, title: 'Media', icon: Camera }] : []),
      { key: STEP_KEYS.REVIEW, title: 'Review', icon: Eye },
    ];
  }, [form.venueRequired, form.audioRequired, form.ictsRequired, form.transportRequired, form.accommodationRequired, form.mediaRequired]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [maxReachedIndex, setMaxReachedIndex] = useState(0);

  useEffect(() => {
    if (!editingEvent) return;

    const step1 = editingEvent.requisition?.step1 || {};
    const venueAnnex = editingEvent.requisition?.annexureI_venue || null;
    const audioAnnex = editingEvent.requisition?.annexureII_audio || null;
    const ictsAnnex = editingEvent.requisition?.annexureIII_icts || null;
    const transportAnnex = editingEvent.requisition?.annexureIV_transport || null;
    const accommodationAnnex = editingEvent.requisition?.annexureV_accommodation || null;
    const mediaAnnex = editingEvent.requisition?.annexureVI_media || null;

    setForm((prev) => ({
      ...prev,
      eventName: step1.eventName || editingEvent.title || '',
      eventType: step1.eventType || editingEvent.eventType || '',
      posterDataUrl: editingEvent.posterDataUrl || '',
      posterFileName: editingEvent.posterFileName || '',
      posterMimeType: editingEvent.posterMimeType || '',
      requirePoster: editingEvent.posterWorkflow?.requested || false,
      professionalSocieties: step1.professionalSocieties || [],
      isIIC: step1.isIIC || 'No',
      startDate: step1.eventStartDate || editingEvent.date || '',
      endDate: step1.eventEndDate || editingEvent.date || '',
      startTime: step1.eventStartTime || editingEvent.startTime || '',
      endTime: step1.eventEndTime || editingEvent.endTime || '',
      organizerName: step1.organizerDetails?.organizerName || editingEvent.organizerName || currentUser?.name || '',
      department: step1.organizerDetails?.department || editingEvent.department || '',
      mobileNumber: step1.organizerDetails?.mobileNumber || '',
      internalParticipants: String(step1.participants?.internalParticipants ?? ''),
      externalParticipants: String(step1.participants?.externalParticipants ?? ''),
      guests: Array.isArray(step1.guestDetails?.guests)
        ? step1.guestDetails.guests
        : [
            // Legacy flat-field support: convert old format to array
            ...(step1.guestDetails?.guestNames ? [{
              name: step1.guestDetails.guestNames || '',
              designation: step1.guestDetails.guestDesignation || '',
              organization: step1.guestDetails.organizationIndustry || '',
            }] : []),
          ],
      venueRequired: step1.requirements?.venueRequired ?? true,
      audioRequired: step1.requirements?.audioRequired ?? true,
      ictsRequired: step1.requirements?.ictsRequired ?? true,
      transportRequired: step1.requirements?.transportRequired ?? false,
      accommodationRequired: step1.requirements?.accommodationDiningRequired ?? true,
      mediaRequired: step1.requirements?.mediaRequired ?? true,
      financialRequired: step1.requirements?.financialRequired ?? false,
      gifts: step1.otherRequirements?.gifts || { selected: false, qty: '' },
      trophy: step1.otherRequirements?.trophy || { selected: false, qty: '' },
      bouquet: step1.otherRequirements?.bouquet || { selected: false, qty: '' },
      numberOfVenuesRequired: String(venueAnnex?.numberOfVenuesRequired ?? ''),
      venueSelection: venueAnnex?.venueSelection || createQtyMap(VENUE_OPTIONS),
      hallRequirements: venueAnnex?.hallRequirements || createQtyMap(HALL_REQUIREMENTS),
      venueSpecialRequest: venueAnnex?.specialRequest || '',
      audioDate: audioAnnex?.eventDate || prev.startDate || '',
      audioStartTime: audioAnnex?.startTime || '',
      audioEndTime: audioAnnex?.endTime || '',
      audioVenueName: audioAnnex?.venueName || '',
      audioEquipment: audioAnnex?.audioEquipment || createAudioQtyMap(AUDIO_EQUIPMENT),
      audioSpecialRequest: audioAnnex?.specialRequest || '',
      desktopLaptopRequired: ictsAnnex?.desktopLaptop || 'Not Required',
      internetFacility: ictsAnnex?.internetFacility || 'WiFi',
      expectedInternetUsers: String(ictsAnnex?.expectedInternetUsers ?? ''),
      additionalICTServices: ictsAnnex?.additionalServices || ICT_ADDITIONAL_SERVICES.reduce((acc, s) => ({ ...acc, [s]: false }), {}),
      ictsSpecialRequest: ictsAnnex?.specialRequest || '',
      externalTransport: transportAnnex?.externalTransport || prev.externalTransport,
      internalTransport: transportAnnex?.internalTransport || prev.internalTransport,
      accommodation: accommodationAnnex || prev.accommodation,
      media: mediaAnnex || prev.media,
    }));
  }, [editingEvent, currentUser]);

  const advanceStep = (prev, stepsLen) => {
    const next = Math.min(prev + 1, stepsLen - 1);
    setMaxReachedIndex((m) => Math.max(m, next));
    return next;
  };

  useEffect(() => {
    if (!currentUser) navigate('/');
  }, [currentUser, navigate]);

  useEffect(() => {
    if (currentStepIndex >= steps.length) {
      setCurrentStepIndex(steps.length - 1);
    }
    setMaxReachedIndex((m) => Math.min(m, steps.length - 1));
  }, [steps, currentStepIndex]);

  if (!currentUser) return null;

  const currentStep = steps[currentStepIndex]?.key;

  const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const clearPoster = () => {
    setForm((prev) => ({
      ...prev,
      posterDataUrl: '',
      posterFileName: '',
      posterMimeType: '',
    }));
  };

  const handlePosterUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setStepError('Please upload an image file for the event poster.');
      return;
    }

    try {
      setStepError('');
      const posterDataUrl = file.type === 'image/gif'
        ? await fileToDataUrl(file)
        : await compressImageToDataUrl(file);

      if (posterDataUrl.length > 10 * 1024 * 1024) {
        setStepError('Poster is too large after processing. Please use a smaller image.');
        return;
      }

      setForm((prev) => ({
        ...prev,
        posterDataUrl,
        posterFileName: file.name,
        posterMimeType: file.type,
      }));
    } catch {
      setStepError('Unable to process poster image. Please try another file.');
    } finally {
      event.target.value = '';
    }
  };

  const toggleRequirement = (name) => {
    setForm((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const toggleArrayValue = (field, value) => {
    setForm((prev) => {
      const exists = prev[field].includes(value);
      return {
        ...prev,
        [field]: exists ? prev[field].filter((v) => v !== value) : [...prev[field], value],
      };
    });
  };

  const updateQtyMap = (field, key, patch) => {
    setForm((prev) => ({
      ...prev,
      [field]: {
        ...prev[field],
        [key]: {
          ...prev[field][key],
          ...patch,
          qty: patch.selected === false ? 0 : (patch.qty ?? prev[field][key].qty),
        },
      },
    }));
  };

  const updateNested = (path, value) => {
    setForm((prev) => {
      const segments = path.split('.');
      const next = { ...prev };
      let ptr = next;
      for (let i = 0; i < segments.length - 1; i += 1) {
        ptr[segments[i]] = { ...ptr[segments[i]] };
        ptr = ptr[segments[i]];
      }
      ptr[segments[segments.length - 1]] = value;
      return next;
    });
  };

  const updateJourney = (transportType, journeyType, field, value) => {
    setForm((prev) => ({
      ...prev,
      [transportType]: {
        ...prev[transportType],
        [journeyType]: {
          ...prev[transportType][journeyType],
          [field]: value,
        },
      },
    }));
  };

  const addPassenger = () => {
    setForm((prev) => {
      const p = prev.internalTransport.passengers;
      return {
        ...prev,
        internalTransport: {
          ...prev.internalTransport,
          passengers: [...p, createPassenger(p.length + 1)],
        },
      };
    });
  };

  const removePassenger = (id) => {
    setForm((prev) => {
      const filtered = prev.internalTransport.passengers.filter((p) => p.id !== id)
        .map((p, idx) => ({ ...p, sno: idx + 1 }));
      return {
        ...prev,
        internalTransport: {
          ...prev.internalTransport,
          passengers: filtered.length ? filtered : [createPassenger()],
        },
      };
    });
  };

  const updatePassenger = (id, field, value) => {
    setForm((prev) => ({
      ...prev,
      internalTransport: {
        ...prev.internalTransport,
        passengers: prev.internalTransport.passengers.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
      },
    }));
  };

  const addIndustry = () => {
    setForm((prev) => ({
      ...prev,
      internalTransport: {
        ...prev.internalTransport,
        industries: [...prev.internalTransport.industries, ''],
      },
    }));
  };

  const updateIndustry = (idx, value) => {
    setForm((prev) => ({
      ...prev,
      internalTransport: {
        ...prev.internalTransport,
        industries: prev.internalTransport.industries.map((i, iIdx) => (iIdx === idx ? value : i)),
      },
    }));
  };

  const removeIndustry = (idx) => {
    setForm((prev) => {
      const next = prev.internalTransport.industries.filter((_, i) => i !== idx);
      return {
        ...prev,
        internalTransport: {
          ...prev.internalTransport,
          industries: next.length ? next : [''],
        },
      };
    });
  };

  const addDiningRow = () => {
    setForm((prev) => ({
      ...prev,
      accommodation: {
        ...prev.accommodation,
        mealSchedule: [...prev.accommodation.mealSchedule, createDiningRow(prev.accommodation.mealSchedule.length + 1)],
      },
    }));
  };

  const removeDiningRow = (id) => {
    setForm((prev) => ({
      ...prev,
      accommodation: {
        ...prev.accommodation,
        mealSchedule: prev.accommodation.mealSchedule.filter((row) => row.id !== id) || [createDiningRow()],
      },
    }));
  };

  const updateDiningRow = (id, field, value) => {
    setForm((prev) => ({
      ...prev,
      accommodation: {
        ...prev.accommodation,
        mealSchedule: prev.accommodation.mealSchedule.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
      },
    }));
  };

  const toggleMediaItem = (bucket, item) => {
    setForm((prev) => ({
      ...prev,
      media: {
        ...prev.media,
        [bucket]: {
          ...prev.media[bucket],
          [item]: !prev.media[bucket][item],
        },
      },
    }));
  };

  const isValidPhone = (phone) => /^\d{10}$/.test(String(phone).trim());
  const isValidEmail = (email) => {
    if (!email) return true;
    const val = String(email).trim();
    return val.includes('@') && val === val.toLowerCase();
  };
  const isPositiveInt = (v) => /^\d+$/.test(String(v).trim()) && Number(v) >= 0;

  // Validate a single field and update fieldErrors; returns true if ok
  const validateField = (key, value) => {
    let msg = '';
    switch (key) {
      // ── Event Info ──
      case 'eventName':
        if (!String(value || '').trim()) msg = 'Event Name is required.';
        break;
      case 'eventType':
        if (!value) msg = 'Please select an Event Type.';
        break;
      case 'startDate':
        if (!value) { msg = 'Start Date is required.'; break; }
        if (new Date(value) < new Date(todayIso)) msg = 'Start Date must be today or a future date.';
        break;
      case 'endDate':
        if (!value) { msg = 'End Date is required.'; break; }
        if (form.startDate && value < form.startDate) msg = 'End Date must be on or after Start Date.';
        break;
      case 'startTime':
        if (!value) msg = 'Start Time is required.';
        break;
      case 'endTime':
        if (!value) { msg = 'End Time is required.'; break; }
        if (form.startDate && form.endDate && form.startDate === form.endDate && form.startTime && value <= form.startTime)
          msg = 'End Time must be after Start Time for same-day events.';
        break;
      case 'organizerName':
        if (!String(value || '').trim()) msg = 'Organizer Name is required.';
        break;
      case 'department':
        if (!value) msg = 'Please select a Department.';
        break;
      case 'mobileNumber':
        if (!String(value || '').trim()) { msg = 'Mobile Number is required.'; break; }
        if (!isValidPhone(value)) msg = 'Mobile number must be exactly 10 digits (numbers only).';
        break;
      case 'internalParticipants':
        if (value !== '' && !/^\d*$/.test(String(value))) msg = 'Only whole numbers allowed.';
        break;
      case 'externalParticipants':
        if (value !== '' && !/^\d*$/.test(String(value))) msg = 'Only whole numbers allowed.';
        break;
      // ── Venue ──
      case 'numberOfVenuesRequired':
        if (!String(value || '').trim()) { msg = 'Number of venues is required.'; break; }
        if (!isPositiveInt(value)) msg = 'Must be a whole number (digits only).';
        break;
      // ── ICTS ──
      case 'expectedInternetUsers':
        if (!String(value || '').trim()) { msg = 'Expected Internet Users is required.'; break; }
        if (!isPositiveInt(value)) msg = 'Must be a whole number (digits only).';
        break;
      // ── External Transport ──
      case 'ext_contactNumber':
        if (value && !isValidPhone(value)) msg = 'Must be exactly 10 digits (numbers only).';
        break;
      case 'ext_emailId':
        if (value && !isValidEmail(value)) msg = 'Email must contain @ and be all lowercase.';
        break;
      // ── Internal Transport ──
      case 'int_contactNumber':
        if (value && !isValidPhone(value)) msg = 'Must be exactly 10 digits (numbers only).';
        break;
      case 'int_emailId':
        if (value && !isValidEmail(value)) msg = 'Email must contain @ and be all lowercase.';
        break;
      case 'int_numberOfVehicles':
        if (value && !isPositiveInt(value)) msg = 'Must be a whole number (digits only).';
        break;
      // ── Accommodation ──
      case 'accom_mobileNumber':
        if (value && !isValidPhone(value)) msg = 'Must be exactly 10 digits (numbers only).';
        break;
      case 'accom_email':
        if (value && !isValidEmail(value)) msg = 'Email must contain @ and be all lowercase.';
        break;
      case 'accom_maleGuests':
        if (value && !isPositiveInt(value)) msg = 'Must be a whole number (digits only).';
        break;
      case 'accom_femaleGuests':
        if (value && !isPositiveInt(value)) msg = 'Must be a whole number (digits only).';
        break;
      case 'accom_numberOfRooms':
        if (value && !isPositiveInt(value)) msg = 'Must be a whole number (digits only).';
        break;
      case 'accom_arrivalDate':
        if (!value) msg = 'Arrival Date is required.';
        break;
      case 'accom_departureDate':
        if (!value) { msg = 'Departure Date is required.'; break; }
        if (form.accommodation.arrivalDate && value < form.accommodation.arrivalDate)
          msg = 'Departure Date must be on or after Arrival Date.';
        break;
      case 'accom_arrivalTime':
        if (!value) msg = 'Arrival Time is required.';
        break;
      case 'accom_departureTime':
        if (!value) msg = 'Departure Time is required.';
        break;
      // ── Audio ──
      case 'audioDate':
        if (!value) msg = 'Audio Event Date is required.';
        break;
      case 'audioStartTime':
        if (!value) msg = 'Audio Start Time is required.';
        break;
      case 'audioEndTime':
        if (!value) { msg = 'Audio End Time is required.'; break; }
        if (form.audioStartTime && value <= form.audioStartTime) msg = 'End Time must be after Start Time.';
        break;
      case 'audioVenueName':
        if (!String(value || '').trim()) msg = 'Venue Name is required for Audio.';
        break;
      default:
        break;
    }
    setFE(key, msg);
    return !msg;
  };

  // Block non-digit keystrokes for phone/number-only inputs
  const onlyDigitsKeyDown = (e) => {
    const allow = ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'];
    if (!allow.includes(e.key) && !/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const isStepValid = (stepKey) => {
    if (stepKey === STEP_KEYS.EVENT_INFO) {
      if (!form.eventName || !form.eventType || !form.startDate || !form.endDate || !form.startTime || !form.endTime || !form.organizerName || !form.department || !form.mobileNumber) {
        setStepError('Please fill all required Event Info fields.');
        return false;
      }
      
      if (!isValidPhone(form.mobileNumber)) {
        setStepError('Mobile number must be exactly 10 digits.');
        return false;
      }

      if (form.internalParticipants && !/^\d+$/.test(String(form.internalParticipants))) {
        setStepError('Internal participants must be a number.');
        return false;
      }

      if (form.externalParticipants && !/^\d+$/.test(String(form.externalParticipants))) {
        setStepError('External participants must be a number.');
        return false;
      }

      const start = new Date(form.startDate);
      const end = new Date(form.endDate);
      const today = new Date(todayIso);

      if (start < today) {
        setStepError('Event Start Date must be today or a future date.');
        return false;
      }

      if (end < start) {
        setStepError('Event End Date must be on or after Event Start Date.');
        return false;
      }

      if (form.startDate === form.endDate && form.endTime <= form.startTime) {
        setStepError('Event End Time must be after Start Time for same-day events.');
        return false;
      }

      if (!form.requirePoster && !form.posterDataUrl) {
        setStepError('You must upload an event poster if you are not requesting one from the Media team.');
        return false;
      }
    }

    if (stepKey === STEP_KEYS.AUDIO && form.audioRequired) {
      if (!form.audioDate || !form.audioStartTime || !form.audioEndTime || !form.audioVenueName) {
        setStepError('Please complete Audio date, time, and venue fields.');
        return false;
      }
      if (form.audioEndTime <= form.audioStartTime) {
        setStepError('Audio End Time must be after Audio Start Time.');
        return false;
      }
      // Every selected audio equipment must have qty >= 1
      const audioZeroQty = Object.entries(form.audioEquipment || {}).find(([, v]) => v.selected && Number(v.qty) <= 0);
      if (audioZeroQty) {
        setStepError(`Quantity for audio equipment "${audioZeroQty[0]}" must be at least 1.`);
        return false;
      }
    }

    if (stepKey === STEP_KEYS.VENUE && form.venueRequired) {
      if (!form.numberOfVenuesRequired) {
        setStepError('Please enter number of venues required.');
        return false;
      }
      if (!/^\d+$/.test(String(form.numberOfVenuesRequired))) {
        setStepError('Number of venues required must be a number.');
        return false;
      }
      const hasSelectedVenue = Object.values(form.venueSelection || {}).some((v) => v.selected);
      if (!hasSelectedVenue) {
        setStepError('Please select at least one venue option.');
        return false;
      }
      // Every selected venue must have qty >= 1
      const venueZeroQty = Object.entries(form.venueSelection || {}).find(([, v]) => v.selected && Number(v.qty) <= 0);
      if (venueZeroQty) {
        setStepError(`Quantity for "${venueZeroQty[0]}" must be at least 1.`);
        return false;
      }
      // Every selected hall requirement must have qty >= 1
      const hallZeroQty = Object.entries(form.hallRequirements || {}).find(([, v]) => v.selected && Number(v.qty) <= 0);
      if (hallZeroQty) {
        setStepError(`Quantity for hall requirement "${hallZeroQty[0]}" must be at least 1.`);
        return false;
      }
    }

    if (stepKey === STEP_KEYS.ICTS && form.ictsRequired) {
      if (!form.desktopLaptopRequired || !form.internetFacility) {
        setStepError('Please select desktop/laptop and internet facility options.');
        return false;
      }
      if (!String(form.expectedInternetUsers || '').trim()) {
        setStepError('Please enter expected number of internet users.');
        return false;
      }
      if (!/^\d+$/.test(String(form.expectedInternetUsers || '').trim())) {
        setStepError('Expected number of internet users must be a number.');
        return false;
      }
    }

    if (stepKey === STEP_KEYS.ACCOMMODATION && form.accommodationRequired) {
      const a = form.accommodation;
      if (!a.arrivalDate || !a.departureDate || !a.arrivalTime || !a.departureTime) {
        setStepError('Please fill arrival/departure date and time for accommodation.');
        return false;
      }
      if (a.email && !isValidEmail(a.email)) {
        setStepError('Accommodation email must contain @ and be all lowercase.');
        return false;
      }
      if (a.mobileNumber && !isValidPhone(a.mobileNumber)) {
        setStepError('Accommodation mobile number must be exactly 10 digits.');
        return false;
      }
      const arrival = new Date(a.arrivalDate);
      const departure = new Date(a.departureDate);
      if (departure < arrival) {
        setStepError('Departure Date must be on or after Arrival Date.');
        return false;
      }
      if (a.diningRequired) {
        const hasInvalidDiningRow = a.mealSchedule.some((row) => !row.date || Number(row.guestCount || 0) <= 0);
        if (hasInvalidDiningRow) {
          setStepError('Each dining row must include Date and Number of Guests greater than 0.');
          return false;
        }
      }
    }

    if (stepKey === STEP_KEYS.TRANSPORT && form.transportRequired) {
      if (!form.externalTransport.facultyId && !form.internalTransport.indenterName) {
        setStepError('Please complete key Transport fields.');
        return false;
      }
      
      if (form.externalTransport.facultyId) {
        if (!form.externalTransport.contactNumber) {
          setStepError('Please complete key Transport fields (Contact number for external).');
          return false;
        }
        if (form.externalTransport.contactNumber && !isValidPhone(form.externalTransport.contactNumber)) {
          setStepError('External Transport contact number must be exactly 10 digits.');
          return false;
        }
        if (form.externalTransport.emailId && !isValidEmail(form.externalTransport.emailId)) {
          setStepError('External Transport email must contain @ and be all lowercase.');
          return false;
        }
      }

      if (form.internalTransport.indenterName) {
        if (!form.internalTransport.contactNumber) {
          setStepError('Please complete key Transport fields (Contact number for internal).');
          return false;
        }
        if (form.internalTransport.contactNumber && !isValidPhone(form.internalTransport.contactNumber)) {
          setStepError('Internal Transport contact number must be exactly 10 digits.');
          return false;
        }
        if (form.internalTransport.emailId && !isValidEmail(form.internalTransport.emailId)) {
          setStepError('Internal Transport email must contain @ and be all lowercase.');
          return false;
        }
        for (const [idx, p] of form.internalTransport.passengers.entries()) {
          if (p.contactNumber && !isValidPhone(p.contactNumber)) {
            setStepError(`Passenger ${idx + 1} contact number must be exactly 10 digits.`);
            return false;
          }
        }
      }
    }

    if (stepKey === STEP_KEYS.MEDIA && form.mediaRequired) {
      const hasAnyChecklist = [
        'posterDesign',
        'receptionTvDesign',
        'stageDesign',
        'flexDesign',
        'otherMaterials',
        'videoRequirements',
      ].some((bucket) => Object.values(form.media?.[bucket] || {}).some(Boolean));

      if (!form.media.logosRequired) {
        setStepError('Please specify whether logos are required in Media step.');
        return false;
      }

      if (!form.media.photographyTime && !form.media.videoRecordingTime && !hasAnyChecklist) {
        setStepError('Please provide at least one media requirement (time slot or checklist item).');
        return false;
      }

      const preEventPosterRequested = Boolean(form.media?.posterDesign?.['Pre Event Poster']);
      if (preEventPosterRequested && (!form.media.preEventPosterNeededByDate || !form.media.preEventPosterNeededByTime)) {
        setStepError('Please specify needed date and time for the Pre Event Poster request.');
        return false;
      }
    }

    setStepError('');
    return true;
  };

  const goNext = () => {
    if (!isStepValid(currentStep)) {
      // Reveal qty=0 errors so the user can see which rows need a count
      setQtyErrorsVisible(true);
      return;
    }
    setQtyErrorsVisible(false);
    setCurrentStepIndex((prev) => advanceStep(prev, steps.length));
  };

  const goPrev = () => {
    setQtyErrorsVisible(false);
    setCurrentStepIndex((i) => Math.max(i - 1, 0));
  };

  const buildPayload = () => {
    const initialStatus = currentUser?.role === UserRole.FACULTY
      ? EventStatus.PENDING_HOD
      : EventStatus.PENDING_FACULTY;
    let posterWorkflow = {
      requested: false,
      status: 'NOT_REQUIRED',
    };

    if (form.requirePoster) {
      if (isResubmissionEdit && editingEvent.posterWorkflow?.requested) {
        posterWorkflow = {
          ...editingEvent.posterWorkflow,
          neededByDate: form.media?.preEventPosterNeededByDate || editingEvent.posterWorkflow.neededByDate,
          neededByTime: form.media?.preEventPosterNeededByTime || editingEvent.posterWorkflow.neededByTime,
          requestNotes: form.media?.preEventPosterNotes || editingEvent.posterWorkflow.requestNotes,
        };
      } else {
        posterWorkflow = {
          requested: true,
          status: 'REQUESTED',
          neededByDate: form.media?.preEventPosterNeededByDate || null,
          neededByTime: form.media?.preEventPosterNeededByTime || null,
          requestNotes: form.media?.preEventPosterNotes || 'Poster requested by organizer',
          requestedAt: new Date().toISOString(),
          requestedBy: form.organizerName || currentUser?.name || 'Organizer',
          mediaDraftDataUrl: null,
          mediaDraftFileName: null,
          mediaDraftMimeType: null,
          mediaResponseAt: null,
          mediaResponseBy: null,
          organizerDecisionAt: null,
          organizerDecisionBy: null,
          organizerReviewComment: '',
          finalUploadedAt: null,
          finalUploadedBy: null,
        };
      }
    }

    return {
      // Keep compatibility with existing views
      title: form.eventName,
      description: `${form.eventType} event requisition${form.isIIC === 'Yes' ? ' (IIC)' : ''}`,
      eventType: form.eventType,
      date: form.startDate,
      startTime: form.startTime,
      endTime: form.endTime,
      venue: form.audioVenueName || Object.entries(form.venueSelection).find(([, v]) => v.selected)?.[0] || 'To be allocated',
      organizerId: currentUser?.id || '',
      organizerName: form.organizerName,
      organizerEmail: currentUser?.email || '',
      createdByRole: currentUser?.role || UserRole.STUDENT_GENERAL,
      creatorType: currentUser?.role === UserRole.FACULTY ? 'FACULTY' : 'STUDENT',
      status: initialStatus,
      createdAt: new Date().toISOString(),
      posterWorkflow,
      posterDataUrl: form.posterDataUrl || null,
      posterFileName: form.posterFileName || null,
      posterMimeType: form.posterMimeType || null,

      // Full requisition model
      requisition: {
        iqacNumber,
        step1: {
          eventName: form.eventName,
          eventType: form.eventType,
          professionalSocieties: form.professionalSocieties,
          isIIC: form.isIIC,
          eventStartDate: form.startDate,
          eventEndDate: form.endDate,
          numberOfDays,
          eventStartTime: form.startTime,
          eventEndTime: form.endTime,
          organizerDetails: {
            organizerName: form.organizerName,
            department: form.department,
            mobileNumber: form.mobileNumber,
          },
          participants: {
            internalParticipants: Number(form.internalParticipants || 0),
            externalParticipants: Number(form.externalParticipants || 0),
          },
          guestDetails: {
            numberOfGuests: (form.guests || []).length,
            guests: (form.guests || []),
            // Legacy flat fields for backward compatibility with older events
            guestNames: (form.guests || []).map(g => g.name).filter(Boolean).join(', '),
            guestDesignation: (form.guests || []).map(g => g.designation).filter(Boolean).join(', '),
            organizationIndustry: (form.guests || []).map(g => g.organization).filter(Boolean).join(', '),
          },
          requirements: {
            venueRequired: form.venueRequired,
            audioRequired: form.audioRequired,
            ictsRequired: form.ictsRequired,
            transportRequired: form.transportRequired,
            accommodationDiningRequired: form.accommodationRequired,
            mediaRequired: form.mediaRequired,
            financialRequired: form.financialRequired,
          },
          otherRequirements: {
            gifts: form.gifts,
            trophy: form.trophy,
            bouquet: form.bouquet,
          },
        },
        annexureI_venue: form.venueRequired
          ? {
              eventDate: form.startDate,
              numberOfVenuesRequired: Number(form.numberOfVenuesRequired || 0),
              venueSelection: form.venueSelection,
              hallRequirements: form.hallRequirements,
              specialRequest: form.venueSpecialRequest,
            }
          : null,
        annexureII_audio: form.audioRequired
          ? {
              eventDate: form.audioDate,
              startTime: form.audioStartTime,
              endTime: form.audioEndTime,
              venueName: form.audioVenueName,
              iqacNumber,
              audioEquipment: form.audioEquipment,
              specialRequest: form.audioSpecialRequest,
            }
          : null,
        annexureIII_icts: form.ictsRequired
          ? {
              desktopLaptop: form.desktopLaptopRequired,
              internetFacility: form.internetFacility,
              expectedInternetUsers: Number(form.expectedInternetUsers || 0),
              additionalServices: form.additionalICTServices,
              specialRequest: form.ictsSpecialRequest,
            }
          : null,
        annexureIV_transport: form.transportRequired
          ? {
              externalTransport: form.externalTransport,
              internalTransport: form.internalTransport,
            }
          : null,
        annexureV_accommodation: form.accommodationRequired
          ? {
              ...form.accommodation,
              numberOfDays: accommodationDays,
            }
          : null,
        annexureVI_media: form.mediaRequired ? form.media : null,
      },
    };
  };

  const handleSubmit = async () => {
    for (let i = 0; i < steps.length; i += 1) {
      const key = steps[i].key;
      if (key === STEP_KEYS.REVIEW) continue;
      if (!isStepValid(key)) {
        setCurrentStepIndex(i);
        return;
      }
    }

    setIsSubmitting(true);
    setSubmitError('');
    try {
      const payload = buildPayload();
      const endpoint = isResubmissionEdit
        ? `http://localhost:5001/api/events/${editingEvent.id}/resubmit-edit`
        : 'http://localhost:5001/api/events';
      const method = isResubmissionEdit ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || (isResubmissionEdit ? 'Failed to update and resubmit event' : 'Failed to create event'));
      }
      navigate('/dashboard');
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit event');
      setIsSubmitting(false);
    }
  };

  const inputClass = 'input-field';

  /* ── Helper renderers for validated fields ─────────────────────────── */
  // Renders <label> with optional required asterisk
  const Lbl = ({ children, required: req, htmlFor }) => (
    <label htmlFor={htmlFor} className={`text-sm font-semibold text-slate-700${req ? ' required-label' : ''}`}>{children}</label>
  );
  // Renders inline error or hint text below a field
  const FieldMsg = ({ errKey, hint }) => {
    const err = fieldErrors[errKey];
    if (err) return <p className="field-error-msg">{err}</p>;
    if (hint) return <p className="field-hint">{hint}</p>;
    return null;
  };

  const renderStepContent = () => {
    if (currentStep === STEP_KEYS.EVENT_INFO) {
      return (
        <Card title="Step 1 - Event Requisition (Basic Event Information)" icon={ClipboardList}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 md:col-span-2">
              <Lbl required>Event Name</Lbl>
              <input
                id="eventName"
                className={fieldCls('eventName')}
                value={form.eventName}
                onChange={(e) => { setField('eventName', e.target.value); setFE('eventName', ''); }}
                onBlur={(e) => validateField('eventName', e.target.value)}
                placeholder="Enter event name"
              />
              <FieldMsg errKey="eventName" />
            </div>

            <div className="space-y-1">
              <Lbl required>Event Type</Lbl>
              <select
                id="eventType"
                className={fieldCls('eventType')}
                value={form.eventType}
                onChange={(e) => { setField('eventType', e.target.value); validateField('eventType', e.target.value); }}
                onBlur={(e) => validateField('eventType', e.target.value)}
              >
                <option value="">Select Type</option>
                {EVENT_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <FieldMsg errKey="eventType" />
            </div>

            {isResubmissionEdit && form.requirePoster ? (
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold text-slate-700">Event Poster</label>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-blue-700 mb-3">Event Poster (Managed by Media Team)</p>
                  {form.posterDataUrl ? (
                    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                      <div className="w-full h-60 bg-slate-100 flex items-center justify-center">
                        <img src={form.posterDataUrl} alt="Event poster preview" className="max-w-full max-h-full object-contain" />
                      </div>
                      <div className="px-3 py-2 bg-slate-50 border-t border-slate-200">
                        <p className="text-xs text-slate-500 truncate">{form.posterFileName || 'Poster uploaded by Media Team'}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No poster has been uploaded yet.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold text-slate-700">Event Poster</label>
                <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
                  <div className="flex items-center gap-3 mb-2">
                    <input
                      type="checkbox"
                      checked={form.requirePoster || false}
                      onChange={e => setForm(prev => ({ ...prev, requirePoster: e.target.checked }))}
                      id="requirePosterCheckbox"
                      disabled={isResubmissionEdit || (!!form.posterDataUrl && !form.requirePoster)}
                    />
                    <label 
                      htmlFor="requirePosterCheckbox" 
                      className={`text-sm font-semibold ${(isResubmissionEdit || (form.posterDataUrl && !form.requirePoster)) ? 'text-slate-400' : 'text-slate-700'}`}
                    >
                      Require Poster (Send request to Media)
                    </label>
                  </div>

                  {form.posterDataUrl && !form.requirePoster && !isResubmissionEdit && (
                    <div className="text-[11px] text-amber-600 bg-amber-50 rounded-lg p-2.5 border border-amber-100 italic">
                      Remove the manually uploaded poster below to send a request to the Media Team instead.
                    </div>
                  )}
                  {form.requirePoster ? (
                    <div className={`${inputClass} bg-slate-50 text-slate-500 flex items-center`}>
                      Poster will be created and uploaded by the Media Team
                    </div>
                  ) : (
                    <input
                      type="file"
                      accept="image/*"
                      className={inputClass}
                      onChange={handlePosterUpload}
                      disabled={!isResubmissionEdit && form.startDate && form.startTime && new Date() > new Date(`${form.startDate}T${form.startTime}`)}
                    />
                  )}
                  {form.posterDataUrl ? (
                    <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                      <div className="w-full h-60 bg-slate-100 flex items-center justify-center">
                        <img
                          src={form.posterDataUrl}
                          alt="Event poster preview"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                      <div className="px-3 py-2 flex items-center justify-between gap-3 bg-white border-t border-slate-200">
                        <p className="text-xs text-slate-500 truncate">{form.posterFileName || 'Poster selected'}</p>
                        {!form.requirePoster && (
                          <button
                            type="button"
                            onClick={clearPoster}
                            className="text-xs font-semibold text-red-600 hover:text-red-700"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Upload an image poster to show on the Explore Events cards. If 'Require Poster' is checked, poster will be created by Media team.</p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Professional Society Involved</label>
              <div className="grid grid-cols-2 gap-2">
                {PROFESSIONAL_SOCIETIES.map((s) => (
                  <label key={s} className="text-sm flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                    <input type="checkbox" checked={form.professionalSocieties.includes(s)} onChange={() => toggleArrayValue('professionalSocieties', s)} />
                    {s}
                  </label>
                ))}
              </div>
            </div>

            <YesNoToggle label="Whether Event Belongs to IIC" value={form.isIIC} onChange={(value) => setField('isIIC', value)} />

            <div className="space-y-1">
              <Lbl required>Event Start Date</Lbl>
              <input
                id="startDate"
                type="date"
                min={eventStartMinDate}
                className={fieldCls('startDate')}
                value={form.startDate}
                onChange={(e) => { setField('startDate', e.target.value); setFE('startDate', ''); }}
                onBlur={(e) => validateField('startDate', e.target.value)}
              />
              <FieldMsg errKey="startDate" hint="Must be today or a future date" />
            </div>

            <div className="space-y-1">
              <Lbl required>Event End Date</Lbl>
              <input
                id="endDate"
                type="date"
                min={eventEndMinDate}
                className={fieldCls('endDate')}
                value={form.endDate}
                onChange={(e) => { setField('endDate', e.target.value); setFE('endDate', ''); }}
                onBlur={(e) => validateField('endDate', e.target.value)}
              />
              <FieldMsg errKey="endDate" hint="Must be on or after start date" />
            </div>

            <div className="space-y-1">
              <Lbl>Number of Days</Lbl>
              <input readOnly className={`${inputClass} bg-slate-100`} value={numberOfDays || ''} placeholder="Auto calculated" />
              <p className="field-hint">Auto-calculated from dates</p>
            </div>

            <div className="space-y-1">
              <Lbl required>Event Start Time</Lbl>
              <TimePicker
                id="startTime"
                className={fieldCls('startTime')}
                value={form.startTime}
                onChange={(e) => { setField('startTime', e.target.value); setFE('startTime', ''); }}
                onBlur={(e) => validateField('startTime', e.target.value)}
              />
              <FieldMsg errKey="startTime" />
            </div>

            <div className="space-y-1">
              <Lbl required>Event End Time</Lbl>
              <TimePicker
                id="endTime"
                className={fieldCls('endTime')}
                value={form.endTime}
                onChange={(e) => { setField('endTime', e.target.value); setFE('endTime', ''); }}
                onBlur={(e) => validateField('endTime', e.target.value)}
              />
              <FieldMsg errKey="endTime" hint="Must be after start time for same-day events" />
            </div>

            <div className="md:col-span-2 border-t border-slate-200 pt-4">
              <h4 className="font-semibold text-slate-800 mb-3">Organizer Details</h4>
            </div>

            <div className="space-y-1">
              <Lbl required>Organizer Name</Lbl>
              <input
                id="organizerName"
                className={fieldCls('organizerName')}
                value={form.organizerName}
                onChange={(e) => { setField('organizerName', e.target.value); setFE('organizerName', ''); }}
                onBlur={(e) => validateField('organizerName', e.target.value)}
                placeholder="Full name"
              />
              <FieldMsg errKey="organizerName" />
            </div>

            <div className="space-y-1">
              <Lbl required>Department</Lbl>
              <select
                id="department"
                className={fieldCls('department')}
                value={form.department}
                onChange={(e) => { setField('department', e.target.value); validateField('department', e.target.value); }}
                onBlur={(e) => validateField('department', e.target.value)}
              >
                <option value="">Select Department</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <FieldMsg errKey="department" />
            </div>

            <div className="space-y-1">
              <Lbl required>Mobile Number</Lbl>
              <input
                id="mobileNumber"
                type="tel"
                className={fieldCls('mobileNumber')}
                value={form.mobileNumber}
                maxLength={10}
                onKeyDown={onlyDigitsKeyDown}
                onChange={(e) => { setField('mobileNumber', e.target.value); setFE('mobileNumber', ''); }}
                onBlur={(e) => validateField('mobileNumber', e.target.value)}
                placeholder="10-digit mobile number"
              />
              <FieldMsg errKey="mobileNumber" hint="Exactly 10 digits, numbers only" />
            </div>

            <div className="md:col-span-2 border-t border-slate-200 pt-4">
              <h4 className="font-semibold text-slate-800 mb-3">Participants</h4>
            </div>

            <div className="space-y-1">
              <Lbl>Internal Participants</Lbl>
              <input
                id="internalParticipants"
                type="text"
                inputMode="numeric"
                className={fieldCls('internalParticipants')}
                value={form.internalParticipants}
                onKeyDown={onlyDigitsKeyDown}
                onChange={(e) => { setField('internalParticipants', e.target.value); setFE('internalParticipants', ''); }}
                onBlur={(e) => validateField('internalParticipants', e.target.value)}
                placeholder="e.g. 50"
              />
              <FieldMsg errKey="internalParticipants" hint="Whole numbers only" />
            </div>

            <div className="space-y-1">
              <Lbl>External Participants</Lbl>
              <input
                id="externalParticipants"
                type="text"
                inputMode="numeric"
                className={fieldCls('externalParticipants')}
                value={form.externalParticipants}
                onKeyDown={onlyDigitsKeyDown}
                onChange={(e) => { setField('externalParticipants', e.target.value); setFE('externalParticipants', ''); }}
                onBlur={(e) => validateField('externalParticipants', e.target.value)}
                placeholder="e.g. 20"
              />
              <FieldMsg errKey="externalParticipants" hint="Whole numbers only" />
            </div>


            <div className="md:col-span-2 border-t border-slate-200 pt-4">
              <h4 className="font-semibold text-slate-800 mb-3">Guest Details</h4>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Number of Guests</label>
              <input type="number" className={inputClass} value={form.guests ? form.guests.length : 0} readOnly />
            </div>

            <div className="space-y-2 md:col-span-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg bg-cse-accent text-white font-semibold text-sm mb-2"
                onClick={() => setForm((prev) => ({
                  ...prev,
                  guests: [...(prev.guests || []), { name: '', designation: '', organization: '' }],
                }))}
              >
                Add Guest
              </button>
              {(form.guests || []).length === 0 && (
                <p className="text-sm text-slate-400">No guests added yet.</p>
              )}
              {(form.guests || []).map((guest, idx) => (
                <div key={idx} className="grid grid-cols-3 gap-4 items-end border border-slate-200 rounded-xl bg-slate-50 px-3 py-2 mb-2 relative">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Name</label>
                    <input
                      className={inputClass}
                      value={guest.name}
                      onChange={(e) => setForm((prev) => {
                        const guests = [...(prev.guests || [])];
                        guests[idx].name = e.target.value;
                        return { ...prev, guests };
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Designation</label>
                    <input
                      className={inputClass}
                      value={guest.designation}
                      onChange={(e) => setForm((prev) => {
                        const guests = [...(prev.guests || [])];
                        guests[idx].designation = e.target.value;
                        return { ...prev, guests };
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Organization</label>
                    <input
                      className={inputClass}
                      value={guest.organization}
                      onChange={(e) => setForm((prev) => {
                        const guests = [...(prev.guests || [])];
                        guests[idx].organization = e.target.value;
                        return { ...prev, guests };
                      })}
                    />
                  </div>
                  <button
                    type="button"
                    title="Remove guest"
                    className="absolute top-2 right-2 p-1 rounded-full bg-red-500 hover:bg-red-600 text-white text-xs flex items-center justify-center"
                    onClick={() => setForm((prev) => {
                      const guests = [...(prev.guests || [])];
                      guests.splice(idx, 1);
                      return { ...prev, guests };
                    })}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className="md:col-span-2 border-t border-slate-200 pt-4">
              <h4 className="font-semibold text-slate-800 mb-3">Event Requirements</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <RequirementToggle label="Venue Required" checked={form.venueRequired} onToggle={() => toggleRequirement('venueRequired')} />
                <RequirementToggle label="Audio Required" checked={form.audioRequired} onToggle={() => toggleRequirement('audioRequired')} />
                <RequirementToggle label="ICTS Required" checked={form.ictsRequired} onToggle={() => toggleRequirement('ictsRequired')} />
                <RequirementToggle label="Transport Required" checked={form.transportRequired} onToggle={() => toggleRequirement('transportRequired')} />
                <RequirementToggle label="Accommodation / Dining Required" checked={form.accommodationRequired} onToggle={() => toggleRequirement('accommodationRequired')} />
                <RequirementToggle label="Media Required" checked={form.mediaRequired} onToggle={() => toggleRequirement('mediaRequired')} />
                <RequirementToggle label="Financial Required" checked={form.financialRequired} onToggle={() => toggleRequirement('financialRequired')} />
              </div>
            </div>

            <div className="md:col-span-2 border-t border-slate-200 pt-4">
              <h4 className="font-semibold text-slate-800 mb-3">Other Requirements</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {['gifts', 'trophy', 'bouquet'].map((key) => (
                  <div key={key} className="rounded-xl border border-slate-200 p-3 space-y-2">
                    <label className="text-sm font-semibold text-slate-700 capitalize flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form[key].selected}
                        onChange={(e) => setField(key, { ...form[key], selected: e.target.checked, qty: e.target.checked ? form[key].qty : '' })}
                      />
                      {key}
                    </label>
                    <input
                      type="number"
                      disabled={!form[key].selected}
                      placeholder="Quantity"
                      className={inputClass}
                      value={form[key].qty}
                      onChange={(e) => setField(key, { ...form[key], qty: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">IQAC Number (Auto Generated)</label>
              <input readOnly className={`${inputClass} bg-slate-100`} value={iqacNumber} />
            </div>
          </div>
        </Card>
      );
    }

    if (currentStep === STEP_KEYS.VENUE) {
      return (
        <Card title="Step 2 - Venue Requirements (Annexure I)" icon={Building2}>
          {!form.venueRequired && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Venue requirement is marked as Not Required in Step 1. You can still fill this section if needed.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Lbl>Event Date</Lbl>
              <input type="date" min={eventStartMinDate} className={inputClass} value={form.startDate} onChange={(e) => setField('startDate', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Lbl required>Number of Venues Required</Lbl>
              <input
                id="numberOfVenuesRequired"
                type="text"
                inputMode="numeric"
                className={fieldCls('numberOfVenuesRequired')}
                value={form.numberOfVenuesRequired}
                onKeyDown={onlyDigitsKeyDown}
                onChange={(e) => { setField('numberOfVenuesRequired', e.target.value); setFE('numberOfVenuesRequired', ''); }}
                onBlur={(e) => validateField('numberOfVenuesRequired', e.target.value)}
                placeholder="e.g. 2"
              />
              <FieldMsg errKey="numberOfVenuesRequired" hint="Whole number only (e.g. 1, 2, 3)" />
            </div>

            <div className="md:col-span-2">
              <h4 className="font-semibold text-slate-800 mb-1">Venue Selection <span className="text-red-500">*</span><span className="text-xs font-normal text-slate-500 ml-1">(Qty must be ≥ 1 when checked)</span></h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {VENUE_OPTIONS.map((v) => {
                  const item = form.venueSelection[v];
                  const qtyInvalid = qtyErrorsVisible && item.selected && Number(item.qty) <= 0;
                  return (
                    <div key={v} className={`rounded-lg border p-3 flex items-center gap-3 ${qtyInvalid ? 'border-red-400 bg-red-50/40' : 'border-slate-200'}`}>
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={(e) => updateQtyMap('venueSelection', v, { selected: e.target.checked, qty: e.target.checked ? item.qty : 0 })}
                      />
                      <span className="text-sm flex-1">{v}</span>
                      <div className="flex flex-col items-end gap-0.5">
                        <input
                          type="number"
                          min="1"
                          disabled={!item.selected}
                          className={`w-24 px-3 py-2 rounded-lg border text-sm transition-colors ${qtyInvalid ? 'border-red-500 bg-red-50 text-red-700 focus:outline-none focus:ring-1 focus:ring-red-400' : 'border-slate-200'} disabled:opacity-40`}
                          value={item.qty}
                          onChange={(e) => updateQtyMap('venueSelection', v, { qty: Number(e.target.value || 0) })}
                          placeholder="Qty"
                        />
                        {qtyInvalid && <span className="text-xs text-red-600">⚠ Enter qty</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-2">
              <h4 className="font-semibold text-slate-800 mb-1">Hall Requirements <span className="text-red-500">*</span><span className="text-xs font-normal text-slate-500 ml-1">(Qty must be ≥ 1 when checked)</span></h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {HALL_REQUIREMENTS.map((v) => {
                  const item = form.hallRequirements[v];
                  const qtyInvalid = qtyErrorsVisible && item.selected && Number(item.qty) <= 0;
                  return (
                    <div key={v} className={`rounded-lg border p-3 flex items-center gap-3 ${qtyInvalid ? 'border-red-400 bg-red-50/40' : 'border-slate-200'}`}>
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={(e) => updateQtyMap('hallRequirements', v, { selected: e.target.checked, qty: e.target.checked ? item.qty : 0 })}
                      />
                      <span className="text-sm flex-1">{v}</span>
                      <div className="flex flex-col items-end gap-0.5">
                        <input
                          type="number"
                          min="1"
                          disabled={!item.selected}
                          className={`w-24 px-3 py-2 rounded-lg border text-sm transition-colors ${qtyInvalid ? 'border-red-500 bg-red-50 text-red-700 focus:outline-none focus:ring-1 focus:ring-red-400' : 'border-slate-200'} disabled:opacity-40`}
                          value={item.qty}
                          onChange={(e) => updateQtyMap('hallRequirements', v, { qty: Number(e.target.value || 0) })}
                          placeholder="Qty"
                        />
                        {qtyInvalid && <span className="text-xs text-red-600">⚠ Enter qty</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-semibold text-slate-700">Special Request</label>
              <textarea rows={4} className={inputClass} value={form.venueSpecialRequest} onChange={(e) => setField('venueSpecialRequest', e.target.value)} />
            </div>
          </div>
        </Card>
      );
    }

    if (currentStep === STEP_KEYS.AUDIO) {
      return (
        <Card title="Step 3 - Audio Requirements (Annexure II)" icon={Mic2}>
          {!form.audioRequired && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Audio requirement is marked as Not Required in Step 1. You can still fill this section if needed.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Lbl required>Event Date</Lbl>
              <input
                id="audioDate"
                type="date"
                min={audioMinDate}
                className={fieldCls('audioDate')}
                value={form.audioDate}
                onChange={(e) => { setField('audioDate', e.target.value); setFE('audioDate', ''); }}
                onBlur={(e) => validateField('audioDate', e.target.value)}
              />
              <FieldMsg errKey="audioDate" />
            </div>
            <div className="space-y-1">
              <Lbl required>Venue Name</Lbl>
              <input
                id="audioVenueName"
                className={fieldCls('audioVenueName')}
                value={form.audioVenueName}
                onChange={(e) => { setField('audioVenueName', e.target.value); setFE('audioVenueName', ''); }}
                onBlur={(e) => validateField('audioVenueName', e.target.value)}
                placeholder="e.g. Auditorium I Floor"
              />
              <FieldMsg errKey="audioVenueName" />
            </div>
            <div className="space-y-1">
              <Lbl required>Start Time</Lbl>
              <TimePicker
                id="audioStartTime"
                className={fieldCls('audioStartTime')}
                value={form.audioStartTime}
                onChange={(e) => { setField('audioStartTime', e.target.value); setFE('audioStartTime', ''); }}
                onBlur={(e) => validateField('audioStartTime', e.target.value)}
              />
              <FieldMsg errKey="audioStartTime" />
            </div>
            <div className="space-y-1">
              <Lbl required>End Time</Lbl>
              <TimePicker
                id="audioEndTime"
                className={fieldCls('audioEndTime')}
                value={form.audioEndTime}
                onChange={(e) => { setField('audioEndTime', e.target.value); setFE('audioEndTime', ''); }}
                onBlur={(e) => validateField('audioEndTime', e.target.value)}
              />
              <FieldMsg errKey="audioEndTime" hint="Must be after start time" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">IQAC Number</label>
              <input readOnly className={`${inputClass} bg-slate-100`} value={iqacNumber} />
            </div>

            <div className="md:col-span-2">
              <h4 className="font-semibold text-slate-800 mb-1">Audio Equipment <span className="text-red-500">*</span><span className="text-xs font-normal text-slate-500 ml-1">(Qty must be ≥ 1 when checked, except AC)</span></h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {AUDIO_EQUIPMENT.map((v) => {
                  const item = form.audioEquipment[v];
                  // AC does not need a quantity count validation
                  const isAC = v === 'AC';
                  const qtyInvalid = qtyErrorsVisible && item.selected && !isAC && Number(item.qty) <= 0;
                  return (
                    <div key={v} className={`rounded-lg border p-3 flex items-center gap-3 ${qtyInvalid ? 'border-red-400 bg-red-50/40' : 'border-slate-200'}`}>
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={(e) => updateQtyMap('audioEquipment', v, { selected: e.target.checked, qty: e.target.checked ? (isAC ? '' : item.qty) : 0 })}
                      />
                      <span className="text-sm flex-1">{v}</span>
                      {!isAC && (
                        <div className="flex flex-col items-end gap-0.5">
                          <input
                            type="number"
                            min="1"
                            disabled={!item.selected}
                            className={`w-24 px-3 py-2 rounded-lg border text-sm transition-colors ${qtyInvalid ? 'border-red-500 bg-red-50 text-red-700 focus:outline-none focus:ring-1 focus:ring-red-400' : 'border-slate-200'} disabled:opacity-40`}
                            value={item.qty}
                            onChange={(e) => updateQtyMap('audioEquipment', v, { qty: Number(e.target.value || 0) })}
                            placeholder="Qty"
                          />
                          {qtyInvalid && <span className="text-xs text-red-600">⚠ Enter qty</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-semibold text-slate-700">Special Request</label>
              <textarea rows={4} className={inputClass} value={form.audioSpecialRequest} onChange={(e) => setField('audioSpecialRequest', e.target.value)} />
            </div>
          </div>
        </Card>
      );
    }

    if (currentStep === STEP_KEYS.ICTS) {
      return (
        <Card title="Step 4 - ICTS Requirements (Annexure III)" icon={MonitorSmartphone}>
          {!form.ictsRequired && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              ICTS requirement is marked as Not Required in Step 1. You can still fill this section if needed.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Lbl required>Desktop / Laptop</Lbl>
              <select className={inputClass} value={form.desktopLaptopRequired} onChange={(e) => setField('desktopLaptopRequired', e.target.value)}>
                <option>Required</option>
                <option>Not Required</option>
              </select>
            </div>
            <div className="space-y-1">
              <Lbl required>Internet Facility</Lbl>
              <select className={inputClass} value={form.internetFacility} onChange={(e) => setField('internetFacility', e.target.value)}>
                <option>LAN</option>
                <option>WiFi</option>
                <option>Both</option>
              </select>
            </div>

            <div className="space-y-1">
              <Lbl required>Expected Internet Users</Lbl>
              <input
                id="expectedInternetUsers"
                type="text"
                inputMode="numeric"
                className={fieldCls('expectedInternetUsers')}
                value={form.expectedInternetUsers}
                onKeyDown={onlyDigitsKeyDown}
                onChange={(e) => { setField('expectedInternetUsers', e.target.value); setFE('expectedInternetUsers', ''); }}
                onBlur={(e) => validateField('expectedInternetUsers', e.target.value)}
                placeholder="e.g. 30"
              />
              <FieldMsg errKey="expectedInternetUsers" hint="Whole number only (digits only)" />
            </div>

            <div className="md:col-span-2">
              <h4 className="font-semibold text-slate-800 mb-2">Additional ICT Services</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {ICT_ADDITIONAL_SERVICES.map((s) => (
                  <label key={s} className="text-sm flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={form.additionalICTServices[s]}
                      onChange={() => setField('additionalICTServices', { ...form.additionalICTServices, [s]: !form.additionalICTServices[s] })}
                    />
                    {s}
                  </label>
                ))}
              </div>
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-semibold text-slate-700">Special Request</label>
              <textarea rows={4} className={inputClass} value={form.ictsSpecialRequest} onChange={(e) => setField('ictsSpecialRequest', e.target.value)} />
            </div>
          </div>
        </Card>
      );
    }

    if (currentStep === STEP_KEYS.TRANSPORT) {
      return (
        <Card title="Step 5 - Transport Requirements (Annexure IV a & b)" icon={Car}>
          {!form.transportRequired && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Transport requirement is marked as Not Required in Step 1. You can still fill this section if needed.
            </div>
          )}
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 p-4 space-y-4">
              <h4 className="font-semibold text-slate-800">External Transport (Annexure IV a)</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Lbl required>Faculty ID</Lbl>
                  <input className={inputClass} value={form.externalTransport.facultyId} onChange={(e) => updateNested('externalTransport.facultyId', e.target.value)} placeholder="e.g. F-1001" />
                </div>
                <div className="space-y-1">
                  <Lbl>Organizer Designation</Lbl>
                  <input className={inputClass} value={form.externalTransport.organizerDesignation} onChange={(e) => updateNested('externalTransport.organizerDesignation', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Lbl>Contact Number</Lbl>
                  <input
                    id="ext_contactNumber"
                    type="tel"
                    className={fieldCls('ext_contactNumber')}
                    value={form.externalTransport.contactNumber}
                    maxLength={10}
                    onKeyDown={onlyDigitsKeyDown}
                    onChange={(e) => { updateNested('externalTransport.contactNumber', e.target.value); setFE('ext_contactNumber', ''); }}
                    onBlur={(e) => validateField('ext_contactNumber', e.target.value)}
                    placeholder="10-digit number"
                  />
                  <FieldMsg errKey="ext_contactNumber" hint="Exactly 10 digits, numbers only" />
                </div>
                <div className="space-y-1">
                  <Lbl>Email ID</Lbl>
                  <input
                    id="ext_emailId"
                    type="email"
                    className={fieldCls('ext_emailId')}
                    value={form.externalTransport.emailId}
                    onChange={(e) => { updateNested('externalTransport.emailId', e.target.value.toLowerCase()); setFE('ext_emailId', ''); }}
                    onBlur={(e) => validateField('ext_emailId', e.target.value)}
                    placeholder="lowercase@example.com"
                  />
                  <FieldMsg errKey="ext_emailId" hint="Must contain @ and be all lowercase" />
                </div>
                <div className="space-y-1">
                  <Lbl>Guest Details</Lbl>
                  <input className={inputClass} value={form.externalTransport.guestDetails} onChange={(e) => updateNested('externalTransport.guestDetails', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Lbl>Purpose of Visit</Lbl>
                  <input className={inputClass} value={form.externalTransport.purposeOfVisit} onChange={(e) => updateNested('externalTransport.purposeOfVisit', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Lbl required>Mode of Transport</Lbl>
                  <select className={inputClass} value={form.externalTransport.modeOfTransport} onChange={(e) => updateNested('externalTransport.modeOfTransport', e.target.value)}>
                    <option>Bus</option>
                    <option>Train</option>
                    <option>Flight</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['onwardJourney', 'returnJourney'].map((journey) => (
                  <div key={journey} className="rounded-lg border border-slate-200 p-3">
                    <p className="font-semibold text-sm mb-2">{journey === 'onwardJourney' ? 'Onward Journey' : 'Return Journey'}</p>
                    <div className="grid grid-cols-1 gap-2">
                      {Object.keys(defaultTransportJourney).map((field) => (
                        <div key={field} className="space-y-2">
                          <label className="text-sm font-semibold text-slate-700">{JOURNEY_FIELD_LABELS[field] || field}</label>
                          {field.toLowerCase().includes('time') ? (
                            <TimePicker
                              id={field}
                              className={inputClass}
                              value={form.externalTransport[journey][field]}
                              onChange={(e) => updateJourney('externalTransport', journey, field, e.target.value)}
                            />
                          ) : (
                            <input
                              className={inputClass}
                              type={field.toLowerCase().includes('date') ? 'date' : field === 'numberOfPersons' ? 'number' : 'text'}
                              min={field.toLowerCase().includes('date') ? journeyMinDate : undefined}
                              value={form.externalTransport[journey][field]}
                              onChange={(e) => updateJourney('externalTransport', journey, field, e.target.value)}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 space-y-4">
              <h4 className="font-semibold text-slate-800">Internal Transport (Annexure IV b)</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Lbl required>Indenter Name</Lbl>
                  <input className={inputClass} value={form.internalTransport.indenterName} onChange={(e) => updateNested('internalTransport.indenterName', e.target.value)} placeholder="Full name" />
                </div>
                <div className="space-y-1">
                  <Lbl>Contact Number</Lbl>
                  <input
                    id="int_contactNumber"
                    type="tel"
                    className={fieldCls('int_contactNumber')}
                    value={form.internalTransport.contactNumber}
                    maxLength={10}
                    onKeyDown={onlyDigitsKeyDown}
                    onChange={(e) => { updateNested('internalTransport.contactNumber', e.target.value); setFE('int_contactNumber', ''); }}
                    onBlur={(e) => validateField('int_contactNumber', e.target.value)}
                    placeholder="10-digit number"
                  />
                  <FieldMsg errKey="int_contactNumber" hint="Exactly 10 digits, numbers only" />
                </div>
                <div className="space-y-1">
                  <Lbl>Designation</Lbl>
                  <input className={inputClass} value={form.internalTransport.designation} onChange={(e) => updateNested('internalTransport.designation', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Lbl>Employee ID</Lbl>
                  <input className={inputClass} value={form.internalTransport.employeeId} onChange={(e) => updateNested('internalTransport.employeeId', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Lbl>Department</Lbl>
                  <input className={inputClass} value={form.internalTransport.department} onChange={(e) => updateNested('internalTransport.department', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Lbl>Email ID</Lbl>
                  <input
                    id="int_emailId"
                    type="email"
                    className={fieldCls('int_emailId')}
                    value={form.internalTransport.emailId}
                    onChange={(e) => { updateNested('internalTransport.emailId', e.target.value.toLowerCase()); setFE('int_emailId', ''); }}
                    onBlur={(e) => validateField('int_emailId', e.target.value)}
                    placeholder="lowercase@example.com"
                  />
                  <FieldMsg errKey="int_emailId" hint="Must contain @ and be all lowercase" />
                </div>
                <div className="space-y-1">
                  <Lbl>Number of Vehicles</Lbl>
                  <input
                    id="int_numberOfVehicles"
                    type="text"
                    inputMode="numeric"
                    className={fieldCls('int_numberOfVehicles')}
                    value={form.internalTransport.numberOfVehicles}
                    onKeyDown={onlyDigitsKeyDown}
                    onChange={(e) => { updateNested('internalTransport.numberOfVehicles', e.target.value); setFE('int_numberOfVehicles', ''); }}
                    onBlur={(e) => validateField('int_numberOfVehicles', e.target.value)}
                    placeholder="e.g. 2"
                  />
                  <FieldMsg errKey="int_numberOfVehicles" hint="Whole number only" />
                </div>
                <div className="space-y-1">
                  <Lbl>Vehicle Number</Lbl>
                  <input className={inputClass} value={form.internalTransport.vehicleNumber} onChange={(e) => updateNested('internalTransport.vehicleNumber', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Lbl>Purpose of Visit</Lbl>
                  <input className={inputClass} value={form.internalTransport.purposeOfVisit} onChange={(e) => updateNested('internalTransport.purposeOfVisit', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['onwardJourney', 'returnJourney'].map((journey) => (
                  <div key={journey} className="rounded-lg border border-slate-200 p-3">
                    <p className="font-semibold text-sm mb-2">Internal {journey === 'onwardJourney' ? 'Onward Journey' : 'Return Journey'}</p>
                    <div className="grid grid-cols-1 gap-2">
                      {Object.keys(defaultTransportJourney).map((field) => (
                        <div key={field} className="space-y-2">
                          <label className="text-sm font-semibold text-slate-700">{JOURNEY_FIELD_LABELS[field] || field}</label>
                          {field.toLowerCase().includes('time') ? (
                            <TimePicker
                              id={field}
                              className={inputClass}
                              value={form.internalTransport[journey][field]}
                              onChange={(e) => updateJourney('internalTransport', journey, field, e.target.value)}
                            />
                          ) : (
                            <input
                              className={inputClass}
                              type={field.toLowerCase().includes('date') ? 'date' : field === 'numberOfPersons' ? 'number' : 'text'}
                              min={field.toLowerCase().includes('date') ? journeyMinDate : undefined}
                              value={form.internalTransport[journey][field]}
                              onChange={(e) => updateJourney('internalTransport', journey, field, e.target.value)}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <p className="font-semibold text-sm mb-2">Passenger Table</p>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left">S.No</th>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Employee ID</th>
                        <th className="px-3 py-2 text-left">Designation</th>
                        <th className="px-3 py-2 text-left">Contact Number</th>
                        <th className="px-3 py-2 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.internalTransport.passengers.map((row) => (
                        <tr key={row.id} className="border-t border-slate-200">
                          <td className="px-3 py-2">{row.sno}</td>
                          <td className="px-3 py-2"><input className={inputClass} value={row.name} onChange={(e) => updatePassenger(row.id, 'name', e.target.value)} /></td>
                          <td className="px-3 py-2"><input className={inputClass} value={row.employeeId} onChange={(e) => updatePassenger(row.id, 'employeeId', e.target.value)} /></td>
                          <td className="px-3 py-2"><input className={inputClass} value={row.designation} onChange={(e) => updatePassenger(row.id, 'designation', e.target.value)} /></td>
                          <td className="px-3 py-2"><input className={inputClass} value={row.contactNumber} onChange={(e) => updatePassenger(row.id, 'contactNumber', e.target.value)} /></td>
                          <td className="px-3 py-2">
                            <button type="button" onClick={() => removePassenger(row.id)} className="text-red-600"><Trash2 size={14} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" onClick={addPassenger} className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-blue-600">
                  <Plus size={14} /> Add Passenger
                </button>
              </div>

              <div>
                <p className="font-semibold text-sm mb-2">Industry / Organization Name (Multiple)</p>
                {form.internalTransport.industries.map((industry, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2">
                    <input className={inputClass} value={industry} onChange={(e) => updateIndustry(idx, e.target.value)} />
                    <button type="button" onClick={() => removeIndustry(idx)} className="text-red-600"><Trash2 size={14} /></button>
                  </div>
                ))}
                <button type="button" onClick={addIndustry} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600">
                  <Plus size={14} /> Add Industry / Organization
                </button>
              </div>
            </div>
          </div>
        </Card>
      );
    }

    if (currentStep === STEP_KEYS.ACCOMMODATION) {
      return (
        <Card title="Step 6 - Guest Accommodation / Dining (Annexure V)" icon={Hotel}>
          {!form.accommodationRequired && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Accommodation/Dining requirement is marked as Not Required in Step 1. You can still fill this section if needed.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Lbl>Guest Name(s)</Lbl>
              <input className={inputClass} value={form.accommodation.guestNames} onChange={(e) => updateNested('accommodation.guestNames', e.target.value)} placeholder="Guest full name" />
            </div>
            <div className="space-y-1">
              <Lbl>Guest Designation</Lbl>
              <input className={inputClass} value={form.accommodation.guestDesignation} onChange={(e) => updateNested('accommodation.guestDesignation', e.target.value)} placeholder="e.g. Professor" />
            </div>
            <div className="space-y-1">
              <Lbl>Industry / Institute</Lbl>
              <input className={inputClass} value={form.accommodation.industryInstitute} onChange={(e) => updateNested('accommodation.industryInstitute', e.target.value)} placeholder="e.g. IIT Madras" />
            </div>
            <div className="space-y-1">
              <Lbl>Mobile Number</Lbl>
              <input
                id="accom_mobileNumber"
                type="tel"
                className={fieldCls('accom_mobileNumber')}
                value={form.accommodation.mobileNumber}
                maxLength={10}
                onKeyDown={onlyDigitsKeyDown}
                onChange={(e) => { updateNested('accommodation.mobileNumber', e.target.value); setFE('accom_mobileNumber', ''); }}
                onBlur={(e) => validateField('accom_mobileNumber', e.target.value)}
                placeholder="10-digit number"
              />
              <FieldMsg errKey="accom_mobileNumber" hint="Exactly 10 digits, numbers only" />
            </div>
            <div className="space-y-1">
              <Lbl>Email</Lbl>
              <input
                id="accom_email"
                type="email"
                className={fieldCls('accom_email')}
                value={form.accommodation.email}
                onChange={(e) => { updateNested('accommodation.email', e.target.value.toLowerCase()); setFE('accom_email', ''); }}
                onBlur={(e) => validateField('accom_email', e.target.value)}
                placeholder="lowercase@example.com"
              />
              <FieldMsg errKey="accom_email" hint="Must contain @ and be all lowercase" />
            </div>
            <div className="space-y-1">
              <Lbl>Address</Lbl>
              <input className={inputClass} value={form.accommodation.address} onChange={(e) => updateNested('accommodation.address', e.target.value)} placeholder="Full address" />
            </div>
            <div className="space-y-1">
              <Lbl>Male Guests</Lbl>
              <input
                id="accom_maleGuests"
                type="text"
                inputMode="numeric"
                className={fieldCls('accom_maleGuests')}
                value={form.accommodation.maleGuests}
                onKeyDown={onlyDigitsKeyDown}
                onChange={(e) => { updateNested('accommodation.maleGuests', e.target.value); setFE('accom_maleGuests', ''); }}
                onBlur={(e) => validateField('accom_maleGuests', e.target.value)}
                placeholder="0"
              />
              <FieldMsg errKey="accom_maleGuests" hint="Whole number only" />
            </div>
            <div className="space-y-1">
              <Lbl>Female Guests</Lbl>
              <input
                id="accom_femaleGuests"
                type="text"
                inputMode="numeric"
                className={fieldCls('accom_femaleGuests')}
                value={form.accommodation.femaleGuests}
                onKeyDown={onlyDigitsKeyDown}
                onChange={(e) => { updateNested('accommodation.femaleGuests', e.target.value); setFE('accom_femaleGuests', ''); }}
                onBlur={(e) => validateField('accom_femaleGuests', e.target.value)}
                placeholder="0"
              />
              <FieldMsg errKey="accom_femaleGuests" hint="Whole number only" />
            </div>
            <div className="space-y-1">
              <Lbl required>Arrival Date</Lbl>
              <input
                id="accom_arrivalDate"
                type="date"
                min={accommodationArrivalMinDate}
                className={fieldCls('accom_arrivalDate')}
                value={form.accommodation.arrivalDate}
                onChange={(e) => { updateNested('accommodation.arrivalDate', e.target.value); setFE('accom_arrivalDate', ''); }}
                onBlur={(e) => validateField('accom_arrivalDate', e.target.value)}
              />
              <FieldMsg errKey="accom_arrivalDate" />
            </div>
            <div className="space-y-1">
              <Lbl required>Arrival Time</Lbl>
              <TimePicker
                id="accom_arrivalTime"
                className={fieldCls('accom_arrivalTime')}
                value={form.accommodation.arrivalTime}
                onChange={(e) => { updateNested('accommodation.arrivalTime', e.target.value); setFE('accom_arrivalTime', ''); }}
                onBlur={(e) => validateField('accom_arrivalTime', e.target.value)}
              />
              <FieldMsg errKey="accom_arrivalTime" />
            </div>
            <div className="space-y-1">
              <Lbl required>Departure Date</Lbl>
              <input
                id="accom_departureDate"
                type="date"
                min={accommodationDepartureMinDate}
                className={fieldCls('accom_departureDate')}
                value={form.accommodation.departureDate}
                onChange={(e) => { updateNested('accommodation.departureDate', e.target.value); setFE('accom_departureDate', ''); }}
                onBlur={(e) => validateField('accom_departureDate', e.target.value)}
              />
              <FieldMsg errKey="accom_departureDate" hint="Must be on or after arrival date" />
            </div>
            <div className="space-y-1">
              <Lbl required>Departure Time</Lbl>
              <TimePicker
                id="accom_departureTime"
                className={fieldCls('accom_departureTime')}
                value={form.accommodation.departureTime}
                onChange={(e) => { updateNested('accommodation.departureTime', e.target.value); setFE('accom_departureTime', ''); }}
                onBlur={(e) => validateField('accom_departureTime', e.target.value)}
              />
              <FieldMsg errKey="accom_departureTime" />
            </div>
            <div className="space-y-1">
              <Lbl>Number of Days</Lbl>
              <input className={`${inputClass} bg-slate-100`} readOnly value={accommodationDays || ''} />
              <p className="field-hint">Auto-calculated from dates</p>
            </div>
            <div className="space-y-1">
              <Lbl>Number of Rooms</Lbl>
              <input
                id="accom_numberOfRooms"
                type="text"
                inputMode="numeric"
                className={fieldCls('accom_numberOfRooms')}
                value={form.accommodation.numberOfRooms}
                onKeyDown={onlyDigitsKeyDown}
                onChange={(e) => { updateNested('accommodation.numberOfRooms', e.target.value); setFE('accom_numberOfRooms', ''); }}
                onBlur={(e) => validateField('accom_numberOfRooms', e.target.value)}
                placeholder="e.g. 2"
              />
              <FieldMsg errKey="accom_numberOfRooms" hint="Whole number only" />
            </div>

            <div className="md:col-span-2">
              <h4 className="font-semibold text-slate-800 mb-2">Accommodation Type</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {ACCOMMODATION_TYPES.map((type) => (
                  <label key={type} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.accommodation.accommodationTypes[type]}
                      onChange={(e) => updateNested('accommodation.accommodationTypes', { ...form.accommodation.accommodationTypes, [type]: e.target.checked })}
                    />
                    {type}
                  </label>
                ))}
              </div>
            </div>

            <div className="md:col-span-2 rounded-xl border border-slate-200 p-4 space-y-3">
              <h4 className="font-semibold text-slate-800">Dining Request</h4>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.accommodation.diningRequired} onChange={(e) => updateNested('accommodation.diningRequired', e.target.checked)} />
                Required
              </label>

              {form.accommodation.diningRequired && (
                <>
                  <select className={inputClass} value={form.accommodation.diningType} onChange={(e) => updateNested('accommodation.diningType', e.target.value)}>
                    <option>Hostel Guest Dining</option>
                    <option>Amenities Guest Dining</option>
                  </select>

                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="min-w-[1050px] w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-2 py-2 text-left">Date <span className="text-red-500">*</span></th>
                          <th className="px-2 py-2 text-left">No. of Guests <span className="text-red-500">*</span></th>
                          <th className="px-2 py-2">Breakfast</th>
                          <th className="px-2 py-2">Morning Refreshment</th>
                          <th className="px-2 py-2">Lunch Veg</th>
                          <th className="px-2 py-2">Lunch Non-Veg</th>
                          <th className="px-2 py-2">Evening Refreshment</th>
                          <th className="px-2 py-2">Dinner Veg</th>
                          <th className="px-2 py-2">Dinner Non-Veg</th>
                          <th className="px-2 py-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.accommodation.mealSchedule.map((row) => (
                          <tr key={row.id} className="border-t border-slate-200">
                            <td className="px-2 py-2"><input type="date" min={diningMinDate} className={inputClass} value={row.date} onChange={(e) => updateDiningRow(row.id, 'date', e.target.value)} /></td>
                            <td className="px-2 py-2"><input type="number" className={inputClass} value={row.guestCount} onChange={(e) => updateDiningRow(row.id, 'guestCount', e.target.value)} /></td>
                            {['breakfast', 'morningRefreshment', 'lunchVeg', 'lunchNonVeg', 'eveningRefreshment', 'dinnerVeg', 'dinnerNonVeg'].map((key) => (
                              <td key={key} className="px-2 py-2 text-center">
                                <input type="checkbox" checked={row[key]} onChange={(e) => updateDiningRow(row.id, key, e.target.checked)} />
                              </td>
                            ))}
                            <td className="px-2 py-2 text-center">
                              <button type="button" onClick={() => removeDiningRow(row.id)} className="text-red-600"><Trash2 size={14} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button type="button" onClick={addDiningRow} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600">
                    <Plus size={14} /> Add Meal Schedule Row
                  </button>
                </>
              )}
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-semibold text-slate-700">Special Request</label>
              <textarea rows={4} className={inputClass} value={form.accommodation.specialRequest} onChange={(e) => updateNested('accommodation.specialRequest', e.target.value)} />
            </div>
          </div>
        </Card>
      );
    }

    if (currentStep === STEP_KEYS.MEDIA) {
      return (
        <Card title="Step 7 - Media Requirements (Annexure VI)" icon={Camera}>
          {!form.mediaRequired && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Media requirement is marked as Not Required in Step 1. You can still fill this section if needed.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Lbl required>Logos Required</Lbl>
              <input className={inputClass} value={form.media.logosRequired} onChange={(e) => updateNested('media.logosRequired', e.target.value)} placeholder="e.g. College, IEEE" />
            </div>
            <div className="space-y-1">
              <Lbl>Photography Time</Lbl>
              <TimePicker
                id="photographyTime"
                className={inputClass}
                value={form.media.photographyTime}
                onChange={(e) => updateNested('media.photographyTime', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Lbl>Video Recording Time</Lbl>
              <TimePicker
                id="videoRecordingTime"
                className={inputClass}
                value={form.media.videoRecordingTime}
                onChange={(e) => updateNested('media.videoRecordingTime', e.target.value)}
              />
            </div>

            {Object.entries(MEDIA_CHECKLIST).map(([bucket, items]) => {
              if (bucket === 'otherMaterialCount') return null;
              return (
              <div key={bucket} className="md:col-span-2 rounded-xl border border-slate-200 p-4">
                <h4 className="font-semibold text-slate-800 mb-2 capitalize">{bucket.replace(/([A-Z])/g, ' $1')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {items.map((item) => (
                    <label key={item} className="text-sm flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={form.media[bucket]?.[item] || false}
                        onChange={() => toggleMediaItem(bucket, item)}
                      />
                      {item}
                    </label>
                  ))}
                </div>
                {bucket === 'otherMaterials' && (
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <label className="text-sm font-semibold text-slate-700 mb-1 block">Other Material Count (Optional)</label>
                    <input
                      type="number"
                      placeholder="e.g. 50"
                      className={inputClass}
                      value={form.media.otherMaterialCount || ''}
                      onChange={(e) => updateNested('media.otherMaterialCount', e.target.value)}
                    />
                  </div>
                )}
              </div>
              );
            })}

            {form.media?.posterDesign?.['Pre Event Poster'] && (
              <div className="md:col-span-2 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                <p className="text-sm font-semibold text-blue-800 mb-3">Pre Event Poster Request Details</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Lbl required>Needed By Date</Lbl>
                    <input
                      type="date"
                      min={form.startDate || todayIso}
                      className={inputClass}
                      value={form.media.preEventPosterNeededByDate}
                      onChange={(e) => updateNested('media.preEventPosterNeededByDate', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Lbl required>Needed By Time</Lbl>
                    <TimePicker
                      id="preEventPosterNeededByTime"
                      className={inputClass}
                      value={form.media.preEventPosterNeededByTime}
                      onChange={(e) => updateNested('media.preEventPosterNeededByTime', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-700">Poster Brief / Notes for Media Team</label>
                    <textarea
                      rows={3}
                      className={inputClass}
                      value={form.media.preEventPosterNotes}
                      onChange={(e) => updateNested('media.preEventPosterNotes', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-semibold text-slate-700">Post on Website (Content)</label>
              <textarea rows={3} className={inputClass} value={form.media.websitePostContent} onChange={(e) => updateNested('media.websitePostContent', e.target.value)} />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-semibold text-slate-700">Post on Social Media (Content)</label>
              <textarea rows={3} className={inputClass} value={form.media.socialPostContent} onChange={(e) => updateNested('media.socialPostContent', e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">Other Media Requirement</label>
              <input className={inputClass} value={form.media.otherMediaRequirement} onChange={(e) => updateNested('media.otherMediaRequirement', e.target.value)} />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-semibold text-slate-700">Special Request</label>
              <textarea rows={3} className={inputClass} value={form.media.specialRequest} onChange={(e) => updateNested('media.specialRequest', e.target.value)} />
            </div>
          </div>
        </Card>
      );
    }

    if (currentStep === STEP_KEYS.REVIEW) {
      const requirements = [
        ['Venue', form.venueRequired],
        ['Audio', form.audioRequired],
        ['ICTS', form.ictsRequired],
        ['Transport', form.transportRequired],
        ['Accommodation / Dining', form.accommodationRequired],
        ['Media', form.mediaRequired],
        ['Financial', form.financialRequired],
      ];

      return (
        <Card title="Step 8 - Review & Submit" icon={CheckCircle2}>
          <div className="space-y-4 text-sm">
            <div className="rounded-xl bg-slate-50 p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <p><span className="font-semibold">Event Name:</span> {form.eventName || '-'}</p>
              <p><span className="font-semibold">Type:</span> {form.eventType || '-'}</p>
              <p><span className="font-semibold">Dates:</span> {form.startDate || '-'} to {form.endDate || '-'}</p>
              <p><span className="font-semibold">Days:</span> {numberOfDays || '-'}</p>
              <p><span className="font-semibold">Time:</span> {formatTime12(form.startTime)} - {formatTime12(form.endTime)}</p>
              <p><span className="font-semibold">Organizer:</span> {form.organizerName || '-'}</p>
              <p><span className="font-semibold">Department:</span> {form.department || '-'}</p>
              <p><span className="font-semibold">IQAC Number:</span> {iqacNumber}</p>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <p className="font-semibold mb-2">Selected Requirements</p>
              <div className="flex flex-wrap gap-2">
                {requirements.filter(([, v]) => v).map(([label]) => (
                  <span key={label} className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">{label}</span>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
              Review complete. Click Submit to create event requisition and all enabled annexures.
            </div>
          </div>
        </Card>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen pb-20">
      <Navbar />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Create Event Requisition</h2>
            <p className="text-slate-500 mt-1">Toggle requirements in Step 1 — only selected steps will appear in the stepper.</p>
            {isResubmissionEdit && (
              <p className="text-amber-600 mt-2 text-sm font-medium">Editing rejected event before resubmission. Update details like date/time, then submit again.</p>
            )}
          </div>
          <button onClick={() => navigate('/dashboard')} className="btn-secondary">
            Back to Dashboard
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-6xl mx-auto"
        >
          <div className="glass-panel p-4 rounded-2xl mb-6 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max">
              {steps.map((step, idx) => {
                const Icon = step.icon;
                const active = idx === currentStepIndex;
                const done = idx < currentStepIndex;
                return (
                  <div key={step.key} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => idx <= maxReachedIndex && setCurrentStepIndex(idx)}
                      disabled={idx > maxReachedIndex}
                      title={idx > maxReachedIndex ? 'Complete previous steps first' : undefined}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-colors ${
                        active ? 'bg-blue-600 text-white border-blue-600' : done ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : idx > maxReachedIndex ? 'bg-white text-slate-300 border-slate-100 cursor-not-allowed' : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      <Icon size={15} />
                      {step.title}
                    </button>
                    {idx < steps.length - 1 && <ChevronRight size={14} className="text-slate-400" />}
                  </div>
                );
              })}
            </div>
          </div>

          {renderStepContent()}

          {submitError && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          )}

          {stepError && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {stepError}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={goPrev}
              disabled={currentStepIndex === 0 || isSubmitting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 disabled:opacity-50"
            >
              <ChevronLeft size={16} /> Previous
            </button>

            {currentStep !== STEP_KEYS.REVIEW ? (
              <button
                type="button"
                onClick={goNext}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-60"
              >
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-60"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {isSubmitting ? (isResubmissionEdit ? 'Resubmitting...' : 'Submitting...') : (isResubmissionEdit ? 'Update & Resubmit' : 'Submit Requisition')}
              </button>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default CreateEvent;
