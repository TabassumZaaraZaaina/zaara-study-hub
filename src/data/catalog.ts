import type { ActivitySpec, Milestone, PaceMode, SessionTemplate, Subject, SubjectId } from '@/types';

/**
 * Confirmed facts only. Syllabus codes are left null (pending) except Physics 5054,
 * which was confirmed in the project brief. Papers are listed only where confirmed.
 */
export const SUBJECTS: Subject[] = [
  {
    id: 'bangla', name: 'Bangla', shortName: 'Bangla', syllabusCode: null, syllabusVersion: null,
    papers: [], weight: 0.85, demanding: false, active: true
  },
  {
    id: 'english', name: 'English Language', shortName: 'English', syllabusCode: null, syllabusVersion: null,
    papers: [], weight: 0.9, demanding: false, active: true
  },
  {
    id: 'economics', name: 'Economics', shortName: 'Econ', syllabusCode: null, syllabusVersion: null,
    papers: [], weight: 0.9, demanding: false, active: true
  },
  {
    id: 'physics', name: 'Physics', shortName: 'Physics', syllabusCode: '5054', syllabusVersion: null,
    papers: [
      { id: 'p1', name: 'Paper 1 — Multiple Choice' },
      { id: 'p2', name: 'Paper 2 — Theory' },
      { id: 'p3', name: 'Paper 3 — Practical Test', note: 'Experiments at school; home practice covers data, graphs and planning.' }
    ],
    weight: 1.1, demanding: true, active: true
  },
  {
    id: 'chemistry', name: 'Chemistry', shortName: 'Chem', syllabusCode: null, syllabusVersion: null,
    papers: [], weight: 1.0, demanding: true, active: true
  },
  {
    id: 'mathd', name: 'Mathematics D', shortName: 'Maths D', syllabusCode: null, syllabusVersion: null,
    papers: [], weight: 1.0, demanding: true, active: true
  },
  {
    id: 'addmath', name: 'Additional Mathematics', shortName: 'Add Maths', syllabusCode: null, syllabusVersion: null,
    papers: [], weight: 1.15, demanding: true, active: true
  }
];

export const SUBJECT_IDS = SUBJECTS.map((s) => s.id);

/** Visual identity per subject. Muted accents; contrast-checked text colours. */
export const SUBJECT_STYLE: Record<SubjectId, { accent: string; soft: string; ink: string; glyph: string }> = {
  bangla: { accent: '#D9826B', soft: 'var(--s-bangla-soft)', ink: 'var(--s-bangla-ink)', glyph: 'অ' },
  english: { accent: '#6E9C6A', soft: 'var(--s-eng-soft)', ink: 'var(--s-eng-ink)', glyph: 'Aa' },
  economics: { accent: '#C9A04A', soft: 'var(--s-econ-soft)', ink: 'var(--s-econ-ink)', glyph: '₳' },
  physics: { accent: '#8B7BC8', soft: 'var(--s-physics-soft)', ink: 'var(--s-physics-ink)', glyph: 'Φ' },
  chemistry: { accent: '#3E9E96', soft: 'var(--s-chem-soft)', ink: 'var(--s-chem-ink)', glyph: '⚗' },
  mathd: { accent: '#5B86C9', soft: 'var(--s-mathd-soft)', ink: 'var(--s-mathd-ink)', glyph: 'Σ' },
  addmath: { accent: '#9C5B8F', soft: 'var(--s-addmath-soft)', ink: 'var(--s-addmath-ink)', glyph: '∫' }
};

export const MILESTONES: Milestone[] = [
  { id: 'mock2', label: 'Mock 2', startDate: '2026-11-25', note: 'Start date confirmed (25 November 2026). Individual paper dates to be entered.' },
  { id: 'final', label: 'O Level Finals', startDate: null, note: 'May/June 2027 series. Exact dates to be entered from the Statement of Entry.' }
];

const a = (key: string, title: string, minutes: number, kind: ActivitySpec['kind'], instruction: string, assessable = false): ActivitySpec =>
  ({ key, title, minutes, kind, instruction, assessable });

/** A shared Light (15 min) session: genuine retrieval, not a token tick-box. */
const lightRecall = (what: string): ActivitySpec[] => [
  a('light-recall', 'Blank-page recall', 10, 'recall', `Close everything. Write or sketch what you remember about ${what}. Don't look anything up yet.`),
  a('light-check', 'Check and flag', 5, 'reflect', 'Open your notes and mark what you missed. Flag one gap for your next full session.')
];

const T = (id: string, subjectId: SubjectId | '*', name: string, purpose: SessionTemplate['purpose'], full: ActivitySpec[], steady: ActivitySpec[], light: ActivitySpec[]): SessionTemplate =>
  ({ id, subjectId, name, purpose, modes: { full, steady, light } });

export const TEMPLATES: SessionTemplate[] = [
  // ───────────── PHYSICS (the established 90-minute loop) ─────────────
  T('physics-loop', 'physics', 'Study loop', 'learn', [
    a('recall', 'Recall warm-up', 10, 'recall', 'Without notes, write the key ideas, equations and units for this topic. Attempt before you check.'),
    a('read', 'Read actively', 20, 'learn', 'Read the textbook section. Stop after each part and explain it in one sentence in your own words.'),
    a('see', 'See it', 10, 'watch', 'Watch one short video or simulation on the idea you found hardest while reading.'),
    a('do', 'Timed questions', 35, 'practice', 'Answer exam-style questions under time. Attempt every question before looking at any answer.'),
    a('mark', 'Mark and audit', 10, 'mark', 'Mark with the mark scheme. Record your score honestly, including partial marks.', true),
    a('errors', 'Error log', 5, 'reflect', 'For each lost mark, note the error type and the correct idea.')
  ], [
    a('recall', 'Recall warm-up', 5, 'recall', 'Write the key ideas and equations from memory.'),
    a('do', 'Timed questions', 25, 'practice', 'Answer a shorter set of exam-style questions. Attempt before checking.'),
    a('mark', 'Mark and audit', 10, 'mark', 'Mark against the mark scheme and record your score.', true),
    a('errors', 'Error log', 5, 'reflect', 'Log each lost mark with its error type.')
  ], lightRecall('this Physics topic')),
  T('physics-p3', 'physics', 'Paper 3 skills', 'practice', [
    a('recall', 'Recall warm-up', 10, 'recall', 'From memory: rules for tables, units, significant figures and choosing graph scales.'),
    a('skill', 'Skill focus', 20, 'learn', 'Focus on one skill: reading scales, graph plotting, best-fit lines, gradient/intercept, variables, or planning.'),
    a('data', 'Data-processing questions', 40, 'practice', 'Work through practical-style questions on paper. Plot graphs by hand. Photograph your graph if you like.'),
    a('mark', 'Mark and audit', 15, 'mark', 'Check against the mark scheme: units, precision, scale choice, line of best fit, gradient triangle size.', true),
    a('errors', 'Error log', 5, 'reflect', 'Note specific improvements (not "be more careful").')
  ], [
    a('skill', 'Skill focus', 10, 'learn', 'Pick one practical-data skill and review the rule.'),
    a('data', 'Data-processing question', 25, 'practice', 'Do one practical-style question by hand.'),
    a('mark', 'Mark and audit', 10, 'mark', 'Mark it and record your score.', true)
  ], lightRecall('practical-data rules (tables, units, graphs, gradients)')),
  T('physics-timed', 'physics', 'Timed paper practice', 'exam', [
    a('timed', 'Timed paper section', 60, 'timed', 'Do a past-paper section under exam conditions. No notes, no answers until finished.'),
    a('mark', 'Mark with the mark scheme', 20, 'mark', 'Mark strictly. Record marks per question if you can.', true),
    a('errors', 'Error audit', 10, 'reflect', 'Log every lost mark by type. Note one exam-technique fix.')
  ], [
    a('timed', 'Timed short section', 30, 'timed', 'A shorter timed section under exam conditions.'),
    a('mark', 'Mark', 10, 'mark', 'Mark strictly and record your score.', true),
    a('errors', 'Error audit', 5, 'reflect', 'Log lost marks by type.')
  ], lightRecall('the topics in this paper')),

  // ───────────── CHEMISTRY ─────────────
  T('chem-concept', 'chemistry', 'Concepts and equations', 'learn', [
    a('recall', 'Recall', 10, 'recall', 'From memory: key definitions, particle explanations and any equations for this topic.'),
    a('explain', 'Concept explanation', 20, 'learn', 'Read, then explain the concept as if teaching it. Draw particle diagrams where useful.'),
    a('equations', 'Chemical equations', 15, 'practice', 'Write and balance equations, including state symbols and ionic equations where relevant.'),
    a('structured', 'Structured questions', 30, 'practice', 'Answer structured exam questions. Attempt fully before checking.'),
    a('mark', 'Mark and diagnose', 10, 'mark', 'Mark with the mark scheme and record your score.', true),
    a('errors', 'Error log', 5, 'reflect', 'Classify each error: concept, equation, calculation or wording.')
  ], [
    a('recall', 'Recall', 5, 'recall', 'Key definitions and equations from memory.'),
    a('equations', 'Equations', 10, 'practice', 'Balance and complete equations.'),
    a('structured', 'Structured questions', 20, 'practice', 'A short set of structured questions.'),
    a('mark', 'Mark', 10, 'mark', 'Mark and record your score.', true)
  ], lightRecall('this Chemistry topic (definitions and equations)')),
  T('chem-calc', 'chemistry', 'Stoichiometry and calculations', 'practice', [
    a('recall', 'Recall', 10, 'recall', 'Write the mole relationships and formulae you need, with units.'),
    a('worked', 'Worked example', 15, 'learn', 'Study one worked example. Cover the solution and redo it yourself.'),
    a('calc', 'Calculation practice', 40, 'practice', 'Independent calculation questions. Show every step and unit.'),
    a('mark', 'Mark', 15, 'mark', 'Mark each step, not just the final answer. Record your score.', true),
    a('errors', 'Calculation repair', 10, 'reflect', 'For each error, identify: formula, substitution, units or arithmetic.')
  ], [
    a('calc', 'Calculation practice', 30, 'practice', 'Independent calculation questions with full working.'),
    a('mark', 'Mark', 10, 'mark', 'Mark and record your score.', true),
    a('errors', 'Calculation repair', 5, 'reflect', 'Note where each error happened.')
  ], lightRecall('mole calculations and the formulae you use')),
  T('chem-timed', 'chemistry', 'Timed paper practice', 'exam', [
    a('timed', 'Timed paper section', 60, 'timed', 'Past-paper section under exam conditions.'),
    a('mark', 'Mark', 20, 'mark', 'Mark strictly and record your score.', true),
    a('errors', 'Error audit', 10, 'reflect', 'Log each lost mark by type.')
  ], [
    a('timed', 'Timed short section', 30, 'timed', 'Shorter timed section.'),
    a('mark', 'Mark', 10, 'mark', 'Mark and record your score.', true),
    a('errors', 'Error audit', 5, 'reflect', 'Log lost marks.')
  ], lightRecall('the topics in this paper')),

  // ───────────── MATHEMATICS D ─────────────
  T('mathd-practice', 'mathd', 'Practice loop', 'practice', [
    a('retrieval', 'Short retrieval', 10, 'recall', 'Three quick questions from earlier topics, from memory.'),
    a('worked', 'Worked-example review', 15, 'learn', 'Study a worked example, then cover it and reproduce the method.'),
    a('solve', 'Independent problems', 40, 'practice', 'Solve problems without help. Write full workings — method marks matter.'),
    a('mark', 'Mark', 15, 'mark', 'Mark answers and workings. Record your score.', true),
    a('errors', 'Method-error analysis', 10, 'reflect', 'For each mistake: wrong method, slip, or misread? Note the fix.')
  ], [
    a('retrieval', 'Short retrieval', 5, 'recall', 'Two quick questions from earlier topics.'),
    a('solve', 'Independent problems', 25, 'practice', 'Solve problems with full workings.'),
    a('mark', 'Mark', 10, 'mark', 'Mark and record your score.', true),
    a('errors', 'Method errors', 5, 'reflect', 'Note each method error.')
  ], lightRecall('this Maths D topic: methods and formulae')),
  T('mathd-mixed', 'mathd', 'Timed mixed exercise', 'exam', [
    a('timed', 'Timed mixed questions', 50, 'timed', 'Mixed-topic questions under time. Clear workings.'),
    a('mark', 'Mark', 20, 'mark', 'Mark answers and method. Record your score.', true),
    a('reattempt', 'Reattempt with new questions', 20, 'practice', 'For each topic you lost marks on, try a different question of the same type.')
  ], [
    a('timed', 'Timed mixed questions', 25, 'timed', 'Shorter mixed set under time.'),
    a('mark', 'Mark', 10, 'mark', 'Mark and record your score.', true),
    a('reattempt', 'Reattempt', 10, 'practice', 'Retry one weak question type with a new question.')
  ], lightRecall('mixed Maths D methods')),

  // ───────────── ADDITIONAL MATHEMATICS ─────────────
  T('addmath-build', 'addmath', 'Build and solve', 'learn', [
    a('prereq', 'Prerequisite check', 10, 'recall', 'Check you can do the algebra this topic depends on. Try two quick prerequisite questions.'),
    a('concept', 'Concept review', 15, 'learn', 'Review the idea and one derivation. Then close the book and derive it yourself.'),
    a('multistep', 'Multistep problems', 45, 'practice', 'Work through multistep problems independently. Persist before checking.'),
    a('mark', 'Mark', 10, 'mark', 'Mark carefully and record your score.', true),
    a('errors', 'Error analysis', 10, 'reflect', 'Where did each solution break: setup, algebra, or concept?')
  ], [
    a('prereq', 'Prerequisite check', 5, 'recall', 'One quick prerequisite question.'),
    a('multistep', 'Multistep problems', 25, 'practice', 'Two or three multistep problems.'),
    a('mark', 'Mark', 10, 'mark', 'Mark and record your score.', true),
    a('errors', 'Error analysis', 5, 'reflect', 'Note where each solution broke.')
  ], lightRecall('this Add Maths topic: key results and derivations')),
  T('addmath-transfer', 'addmath', 'Mixed-topic transfer', 'exam', [
    a('timed', 'Timed mixed exercise', 55, 'timed', 'Mixed-topic problems under time. Decide the method yourself.'),
    a('mark', 'Mark', 20, 'mark', 'Mark strictly and record your score.', true),
    a('retest', 'Retry the hardest', 15, 'practice', 'Retry the hardest problem without looking at the solution.')
  ], [
    a('timed', 'Timed mixed exercise', 30, 'timed', 'A shorter mixed set.'),
    a('mark', 'Mark', 10, 'mark', 'Mark and record your score.', true),
    a('retest', 'Retry one', 5, 'practice', 'Retry the hardest one.')
  ], lightRecall('Add Maths methods across topics')),

  // ───────────── ECONOMICS ─────────────
  T('econ-concept', 'economics', 'Concepts and application', 'learn', [
    a('defs', 'Definitions recall', 10, 'recall', 'Write precise definitions of the key terms from memory.'),
    a('concept', 'Concept and diagram', 25, 'learn', 'Understand the idea and draw the diagram from memory, fully labelled.'),
    a('apply', 'Data and application', 20, 'practice', 'Interpret a data extract or scenario and apply the concept to it.'),
    a('structured', 'Structured answer', 25, 'practice', 'Write a structured answer: explain, apply, then evaluate.'),
    a('compare', 'Mark-scheme comparison', 10, 'mark', 'Compare with the mark scheme: which points, links and evaluation did you miss? Record your score.', true)
  ], [
    a('defs', 'Definitions recall', 5, 'recall', 'Key definitions from memory.'),
    a('concept', 'Diagram from memory', 10, 'learn', 'Draw and label the main diagram.'),
    a('structured', 'Short structured answer', 20, 'practice', 'One structured answer.'),
    a('compare', 'Mark-scheme comparison', 10, 'mark', 'Compare and record your score.', true)
  ], lightRecall('this Economics topic: definitions and the main diagram')),
  T('econ-written', 'economics', 'Timed written answer', 'exam', [
    a('timed', 'Timed written answer', 45, 'timed', 'Answer an exam question under time. Plan briefly first.'),
    a('compare', 'Mark-scheme comparison', 25, 'mark', 'Mark against the scheme: knowledge, application, analysis, evaluation. Record your score.', true),
    a('rewrite', 'Rewrite weakest paragraph', 20, 'practice', 'Rewrite the weakest paragraph to hit the missing marking points.')
  ], [
    a('timed', 'Timed short answer', 25, 'timed', 'A shorter question under time.'),
    a('compare', 'Mark-scheme comparison', 15, 'mark', 'Compare and record your score.', true),
    a('rewrite', 'Fix one point', 5, 'practice', 'Rewrite one weak sentence.')
  ], lightRecall('Economics definitions and diagrams')),

  // ───────────── BANGLA ─────────────
  T('bangla-language', 'bangla', 'Language practice', 'learn', [
    a('vocab', 'Vocabulary and language', 15, 'recall', 'Review vocabulary and language points. Test yourself before checking.'),
    a('reading', 'Reading comprehension', 30, 'practice', 'Read a passage and answer comprehension questions in your own words.'),
    a('structured', 'Structured responses', 25, 'practice', 'Write structured answers as required by your paper.'),
    a('review', 'Review written answers', 20, 'mark', 'Compare with model answers or your teacher’s criteria. Record your score if you can.', true)
  ], [
    a('vocab', 'Vocabulary', 10, 'recall', 'Quick vocabulary self-test.'),
    a('reading', 'Short comprehension', 20, 'practice', 'A short passage with questions.'),
    a('review', 'Review', 15, 'mark', 'Check your answers and record your score.', true)
  ], lightRecall('Bangla vocabulary and language points')),
  T('bangla-writing', 'bangla', 'Writing practice', 'exam', [
    a('plan', 'Plan', 15, 'learn', 'Read the task carefully and plan your structure.'),
    a('write', 'Timed writing', 45, 'timed', 'Write under time, in Bangla, as in the exam.'),
    a('review', 'Self-review against criteria', 20, 'mark', 'Review content, organisation, language accuracy. Record your score if marked.', true),
    a('rewrite', 'Rewrite', 10, 'practice', 'Rewrite one paragraph to fix the main weakness.')
  ], [
    a('plan', 'Plan', 10, 'learn', 'Plan a response.'),
    a('write', 'Timed writing', 25, 'timed', 'Write a shorter piece under time.'),
    a('review', 'Self-review', 10, 'mark', 'Review and record your score if marked.', true)
  ], lightRecall('useful Bangla phrases and structures for writing')),

  // ───────────── ENGLISH LANGUAGE ─────────────
  T('english-reading', 'english', 'Reading practice', 'learn', [
    a('vocab', 'Vocabulary and techniques recall', 10, 'recall', 'From memory: useful vocabulary and the language techniques you can name (imagery, contrast, tone…). Test yourself before checking.'),
    a('comprehension', 'Comprehension', 30, 'practice', 'Read a narrative passage and answer questions on explicit and implicit meanings, in your own words where asked.'),
    a('language', 'Use of language', 20, 'practice', 'Pick words and phrases from the passage and explain the effect the writer creates — not just what they mean.'),
    a('summary', 'Summary', 20, 'practice', 'Write a summary of no more than 150 words from a second passage, as continuous writing. Count your words.'),
    a('mark', 'Mark and compare', 10, 'mark', 'Compare with the mark scheme or model answer: which points did you miss? Record your score.', true)
  ], [
    a('comprehension', 'Comprehension', 20, 'practice', 'A short passage with comprehension and use-of-language questions.'),
    a('summary', 'Summary', 15, 'practice', 'A short summary task (no more than 150 words).'),
    a('mark', 'Mark and compare', 10, 'mark', 'Check your answers and record your score.', true)
  ], lightRecall('useful vocabulary and language techniques')),
  T('english-writing', 'english', 'Writing practice', 'exam', [
    a('plan', 'Plan', 10, 'learn', 'Read the task carefully: audience, purpose, form. Plan your points or story arc before writing.'),
    a('directed', 'Directed writing', 45, 'timed', 'Write a speech, email, report, letter or article (about 250–350 words) using and evaluating the ideas in the given text(s).'),
    a('mark', 'Mark against the criteria', 20, 'mark', 'Check content, organisation, register, vocabulary and accuracy against the mark scheme. Record your score.', true),
    a('composition', 'Composition opening', 15, 'practice', 'Plan a descriptive or narrative composition (350–450 words) and write a strong opening paragraph.')
  ], [
    a('plan', 'Plan', 5, 'learn', 'Plan a directed-writing or composition task.'),
    a('directed', 'Timed writing', 30, 'timed', 'Write under time.'),
    a('mark', 'Mark', 10, 'mark', 'Check against the criteria and record your score.', true)
  ], lightRecall('useful phrases and structures for writing')),

  // ───────────── SHARED ─────────────
  T('exam-prep', '*', 'Exam preparation', 'exam', [
    a('recall', 'Light recall', 15, 'recall', 'Recall key facts, formulae and definitions for the coming paper.'),
    a('weak', 'Weak-topic questions', 40, 'practice', 'Questions on the topics marked Needs Practice or Developing.'),
    a('timed', 'Short timed section', 25, 'timed', 'A short section under exam timing.'),
    a('mark', 'Mark and note', 10, 'mark', 'Mark, record your score and note one thing to remember in the exam.', true)
  ], [
    a('recall', 'Light recall', 10, 'recall', 'Key facts and formulae.'),
    a('weak', 'Weak-topic questions', 25, 'practice', 'A few questions on weak topics.'),
    a('mark', 'Mark', 10, 'mark', 'Mark and record your score.', true)
  ], lightRecall('the key facts for this exam')),
  T('repair', '*', 'Repair session', 'repair', [
    a('diagnose', 'Look at the mistake', 5, 'reflect', 'Re-read the question and your original answer. What exactly went wrong?'),
    a('method', 'Repair method', 20, 'repair', 'Use your chosen repair method (shown above).'),
    a('transfer', 'New question', 5, 'practice', 'Try one new question of the same type, without help.')
  ], [
    a('method', 'Repair method', 15, 'repair', 'Use your chosen repair method.'),
    a('transfer', 'New question', 5, 'practice', 'Try one new question without help.')
  ], [
    a('method', 'Repair method', 15, 'repair', 'Short version of your repair method: rebuild the idea from memory.')
  ]),
  T('retest', '*', 'Unseen retest', 'retest', [
    a('retest', 'Unseen question', 20, 'retest', 'Answer a question you have NOT seen before, with no notes. Generated practice must be labelled as generated.'),
    a('mark', 'Mark and record', 5, 'mark', 'Mark it and record your score as a retest.', true)
  ], [
    a('retest', 'Unseen question', 20, 'retest', 'Answer an unseen question with no notes.'),
    a('mark', 'Mark and record', 5, 'mark', 'Mark and record as a retest.', true)
  ], [
    a('retest', 'Unseen short question', 10, 'retest', 'One short unseen question, no notes.'),
    a('mark', 'Mark and record', 5, 'mark', 'Mark and record.', true)
  ]),
  T('quick-check', '*', 'Quick retrieval check', 'quick', lightRecall('this topic'), lightRecall('this topic'), lightRecall('this topic')),
  // Home mock: sat as one block under exam conditions. 'sit' minutes come from the paper.
  ...(() => {
    const sit = [
      a('prepare', 'Set up exam conditions', 5, 'reflect', 'Clear desk. Phone in another room. No notes, no NotebookLM, no mark scheme. Set out pens, calculator (only if the paper allows it) and water.'),
      a('sit', 'Sit the paper', 0, 'timed', 'Work under the real time limit. If you finish early, check your answers — don’t open the mark scheme. Stop writing when time is up.')
    ];
    const mark = [
      a('mark', 'Mark with the official mark scheme', 30, 'mark', 'Mark strictly, question by question. For long written answers, ask a parent or teacher to mark. Record the score.', true),
      a('errors', 'Log lost marks', 15, 'reflect', 'Log each lost mark by type and topic. Pick the two topics that cost the most marks — they become your next repairs.')
    ];
    return [T('home-mock', '*', 'Home mock', 'mock', sit, sit, sit), T('mock-mark', '*', 'Mark home mock', 'practice', mark, mark, mark)];
  })()
];

export const TEMPLATE_BY_ID: Record<string, SessionTemplate> = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));

/**
 * The repeating cycle of session types per subject during normal preparation.
 * Close to an exam the scheduler switches to `EXAM_CYCLE`.
 */
export const SUBJECT_CYCLE: Record<SubjectId, string[]> = {
  physics: ['physics-loop', 'physics-loop', 'physics-p3', 'physics-loop', 'physics-timed'],
  chemistry: ['chem-concept', 'chem-calc', 'chem-concept', 'chem-timed'],
  mathd: ['mathd-practice', 'mathd-practice', 'mathd-mixed'],
  addmath: ['addmath-build', 'addmath-build', 'addmath-transfer'],
  economics: ['econ-concept', 'econ-concept', 'econ-written'],
  bangla: ['bangla-language', 'bangla-writing'],
  english: ['english-reading', 'english-writing']
};

export const EXAM_CYCLE: Record<SubjectId, string[]> = {
  physics: ['exam-prep', 'physics-timed'],
  chemistry: ['exam-prep', 'chem-timed'],
  mathd: ['exam-prep', 'mathd-mixed'],
  addmath: ['exam-prep', 'addmath-transfer'],
  economics: ['exam-prep', 'econ-written'],
  bangla: ['exam-prep', 'bangla-writing'],
  english: ['exam-prep', 'english-writing']
};

export const MODE_LABEL: Record<PaceMode, string> = { full: 'Full', steady: 'Steady', light: 'Light' };
export const MODE_MINUTES: Record<PaceMode, number> = { full: 90, steady: 45, light: 15 };

/** Activities for a session, applying any per-session minute overrides (home mocks). */
export function sessionActivities(s: { templateId: string; activityMinutes?: Record<string, number> }, mode: PaceMode): ActivitySpec[] {
  const acts = activitiesFor(s.templateId, mode);
  const o = s.activityMinutes;
  return o ? acts.map((x) => (o[x.key] !== undefined ? { ...x, minutes: o[x.key] } : x)) : acts;
}

export function templateMinutes(templateId: string, mode: PaceMode): number {
  const t = TEMPLATE_BY_ID[templateId];
  if (!t) return 0;
  return t.modes[mode].reduce((s, x) => s + x.minutes, 0);
}

export function activitiesFor(templateId: string, mode: PaceMode): ActivitySpec[] {
  return TEMPLATE_BY_ID[templateId]?.modes[mode] ?? [];
}
