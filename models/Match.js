const mongoose = require('mongoose');

// A room request between two students. Created as "pending" by the sender;
// the recipient accepts or declines, the sender can cancel while pending.
const matchSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'cancelled'],
      default: 'pending',
    },
    scoreAtRequest: { type: Number, min: 0, max: 100 },
    respondedAt: { type: Date },
  },
  { timestamps: true }
);

// One request per direction per pair
matchSchema.index({ from: 1, to: 1 }, { unique: true });

module.exports = mongoose.model('Match', matchSchema);
