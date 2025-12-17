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

  return {
    issueCode(userId, gameId) {
      const last = cooldown.get(userId) || 0;
      if (Date.now() - last < 60000)
        return { ok: false, reason: "Cooldown active" };

      const code = crypto.randomBytes(3).toString("hex");
      const expiresAt = Date.now() + RULES.CODE_EXPIRY_MS;
      codes.set(code, { userId, gameId, expiresAt, used: false });
      cooldown.set(userId, Date.now());
      return { ok: true, code, expiresAt };
    }
  };
}
