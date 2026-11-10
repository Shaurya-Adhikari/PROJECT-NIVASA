# NIVASA

Hostel roommate matching for college students. Students answer 13 quick cards
(sleep, study, cleanliness, room rules) and see which students in the same
college and hostel they would get along with, then send room requests.

## Run it

```bash
npm install
npm run seed     # optional: adds 6 demo students
npm run dev      # http://localhost:3000
```

No MongoDB install is needed for development: without `MONGO_URI` the server
starts an embedded MongoDB that keeps its data in `.data/db`. To use Atlas or
a local `mongod`, copy `.env.example` to `.env` and set `MONGO_URI`.

To see the demo students as matches, sign up with any `@nivasa-demo.ac.in`
email and hostel `Girls Hostel A`.

```bash
npm test         # compatibility engine tests
```

## How matching works

The engine lives in `shared/engine.js` and runs on both the server and the
browser, so scores always agree.

1. **Must match cards** (room type, smoking) never add points. If they
   conflict, the pair is hidden from both feeds.
2. **Habit cards** score from 0 to 1 by distance: `1 − |a − b| / (options − 1)`.
3. **Weights**: bedtime 3, cleanliness 2.5, study 2.5, friends 2, wake up,
   lights, sharing and food 1.5, fan and vibe 1. Each person's "matters most"
   pick counts double for them.
4. **Mutual score** is the geometric mean of both directions,
   `√(A→B × B→A)`, so a match is only high if it works for both students.

## API

| Method | Path | What it does |
| --- | --- | --- |
| POST | `/api/auth/signup` | Create account (college email only), optional `answers` |
| POST | `/api/auth/login` | Log in |
| POST | `/api/auth/logout` | Log out |
| GET | `/api/me` | Signed in user and saved answers |
| GET | `/api/quiz` | Question set |
| PUT | `/api/quiz` | Save answers `{ answers: { bed: 1 } }`, `null` clears a card |
| GET | `/api/matches?filter=` | Scored students in your hostel. Filters: `night`, `early`, `tidy`, `silent`, `top` |
| GET | `/api/requests` | Incoming and outgoing room requests |
| POST | `/api/requests` | Send a request `{ to: userId }` |
| PATCH | `/api/requests/:id` | `{ status: "accepted" \| "declined" \| "cancelled" }` |

Emails are only shared after both students accept.

## Structure

```
server.js              Express app: views, security headers, sessions, routes
config/db.js           MongoDB connection (embedded fallback in development)
models/                User, Profile (quiz answers), Match (room requests)
controllers/           auth, quiz, matches and requests handlers
middleware/            auth guards, error handling
routes/                api.js (JSON), pages.js (Handlebars pages)
shared/engine.js       Questions and compatibility engine (server + browser)
views/                 Handlebars layout, partials, home, login, signup, 404
public/                CSS and browser JS
scripts/seed.js        Demo students
tests/                 Engine tests (node --test)
```
