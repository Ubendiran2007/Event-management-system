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
const PROFESSIONAL_SOCIETIES = ['IEEE', 'IETE', 'ISTE', 'WiCYS', 'IGEN', 'Other'];
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
  videoRequirements: [
    'Coming Soon Video', 'Event Launch Video', 'Promotional Video', 'Stage Streaming Video',
    'Chief Guest AV', 'Event Glimpses Video', 'Feedback Video',
  ],
};

const createQtyMap = (items) => Object.fromEntries(items.map((item) => [item, { selected: false, qty: 0 }]));

const JOURNEY_FIELD_LABELS = {
  vehicleDate: 'Vehicle Date',
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
    transportRequired: true,
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
    audioEquipment: createQtyMap(AUDIO_EQUIPMENT),
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
      videoRequirements: MEDIA_CHECKLIST.videoRequirements.reduce((acc, item) => ({ ...acc, [item]: false }), {}),
      websitePostContent: '',
      socialPostContent: '',
      otherMediaRequirement: '',
      specialRequest: '',
    },
  });

  const iqacNumber = useMemo(() => {
    const year = new Date().getFullYear();
    const suffix = String(Date.now() % 1000).padStart(3, '0');
    return `IQAC-${year}-${suffix}`;
  }, []);

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
      transportRequired: step1.requirements?.transportRequired ?? true,
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
      audioDate: audioAnnex?.eventDate || '',
      audioStartTime: audioAnnex?.startTime || '',
      audioEndTime: audioAnnex?.endTime || '',
      audioVenueName: audioAnnex?.venueName || '',
      audioEquipment: audioAnnex?.audioEquipment || createQtyMap(AUDIO_EQUIPMENT),
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
    if (!email) return true; // Validate only if provided, if required check is elsewhere
    const val = String(email).trim();
    return val.includes('@') && val === val.toLowerCase();
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
    if (!isStepValid(currentStep)) return;
    setCurrentStepIndex((prev) => advanceStep(prev, steps.length));
  };

  const goPrev = () => {
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

  const renderStepContent = () => {
    if (currentStep === STEP_KEYS.EVENT_INFO) {
      return (
        <Card title="Step 1 - Event Requisition (Basic Event Information)" icon={ClipboardList}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">Event Name</label>
              <input className={inputClass} value={form.eventName} onChange={(e) => setField('eventName', e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Event Type</label>
              <select className={inputClass} value={form.eventType} onChange={(e) => setField('eventType', e.target.value)}>
                <option value="">Select Type</option>
                {EVENT_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
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
                      disabled={isResubmissionEdit}
                    />
                    <label htmlFor="requirePosterCheckbox" className={`text-sm font-semibold ${isResubmissionEdit ? 'text-slate-400' : 'text-slate-700'}`}>Require Poster (Send request to Media)</label>
                  </div>
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

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Event Start Date</label>
              <input type="date" min={eventStartMinDate} className={inputClass} value={form.startDate} onChange={(e) => setField('startDate', e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Event End Date</label>
              <input type="date" min={eventEndMinDate} className={inputClass} value={form.endDate} onChange={(e) => setField('endDate', e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Number of Days</label>
              <input readOnly className={`${inputClass} bg-slate-100`} value={numberOfDays || ''} placeholder="Auto calculated" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Event Start Time</label>
              <input type="time" className={inputClass} value={form.startTime} onChange={(e) => setField('startTime', e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Event End Time</label>
              <input type="time" className={inputClass} value={form.endTime} onChange={(e) => setField('endTime', e.target.value)} />
            </div>

            <div className="md:col-span-2 border-t border-slate-200 pt-4">
              <h4 className="font-semibold text-slate-800 mb-3">Organizer Details</h4>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Organizer Name</label>
              <input className={inputClass} value={form.organizerName} onChange={(e) => setField('organizerName', e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Department</label>
              <select className={inputClass} value={form.department} onChange={(e) => setField('department', e.target.value)}>
                <option value="">Select Department</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Mobile Number</label>
              <input type="tel" className={inputClass} value={form.mobileNumber} onChange={(e) => setField('mobileNumber', e.target.value)} />
            </div>

            <div className="md:col-span-2 border-t border-slate-200 pt-4">
              <h4 className="font-semibold text-slate-800 mb-3">Participants</h4>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Internal Participants</label>
              <input type="number" className={inputClass} value={form.internalParticipants} onChange={(e) => setField('internalParticipants', e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">External Participants</label>
              <input type="number" className={inputClass} value={form.externalParticipants} onChange={(e) => setField('externalParticipants', e.target.value)} />
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
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Event Date</label>
              <input type="date" min={eventStartMinDate} className={inputClass} value={form.startDate} onChange={(e) => setField('startDate', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Number of Venues Required</label>
              <input type="number" className={inputClass} value={form.numberOfVenuesRequired} onChange={(e) => setField('numberOfVenuesRequired', e.target.value)} />
            </div>

            <div className="md:col-span-2">
              <h4 className="font-semibold text-slate-800 mb-2">Venue Selection (Checkbox + Quantity)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {VENUE_OPTIONS.map((v) => (
                  <div key={v} className="rounded-lg border border-slate-200 p-3 flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={form.venueSelection[v].selected}
                      onChange={(e) => updateQtyMap('venueSelection', v, { selected: e.target.checked, qty: e.target.checked ? form.venueSelection[v].qty : 0 })}
                    />
                    <span className="text-sm flex-1">{v}</span>
                    <input
                      type="number"
                      min="0"
                      disabled={!form.venueSelection[v].selected}
                      className="w-24 px-3 py-2 rounded-lg border border-slate-200"
                      value={form.venueSelection[v].qty}
                      onChange={(e) => updateQtyMap('venueSelection', v, { qty: Number(e.target.value || 0) })}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <h4 className="font-semibold text-slate-800 mb-2">Hall Requirements (Checkbox + Quantity)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {HALL_REQUIREMENTS.map((v) => (
                  <div key={v} className="rounded-lg border border-slate-200 p-3 flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={form.hallRequirements[v].selected}
                      onChange={(e) => updateQtyMap('hallRequirements', v, { selected: e.target.checked, qty: e.target.checked ? form.hallRequirements[v].qty : 0 })}
                    />
                    <span className="text-sm flex-1">{v}</span>
                    <input
                      type="number"
                      min="0"
                      disabled={!form.hallRequirements[v].selected}
                      className="w-24 px-3 py-2 rounded-lg border border-slate-200"
                      value={form.hallRequirements[v].qty}
                      onChange={(e) => updateQtyMap('hallRequirements', v, { qty: Number(e.target.value || 0) })}
                    />
                  </div>
                ))}
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
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Event Date</label>
              <input type="date" min={audioMinDate} className={inputClass} value={form.audioDate} onChange={(e) => setField('audioDate', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Venue Name</label>
              <input className={inputClass} value={form.audioVenueName} onChange={(e) => setField('audioVenueName', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Start Time</label>
              <input type="time" className={inputClass} value={form.audioStartTime} onChange={(e) => setField('audioStartTime', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">End Time</label>
              <input type="time" className={inputClass} value={form.audioEndTime} onChange={(e) => setField('audioEndTime', e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">IQAC Number</label>
              <input readOnly className={`${inputClass} bg-slate-100`} value={iqacNumber} />
            </div>

            <div className="md:col-span-2">
              <h4 className="font-semibold text-slate-800 mb-2">Audio Equipment (Checkbox + Quantity)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {AUDIO_EQUIPMENT.map((v) => (
                  <div key={v} className="rounded-lg border border-slate-200 p-3 flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={form.audioEquipment[v].selected}
                      onChange={(e) => updateQtyMap('audioEquipment', v, { selected: e.target.checked, qty: e.target.checked ? form.audioEquipment[v].qty : 0 })}
                    />
                    <span className="text-sm flex-1">{v}</span>
                    <input
                      type="number"
                      min="0"
                      disabled={!form.audioEquipment[v].selected}
                      className="w-24 px-3 py-2 rounded-lg border border-slate-200"
                      value={form.audioEquipment[v].qty}
                      onChange={(e) => updateQtyMap('audioEquipment', v, { qty: Number(e.target.value || 0) })}
                    />
                  </div>
                ))}
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
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Desktop / Laptop</label>
              <select className={inputClass} value={form.desktopLaptopRequired} onChange={(e) => setField('desktopLaptopRequired', e.target.value)}>
                <option>Required</option>
                <option>Not Required</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Internet Facility</label>
              <select className={inputClass} value={form.internetFacility} onChange={(e) => setField('internetFacility', e.target.value)}>
                <option>LAN</option>
                <option>WiFi</option>
                <option>Both</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Expected Internet Users</label>
              <input type="number" className={inputClass} value={form.expectedInternetUsers} onChange={(e) => setField('expectedInternetUsers', e.target.value)} />
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
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Faculty ID</label>
                  <input className={inputClass} value={form.externalTransport.facultyId} onChange={(e) => updateNested('externalTransport.facultyId', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Organizer Designation</label>
                  <input className={inputClass} value={form.externalTransport.organizerDesignation} onChange={(e) => updateNested('externalTransport.organizerDesignation', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Contact Number</label>
                  <input className={inputClass} value={form.externalTransport.contactNumber} onChange={(e) => updateNested('externalTransport.contactNumber', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Email ID</label>
                  <input className={inputClass} value={form.externalTransport.emailId} onChange={(e) => updateNested('externalTransport.emailId', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Guest Details</label>
                  <input className={inputClass} value={form.externalTransport.guestDetails} onChange={(e) => updateNested('externalTransport.guestDetails', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Purpose of Visit</label>
                  <input className={inputClass} value={form.externalTransport.purposeOfVisit} onChange={(e) => updateNested('externalTransport.purposeOfVisit', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Mode of Transport</label>
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
                          <input
                            className={inputClass}
                            type={field.toLowerCase().includes('time') ? 'time' : field.toLowerCase().includes('date') ? 'date' : field === 'numberOfPersons' ? 'number' : 'text'}
                            min={field.toLowerCase().includes('date') ? journeyMinDate : undefined}
                            value={form.externalTransport[journey][field]}
                            onChange={(e) => updateJourney('externalTransport', journey, field, e.target.value)}
                          />
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
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Indenter Name</label>
                  <input className={inputClass} value={form.internalTransport.indenterName} onChange={(e) => updateNested('internalTransport.indenterName', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Contact Number</label>
                  <input className={inputClass} value={form.internalTransport.contactNumber} onChange={(e) => updateNested('internalTransport.contactNumber', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Designation</label>
                  <input className={inputClass} value={form.internalTransport.designation} onChange={(e) => updateNested('internalTransport.designation', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Employee ID</label>
                  <input className={inputClass} value={form.internalTransport.employeeId} onChange={(e) => updateNested('internalTransport.employeeId', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Department</label>
                  <input className={inputClass} value={form.internalTransport.department} onChange={(e) => updateNested('internalTransport.department', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Email ID</label>
                  <input className={inputClass} value={form.internalTransport.emailId} onChange={(e) => updateNested('internalTransport.emailId', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Number of Vehicles</label>
                  <input type="number" className={inputClass} value={form.internalTransport.numberOfVehicles} onChange={(e) => updateNested('internalTransport.numberOfVehicles', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Vehicle Number</label>
                  <input className={inputClass} value={form.internalTransport.vehicleNumber} onChange={(e) => updateNested('internalTransport.vehicleNumber', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Purpose of Visit</label>
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
                          <input
                            className={inputClass}
                            type={field.toLowerCase().includes('time') ? 'time' : field.toLowerCase().includes('date') ? 'date' : field === 'numberOfPersons' ? 'number' : 'text'}
                            min={field.toLowerCase().includes('date') ? journeyMinDate : undefined}
                            value={form.internalTransport[journey][field]}
                            onChange={(e) => updateJourney('internalTransport', journey, field, e.target.value)}
                          />
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
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Guest Name(s)</label>
              <input className={inputClass} value={form.accommodation.guestNames} onChange={(e) => updateNested('accommodation.guestNames', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Guest Designation</label>
              <input className={inputClass} value={form.accommodation.guestDesignation} onChange={(e) => updateNested('accommodation.guestDesignation', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Industry / Institute</label>
              <input className={inputClass} value={form.accommodation.industryInstitute} onChange={(e) => updateNested('accommodation.industryInstitute', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Mobile Number</label>
              <input className={inputClass} value={form.accommodation.mobileNumber} onChange={(e) => updateNested('accommodation.mobileNumber', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Email</label>
              <input className={inputClass} value={form.accommodation.email} onChange={(e) => updateNested('accommodation.email', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Address</label>
              <input className={inputClass} value={form.accommodation.address} onChange={(e) => updateNested('accommodation.address', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Male Guests</label>
              <input type="number" className={inputClass} value={form.accommodation.maleGuests} onChange={(e) => updateNested('accommodation.maleGuests', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Female Guests</label>
              <input type="number" className={inputClass} value={form.accommodation.femaleGuests} onChange={(e) => updateNested('accommodation.femaleGuests', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Arrival Date</label>
              <input type="date" min={accommodationArrivalMinDate} className={inputClass} value={form.accommodation.arrivalDate} onChange={(e) => updateNested('accommodation.arrivalDate', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Arrival Time</label>
              <input type="time" className={inputClass} value={form.accommodation.arrivalTime} onChange={(e) => updateNested('accommodation.arrivalTime', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Departure Date</label>
              <input type="date" min={accommodationDepartureMinDate} className={inputClass} value={form.accommodation.departureDate} onChange={(e) => updateNested('accommodation.departureDate', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Departure Time</label>
              <input type="time" className={inputClass} value={form.accommodation.departureTime} onChange={(e) => updateNested('accommodation.departureTime', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Number of Days</label>
              <input className={`${inputClass} bg-slate-100`} readOnly value={accommodationDays || ''} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Number of Rooms</label>
              <input type="number" className={inputClass} value={form.accommodation.numberOfRooms} onChange={(e) => updateNested('accommodation.numberOfRooms', e.target.value)} />
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
                          <th className="px-2 py-2 text-left">Date</th>
                          <th className="px-2 py-2 text-left">No. of Guests</th>
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
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Logos Required</label>
              <input className={inputClass} value={form.media.logosRequired} onChange={(e) => updateNested('media.logosRequired', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Photography Time</label>
              <input type="time" className={inputClass} value={form.media.photographyTime} onChange={(e) => updateNested('media.photographyTime', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Video Recording Time</label>
              <input type="time" className={inputClass} value={form.media.videoRecordingTime} onChange={(e) => updateNested('media.videoRecordingTime', e.target.value)} />
            </div>

            {Object.entries(MEDIA_CHECKLIST).map(([bucket, items]) => (
              <div key={bucket} className="md:col-span-2 rounded-xl border border-slate-200 p-4">
                <h4 className="font-semibold text-slate-800 mb-2 capitalize">{bucket.replace(/([A-Z])/g, ' $1')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {items.map((item) => (
                    <label key={item} className="text-sm flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={form.media[bucket][item]}
                        onChange={() => toggleMediaItem(bucket, item)}
                      />
                      {item}
                    </label>
                  ))}
                </div>
              </div>
            ))}

            {form.media?.posterDesign?.['Pre Event Poster'] && (
              <div className="md:col-span-2 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                <p className="text-sm font-semibold text-blue-800 mb-3">Pre Event Poster Request Details</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Needed By Date</label>
                    <input
                      type="date"
                      min={form.startDate || todayIso}
                      className={inputClass}
                      value={form.media.preEventPosterNeededByDate}
                      onChange={(e) => updateNested('media.preEventPosterNeededByDate', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Needed By Time</label>
                    <input
                      type="time"
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
              <p><span className="font-semibold">Time:</span> {form.startTime || '-'} - {form.endTime || '-'}</p>
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
