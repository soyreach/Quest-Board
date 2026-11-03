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

// dns.setServers only covers the SRV lookup. Each new connection then resolves
// its host through dns.lookup, i.e. the OS resolver, and a slow router there
// stalls whichever page opened the connection for 10+ seconds. Use the same
// servers for those too, and only fall back to the OS if they fail.
function lookup(hostname, options, callback) {
  dns.resolve4(hostname, (err, addresses) => {
    if (err) return dns.lookup(hostname, options, callback);
    if (options.all) return callback(null, addresses.map((address) => ({ address, family: 4 })));
    callback(null, addresses[0], 4);
  });
}

export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        bufferCommands: false,
        lookup,
        // Pages run several queries at once; keep connections ready for them.
        minPoolSize: 5,
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