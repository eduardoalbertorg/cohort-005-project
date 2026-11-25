import { z } from "zod";

export const noteBodySchema = z
  .string({ required_error: "Enter a note before saving." })
  .trim()
  .max(2000, "Notes must be 2,000 characters or fewer.");
