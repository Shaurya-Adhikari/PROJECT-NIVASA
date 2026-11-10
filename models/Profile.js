const mongoose = require('mongoose');
const { QUESTIONS, TOP_IDS } = require('../shared/engine');

// One numeric field per quiz card, bounded by that card's option count
const answerFields = {};
QUESTIONS.forEach((q) => {
  answerFields[q.id] = { type: Number, min: 0, max: q.options.length - 1, validate: Number.isInteger };
});
answerFields.top = { type: String, enum: TOP_IDS };

const profileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    answers: { type: new mongoose.Schema(answerFields, { _id: false }), default: () => ({}) },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

profileSchema.methods.answeredCount = function answeredCount() {
  const a = this.answers ? this.answers.toObject() : {};
  return QUESTIONS.filter((q) => a[q.id] != null).length;
};

module.exports = mongoose.model('Profile', profileSchema);
