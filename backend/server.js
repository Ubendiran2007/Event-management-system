const express = require('express');
const cors = require('cors');
const http = require('http');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const eventsRoutes = require('./routes/events');
const exploreRoutes = require('./routes/explore');
const iqacRoutes = require('./routes/iqac');
const studentsRoutes = require('./routes/students');
const odRequestsRoutes = require('./routes/odRequests');
const { startEventAutoRejectionJob } = require('./services/eventAutoRejectionService');

const app = express();
const PORT = process.env.PORT || 5001;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ 
  origin: [
    process.env.CLIENT_ORIGIN, 
    'http://localhost:5173', 
    'http://localhost:5174'
  ].filter(Boolean) 
}));
// 10 MB limit — needed for base64 poster images attached to event proposals
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/explore', exploreRoutes);
app.use('/api/iqac', iqacRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/od-requests', odRequestsRoutes);

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
});