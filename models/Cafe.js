const mongoose = require("mongoose");

const cafeSchema = new mongoose.Schema(
  {
    placeId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    address: { type: String },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], index: "2dsphere" }, // [lng, lat]
    },
    types: [String],
    rating: { type: Number, min: 0, max: 5, default: 0 },
    ratingsTotal: { type: Number, default: 0 },
    priceLevel: { type: Number, min: 0, max: 4 },
    openNow: { type: Boolean, default: false },
    phone: String,
    website: String,
    photos: [
      {
        url: String,
        public_id: String,
        width: Number,
        height: Number,
      },
    ],
    amenities: {
      wifi: { type: Boolean, default: false },
      vegan: { type: Boolean, default: false },
      outdoorSeating: { type: Boolean, default: false },
      codingFriendly: { type: Boolean, default: false },
      quiet: { type: Boolean, default: false },
      fastInternet: { type: Boolean, default: false },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

cafeSchema.index({ name: "text", address: "text" });

module.exports = mongoose.model("Cafe", cafeSchema);
