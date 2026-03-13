import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import './App.css';

const Landing = lazy(() => import('./pages/landing'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CreateEvent = lazy(() => import('./pages/CreateEvent'));
const ExploreEvents = lazy(() => import('./pages/ExploreEventsNew'));
const IQACSubmission = lazy(() => import('./pages/IQACSubmission'));
const ManageStudents = lazy(() => import('./pages/ManageStudents'));

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/create-event" element={<CreateEvent />} />
            <Route path="/explore" element={<ExploreEvents />} />
            <Route path="/iqac" element={<IQACSubmission />} />
            <Route path="/manage-students" element={<ManageStudents />} />
          </Routes>
        </Suspense>
      </AppProvider>
    </BrowserRouter>
  );
}
