import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { assertUploadIsSafe } from "@/lib/fileSafety";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// Saves a File object (from a Request's FormData) to public/uploads and
// returns the public URL + original filename to store on a document.
//
// Before writing anything, the file is run through assertUploadIsSafe() —
// see lib/fileSafety.js. It throws for disallowed file types or files whose
// content doesn't match their claimed type, so callers should expect this to
// reject (let the error surface as a 400 to the client).
//
// This writes to local disk, which only makes sense for local dev/grading —
// it will NOT persist on serverless hosts like Vercel/Netlify (their
// filesystems are read-only/ephemeral in production). If this ever needs to
// be actually hosted, swap this for an object-storage upload (S3, Cloudinary,
// Vercel Blob, etc.) instead.
export async function saveUploadedFile(file) {
  if (!file || typeof file.arrayBuffer !== "function") return null;

  const buffer = Buffer.from(await file.arrayBuffer());
  assertUploadIsSafe(file.name, buffer);

  await mkdir(UPLOAD_DIR, { recursive: true });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

  await writeFile(path.join(UPLOAD_DIR, filename), buffer);

  return { url: `/uploads/${filename}`, name: file.name };
}
