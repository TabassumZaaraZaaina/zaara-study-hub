import { useEffect, useState } from 'react';
import { HashRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BarChart3, BookOpen, CalendarDays, Inbox, Sun } from 'lucide-react';
import { initialiseDatabase, dailyMaintenance } from '@/services/plan';
import { runMigrations } from '@/services/migrations';
import { useHasDemo, useProfile, useSettings, useToday } from '@/hooks/data';
import { cx } from '@/components/ui';
import { UpdatePrompt } from './UpdatePrompt';
import { ErrorBoundary } from './ErrorBoundary';
import { TodayScreen } from '@/features/today/TodayScreen';
import { SessionScreen } from '@/features/session/SessionScreen';
import { ScheduleScreen } from '@/features/schedule/ScheduleScreen';
import { SubjectsScreen } from '@/features/subjects/SubjectsScreen';
import { SubjectScreen } from '@/features/subjects/SubjectScreen';
import { TopicScreen } from '@/features/subjects/TopicScreen';
import { ProgressScreen } from '@/features/progress/ProgressScreen';
import { ReviewScreen } from '@/features/review/ReviewScreen';
import { RepairScreen } from '@/features/review/RepairScreen';
import { ExamsScreen } from '@/features/exams/ExamsScreen';
import { AssessScreen } from '@/features/assess/AssessScreen';
import { ResourcesScreen } from '@/features/resources/ResourcesScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { SetupScreen } from '@/features/setup/SetupScreen';
import { Link } from 'react-router-dom';

const NAV = [
  { to: '/', label: 'Today', icon: Sun },
  { to: '/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/subjects', label: 'Subjects', icon: BookOpen },
  { to: '/progress', label: 'Progress', icon: BarChart3 },
  { to: '/review', label: 'Review', icon: Inbox }
];

function useTheme() {
  const { theme } = useSettings();
  useEffect(() => {
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
      try {
        localStorage.setItem('zaara-theme', JSON.stringify(theme));
      } catch {
        /* ignore */
      }
    };
    apply();
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

function Maintenance() {
  const today = useToday();
  useEffect(() => {
    dailyMaintenance(today).catch((e) => console.error('maintenance failed', e));
  }, [today]);
  return null;
}

function Shell() {
  const loc = useLocation();
  const profile = useProfile();
  const demo = useHasDemo();
  useTheme();
  const focused = loc.pathname.startsWith('/session/');
  if (profile && !profile.setupComplete && loc.pathname !== '/setup') return <Navigate to="/setup" replace />;
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl">
      {!focused && loc.pathname !== '/setup' && (
        <nav aria-label="Main" className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-1 px-4 py-8 lg:flex">
          <Link to="/" className="mb-6 px-3">
            <span className="block text-xl font-bold tracking-[0.18em]">ZAARA</span>
            <span className="text-sm text-muted">Your O Level Study Hub</span>
          </Link>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => cx('flex min-h-[46px] items-center gap-3 rounded-xl px-3 font-medium', isActive ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-sunken hover:text-ink')}>
              <n.icon size={20} /> {n.label}
            </NavLink>
          ))}
          <div className="mt-auto flex flex-col gap-1 text-sm">
            <NavLink to="/exams" className="rounded-lg px-3 py-2 text-muted hover:bg-sunken">Exam timetable</NavLink>
            <NavLink to="/resources" className="rounded-lg px-3 py-2 text-muted hover:bg-sunken">Resources</NavLink>
            <NavLink to="/settings" className="rounded-lg px-3 py-2 text-muted hover:bg-sunken">Settings</NavLink>
          </div>
        </nav>
      )}
      <main className={cx('min-w-0 flex-1 px-4 pt-safe sm:px-6', !focused && 'content-bottom')}>
        {demo && (
          <div role="status" className="mx-auto mt-3 max-w-2xl rounded-xl bg-amber-soft px-4 py-2.5 text-sm font-medium text-amber">
            Sample data is showing — it is not Zaara’s real progress. <Link to="/settings" className="underline">Clear it in Settings</Link>.
          </div>
        )}
        <div className="mx-auto max-w-2xl py-4">
          <ErrorBoundary key={loc.pathname}>
            <Routes>
              <Route path="/" element={<TodayScreen />} />
              <Route path="/setup" element={<SetupScreen />} />
              <Route path="/session/:id" element={<SessionScreen />} />
              <Route path="/schedule" element={<ScheduleScreen />} />
              <Route path="/subjects" element={<SubjectsScreen />} />
              <Route path="/subjects/:id" element={<SubjectScreen />} />
              <Route path="/topics/:id" element={<TopicScreen />} />
              <Route path="/progress" element={<ProgressScreen />} />
              <Route path="/review" element={<ReviewScreen />} />
              <Route path="/repair/:id" element={<RepairScreen />} />
              <Route path="/exams" element={<ExamsScreen />} />
              <Route path="/assess" element={<AssessScreen />} />
              <Route path="/resources" element={<ResourcesScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ErrorBoundary>
        </div>
      </main>
      {!focused && loc.pathname !== '/setup' && (
        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/92 pb-safe backdrop-blur-md lg:hidden">
          <div className="mx-auto flex max-w-xl">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => cx('flex min-h-[58px] flex-1 flex-col items-center justify-center gap-0.5 text-[11.5px] font-semibold', isActive ? 'text-primary' : 'text-muted')}>
                {({ isActive }) => (
                  <>
                    <span className={cx('flex h-8 w-14 items-center justify-center rounded-full transition', isActive && 'bg-primary-soft')}>
                      <n.icon size={21} strokeWidth={isActive ? 2.3 : 1.9} />
                    </span>
                    {n.label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

export function App() {
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    initialiseDatabase()
      .then(() => runMigrations())
      .then(() => setReady(true))
      .catch((e) => setErr(String(e?.message ?? e)));
  }, []);
  if (err)
    return (
      <div className="mx-auto max-w-md p-6">
        <h1 className="text-xl font-semibold">Storage isn’t available</h1>
        <p className="mt-2 text-muted">ZAARA saves your work in this browser’s storage, which couldn’t be opened ({err}). Private browsing modes can block it — try a normal window.</p>
      </div>
    );
  if (!ready) return null;
  return (
    <HashRouter>
      <Maintenance />
      <Shell />
      <UpdatePrompt />
    </HashRouter>
  );
}
