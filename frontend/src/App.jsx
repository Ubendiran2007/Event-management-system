import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useAppContext } from './context/AppContext';
import { NotificationProvider } from './context/NotificationContext';
import { CalendarProvider } from './context/CalendarContext';
import { AnalyticsProvider } from './context/AnalyticsContext';
import './App.css';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CreateEvent = lazy(() => import('./pages/CreateEvent'));
const ExploreEvents = lazy(() => import('./pages/ExploreEventsNew'));
const IQACSubmission = lazy(() => import('./pages/IQACSubmission'));
const ManageStudents = lazy(() => import('./pages/ManageStudents'));

const AcademicCalendar = lazy(() => import('./pages/AcademicCalendar'));
const AnalyticsDashboard = lazy(() => import('./pages/AnalyticsDashboard'));
const ODCorrection = lazy(() => import('./pages/ODCorrection'));
const SecurityProfile = lazy(() => import('./pages/SecurityProfile'));
const EventTracking = lazy(() => import('./pages/EventTracking'));

import { ROLE_PATHS, getRolePath } from './utils/routeUtils';

const RoleRoutes = () => (
  <Routes>
    {/* Dashboard-hosted feature routes */}
    <Route path="dashboard" element={<Dashboard />} />
    <Route path="events" element={<Dashboard />} />
    <Route path="approvals" element={<Dashboard />} />
    <Route path="registrations" element={<Dashboard />} />
    <Route path="modifications" element={<Dashboard />} />
    <Route path="available" element={<Dashboard />} />
    <Route path="my-registrations" element={<Dashboard />} />
    <Route path="tracking" element={<EventTracking />} />

    {/* Dedicated Pages */}
    <Route path="create-event" element={<CreateEvent />} />
    <Route path="explore" element={<ExploreEvents />} />
    <Route path="iqac" element={<IQACSubmission />} />
    <Route path="manage-students" element={<ManageStudents />} />

    <Route path="academic-calendar" element={<AcademicCalendar />} />
    <Route path="analytics" element={<AnalyticsDashboard />} />
    <Route path="od-correction" element={<ODCorrection />} />
    <Route path="security" element={<SecurityProfile />} />
    
    {/* Fallback within role */}
    <Route path="*" element={<Dashboard />} />
  </Routes>
);

const ProtectedRoute = ({ children }) => {
  const { currentUser } = useAppContext();
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const FallbackRoute = () => {
  const { currentUser } = useAppContext();
  if (currentUser) {
    const rolePrefix = getRolePath(currentUser.role);
    return <Navigate to={`/${rolePrefix}/dashboard`} replace />;
  }
  return <Navigate to="/login" replace />;
};

const LoadingFallback = () => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center">
    <div className="text-slate-500 font-medium">Loading...</div>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <CalendarProvider>
          <AnalyticsProvider>
            <NotificationProvider>
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                  <Route path="/" element={<Login />} />
                  <Route path="/login" element={<Login />} />
                  
                  {/* Generate nested routes for every role path */}
                  {ROLE_PATHS.map((rolePath) => (
                    <Route key={rolePath} path={`/${rolePath}/*`} element={<ProtectedRoute><RoleRoutes /></ProtectedRoute>} />
                  ))}
                  
                  {/* Legacy fallback if accessed directly, redirect to proper dashboard or login */}
                  <Route path="*" element={<FallbackRoute />} />
                </Routes>
              </Suspense>
            </NotificationProvider>
          </AnalyticsProvider>
        </CalendarProvider>
      </AppProvider>
    </BrowserRouter>
  );
}
