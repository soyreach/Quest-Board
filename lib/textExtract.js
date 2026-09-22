import { readFile } from "fs/promises";
import path from "path";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

// Plain-text-ish files we can read directly.
const TEXT_EXTENSIONS = [
  ".py", ".txt", ".md", ".js", ".jsx", ".ts", ".tsx",
  ".json", ".csv", ".html", ".css", ".java", ".c", ".cpp", ".ipynb",
];

// Binary formats we extract text FROM, rather than read as text directly.
const BINARY_EXTRACTORS = {
  ".pdf": async (buffer) => (await pdfParse(buffer)).text,
  ".docx": async (buffer) => (await mammoth.extractRawText({ buffer })).value,
};

export async function extractTextFromUpload(fileUrl) {
  if (!fileUrl) return null;
  const ext = path.extname(fileUrl).toLowerCase();
  const filePath = path.join(process.cwd(), "public", fileUrl);

  try {
    if (BINARY_EXTRACTORS[ext]) {
      const buffer = await readFile(filePath); // no encoding — raw bytes
      return await BINARY_EXTRACTORS[ext](buffer);
    }

    if (!TEXT_EXTENSIONS.includes(ext)) return null;

    const raw = await readFile(filePath, "utf-8");

    if (ext === ".ipynb") {
      // Pull code + markdown cell text out of the notebook JSON rather than
      // comparing raw JSON structure (which would make every notebook look
      // "similar" just from shared formatting).
      const notebook = JSON.parse(raw);
      return (notebook.cells || [])
        .map((cell) => (Array.isArray(cell.source) ? cell.source.join("") : cell.source || ""))
        .join("\n");
    }

    return raw;
  } catch (err) {
    console.error("extractTextFromUpload failed:", err);
    return null;
  }
}

