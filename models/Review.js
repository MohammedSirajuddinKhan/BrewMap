const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    cafe: { type: mongoose.Schema.Types.ObjectId, ref: "Cafe", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true },
    comment: { type: String, trim: true },
    images: [
      {
        url: String,
        public_id: String,
        width: Number,
        height: Number,
      },
    ],
  },
  { timestamps: true },
);

reviewSchema.index({ cafe: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("Review", reviewSchema);
