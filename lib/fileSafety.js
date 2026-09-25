// Lightweight upload safety gate — no external AV service required.
//
// This is NOT a substitute for a real antivirus engine (see README's "File
// uploads" section for why: no ClamAV/VirusTotal wired up). What it *does*
// catch: someone renaming an executable/script to look like a document, or
// uploading something that has no business being a class submission.
//
// Two checks, applied in order:
//   1. Extension allowlist — only common document/archive/image/code/media
//      types are accepted at all.
//   2. Magic-byte sniffing — the file's actual leading bytes must match what
//      its extension claims (a .docx that isn't really a ZIP gets rejected),
//      and anything that looks like a Windows/Linux/macOS executable is
//      rejected outright regardless of what extension it was given.

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

const ALLOWED_EXTENSIONS = new Set([
  // documents
  "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "odt", "ods", "odp", "rtf",
  // plain text / data
  "txt", "md", "csv", "json", "xml", "yaml", "yml",
  // archives
  "zip", "rar", "7z",
  // images
  "png", "jpg", "jpeg", "gif", "webp", "bmp",
  // audio/video
  "mp3", "wav", "mp4", "mov",
  // common source code, for coding assignments
  "js", "jsx", "ts", "tsx", "py", "java", "c", "cpp", "h", "hpp", "cs", "go",
  "rb", "php", "html", "css", "sql", "sh", "ipynb",
]);

// Extensions we can verify against actual file content via magic bytes.
// Anything not listed here only goes through the extension allowlist above
// (plain text/source files don't have a reliable universal magic number).
const MAGIC_CHECKERS = {
  pdf: (buf) => matches(buf, [0x25, 0x50, 0x44, 0x46]), // %PDF
  zip: isZip,
  docx: isZip,
  pptx: isZip,
  xlsx: isZip,
  odt: isZip,
  ods: isZip,
  odp: isZip,
  png: (buf) => matches(buf, [0x89, 0x50, 0x4e, 0x47]),
  jpg: (buf) => matches(buf, [0xff, 0xd8, 0xff]),
  jpeg: (buf) => matches(buf, [0xff, 0xd8, 0xff]),
  gif: (buf) => matches(buf, [0x47, 0x49, 0x46, 0x38]), // GIF8
  rar: (buf) => matches(buf, [0x52, 0x61, 0x72, 0x21]), // Rar!
  "7z": (buf) => matches(buf, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]),
};

// Signatures of actual executables/scripts that must never pass, no matter
// what extension the upload claims to be.
const EXECUTABLE_SIGNATURES = [
  [0x4d, 0x5a], // MZ — Windows PE (.exe/.dll/.scr, etc.)
  [0x7f, 0x45, 0x4c, 0x46], // ELF — Linux binaries
  [0xca, 0xfe, 0xba, 0xbe], // Mach-O fat binary (macOS)
  [0xfe, 0xed, 0xfa, 0xce], // Mach-O 32-bit
  [0xfe, 0xed, 0xfa, 0xcf], // Mach-O 64-bit
  [0xce, 0xfa, 0xed, 0xfe], // Mach-O 32-bit reverse
  [0xcf, 0xfa, 0xed, 0xfe], // Mach-O 64-bit reverse
];

function matches(buf, signature) {
  if (buf.length < signature.length) return false;
  return signature.every((byte, i) => buf[i] === byte);
}

function isZip(buf) {
  // PK\x03\x04 (normal), PK\x05\x06 (empty archive), PK\x07\x08 (spanned)
  return (
    matches(buf, [0x50, 0x4b, 0x03, 0x04]) ||
    matches(buf, [0x50, 0x4b, 0x05, 0x06]) ||
    matches(buf, [0x50, 0x4b, 0x07, 0x08])
  );
}

function getExtension(filename) {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return "";
  return filename.slice(dot + 1).toLowerCase();
}

// Throws with a user-facing message if the file should be rejected.
// `buffer` must be the file's actual bytes (read once, reused for writing).
export function assertUploadIsSafe(filename, buffer) {
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File is too large (max ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB).`
    );
  }

  if (EXECUTABLE_SIGNATURES.some((sig) => matches(buffer, sig))) {
    throw new Error(
      "This file looks like an executable program, which isn't allowed as a submission."
    );
  }

  const ext = getExtension(filename);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(
      `".${ext || "unknown"}" files aren't allowed. Please submit a document, archive, image, or code file.`
    );
  }

  const magicCheck = MAGIC_CHECKERS[ext];
  if (magicCheck && !magicCheck(buffer)) {
    throw new Error(
      `This file's contents don't match a valid ".${ext}" file — it may be corrupted or mislabeled.`
    );
  }
}
