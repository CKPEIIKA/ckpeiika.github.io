// Text measuring and word wrapping shared by the renderer and layout (no imports).

// About the advance of the chalk handwriting font, in em per character.
export const estimateTextWidth = (text) => Array.from(String(text)).length * 0.52;

// Greedy word wrapping: lines no wider than maxWidth (a long single word stays alone).
export function wrapTextLines(text, maxWidth, measure = estimateTextWidth) {
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && measure(candidate) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}
