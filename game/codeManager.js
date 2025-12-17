import crypto from "crypto";
import { RULES } from "./constants.js";

export function createCodeManager() {
  const codes = new Map();
  const cooldown = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [c, v] of codes)
      if (now > v.expiresAt) codes.delete(c);
  }, 60000);

  function isExpired(ms) {
    return Date.now() >= ms;
  }

  return {
    issueCode(userId, gameId, displayName) {
      const last = cooldown.get(userId) || 0;
      if (Date.now() - last < 60000)
        return { ok: false, reason: "Cooldown active" };

      const code = crypto.randomBytes(3).toString("hex");
      const expiresAt = Date.now() + RULES.CODE_EXPIRY_MS;
      
      // ✅ Store the Discord name with the code
      codes.set(code, { userId, gameId, expiresAt, used: false, displayName });
      cooldown.set(userId, Date.now());
      return { ok: true, code, expiresAt };
    },

    // ✅ Removed userId check to solve mismatch
    consumeCode(code) {
      const entry = codes.get(code);
      if (!entry) return { ok: false, reason: "Invalid code" };

      if (isExpired(entry.expiresAt)) {
        codes.delete(code);
        return { ok: false, reason: "❌ Code expired" };
      }

      if (entry.used) return { ok: false, reason: "Code already used" };

      entry.used = true;
      // ✅ Return displayName to the gameManager
      return { ok: true, gameId: entry.gameId, displayName: entry.displayName };
    }
  };
}
