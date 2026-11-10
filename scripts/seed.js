// Creates demo students so the matches feed has people in it.
// Usage: npm run seed   (safe to run again, it replaces the demo accounts)
//
// To see them as matches, sign up with any email at @nivasa-demo.ac.in
// and enter the hostel "Girls Hostel A". Demo logins use SEED_PASSWORD
// from .env (default in .env.example).
require('dotenv').config();

const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Match = require('../models/Match');

const DOMAIN = 'nivasa-demo.ac.in';
const HOSTEL = 'Girls Hostel A';
const PASSWORD = process.env.SEED_PASSWORD || 'hostel-demo-2026';

const STUDENTS = [
  { name: 'Sneha Nair', year: 2, branch: 'ECE',
    a: { room: 0, bed: 1, wake: 1, lights: 0, clean: 2, study: 0, friends: 1, sharing: 1, temp: 1, food: 1, smoke: 0, vibe: 1, top: 'bed' } },
  { name: 'Ananya Gupta', year: 1, branch: 'Mechanical',
    a: { room: 0, bed: 0, wake: 0, lights: 0, clean: 3, study: 0, friends: 0, sharing: 0, temp: 2, food: 0, smoke: 0, vibe: 0, top: 'clean' } },
  { name: 'Priya Menon', year: 3, branch: 'CSE',
    a: { room: 0, bed: 3, wake: 2, lights: 2, clean: 1, study: 2, friends: 2, sharing: 2, temp: 0, food: 2, smoke: 1, vibe: 2, top: 'friends' } },
  { name: 'Kavya Reddy', year: 2, branch: 'Civil',
    a: { room: 0, bed: 2, wake: 1, lights: 1, clean: 2, study: 1, friends: 1, sharing: 1, temp: 1, food: 2, smoke: 1, vibe: 1, top: 'study' } },
  { name: 'Ishita Joshi', year: 4, branch: 'Chemical',
    a: { room: 1, bed: 1, wake: 1, lights: 0, clean: 2, study: 0, friends: 1, sharing: 1, temp: 1, food: 0, smoke: 0, vibe: 1, top: 'lights' } },
  { name: 'Meghna Das', year: 2, branch: 'IT',
    a: { room: 0, bed: 2, wake: 2, lights: 1, clean: 1, study: 1, friends: 2, sharing: 2, temp: 0, food: 2, smoke: 2, vibe: 2, top: 'friends' } },
];

function emailFor(name) {
  return name.toLowerCase().replace(/[^a-z]+/g, '.') + '@' + DOMAIN;
}

async function seed() {
  await connectDB();

  const emails = STUDENTS.map((s) => emailFor(s.name));
  const old = await User.find({ email: { $in: emails } }, '_id');
  const oldIds = old.map((u) => u._id);
  await Promise.all([
    Profile.deleteMany({ user: { $in: oldIds } }),
    Match.deleteMany({ $or: [{ from: { $in: oldIds } }, { to: { $in: oldIds } }] }),
    User.deleteMany({ _id: { $in: oldIds } }),
  ]);

  for (const s of STUDENTS) {
    const user = new User({ name: s.name, email: emailFor(s.name), hostel: HOSTEL, year: s.year, branch: s.branch });
    await user.setPassword(PASSWORD);
    await user.save();
    await Profile.create({ user: user._id, answers: s.a, completedAt: new Date() });
    console.log('  created', user.email);
  }

  console.log('\nSeeded ' + STUDENTS.length + ' students in "' + HOSTEL + '" at ' + DOMAIN);
  console.log('Sign up with any @' + DOMAIN + ' email and hostel "' + HOSTEL + '" to match with them.');
  await disconnectDB();
}

seed().catch(async (err) => {
  console.error(err);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
