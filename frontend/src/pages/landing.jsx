import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  GraduationCap,
  ShieldCheck,
  Users,
  Mail,
  Building2,
  Phone,
} from 'lucide-react';
import Navbar from '../components/Navbar';

const features = [
  {
    icon: Calendar,
    title: 'Structured Event Workflow',
    description: 'Create and publish events through a clear, approval-based process with full visibility.',
  },
  {
    icon: Users,
    title: 'Student OD Management',
    description: 'Handle OD requests and status updates in one centralized dashboard for all stakeholders.',
  },
  {
    icon: ShieldCheck,
    title: 'Role-Based Controls',
    description: 'Faculty, HOD, Principal, and students get focused experiences based on their permissions.',
  },
  {
    icon: ClipboardCheck,
    title: 'IQAC Documentation',
    description: 'Capture feedback, reports, and closure documentation with built-in submission windows.',
  },
];

const trustIndicators = [
  { value: '4', label: 'Approval Stages' },
  { value: '100+', label: 'Student Records' },
  { value: '24/7', label: 'Portal Availability' },
  { value: '1', label: 'Unified Platform' },
];

const process = [
  {
    title: 'Plan',
    description: 'Create event details, budget, logistics, and participant information in one proposal.',
  },
  {
    title: 'Approve',
    description: 'Route approvals through Faculty, HOD, and Principal with transparent status tracking.',
  },
  {
    title: 'Execute',
    description: 'Run registrations and OD requests while monitoring updates from a shared dashboard.',
  },
  {
    title: 'Close',
    description: 'Submit reports, collect feedback, and finalize IQAC documentation with clear deadlines.',
  },
];

const testimonials = [
  {
    quote: 'Approval tracking is clearer now, and we spend less time following up manually.',
    name: 'Faculty Coordinator',
  },
  {
    quote: 'Students understand event status quickly, and OD request handling is much faster.',
    name: 'Department Office',
  },
  {
    quote: 'IQAC submissions are more consistent because the workflow is built into the portal.',
    name: 'Academic Team',
  },
];

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col text-slate-900">
      <Navbar />

      <main>
        <section className="px-6 pt-14 pb-12">
          <div className="max-w-6xl mx-auto">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 text-blue-700 border border-blue-100 px-4 py-2 text-sm font-semibold mb-6">
                <Building2 size={15} /> Sri Eshwar College of Engineering
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight mb-5">
                Professional Event Operations for the CSE Department
              </h1>
              <p className="text-slate-600 text-lg leading-relaxed max-w-xl mb-8">
                A clean, centralized platform to manage event proposals, approvals, student OD requests, and IQAC reporting from one place.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => navigate('/login')}
                  className="btn-primary inline-flex items-center justify-center gap-2 px-6 py-3"
                >
                  Get Started
                  <ArrowRight size={17} />
                </button>
                <button
                  onClick={() => navigate('/explore')}
                  className="btn-secondary inline-flex items-center justify-center gap-2 px-6 py-3"
                >
                  Explore Events
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 pb-14">
          <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
            {trustIndicators.map((stat) => (
              <div key={stat.label} className="glass-panel rounded-xl p-5 text-center">
                <p className="text-2xl font-extrabold text-slate-900">{stat.value}</p>
                <p className="text-sm text-slate-600 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="px-6 py-14 bg-white/70 border-y border-slate-200/70">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-2">Core Features</h2>
            <p className="text-slate-600 mb-8">Everything required to operate institutional events with consistency and clarity.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {features.map(({ icon: Icon, title, description }) => (
                <article key={title} className="glass-panel rounded-2xl p-5 hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-4">
                    <Icon size={18} />
                  </div>
                  <h3 className="font-bold text-base mb-2">{title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="px-6 py-14">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-8">
            <div>
              <h2 className="text-3xl font-bold mb-3">About The Platform</h2>
              <p className="text-slate-600 leading-relaxed mb-5">
                This platform is designed for structured, department-level operations. It minimizes manual tracking by connecting event planning, approvals, OD workflows, and post-event reporting.
              </p>
              <ul className="space-y-3">
                {[
                  'Role-specific access for students and staff',
                  'Readable dashboards with clear event status',
                  'Simple workflows for approvals and submissions',
                ].map((point) => (
                  <li key={point} className="flex items-start gap-2 text-slate-700">
                    <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" /> {point}
                  </li>
                ))}
              </ul>
            </div>

            <div className="glass-panel rounded-2xl p-6">
              <h3 className="font-bold text-lg mb-4">Operating Model</h3>
              <div className="space-y-3">
                {process.map((item, idx) => (
                  <div key={item.title} className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                    <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase mb-1">Step {idx + 1}</p>
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p className="text-sm text-slate-600 mt-1">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-14 bg-white/70 border-y border-slate-200/70">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-2">Trusted By Department Teams</h2>
            <p className="text-slate-600 mb-8">Built to support day-to-day academic operations with less friction.</p>
            <div className="grid md:grid-cols-3 gap-5">
              {testimonials.map((item) => (
                <blockquote key={item.name} className="glass-panel rounded-2xl p-5">
                  <p className="text-slate-700 leading-relaxed">"{item.quote}"</p>
                  <footer className="text-sm font-semibold text-slate-900 mt-4">{item.name}</footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="px-6 py-14">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-8">
            <div className="glass-panel rounded-2xl p-7">
              <h2 className="text-3xl font-bold mb-2">Ready To Use The Portal?</h2>
              <p className="text-slate-600 mb-6">Sign in to access your role-based dashboard and manage workflows confidently.</p>
              <button
                onClick={() => navigate('/login')}
                className="btn-primary inline-flex items-center gap-2 px-6 py-3"
              >
                Go To Login
                <ArrowRight size={16} />
              </button>
            </div>

            <div className="glass-panel rounded-2xl p-7">
              <h3 className="font-bold text-xl mb-4">Contact</h3>
              <div className="space-y-3 text-slate-700">
                <p className="flex items-center gap-2"><Mail size={16} className="text-slate-500" /> cse@sece.ac.in</p>
                <p className="flex items-center gap-2"><Phone size={16} className="text-slate-500" /> +91 00000 00000</p>
                <p className="flex items-center gap-2"><GraduationCap size={16} className="text-slate-500" /> Department of Computer Science and Engineering</p>
                <p className="flex items-center gap-2"><FileText size={16} className="text-slate-500" /> Sri Eshwar College of Engineering</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white/80">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-slate-600">© {new Date().getFullYear()} CSE Event Management Portal</p>
          <p className="text-sm text-slate-500">Designed for reliable, professional academic operations.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;