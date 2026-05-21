const multer = require("multer");
const path = require("path");
const { uploadBuffer } = require("./cloudinary");

// Use memory storage so we can stream to Cloudinary
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = [".png", ".jpg", ".jpeg", ".webp"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowed.includes(ext))
    return cb(new Error("Unsupported file type"), false);
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 4 * 1024 * 1024 },
});

// Middleware to upload single file buffer to Cloudinary and attach result to req.fileUploaded
async function uploadToCloud(req, res, next) {
  try {
    if (!req.file || !req.file.buffer) return next();
    const folder = process.env.CLOUDINARY_FOLDER || "brewmap/uploads";
    const result = await uploadBuffer(req.file.buffer, folder);
    req.fileUploaded = {
      url: result.secure_url,
      public_id: result.public_id,
      raw: result,
    };
    next();
  } catch (err) {
    next(err);
  }
}

// For multiple files
async function uploadMultipleToCloud(req, res, next) {
  try {
    if (!req.files || !req.files.length) return next();
    const folder = process.env.CLOUDINARY_FOLDER || "brewmap/uploads";
    const results = [];
    for (const f of req.files) {
      const r = await uploadBuffer(f.buffer, folder);
      results.push({ url: r.secure_url, public_id: r.public_id, raw: r });
    }
    req.filesUploaded = results;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { upload, uploadToCloud, uploadMultipleToCloud };
