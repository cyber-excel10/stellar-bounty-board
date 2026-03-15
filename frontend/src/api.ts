import { Bounty, CreateBountyPayload, OpenIssue } from "./types";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? "Unexpected API error");
  }
  return body;
}

export async function listBounties(): Promise<Bounty[]> {
  const response = await fetch(`${API_BASE}/bounties`);
  const body = await parseResponse<{ data: Bounty[] }>(response);
  return body.data;
}

export async function createBounty(payload: CreateBountyPayload): Promise<Bounty> {
  const response = await fetch(`${API_BASE}/bounties`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await parseResponse<{ data: Bounty }>(response);
  return body.data;
}

export async function reserveBounty(id: string, contributor: string): Promise<Bounty> {
  const response = await fetch(`${API_BASE}/bounties/${id}/reserve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contributor }),
  });
  const body = await parseResponse<{ data: Bounty }>(response);
  return body.data;
}

export async function submitBounty(
  id: string,
  contributor: string,
  submissionUrl: string,
  notes?: string,
): Promise<Bounty> {
  const response = await fetch(`${API_BASE}/bounties/${id}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contributor, submissionUrl, notes }),
  });
  const body = await parseResponse<{ data: Bounty }>(response);
  return body.data;
}

export async function releaseBounty(id: string, maintainer: string): Promise<Bounty> {
  const response = await fetch(`${API_BASE}/bounties/${id}/release`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ maintainer }),
  });
  const body = await parseResponse<{ data: Bounty }>(response);
  return body.data;
}

export async function refundBounty(id: string, maintainer: string): Promise<Bounty> {
  const response = await fetch(`${API_BASE}/bounties/${id}/refund`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ maintainer }),
  });
  const body = await parseResponse<{ data: Bounty }>(response);
  return body.data;
}

export async function listOpenIssues(): Promise<OpenIssue[]> {
  const response = await fetch(`${API_BASE}/open-issues`);
  const body = await parseResponse<{ data: OpenIssue[] }>(response);
  return body.data;
}

