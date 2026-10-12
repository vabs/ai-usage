import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

/**
 * AES-256-GCM encryption for OAuth credentials at rest.
 * Sealed format: "v1.<iv>.<tag>.<ciphertext>", each part base64url.
 */
export function createSealer(keyBase64: string) {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded. Generate one with: openssl rand -base64 32");
  }

  return {
    seal(plaintext: string): string {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      return [VERSION, iv, cipher.getAuthTag(), ciphertext].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
    },

    open(sealed: string): string {
      const [version, iv, tag, ciphertext] = sealed.split(".");
      if (version !== VERSION || !iv || !tag || ciphertext === undefined) throw new Error("Unrecognised sealed value");
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
      decipher.setAuthTag(Buffer.from(tag, "base64url"));
      return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
    },
  };
}

export type Sealer = ReturnType<typeof createSealer>;
