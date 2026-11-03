import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useAttempts, useExams, useSessions, useSubjects, useToday, useTopics, useMastery } from '@/hooks/data';
import { subjectSummary } from '@/domain/progress';
import { Card, PageHeader, SubjectGlyph } from '@/components/ui';
import { MasteryStack } from './MasteryStack';
import { fmtShort } from '@/utils/dates';

export function SubjectsScreen() {
  const subjects = useSubjects();
  const topics = useTopics();
  const attempts = useAttempts();
  const sessions = useSessions() ?? [];
  const exams = useExams();
  const today = useToday();
  const mastery = useMastery(topics, attempts);
  return (
    <div className="animate-rise">
      <PageHeader title="Subjects" subtitle="Six separate subjects, one plan." />
      <div className="space-y-3">
        {subjects.map((s) => {
          const sum = subjectSummary(s.id, topics, sessions, attempts, mastery);
          const next = sessions.filter((x) => x.subjectId === s.id && x.date >= today && x.status === 'planned').sort((a, b) => (a.date < b.date ? -1 : 1))[0];
          const exam = exams.filter((e) => e.subjectId === s.id && e.date && e.date >= today).sort((a, b) => (a.date! < b.date! ? -1 : 1))[0];
          return (
            <Link key={s.id} to={`/subjects/${s.id}`} className="block">
              <Card className="flex items-center gap-4 p-4 transition hover:shadow-lift">
                <SubjectGlyph id={s.id} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="text-[17px] font-semibold">{s.name}</p>
                    <span className="text-[13px] text-muted">{s.syllabusCode ?? 'code pending'}</span>
                  </div>
                  <p className="text-[13px] text-muted">
                    {sum.topicsListed ? `${sum.topicsListed} topics` : 'No topics added yet'}
                    {next ? ` · next ${fmtShort(next.date)}` : ''}
                    {exam ? ` · exam ${fmtShort(exam.date!)}` : ''}
                  </p>
                  {sum.topicsListed > 0 && <MasteryStack counts={sum.mastery} className="mt-2" />}
                </div>
                <ChevronRight size={18} className="text-muted" />
              </Card>
            </Link>
          );
        })}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
        <Link to="/exams" className="rounded-2xl border border-line bg-surface p-4 font-semibold shadow-card">Exam timetable →</Link>
        <Link to="/resources" className="rounded-2xl border border-line bg-surface p-4 font-semibold shadow-card">Resources →</Link>
      </div>
    </div>
  );
}
