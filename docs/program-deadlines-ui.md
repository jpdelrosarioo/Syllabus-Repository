# Program deadline UI prototype

Based on `System-Improvement` commit `4e65dda3fc8551171a3f9de785836242f0bb4c93`, following `claude-program-deadlines-ui.md` and the v1.37.0 changelog.

## Scope and preview

This is a UI prototype, not an operational deadline service. No backend routes, migrations, persistence, scheduled jobs, email or real notification delivery were added. All deadline mutations use a small in-memory adapter. Refresh/logout resets them; the provider is keyed by account identity. Existing permissions, draft locking, builder validation, AI checking, approval, messaging, and immutable history remain authoritative.

Run `npm ci` and `npm run dev`, then open `/tests/deadlines-preview.html`. The preview uses synthetic faculty, subject and program identities and blocks fetch requests. It includes administrator/faculty selection, English/Tagalog, empty/populated data, reset and fail-next-action controls. Its notification preview is separate from the authenticated notification bell, with no read markers or unread counts written to account notifications.

In the signed-in application, Program & Subjects has the new actions on actual program rows. Subject names are read from its existing catalog response. The in-memory deadline store starts empty; it does **not** insert synthetic faculty into a real program. Assignment previews explicitly report unavailable assignment data rather than presenting unknown requirements as complete. Faculty dashboards therefore remain empty until a replacement adapter supplies period-scoped assignment/deadline data. The populated end-to-end UI is reviewable through the isolated preview above.

## Layout and reusable components

- Program row: period selector, Philippine due date, Set Deadline, Edit Deadline, View Progress and Cancel Deadline, alongside the existing Rename/Delete actions.
- Form: selected program, school year, semester, Philippine-time date/time, optional original-language instructions, affected subjects/faculty, inline errors, saving, retry and success states. One active deadline per program/year/semester. Cancellation requires confirmation.
- Progress: faculty/subject-pair rows; submitted/pending/overdue totals; unassigned subjects separately. Cancelled periods retain their context without overdue obligations.
- Dashboard: assignment-specific entries in the existing fixed-height, hidden-scrollbar card. No wheel interception or global sizing changes.
- Notifications: isolated preview using existing thread/notification styles and shared icons; created/updated/cancelled/reminder entries open their deadline context, including a cancelled period.
- Reuses `StableButton`, catalog portal, modal layer/focus stack, catalog motion, existing badges/input/table/card styles and `phTime.js`. New styles are feature-scoped; all 66 new strings use centralized bilingual dictionaries.

## Data rules

`model.js` joins assignments to subjects and deadlines using stable IDs plus exact school year and semester. A program-only assignment creates no requirement. Multiple faculty assigned the same subject each have one requirement; duplicate assignment rows are deduplicated. Unassigned subjects do not inflate pending/overdue totals.

Only the earliest `kind: initial` submission for the exact faculty/subject/period is used. Revision events and approval status do not affect submission completion. Submission at the due instant is on time; later submission is late. Missing submissions become overdue only after the due instant. Due-today boundaries and display use Philippine time independently of the browser timezone. The displayed clock refreshes every ten seconds while mounted.

## Files

- `src/features/deadlines/`: replaceable adapter, pure rules, provider, reusable feature UI, scoped CSS, isolated fixtures and domain tests.
- `src/i18n/deadlines.js`, `src/i18n/index.js`: English/Tagalog labels and stable button sizing integration.
- `src/components/ProgramManagement.jsx`, `src/views/CourseOutcomes.jsx`: per-program actions and existing catalog subject preview.
- `src/views/DashboardView.jsx`: replaces fixed sample dates.
- `src/App.jsx`, `src/main.jsx`: account-scoped provider and stylesheet.
- `tests/deadlines-preview.*`, `scripts/test-deadlines-browser.mjs`: isolated visual fixture and optional browser checks.
- `package.json`: deadline domain tests in the existing test command; no new application dependency.

## Future API integration points — proposed, not implemented

Replace `createDeadlineAdapter` with an authenticated adapter exposing `load()`, `save(form)` and `cancel(id)` and returning the same snapshot shape. Suggested endpoints:

- `GET /api/deadlines?programId=&schoolYear=&semester=` — role-filtered deadline records.
- `POST /api/programs/:id/deadlines` and `PATCH /api/deadlines/:id` — administrator-only validated period/due time/instructions, with optimistic version checks and a unique active program/year/semester constraint.
- `POST /api/deadlines/:id/cancel` — idempotent cancellation preserving history.
- `GET /api/deadlines/:id/progress` — authoritative period-scoped faculty/subject assignments, original submission timestamps and unassigned subjects. Faculty must see only their own requirements; administrators may see program progress.

The current builder does not expose a reliable deadline-period prefill/link contract. The prototype opens its existing entry point with an explicit instruction to choose the assigned subject and check the period; it never invents syllabus IDs or matches submissions by course code alone. Before wiring production navigation, establish a stable `facultyId + courseId + schoolYear + semester` association and return an authorized existing syllabus target when available. Initial and revision schedules need distinct types.

A future notification service should create deduplicated deadline events after transactions commit, validate recipients from period assignments, and add a deadline-context route. Reminder scheduling, delivery, retries and read-state handling belong to that later backend work. Do not connect this preview array to the existing account notification API.

## Verification

- `TZ=Asia/Manila npm test`: 474 passing checks (429 domain/API checks including 15 new deadline tests, 22 localization checks, 23 rendered UI checks).
- New deadline tests also pass under the default UTC timezone, including Philippine midnight, initial-vs-revision, late submission, multiple assignments, cancellation, period isolation and adapter failure/retry.
- `npm run audit:i18n`: 1,668 bilingual keys; no hardcoded interface labels.
- `npm run build`: passes; retains the pre-existing bundle-size warning.
- A default-UTC full run exposes a pre-existing assertion in `src/lib/complianceView.test.js:197` that uses local `getDate()` for a Philippine instant; it passes with `TZ=Asia/Manila`. No unrelated date code was changed.

Optional browser checks need Playwright and an installed Chromium (external test tools, not application dependencies):

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs CHROMIUM_PATH=/absolute/path/to/chromium node scripts/test-deadlines-browser.mjs
```

The script starts/stops its own local Vite server and verifies that the fixture makes no backend requests. Set `DEADLINE_SCREENSHOTS` to an existing directory to capture progress and narrow Tagalog form screenshots. Mobile inspection isolates the feature surfaces from the existing desktop shell; it does not claim a redesign or full mobile certification of the whole application.

Browser verification passed 11 interaction groups in Chromium, including a browser timezone of America/Los_Angeles: both roles and languages, empty/populated data, failed-save recovery, inline validation/duplicate prevention, separate periods, deadline status recalculation, cancellation, all four notification contexts, no-assignment faculty, stable dashboard card heights, a 390px Tagalog modal, keyboard focus trapping/restoration, reduced motion, and zero API requests/runtime errors. Administrator form/progress and narrow Tagalog screenshots were visually inspected.
