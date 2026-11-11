const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Only college emails can sign up; the domain groups students by college
const COLLEGE_EMAIL = /^[^\s@]+@([^\s@]+\.(?:ac\.in|edu|edu\.in))$/i;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [COLLEGE_EMAIL, 'Use your college email, the one ending in .ac.in or .edu.'],
    },
    passwordHash: { type: String, required: true, select: false },
    collegeDomain: { type: String, required: true, index: true },
    hostel: { type: String, required: true, trim: true, maxlength: 60 },
    year: { type: Number, required: true, min: 1, max: 5 },
    branch: { type: String, required: true, trim: true, maxlength: 40 },
  },
  { timestamps: true }
);

// Students only ever see others from the same college and hostel
userSchema.index({ collegeDomain: 1, hostel: 1 });

userSchema.pre('validate', function setDomain(next) {
  const m = COLLEGE_EMAIL.exec(this.email || '');
  if (m) this.collegeDomain = m[1].toLowerCase();
  next();
});

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 12);
};

userSchema.methods.checkPassword = function checkPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    hostel: this.hostel,
    year: this.year,
    branch: this.branch,
  };
};

userSchema.statics.COLLEGE_EMAIL = COLLEGE_EMAIL;

module.exports = mongoose.model('User', userSchema);
