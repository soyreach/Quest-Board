# Quest Board

A gamified, closed-loop university project board: professors post quests,
students complete them for bounty points, an AI sidekick gives Socratic (not
solution) help along the way, and professors review + award points on
submission. Built with Next.js App Router, MongoDB Atlas/Mongoose, Auth.js,
Tailwind, and the Vercel AI SDK running on Gemini.

## What's real right now

- **`/login`** — sign up with username, email, and password. A radio button
  picks Student or Professor; picking Professor reveals a verification-code
  field checked against `PROFESSOR_SECRET_CODE`. Wrong code → no account,
  plain error message. Role is permanent once created.
- **`/board`** — fetches live, non-expired quests from MongoDB. A quest
  disappears from a given student's board once they've been approved on it
  (see "Visibility rules" below), and from everyone's board once its deadline
  passes. Turning in work is a real file upload (drag-and-drop or browse),
  not a text link.
- **`/ai-sidekick`** — a real streaming chat against `/api/ai/sidekick`
  (Gemini) using `useChat`, with a real conversation history sidebar backed
  by MongoDB (`ChatThread` model) — start new chats, switch between past
  ones, delete them, and every exchange is saved so it survives a refresh.
  The Socratic guardrail is a system-prompt instruction, not a hard filter.
- **`/student/dashboard`** — real point total, tier badge, certificate
  progress, and submissions split into pending vs. approved — including
  links to both the file the student uploaded and anything the professor
  sent back.
- **`/professor/dashboard`** — convert a syllabus excerpt with AI, set a
  deadline and attach a rubric file/image, then pin the quest. Posted quests
  can be edited afterward (deadline, attachment) via an Edit button. The
  review queue shows each student's uploaded file, lets the professor write
  a comment and attach a file back, and Approve/Request Revision actually
  awards points.

## Visibility rules

Two independent things make a quest drop off the board:

1. **Deadline passed** — hidden from *everyone's* board (professors still see
   it, marked "Expired," under their own posted-quests list, since they need
   to manage it).
2. **This student has been approved on it** — hidden from *that student's*
   board only. It stays visible to every other student who hasn't completed
   it yet. Submitting work does **not** hide a quest by itself — only an
   actual professor approval does, per spec. So if a submission is still
   pending or sent back for revision, the quest stays visible (which is
   intentional — it lets the student find it again to resubmit).

## File uploads — how they're stored

Every upload (student submissions, professor feedback files, quest
attachments) is saved to `public/uploads/` on local disk via
`lib/upload.js`, and referenced by a `/uploads/<file>` URL in MongoDB.

**This only works for local development, not hosting.** Serverless platforms
(Vercel, Netlify) have ephemeral/read-only filesystems in production — files
written there vanish or fail to write at all. Since this project is meant to
run locally for grading rather than be deployed, that's fine as-is. If it
ever needs to actually go live, swap `lib/upload.js` for an object-storage
upload (S3, Cloudinary, Vercel Blob, etc.) instead — every place that calls
`saveUploadedFile()` would keep working the same way, just pointed at a
different backend.

`public/uploads/` is git-ignored so uploaded files don't get committed.

## Role-based navigation

The nav bar only shows "Student hub" to Students and "Faculty hub" to
Professors (`components/Nav.jsx`). This is a UI convenience, not the real
security boundary — `middleware.js` is what actually blocks the wrong role
from loading those pages/routes even if someone types the URL directly.

## How sign-up/sign-in works

A from-scratch username + email + password system (NextAuth's Credentials
provider), not OAuth — no external service to configure.

- **Sign up**: username, email, password, Student/Professor radio. Passwords
  are bcrypt-hashed, never stored in plain text.
- **The Professor gate**: the code is checked server-side against
  `PROFESSOR_SECRET_CODE`. Wrong code → account isn't created, and the error
  never hints at what the real code is.
- **Sign in**: plain email + password — role was locked in at sign-up.
- To test both roles, register two separate accounts.

## Project layout

```
quest-board/
├── app/
│   ├── page.jsx                          # landing page
│   ├── login/page.jsx                    # sign-up / sign-in, role radio + professor code
│   ├── board/
│   │   ├── page.jsx                      # Server Component — fetches initial quests before render
│   │   ├── loading.jsx                   # instant skeleton shown during navigation
│   │   └── BoardClient.jsx               # corkboard, filters, file-upload submission modal
│   ├── ai-sidekick/page.jsx              # streaming chat + persisted thread history sidebar
│   ├── student/dashboard/
│   │   ├── page.jsx                      # Server Component — fetches profile + submissions before render
│   │   ├── loading.jsx
│   │   └── StudentDashboardClient.jsx
│   ├── professor/dashboard/
│   │   ├── page.jsx                      # Server Component — fetches quests + review queue before render
│   │   ├── loading.jsx
│   │   └── ProfessorDashboardClient.jsx  # create/edit quests, review queue
│   ├── layout.js, providers.jsx, globals.css
│   └── api/
│       ├── auth/[...nextauth]/route.js   # NextAuth handler (Credentials provider)
│       ├── auth/register/route.js        # POST — create account, enforces professor code
│       ├── user/me/route.js              # GET  — current user's own doc
│       ├── quests/route.js               # GET (public/active, filtered) / (?mine=true), POST (create, multipart)
│       ├── quests/[id]/route.js          # PATCH — edit deadline/attachment (professor, own quest only)
│       ├── submissions/route.js          # GET (?scope=mine or professor queue), POST (create, multipart file upload)
│       ├── submissions/[id]/route.js     # PATCH — approve/revise + optional feedback file (multipart)
│       ├── sidekick/threads/route.js     # GET (list), POST (create) chat threads
│       ├── sidekick/threads/[id]/route.js# GET, PUT (save messages), DELETE a thread
│       └── ai/
│           ├── convert-syllabus/route.js # Gemini: syllabus -> quest JSON
│           ├── sidekick/route.js         # Gemini: streaming Socratic chat
│           └── pre-grade/route.js        # feedback + real similarity check + AI-content heuristic
├── components/Nav.jsx                    # role-filtered nav links
├── lib/{mongodb.js, auth.js, upload.js, queries.js, savedAccounts.js, textExtract.js, similarity.js}
├── models/{User.js, Quest.js, Submission.js, ChatThread.js}
├── middleware.js                         # real role-based route protection
├── jsconfig.json                         # enables the @/ import alias
├── tailwind.config.js, postcss.config.js
├── package.json
├── .gitignore
└── .env.local.example
```

## Why /board, /student/dashboard, and /professor/dashboard are split in two

These three used to be single client components that fetched their own data
in a `useEffect` after the page had already rendered — page loads empty,
then a fetch happens, then content pops in. That round trip is real network
time the user waits through *after* the page is already visible, which is
what actually caused most of the perceived slowness (separately from
Next.js dev-mode compile time, which `--turbo` in `package.json`'s dev
script addresses).

Each of these routes is now two files:

- **`page.jsx`** — a Server Component. It runs on the server, calls the
  shared functions in `lib/queries.js` directly (no HTTP round trip to its
  own API), and passes the resulting data as props. This data is already
  baked into the HTML the moment the page arrives in the browser — no
  loading spinner, no empty-then-pop-in.
- **`*Client.jsx`** — a Client Component holding all the interactivity
  (filters, modals, forms, buttons). It receives the server-fetched data as
  its *initial* state and only calls the `/api/...` routes again when
  something actually changes afterward (a filter, a form submission, an
  approve/revise action) — which is a normal, expected re-fetch after a user
  action, not the "empty page waiting on data" pattern from before.

`lib/queries.js` holds the actual filtering/visibility logic (deadline
expiry, per-student approved-quest hiding, etc.) in exactly one place — both
the Server Components above and the `/api/quests` and `/api/submissions`
routes call the same functions, so there's no duplicated logic to keep in
sync.

**One trade-off this introduces:** a Server Component has to finish its data
fetch before Next.js sends anything back for that navigation — including
the URL and nav-bar highlight update. Without a `loading.jsx` file, that
means the old page (and old highlighted nav link) just sits frozen for
however long the fetch takes, which reads as "slow" even when the actual
delay is only a few hundred ms. Each of the three routes above has a
`loading.jsx` file specifically to fix this: Next.js treats it as a route's
Suspense fallback, so it updates the URL/nav-highlight and shows that
skeleton *immediately* on click, then swaps in the real content the moment
the data arrives — instead of everything staying frozen until the whole
page is ready.

## Setup

1. `npm install`
2. Copy `.env.local.example` to `.env.local` and fill in:
   - `MONGODB_URI` — MongoDB Atlas connection string, with an explicit
     database name in the path (e.g. `.../quest-board?...`) — don't leave it
     blank, or Mongo silently defaults to a `test` database that may already
     have unrelated data/indexes in it
   - `NEXTAUTH_SECRET` — `openssl rand -base64 32`
   - `PROFESSOR_SECRET_CODE` — any string you choose
   - `GOOGLE_GENERATIVE_AI_API_KEY` — from Google AI Studio
3. `npm run dev` and open `http://localhost:3000`

First run: sign up as a Professor (with the code), post a quest with a
deadline a few days out, sign up a second account as a Student, submit a
file against it, then flip back to the Professor account to approve it and
watch it disappear from that student's board.

## Account switcher

The nav bar has a "Switch account" button next to Sign out. It lists every
account you've signed into on this browser and lets you switch with one
click, no retyping a password.

**How it works, and the trade-off that comes with it:** `lib/savedAccounts.js`
stores each account's email and **password in plain text** in the browser's
`localStorage` the moment you sign in successfully. That's a real security
compromise — anyone with access to this browser profile could read those
passwords. It's only reasonable here because this project runs locally for
grading/demo rather than being hosted for real users. Don't reuse this
pattern anywhere real accounts are involved.

## The AI pre-check, honestly

"Run AI pre-check" in the review queue does three distinct things, with
different levels of reliability:

1. **AI feedback + score** — Gemini reads the actual submitted file and
   writes real, specific feedback (3-5 sentences) plus a rough preliminary
   score and flag count. This is genuinely useful as a first read, but it's
   still one LLM's opinion, not a grade.
2. **Similarity check — real, not AI-guessed.** This compares the submitted
   file's text against every *other* submission for the *same quest*, using
   an actual computed text-overlap algorithm (`lib/similarity.js` — shingled
   Jaccard similarity), and reports the closest match and which student it
   resembles. It will reliably catch copy-pasted or lightly-reworded content.
   It will **not** catch someone who genuinely rewrites the logic in
   different words/structure — that's a real limitation of this simple
   approach, not a bug to fix casually (proper plagiarism detection is a
   much deeper problem).
3. **AI-content likelihood — a heuristic guess, not a detector.** Gemini is
   asked to estimate whether the writing reads as AI-generated. This is
   explicitly **not** equivalent to a real detector like Turnitin's or
   GPTZero's, which use specialized models — it's one LLM's impression of
   another (possibly AI-written) text, and that kind of self-assessment is
   known to be unreliable in both directions (false positives on genuine
   human writing, false negatives on AI writing that's been lightly edited).
   Treat it as a conversation-starter with a student, never as evidence on
   its own.

**File type limits:** all three checks require being able to read the file
as text. Supported: code files (`.py`, `.js`, `.java`, `.c`, `.cpp`, etc.),
`.ipynb` notebooks (code/markdown cells only, not raw notebook JSON), plain
text/markdown/JSON/CSV/HTML/CSS, `.pdf` (via `pdf-parse`), and `.docx` (via
`mammoth`, raw text only — formatting, images, and tables inside the doc are
not considered). `.zip`, images, and other binaries still aren't (see
`lib/textExtract.js` for the exact list) — pre-check honestly reports "can't
auto-check this file type" for those rather than fabricating a score.

## Known gaps / simplifications

- **Files live on local disk, not cloud storage** — see "File uploads" above.
  Fine for local grading, not fine for hosting as-is.
- **No lockout on wrong professor-code attempts** — someone could brute-force
  `PROFESSOR_SECRET_CODE` by spamming sign-ups. Not addressed here; add
  rate-limiting on `/api/auth/register` if this needs to be more robust.
- **Resume bullets aren't AI-generated** — the Copy button on a completed
  quest builds a plain templated sentence, not real STAR-format AI output.
- **The sidekick isn't linked to a specific quest** — `sidekick/route.js`
  already accepts `questId`/`studentDraft` for exactly this, the page just
  isn't passing them yet.
- **Socratic/no-direct-solutions guardrail is a prompt instruction**, not an
  enforced filter.
- **Editing a posted quest** currently only covers deadline and attachment —
  not title/description/rubric/points. Extend `quests/[id]/route.js` and the
  edit modal in the professor dashboard if you need more fields editable.
- **Bounty points formula:** `estimatedHours * 25 * tierMultiplier`
  (1 / 1.3 / 1.6 for Apprentice / Journeyman / Master).

## Deployment

Both Vercel and Netlify support Next.js API routes as serverless functions
— but see "File uploads" above before deploying, since the current upload
mechanism won't work as-is on either platform.
