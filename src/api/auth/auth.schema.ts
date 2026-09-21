import * as z from "zod";

export const postLoginBodySchema = z.object({
    email: z.email(),
    password: z.string().min(8),
});

export type PostLoginBody = z.infer<typeof postLoginBodySchema>;