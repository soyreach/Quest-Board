// A real, deterministic similarity measure — not an LLM's guess. Splits
// text into overlapping 8-word shingles and computes the Jaccard index
// (overlap / union) between two texts' shingle sets. Good at catching
// copy-pasted or lightly-reworded content; it will NOT catch someone who
// genuinely rewrites logic in different words/structure — that's a real
// limitation of this simple approach, not a bug.
function shingles(text, size = 8) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const set = new Set();
  for (let i = 0; i <= words.length - size; i++) {
    set.add(words.slice(i, i + size).join(" "));
  }
  return set;
}

export function textSimilarityPercent(textA, textB) {
  const a = shingles(textA);
  const b = shingles(textB);
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const shingle of a) {
    if (b.has(shingle)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return Math.round((intersection / union) * 100);
}
