import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";

/**
 * Password hashing with scrypt (Node crypto, no dependencies).
 *
 * A stored hash is self-describing so the cost parameters can change without
 * breaking existing passwords: `scrypt$N$r$p$<saltHex>$<hashHex>`.
 */

const N = 16_384;
const R = 8;
const P = 1;
const KEYLEN = 64;

function scrypt(password: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEYLEN, { N, r: R, p: P });
  return ["scrypt", N, R, P, salt.toString("hex"), derived.toString("hex")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");

  const derived = await scrypt(password, salt, expected.length, {
    N: Number.parseInt(nStr, 10),
    r: Number.parseInt(rStr, 10),
    p: Number.parseInt(pStr, 10),
  });

  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
