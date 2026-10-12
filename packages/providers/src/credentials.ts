import type { Sealer } from "@app/shared";
import { z } from "zod";
import type { Credentials } from "./types";

const credentialsSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number(),
  meta: z.record(z.string(), z.string()),
});

export const sealCredentials = (sealer: Sealer, credentials: Credentials): string =>
  sealer.seal(JSON.stringify(credentials));

export const openCredentials = (sealer: Sealer, sealed: string): Credentials =>
  credentialsSchema.parse(JSON.parse(sealer.open(sealed)));
