# NIVASA: Project Synopsis (updated for Evaluation 2)

**Course:** CSE 2022 Web Programming · **Academic year:** 2026–27 · **Faculty:** Mr. Gautam Gupta, Mr. Govind Kumar Jha
**Team:** `[Team name]` · `[Member 1, roll no.]` · `[Member 2, roll no.]` · `[Member 3, roll no.]` · `[Member 4, roll no.]`
**Repository:** `[public GitHub link]`

> **Revised since Evaluation 1.** The scope changed from a general roommate and flat finder to
> **college hostel roommate matching**. See *What changed and why* at the end.

## 1. Problem definition

When students get a hostel room, roommates are usually decided by roll number or at random.
Every student in the hostel pays the same fee, so money is never the issue. The fights come from habits:
one person sleeps at 11pm and the other codes until 2am, one needs silence to study and the other takes
calls on speaker, one keeps the room spotless and the other doesn't. Students have no simple way to find
someone compatible before the allotment list is published.

## 2. Objectives and outcomes

| Objective | Measurable outcome |
|---|---|
| Capture the habits that matter in a shared room | A 13 question quiz (12 habits + "what matters most"), answered in about 3 minutes |
| Score how well two students would live together | A 0–100% match score that is the same in the browser and on the server |
| Never show impossible pairs | Room type (double or triple) and smoking are *must match*: a clash hides the pair completely |
| Explain every score | Each match card shows the habits both picked and one thing to talk about first |
| Keep it inside one college and hostel | Sign up only with a college email (`.ac.in` / `.edu`); you only see students in the same hostel |
| Let students agree to room together | Room requests: send, accept, decline, cancel; emails are shared only after both accept |

## 3. Methodology

**Approach:** project based, built in three phases that match the course evaluations.

| Layer | Technology | Used for |
|---|---|---|
| UI | HTML5 (semantic, accessible attributes), CSS (Grid, Flexbox, custom properties, light and dark theme) | Landing page, quiz, matches feed, login and signup |
| Logic | Vanilla JavaScript (DOM, events, `fetch`, `localStorage`, `IntersectionObserver`) | Quiz flow, live scoring, filters, card flip, form validation |
| Backend | Node.js, Express, Handlebars | JSON API, sessions, server rendered pages |
| Data | MongoDB with Mongoose | Users, quiz profiles, room requests |

**Matching algorithm** (`shared/engine.js`, used by both browser and server):

1. **Must match check:** different room type, or a smoker and a "smoke free please" student, means the pair is never shown.
2. **Similarity per habit:** `1 − |a − b| / (number of options − 1)`, so identical answers give 1 and opposite ends give 0.
3. **Weights:** bedtime ×3, cleanliness and study style ×2.5, friends ×2, wake up, lights, sharing and food ×1.5, fan and vibe ×1. The habit each student marks as "matters most" counts double *for them*.
4. **Mutual score:** `√(A→B × B→A)` (geometric mean), so a match is only high if it works for both students.

## 4. Feasibility and resource planning

- **Tools:** VS Code, Node.js 24, npm, MongoDB (embedded for development, Atlas for deployment), Git and GitHub, Figma `[confirm]`.
- **Cost:** none. Every tool and library is free and open source.
- **Risk: different hostel names.** Students may type their hostel name differently. *Mitigation:* the comparison ignores case, and the signup form asks students to copy the name exactly as the hostel office writes it.
- **Risk: fake accounts.** *Mitigation:* only college email domains can sign up. Email verification is a stretch goal.

## 5. Scope

**In scope:** quiz, scoring, matches feed with filters, room requests, accounts, light and dark theme, works on phones.
**Out of scope:** room allotment itself (the hostel office still decides), payments, chat.

## 6. What changed and why (since Evaluation 1)

| Before (Evaluation 1) | Now | Reason |
|---|---|---|
| General roommate and flat finder | College hostel roommate matching | A clear, real user group: students in our own hostel |
| Budget slider and budget overlap score | Removed | Everyone pays the same hostel fee |
| Questions on one long form | One question per screen, with a progress strip and a summary to edit answers | Easier on phones, and shows more DOM and event handling |
| — | Room type and smoking as must match rules | Some clashes can't be fixed by a good score elsewhere |
| — | Room requests with contact shared only after both accept | Privacy |
