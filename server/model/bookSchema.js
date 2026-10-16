const mongoose = require("mongoose")

const contributionRequestSchema = new mongoose.Schema({
    contributor: { type: mongoose.Schema.Types.ObjectId, ref: "USER" },
    count: { type: Number, required: true, min: 1 },
    description: String,
    department: String,
    image_url: String,
    submittedAt: { type: Date, default: Date.now },
});

const BookSchema = new mongoose.Schema({
    title: String,
    description: String,
    author: String,
    genre: String,
    department: String,
    count: { type: Number, default: 0, min: 0 },
    vendor: String,
    vendor_id: Number,
    publisher: String,
    publisher_id: String,
    image_url: { type: String, default: "/book-cover-placeholder.svg" },
    status: { type: String, enum: ["available", "pending"], default: "available", index: true },
    contributor: { type: mongoose.Schema.Types.ObjectId, ref: "USER" },
    submittedAt: { type: Date },
    contributionRequests: { type: [contributionRequestSchema], default: [] },
  });

module.exports = mongoose.model("Book", BookSchema, "Books");
