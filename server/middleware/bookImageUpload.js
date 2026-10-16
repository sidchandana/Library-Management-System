const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const uploadDirectory = path.resolve(__dirname, "../uploads");
fs.mkdirSync(uploadDirectory, { recursive: true });

const extensions = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (req, file, callback) => {
      callback(null, `${crypto.randomUUID()}${extensions[file.mimetype] || ""}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!extensions[file.mimetype]) {
      return callback(new Error("Upload a JPG, PNG, WEBP, or GIF image."));
    }
    callback(null, true);
  },
});

module.exports = upload;
