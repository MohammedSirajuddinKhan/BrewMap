const mongoose = require("mongoose");

const collectionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    cafes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Cafe" }],
    private: { type: Boolean, default: true },
  },
  { timestamps: true },
);

collectionSchema.index({ user: 1, title: 1 }, { unique: true });

module.exports = mongoose.model("Collection", collectionSchema);
