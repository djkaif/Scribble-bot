import crypto from "crypto";
import { RULES } from "./constants.js";

export function createCodeManager() {
  const codes = new Map();
  const cooldown = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [code, c] of codes) {
      if (now > c.expiresAt) codes.delete(code);
    }
  }, 60_000);

  function issueCode(userId, gameId) {
    const last = cooldown.get(userId) || 0;
    if (Date.now() - last < 60_000) {
      return { ok: false, reason: "⏱ Cooldown active" };
    }

    const code = crypto.randomBytes(3).toString("hex");
    const expiresAt = Date.now() + RULES.CODE_EXPIRY_MS;

    codes.set(code, { userId, gameId, expiresAt, used: false });
    cooldown.set(userId, Date.now());

    return { ok: true, code, expiresAt };
  }

  function consumeCode(code, userId) {
    const c = codes.get(code);
    if (!c) return { ok: false, reason: "Invalid code" };
    if (c.used) return { ok: false, reason: "Code already used" };
    if (Date.now() > c.expiresAt) return { ok: false, reason: "Code expired" };
    if (c.userId !== userId) return { ok: false, reason: "Code mismatch" };

    c.used = true;
    return { ok: true, gameId: c.gameId };
  }

  return { issueCode, consumeCode };
}
