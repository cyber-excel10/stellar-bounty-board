import { z } from "zod";

const STELLAR_ACCOUNT_REGEX = /^G[A-Z2-7]{55}$/;
const REPO_REGEX = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
const TOKEN_REGEX = /^[A-Za-z0-9]{1,12}$/;

export const bountyIdSchema = z.string().trim().min(1, "Bounty ID is required.");

const stellarAccountSchema = z
  .string()
  .trim()
  .regex(STELLAR_ACCOUNT_REGEX, "Must be a valid Stellar public key.");

export const createBountySchema = z.object({
  repo: z
    .string()
    .trim()
    .regex(REPO_REGEX, "Repo must look like owner/repository."),
  issueNumber: z.coerce.number().int().positive("Issue number must be positive."),
  title: z.string().trim().min(5).max(120),
  summary: z.string().trim().min(20).max(280),
  maintainer: stellarAccountSchema,
  tokenSymbol: z.string().trim().regex(TOKEN_REGEX, "Token symbol must be 1-12 letters or numbers."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  deadlineDays: z.coerce.number().int().min(1).max(90),
  labels: z.array(z.string().trim().min(1).max(30)).max(6).default([]),
});

export const reserveBountySchema = z.object({
  contributor: stellarAccountSchema,
});

export const submitBountySchema = z.object({
  contributor: stellarAccountSchema,
  submissionUrl: z.string().trim().url("Submission URL must be a valid URL."),
  notes: z.string().trim().max(240).optional(),
});

export const maintainerActionSchema = z.object({
  maintainer: stellarAccountSchema,
});

export function zodErrorMessage(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ");
}

