const mongoose = require("mongoose");

const favoriteSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    cafe: { type: mongoose.Schema.Types.ObjectId, ref: "Cafe", required: true },
  },
  { timestamps: true },
);

favoriteSchema.index({ user: 1, cafe: 1 }, { unique: true });

module.exports = mongoose.model("Favorite", favoriteSchema);
