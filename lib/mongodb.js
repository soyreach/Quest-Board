import dns from "node:dns";
import mongoose from "mongoose";

// Force Node.js to use Google and Cloudflare DNS to fix the ESERVFAIL error
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "Missing MONGODB_URI. Add it to .env.local (see .env.local.example)."
  );
}

// In serverless environments (Vercel/Netlify functions), each invocation can
// spin up a new module scope, so we cache the connection on `global` to avoid
// exhausting MongoDB Atlas connection limits across warm invocations.
let cached = global._mongoose;

if (!cached) {
  cached = global._mongoose = { conn: null, promise: null };
}

export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        bufferCommands: false,
      })
      .then((mongooseInstance) => mongooseInstance);
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    // Don't cache a failed connect (e.g. a transient DNS error) — otherwise
    // every later request re-throws the same error until the server restarts.
    cached.promise = null;
    throw err;
  }
  return cached.conn;
}