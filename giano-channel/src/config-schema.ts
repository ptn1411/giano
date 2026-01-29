import { z } from "zod";

export const GianoAccountConfigSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  apiBaseUrl: z.string().url().optional(),
  wsUrl: z.string().optional(),
  token: z.string().optional(),
  botUserId: z.string().optional(),
  dmPolicy: z.enum(["pairing", "allowlist", "open", "disabled"]).optional(),
  allowFrom: z.array(z.union([z.string(), z.number()])).optional(),
  groupPolicy: z.enum(["open", "allowlist", "disabled"]).optional(),
  groups: z
    .record(
      z.object({
        allow: z.boolean().optional(),
        enabled: z.boolean().optional(),
      }),
    )
    .optional(),
});

export const GianoConfigSchema = GianoAccountConfigSchema.extend({
  defaultAccount: z.string().optional(),
  accounts: z.record(GianoAccountConfigSchema).optional(),
});
