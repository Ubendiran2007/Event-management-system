const express = require('express');
const cors = require('cors');
const http = require('http');
require('dotenv').config();
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const eventsRoutes = require('./routes/events');
const exploreRoutes = require('./routes/explore');
const iqacRoutes = require('./routes/iqac');
const studentsRoutes = require('./routes/students');
const { setupAdminDefaults } = require('./scripts/setupAdmin');
const errorHandler = require('./middleware/errorHandler');
const academicBatchesRoutes = require('./routes/academicBatches');
const academicCalendarRoutes = require('./routes/academicCalendar');
const odRequestsRoutes = require('./routes/odRequests');
const correctionRequestsRoutes = require('./routes/correctionRequests');
const securityRoutes = require('./routes/security');
const usersRoutes = require('./routes/users');
const analyticsRoutes = require('./routes/analytics');
const notificationsRoutes = require('./routes/notifications');
const preferencesRoutes = require('./routes/preferences');
const { startEventAutoRejectionJob } = require('./services/eventAutoRejectionService');
const { startFeedbackReminderJob } = require('./services/feedbackReminderService');
require('./notifications/orchestrator/notificationOrchestrator'); // Initialize the orchestrator to listen to the EventBus
require('./events/consumers/auditConsumer'); // Initialize the audit consumer to log all EventBus traffic
const workerSupervisor = require('./notifications/queue/workerSupervisor');
workerSupervisor.start(); // Start background queue workers
const reminderScheduler = require('./reminders/scheduler/reminderScheduler');
reminderScheduler.start(); // Start the policy-based reminder engine

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

const PORT = process.env.PORT || 5001;

// ── Rate Limiting ───────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many authentication attempts, please try again later.' }
});

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(compression());
app.use(globalLimiter);

app.use(cors({ 
  origin: [
    process.env.CLIENT_ORIGIN, 
    'http://localhost:5173', 
    'http://localhost:5174'
  ].filter(Boolean) 
}));
// ── Routes ──────────────────────────────────────────────────────────────────
// 50 MB limit — needed for base64 posters and PDF attachments (OD letters)
app.use('/api/events', express.json({ limit: '50mb' }), express.urlencoded({ extended: true, limit: '50mb' }), eventsRoutes);
app.use('/api/od-requests', express.json({ limit: '50mb' }), express.urlencoded({ extended: true, limit: '50mb' }), odRequestsRoutes);

// Global 2 MB limit for all other routes
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.use('/api/login', authLimiter);
app.use('/api', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/explore', exploreRoutes);
app.use('/api/iqac', iqacRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/academic-batches', academicBatchesRoutes);
app.use('/api/academic-calendar', academicCalendarRoutes);
app.use('/api/correction-requests', correctionRequestsRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/preferences', preferencesRoutes);

// ── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start server ─────────────────────────────────────────────────────────────
const server = http.createServer(app);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Kill the existing process and retry.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startEventAutoRejectionJob();
  startFeedbackReminderJob();
}); // Triggered restart to load .env
