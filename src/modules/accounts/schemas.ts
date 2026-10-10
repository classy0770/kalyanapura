import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z.string().min(8, "Use at least 8 characters.").max(128, "Use at most 128 characters.");
export const signupSchema = z.object({ name: z.string().trim().min(1, "Enter your name.").max(150), email: emailSchema, password: passwordSchema });
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password.").max(128) });
