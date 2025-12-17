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

  // ✅ Bonus Safety Patch Helper
  function isExpired(ms) {
    return Date.now() >= ms;
  }

  return {
    issueCode(userId, gameId) {
      const last = cooldown.get(userId) || 0;
      if (Date.now() - last < 60000)
        return { ok: false, reason: "Cooldown active" };

      const code = crypto.randomBytes(3).toString("hex");
      // ✅ Store in milliseconds for JS logic
      const expiresAt = Date.now() + RULES.CODE_EXPIRY_MS;
      
      codes.set(code, { userId, gameId, expiresAt, used: false });
      cooldown.set(userId, Date.now());
      return { ok: true, code, expiresAt };
    },

    // ✅ Safe validation check
    consumeCode(code, userId) {
      const entry = codes.get(code);
      
      if (!entry) return { ok: false, reason: "Invalid code" };

      // 🧪 Debug Test
      console.log("NOW (ms):", Date.now());
      console.log("EXPIRES (ms):", entry.expiresAt);

      if (isExpired(entry.expiresAt)) {
        codes.delete(code);
        return { ok: false, reason: "❌ Code expired" };
      }

      if (entry.userId !== userId) return { ok: false, reason: "User mismatch" };
      if (entry.used) return { ok: false, reason: "Code already used" };

      entry.used = true;
      return { ok: true, gameId: entry.gameId };
    }
  };
}
