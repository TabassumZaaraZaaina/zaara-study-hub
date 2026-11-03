# ZAARA — Your O Level Study Hub

A mobile-first, offline-capable Progressive Web App for six Cambridge O Level subjects: Bangla, Economics, Physics, Chemistry, Mathematics D and Additional Mathematics. It is schedule-driven: every day has dated sessions, and unfinished work is kept and re-planned rather than forgotten.

- React 18 + TypeScript + Tailwind CSS + Vite
- IndexedDB via Dexie (local-first; no server, no accounts, no API keys)
- `vite-plugin-pwa` (Workbox) for installation and offline use
- Vitest unit/integration tests and a Playwright browser walkthrough

## Run it

```bash
npm install
npm run dev          # development server
npm test             # 47 unit + IndexedDB integration tests
npm run build        # type-check + production build into dist/
npm run preview      # serve the production build at http://localhost:4173
```

`dist/` is a static site. Host it on any HTTPS static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages). HTTPS is required for installation and offline use. Routing uses `#/` URLs, so no server rewrite rules are needed.

### Install on a phone
- **Android (Chrome):** menu ⋮ → *Install app* / *Add to Home screen*.
- **iPhone (Safari):** Share → *Add to Home Screen*. On iOS, the home-screen app keeps **its own storage**, separate from Safari. Always open ZAARA from the icon, and back up before deleting it.

## Where data lives, and backups

All data is stored in this browser's IndexedDB on this device. It survives reloads, restarts, offline use and days away. The app also requests persistent storage. **There is no cross-device sync.** Use *Settings → Your data*:
- **Export backup:** one JSON file with every table, including photos (embedded as base64).
- **Restore:** the file is validated first (schema, mark ranges, references between records), a summary is shown, and the restore replaces local data in a single transaction.
- Backups from a newer schema are refused. `migrateBackup()` in `src/services/backup.ts` is the place to add upgrades.

## Configuring the plan

| What | Where |
|---|---|
| Study minutes per weekday, tutoring/fixed commitments, carry-over mode, backlog limit | Settings → Planning |
| Holidays / unavailable days | Schedule → Unavailable days |
| Syllabus code, years, papers, planning weight | Subjects → *subject* → ⚙ |
| Topic lists (paste; Bangla supported) | Subjects → *subject* → Add topics |
| Mock 2 coverage | Exam timetable → paper → coverage ticks (or Topic → Edit) |
| Mock 2 / Final paper dates, times, durations | Exam timetable → Add paper |

Each of these changes re-plans **only untouched future sessions**. Completed, started, moved and hand-edited sessions, repairs, retests and history are never replaced.

**Pre-filled facts only:** the six subjects, Physics syllabus 5054 with its Papers 1–3, Mock 2 starting 28 Nov 2026, Finals in the May/June 2027 series, and the Asia/Dhaka timezone. All other syllabus codes, papers, topics and exam dates are left *pending* until you enter them.

## How the scheduling works (`src/scheduling/`)

- **Generation:** the plan runs 56 days ahead and is extended automatically. Each day's free minutes (capacity, minus commitments, minus existing sessions) become Full 90-minute blocks, plus one Steady 45-minute block if at least 45 minutes remain. Exam days get half capacity.
- **Choosing a subject:** weighted fair queuing on `weight × urgency × weakFactor`. Urgency rises at 28, 14, 7 and 3 days before that subject's next exam; if no paper date is entered, the confirmed Mock 2 start is the target. There is at most one session per subject per day, and a penalty for stacking two demanding subjects back to back.
- **Exam week:** a subject with a known paper within 7 days gets a slot every day, soonest exam first, and switches to exam-prep and timed templates within 10 days.
- **Topics:** least-practised first, with *Needs practice* topics pulled forward. Before Mock 2, only Mock 2 coverage is used if it has been set.
- **Explanations:** every session stores a plain-language reason built only from recorded facts.
- **Missed work (`carryover.ts`):** at each new Dhaka day, past unfinished sessions become *missed* or *partial*. Their progress and original date are kept, and nothing is ever marked complete. Essential ones are placed, in order of preference:
  1. a day with genuinely free time before the subject's next exam (within 7 days);
  2. otherwise **shift**: the session takes the next untouched slot for the same subject, and that subject's later topics each move back one slot. No extra hours are added.
  3. otherwise the session stays in *Unfinished work* for Zaara to choose: do it today, a 15-minute check instead, pick a date, or let it go with a reason.

  Above the backlog limit, only the top three are shown. Mode *Ask me first* turns off automatic placement.
- **Light sessions:** count as completed Light sessions. If the session was essential learning, one 45-minute Steady follow-up is planned (once, never duplicated).

The weights are heuristics, gathered in `PRIORITY` in `engine.ts`. They are not validated science.

## Mastery and repair (`src/domain/`)

Mastery is **derived from results, never toggled by hand**:
- **Needs practice:** the latest result is below 50%.
- **Developing:** the result is improving, used help, or (marked *confirming*) one independent, unseen result of 70% or more.
- **Secure:** two independent, unseen results of 70% or more, at least 7 days apart.

A later drop downgrades the topic. Any result below 50% creates a repair: diagnose what went wrong, choose a method, have a 30-minute session within 48 hours, then an unseen retest 2–4 days later, which closes the repair. Spaced review sessions are added when evidence says a check is due.

## Project layout

```
src/
  types/        domain types (all entities)
  data/         subject catalogue, subject-specific session templates, milestones
  utils/        Asia/Dhaka date utilities
  scheduling/   engine.ts (generation, priority), carryover.ts (missed work) — pure
  domain/       mastery, progress metrics, repair rules, evidence-based wins — pure
  db/           Dexie schema
  services/     transactional operations (plan, sessions, assess, topics, backup, demo, setup)
  hooks/        live queries
  components/   UI kit and session cards
  features/     screens: today, session, schedule, subjects, exams, assess, review, progress, resources, settings, setup
tests/          Vitest (pure logic + services on fake-indexeddb), e2e/smoke.cjs (Playwright)
```

Screens only call `services/*`, so a future sync backend can replace the Dexie calls behind that layer.

## Tests

- `npm test` runs **47 tests across 4 files, all passing**. They cover scheduling (valid dates, capacity, unavailable days, exam prioritisation, exam-day halving, regeneration that preserves work, no duplicates, exam-date changes), missed work (reconcile, the Add Maths shift, free-slot preference, the exam deadline, backlog), progress (Full/Steady/Light maths, day and week counts, evidence thresholds), mastery transitions, the full repair → retest flow, persistence across reopen, returning after several days, rest days, skip and quick-check, backup round-trip and rejection, Dhaka day boundaries, and Bangla topic parsing.
- `tests/e2e/smoke.cjs` is a Playwright walkthrough at 375 px in light and dark themes. It covers setup, a session, a score, marking, a reload, schedule, Bangla topics, progress, a repair, an exam entry, loading and clearing sample data, and an **offline reload**. It checks for no console errors and no horizontal overflow. Both themes pass.

## Implemented vs deferred

**Implemented:** all five tabs plus the secondary screens; setup; dated six-subject plan; subject-specific session loops (the Physics 90-minute loop and Paper 3 data skills kept); Full/Steady/Light; missed-work handling with backlog protection; rest day; week/month calendar with move, length, reorder, topic, type, skip, add session/test, unavailable days and refresh; exam timetable with validation and countdowns; exam-week mode; assessment entry with confidence, assistance, unseen flag, source labelling (generated practice is never shown as official) and photos; marking and correction workflow; error log; repair workflow; retests; evidence-based mastery; dashboards that keep activity, coverage, results and mastery separate; resources including NotebookLM links (links only, no sync); backup and restore; sample data with a banner; light and dark themes; installable offline PWA with a safe update prompt.

**Deferred / known limitations:**
- **No push/phone notifications.** Reminders are shown in-app only, so quiet hours are not exposed. Reliable scheduled notifications need a push server, and iOS limits them further.
- **No in-app question bank**, so answer-before-reveal applies to questions marked outside the app. Confidence is recorded *before* marks are entered. A personal question bank with attempt-before-reveal is the natural next feature.
- **No AI features.** The app works fully without any API.
- **No cross-device sync or accounts.**
- Separate planner/student roles were not built; everything is editable from one mode.
- Topics are per subject; papers are not linked to individual topics.
- Plan weights are heuristic and need tuning against real use.
- Shifting a missed session moves later topics back one slot. The topic pushed past the 56-day horizon returns when the plan extends, via the least-practised rule.
