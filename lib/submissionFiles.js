// A submission (or one of its history entries) can carry several files in
// `files`. Ones saved before multi-file uploads only have fileUrl/fileName,
// so fall back to that single file. Safe to import on the client.
export function filesOf(doc) {
  if (doc?.files?.length) return doc.files;
  return doc?.fileUrl ? [{ url: doc.fileUrl, name: doc.fileName }] : [];
}
