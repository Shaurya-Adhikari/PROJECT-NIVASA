# Contributing to NIVASA

How the team works on this repository.

## Branches

`main` is always working and protected: nobody pushes to it directly.
Every change goes on its own short-lived branch and comes back through a pull
request.

| Prefix | Use it for | Example |
| --- | --- | --- |
| `feat/` | A new feature | `feat/quiz`, `feat/login` |
| `fix/` | A bug fix | `fix/flip-card-mobile` |
| `docs/` | README or docs only | `docs/api-table` |
| `test/` | Tests only | `test/api-signup` |
| `ci/` | GitHub Actions and tooling | `ci/node-24` |

Branches are deleted automatically after they are merged.

## Commit messages

Short, present tense, starting with the type:

```
feat: room request panel with accept and decline
fix: keep the flipped card's height on mobile
docs: worked example of the matching score
test: smoker and smoke free pair is blocked
```

Add a body when the *why* isn't obvious from the title.

## Pull requests

1. Pull the latest `main` and branch from it.
2. Run `npm test` before pushing.
3. Open a pull request and fill in the template.
4. Tests run automatically; a pull request is merged only when they pass and
   a teammate has reviewed it.

## Code style

- Plain JavaScript, no build step. Two space indentation, single quotes,
  semicolons.
- Scoring logic lives only in `shared/engine.js` so the server and the
  browser always agree. Don't copy it into controllers or page scripts.
- Colours and spacing come from the CSS tokens at the top of
  `public/css/styles.css`; don't hard code new values.
- Every interactive element needs a visible focus state and a label.
