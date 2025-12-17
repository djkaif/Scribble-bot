import fs from "fs";

// Ensure words.txt exists in the root directory
const WORDS = fs
  .readFileSync("words.txt", "utf8")
  .split(/\r?\n/)
  .map(w => w.trim())
  .filter(Boolean);

export function getRandomWord() {
  if (!WORDS.length) return "apple";
  return WORDS[Math.floor(Math.random() * WORDS.length)].toLowerCase();
}

export function maskWord(word, revealed) {
  return word
    .split("")
    .map((c, i) => (revealed.has(i) ? c : "_"))
    .join(" ");
}
