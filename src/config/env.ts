import * as z from "zod";
const env = process.env;

const envSchema = z.object({
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.enum(["development", "production", "stage"]),
    DATABASE_URL: z.string()
})

const result = envSchema.safeParse(process.env)

if (!result.success) {
    console.error("❌ Invalid environment variables:");
    console.error(result.error.format());
    process.exit(1); // crash immediately — don't start with bad config
}

export default result.data;
