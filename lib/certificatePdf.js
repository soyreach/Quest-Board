// Browser-only. Builds the certificate PDF without any library:
//   1. draw the student's details onto the blank template image (a <canvas>)
//   2. wrap that picture in a one-page A4-landscape PDF
// The template is public/certificate-template.png (the approved design with the
// sample name, signature and signer removed).

const W = 2000;
const H = 1414;
const GOLD = "#C99A3C";
const SCRIPT = '"Great Vibes", "Snell Roundhand", "Segoe Script", "Brush Script MT", Georgia, serif';
const SANS = 'Poppins, "Segoe UI", Arial, sans-serif';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the certificate template."));
    img.src = src;
  });
}

// Shrinks the font until the text fits the width, so long names never overflow.
function fit(ctx, text, weight, maxWidth, startPx, family, minPx = 36) {
  let px = startPx;
  while (px > minPx) {
    ctx.font = `${weight} ${px}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    px -= 4;
  }
  ctx.font = `${weight} ${px}px ${family}`;
}

async function drawCertificate({ recipientName, signerName, signerTitle, certId, issuedAt }) {
  // Fonts load from Google Fonts; give them a moment, then fall back gracefully.
  await Promise.all(
    [
      document.fonts.load('100px "Great Vibes"', `${recipientName}${signerName}`),
      document.fonts.load("600 40px Poppins"),
      document.fonts.load("400 40px Poppins"),
    ].map((p) => p.catch(() => null))
  );

  const img = await loadImage("/certificate-template.png");
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  // Student name: gold script, left-aligned on the gold line like the template.
  ctx.fillStyle = GOLD;
  ctx.textAlign = "left";
  fit(ctx, recipientName, "400", 940, 150, SCRIPT, 56);
  ctx.fillText(recipientName, 672, 690);

  // Signature (the signer's name in script) and printed name + title under the line.
  ctx.fillStyle = "#111111";
  ctx.textAlign = "center";
  fit(ctx, signerName, "400", 400, 84, SCRIPT, 40);
  ctx.fillText(signerName, 891, 1140);
  fit(ctx, signerName.toUpperCase(), "600", 440, 40, SANS, 22);
  ctx.fillText(signerName.toUpperCase(), 891, 1218);
  fit(ctx, signerTitle, "400", 440, 36, SANS, 20);
  ctx.fillText(signerTitle, 891, 1256);

  // Certificate id and date, small, bottom of the white area.
  const when = new Date(issuedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  ctx.fillStyle = "#6b6b6b";
  ctx.textAlign = "left";
  ctx.font = `400 26px ${SANS}`;
  ctx.fillText(`Certificate ID ${certId}   ·   Issued ${when}`, 668, 1318);

  return canvas;
}

function canvasToJpeg(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => (blob ? resolve(new Uint8Array(await blob.arrayBuffer())) : reject(new Error("Could not create the image."))),
      "image/jpeg",
      0.93
    );
  });
}

// Minimal PDF: catalog, pages, one A4-landscape page that shows the JPEG full-bleed.
function buildPdf(jpeg, title) {
  const enc = new TextEncoder();
  const chunks = [];
  const offsets = [];
  let size = 0;
  const push = (data) => {
    const bytes = typeof data === "string" ? enc.encode(data) : data;
    chunks.push(bytes);
    size += bytes.length;
  };
  const object = (n, body) => {
    offsets[n] = size;
    push(`${n} 0 obj\n${body}\nendobj\n`);
  };

  push(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>");

  offsets[4] = size;
  push(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
  );
  push(jpeg);
  push("\nendstream\nendobj\n");

  const content = "q\n842 0 0 595 0 0 cm\n/Im0 Do\nQ\n";
  object(5, `<< /Length ${content.length} >>\nstream\n${content}endstream`);
  const safeTitle = title.replace(/[^\x20-\x7e]/g, "").replace(/[()\\]/g, "");
  object(6, `<< /Title (${safeTitle}) /Producer (Quest Board) >>`);

  const xrefAt = size;
  let xref = "xref\n0 7\n0000000000 65535 f \n";
  for (let n = 1; n <= 6; n++) xref += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  push(`${xref}trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);

  return new Blob(chunks, { type: "application/pdf" });
}

export async function buildCertificatePdf(details) {
  const canvas = await drawCertificate(details);
  const jpeg = await canvasToJpeg(canvas);
  return buildPdf(jpeg, `Quest Board Certificate - ${details.recipientName}`);
}

// Builds the PDF and starts the browser download.
export async function downloadCertificatePdf(details) {
  const blob = await buildCertificatePdf(details);
  const safeName = details.recipientName.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "Student";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Quest-Board-Certificate-${safeName}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
