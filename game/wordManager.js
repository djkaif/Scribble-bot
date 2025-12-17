import fs from "fs";

const WORDS = fs.readFileSync("words.txt", "utf8")
  .split(/\r?\n/)
  .map(w => w.trim())
  .filter(Boolean);

export function getRandomWord() {
  return WORDS.length
    ? WORDS[Math.floor(Math.random() * WORDS.length)].toLowerCase()
    : "apple";
}

export function maskWord(word, revealed) {
  return word.split("")
    .map((c, i) => revealed.has(i) ? c : "_")
    .join(" ");
}
