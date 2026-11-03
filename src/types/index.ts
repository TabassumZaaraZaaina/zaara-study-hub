/**
 * Core domain types for ZAARA.
 *
 * Conventions
 * - Local calendar dates are ISO strings `YYYY-MM-DD` interpreted in Asia/Dhaka.
 * - Instants (timestamps) are ISO-8601 UTC strings from `new Date().toISOString()`.
 * - Durations are whole minutes.
 * - `demo: true` marks sample records so they can never be confused with real data.
 */

export type ISODate = string; // YYYY-MM-DD (Asia/Dhaka local date)
export type ISOInstant = string; // full ISO timestamp (UTC)

export type SubjectId = 'bangla' | 'economics' | 'physics' | 'chemistry' | 'mathd' | 'addmath';

/** Student-facing pacing. Internally: full / reduced / recovery. */
export type PaceMode = 'full' | 'steady' | 'light';

export type MasteryState = 'unassessed' | 'red' | 'amber' | 'green';

export interface StudentProfile {
  displayName: string;
  timezone: string; // 'Asia/Dhaka'
  setupComplete: boolean;
  createdAt: ISOInstant;
}

export interface Paper {
  id: string;
  name: string; // e.g. "Paper 1 — Multiple Choice"
  note?: string;
}

export interface Subject {
  id: SubjectId;
  name: string;
  shortName: string;
  syllabusCode: string | null; // null = pending verification
  syllabusVersion: string | null;
  papers: Paper[];
  /** Relative planning weight (1 = baseline). Editable in Planning settings. */
  weight: number;
  /** Cognitively demanding — scheduler avoids stacking these back-to-back. */
  demanding: boolean;
  active: boolean;
}

export interface Topic {
  id: string;
  subjectId: SubjectId;
  parentTopicId: string | null;
  syllabusReference: string | null;
  title: string;
  learningObjectives: string;
  order: number;
  active: boolean;
  /** Included in the Mock 2 coverage for this subject. */
  inMock: boolean;
  /** Optional self-rating before any evidence exists. Never treated as evidence. */
  selfRating?: 'red' | 'amber' | 'green' | null;
  demo?: boolean;
}

export type ExamGroup = 'mock2' | 'final';

export interface Exam {
  id: string;
  group: ExamGroup;
  subjectId: SubjectId;
  paper: string;
  date: ISODate | null; // null = not yet announced
  startTime: string | null; // HH:mm local
  durationMinutes: number | null;
  venue?: string;
  coverageTopicIds: string[];
  notes?: string;
  status: 'pending' | 'scheduled' | 'done';
  demo?: boolean;
}

export type ActivityKind = 'recall' | 'learn' | 'watch' | 'practice' | 'mark' | 'reflect' | 'timed' | 'repair' | 'retest';

export interface ActivitySpec {
  key: string;
  title: string;
  minutes: number;
  kind: ActivityKind;
  instruction: string;
  /** Completing this activity invites a score entry. */
  assessable?: boolean;
}

export interface SessionTemplate {
  id: string;
  subjectId: SubjectId | '*';
  name: string;
  /** learn = new/consolidation, practice = applied, exam = timed/exam-focused. */
  purpose: 'learn' | 'practice' | 'exam' | 'repair' | 'retest' | 'quick';
  modes: Record<PaceMode, ActivitySpec[]>;
}

export type SessionSource = 'plan' | 'manual' | 'repair' | 'retest' | 'review' | 'followup' | 'quickcheck';

/**
 * Stored lifecycle state. Display states like "Ready" / "Upcoming" are derived from date.
 * - planned: not started yet
 * - in_progress: started, not finished
 * - completed: finished in its chosen mode
 * - partial: day ended with some activities done (carry-over candidate)
 * - missed: day ended with nothing done (carry-over candidate)
 * - skipped: student chose to skip, reason recorded (kept in history)
 * - consolidated: folded into another session (mergedIntoId)
 * - converted: replaced by a short quick-check session (replacementId)
 */
export type SessionStatus = 'planned' | 'in_progress' | 'completed' | 'partial' | 'missed' | 'skipped' | 'consolidated' | 'converted';

export interface SessionMove {
  from: ISODate;
  to: ISODate;
  at: ISOInstant;
  reason: string;
  auto: boolean;
}

export interface StudySession {
  id: string;
  date: ISODate; // current scheduled date
  originalDate: ISODate; // first assigned date, never changes
  order: number; // order within the day
  subjectId: SubjectId;
  topicIds: string[];
  templateId: string;
  purpose: SessionTemplate['purpose'];
  source: SessionSource;
  /** The size it was planned at (90 = full, 45 = steady, 15 = light). */
  plannedMode: PaceMode;
  plannedMinutes: number;
  /** Mode chosen when the student started (null until started). */
  mode: PaceMode | null;
  status: SessionStatus;
  /** Activity keys completed, for the active mode. */
  completedActivities: string[];
  actualMinutes: number;
  startedAt: ISOInstant | null;
  completedAt: ISOInstant | null;
  /** Essential sessions are carried over; optional ones may be dropped. */
  essential: boolean;
  /** Edited by hand — never replaced by plan regeneration. */
  pinned: boolean;
  skipReason?: string;
  note?: string;
  reason?: string; // plain-language explanation of why it was scheduled
  moves: SessionMove[];
  mergedIntoId?: string;
  replacementId?: string;
  parentSessionId?: string; // follow-up / quick-check / repair links
  repairId?: string;
  /** Light completion of an essential objective → follow-up session id. */
  followupId?: string;
  planVersion: number;
  createdAt: ISOInstant;
  updatedAt: ISOInstant;
  demo?: boolean;
}

export type AssessmentType = 'topic-quiz' | 'past-paper' | 'timed-paper' | 'homework' | 'school-test' | 'retest' | 'retention-check';
export type Assistance = 'none' | 'some' | 'heavy';
export type Confidence = 'guessing' | 'unsure' | 'confident';
export type QuestionSource = 'official-past-paper' | 'teacher' | 'textbook' | 'generated-practice' | 'own';

export interface AssessmentAttempt {
  id: string;
  subjectId: SubjectId;
  topicId: string | null;
  sessionId: string | null;
  assessmentType: AssessmentType;
  paper?: string;
  source: QuestionSource;
  sourceReference?: string; // e.g. "5054/22/M/J/19 Q3"
  marksEarned: number;
  marksAvailable: number;
  assistanceUsed: Assistance;
  confidence: Confidence | null;
  /** True if the questions had not been seen before. Required for a retest to count. */
  unseen: boolean;
  originalAnswer?: string;
  missingPoints?: string;
  correctedAnswer?: string;
  reattemptDone?: boolean;
  photoIds: string[];
  date: ISODate;
  completedAt: ISOInstant;
  repairId?: string;
  demo?: boolean;
}

export type ErrorCategory = 'concept' | 'memory' | 'application' | 'calculation' | 'exam-technique' | 'misread';

export interface ErrorRecord {
  id: string;
  attemptId: string | null;
  subjectId: SubjectId;
  topicId: string | null;
  category: ErrorCategory;
  description: string;
  correction: string;
  confidentButWrong: boolean;
  resolved: boolean;
  createdAt: ISOInstant;
  resolvedAt?: ISOInstant;
  demo?: boolean;
}

export type RepairMethod = 'blank-page' | 'contrast-predict' | 'scaffold-transfer' | 'calculation' | 'exam-language' | 'retrieval';

export interface RepairTask {
  id: string;
  subjectId: SubjectId;
  topicId: string | null;
  sourceAttemptId: string;
  diagnosis: ErrorCategory | null;
  method: RepairMethod | null;
  assignedDate: ISODate;
  dueDate: ISODate; // within 48h of assignment
  status: 'diagnose' | 'scheduled' | 'repaired' | 'retest-scheduled' | 'closed';
  repairSessionId?: string;
  retestSessionId?: string;
  retestAttemptId?: string;
  notes?: string;
  createdAt: ISOInstant;
  closedAt?: ISOInstant;
  demo?: boolean;
}

export interface Resource {
  id: string;
  subjectId: SubjectId | null;
  topicIds: string[];
  title: string;
  type: 'textbook' | 'syllabus' | 'past-paper' | 'mark-scheme' | 'video' | 'notebooklm' | 'worksheet' | 'notes' | 'teacher';
  url?: string;
  fileId?: string;
  notes?: string;
  lastAccessed?: ISOInstant;
  demo?: boolean;
}

export interface StoredFile {
  id: string;
  name: string;
  type: string;
  size: number;
  blob: Blob;
  createdAt: ISOInstant;
  demo?: boolean;
}

export interface HistoryEntry {
  id?: number;
  at: ISOInstant;
  action: string;
  entityType: string;
  entityId: string;
  detail: string;
}

/** Minutes available per weekday. Index 0 = Sunday … 6 = Saturday. */
export type WeeklyCapacity = [number, number, number, number, number, number, number];

export interface UnavailablePeriod {
  id: string;
  start: ISODate;
  end: ISODate;
  label: string;
}

export interface FixedCommitment {
  id: string;
  label: string;
  weekday: number; // 0-6
  minutes: number; // minutes it removes from that day's study capacity
}

export interface PlanConfig {
  planStart: ISODate;
  horizonDays: number;
  capacity: WeeklyCapacity;
  schoolDays: number[];
  unavailable: UnavailablePeriod[];
  commitments: FixedCommitment[];
  /** Full block length; smaller remainders become Steady (45) sessions. */
  blockMinutes: number;
  /** Carry-over: 'auto' places missed work automatically (with undo), 'ask' waits for a tap. */
  carryOverMode: 'auto' | 'ask';
  /** Above this many unplaced carry-over items the app switches to backlog triage. */
  backlogThreshold: number;
  planVersion: number;
  provisional: boolean;
}

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  reminders: {
    enabled: boolean;
    dailyPlan: boolean;
    retests: boolean;
    examCountdown: boolean;
    quietStart: string;
    quietEnd: string;
  };
  planningMode: boolean;
}

export interface Milestone {
  id: ExamGroup;
  label: string;
  /** Confirmed start of the period, if known. */
  startDate: ISODate | null;
  note: string;
}
