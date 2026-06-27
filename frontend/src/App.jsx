import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { NotificationProvider } from './context/NotificationContext';
import './App.css';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CreateEvent = lazy(() => import('./pages/CreateEvent'));
const ExploreEvents = lazy(() => import('./pages/ExploreEventsNew'));
const IQACSubmission = lazy(() => import('./pages/IQACSubmission'));
const ManageStudents = lazy(() => import('./pages/ManageStudents'));
const ODCorrection = lazy(() => import('./pages/ODCorrection'));
const SecurityProfile = lazy(() => import('./pages/SecurityProfile'));

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <NotificationProvider>
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<Login />} />
              <Route path="/login" element={<Login />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/create-event" element={<CreateEvent />} />
              <Route path="/explore" element={<ExploreEvents />} />
              <Route path="/iqac" element={<IQACSubmission />} />
              <Route path="/manage-students" element={<ManageStudents />} />
              <Route path="/od-correction" element={<ODCorrection />} />
              <Route path="/security" element={<SecurityProfile />} />
            </Routes>
          </Suspense>
        </NotificationProvider>
      </AppProvider>
    </BrowserRouter>
  );
}
