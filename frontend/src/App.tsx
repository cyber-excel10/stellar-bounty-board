import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Coins,
  FolderGit2,
  UserRound,
  HandCoins,
  Rocket,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import {
  createBounty,
  exportReleasedPayoutsCsv,
  listBounties,
  listOpenIssues,
  refundBounty,
  releaseBounty,
  reserveBounty,
  submitBounty,
} from "./api";

import GitHubIssuePreviewCard from "./GitHubIssuePreviewCard";
import type { Bounty, BountyStatus, CreateBountyPayload, OpenIssue } from "./types";
import BountyDetailPage from "./BountyDetailPage";

import SkeletonBountyCard from "./SkeletonBountyCard";

const STELLAR_PUBLIC_KEY_HINT = "Expected Stellar public key (starts with G and is 56 characters).";
const STELLAR_PUBLIC_KEY_REGEX = /^G[A-Z2-7]{55}$/;

const initialForm: CreateBountyPayload = {
  repo: "ritik4ever/stellar-stream",
  issueNumber: 48,
  title: "",
  summary: "",
  maintainer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  tokenSymbol: "XLM",
  amount: 150,
  deadlineDays: 14,
  labels: ["help wanted"],
};



function formatRelativeDeadline(deadlineAt: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = deadlineAt - now;
  const days = Math.ceil(Math.abs(diff) / (24 * 60 * 60));
  if (diff >= 0) {
    return `${days} day${days === 1 ? "" : "s"} left`;
  }
  return `${days} day${days === 1 ? "" : "s"} overdue`;
}

function shortAddress(value: string): string {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function validateStellarPublicKey(input: string): string | null {
  const value = input.trim();
  if (!value) return "Address is required.";
  if (!STELLAR_PUBLIC_KEY_REGEX.test(value)) return STELLAR_PUBLIC_KEY_HINT;
  return null;
}

function readInitialFilters() {
  const params = new URLSearchParams(window.location.search);
  const rawSearch = params.get("search") ?? "";
  const rawStatus = params.get("status") ?? "all";
  const statusFilter: "all" | BountyStatus =
    rawStatus === "open" ||
    rawStatus === "reserved" ||
    rawStatus === "submitted" ||
    rawStatus === "released" ||
    rawStatus === "refunded" ||
    rawStatus === "expired"
      ? rawStatus
      : "all";

  return {
    searchQuery: rawSearch,
    statusFilter,
    minReward: params.get("minReward") ?? "",
    maxReward: params.get("maxReward") ?? "",
  };
}

const contributorStatuses: Array<BountyStatus | "all"> = [
  "all",
  "reserved",
  "submitted",
  "released",
  "refunded",
  "expired",
];

type BountyAction = "reserve" | "submit" | "release" | "refund";

const statusCopy: Record<BountyStatus, { label: string; description: string }> = {
  open: {
    label: "Open",
    description: "Maintainer-funded and ready for a contributor to reserve.",
  },
  reserved: {
    label: "Reserved",
    description: "A contributor has claimed the work and is preparing a submission.",
  },
  submitted: {
    label: "Submitted",
    description: "The contributor has shared a PR link. Maintainer can release or refund.",
  },
  released: {
    label: "Released",
    description: "Escrow has been paid out to the contributor.",
  },
  refunded: {
    label: "Refunded",
    description: "Escrow has been returned to the maintainer.",
  },
  expired: {
    label: "Expired",
    description: "Deadline passed before completion. Maintainer can refund.",
  },
};

const actionCopy: Record<BountyStatus, Array<{ action: BountyAction; label: string; title: string }>> = {
  open: [{ action: "reserve", label: "Reserve", title: "Claim this bounty as a contributor." }],
  reserved: [{ action: "submit", label: "Submit", title: "Attach a pull request or demo link." }],
  submitted: [
    { action: "release", label: "Release", title: "Release payout after review." },
    { action: "refund", label: "Refund", title: "Refund escrow instead of releasing." },
  ],
  released: [],
  refunded: [],
  expired: [{ action: "refund", label: "Refund", title: "Refund an expired bounty." }],
};

function repoOwner(repo: string): string {
  return repo.split("/")[0] ?? repo;
}

function formatTimestamp(value?: number): string {
  if (!value) return "-";
  return new Date(value * 1000).toLocaleString();
}

function App() {
  const initialFilters = useMemo(() => readInitialFilters(), []);
  const [form, setForm] = useState<CreateBountyPayload>(initialForm);
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [issues, setIssues] = useState<OpenIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pathname, setPathname] = useState(() => window.location.pathname);

  const [searchQuery, setSearchQuery] = useState(initialFilters.searchQuery);
  const [statusFilter, setStatusFilter] = useState<"all" | BountyStatus>(initialFilters.statusFilter);
  const [minReward, setMinReward] = useState(initialFilters.minReward);
  const [maxReward, setMaxReward] = useState(initialFilters.maxReward);

  const [profileContributor, setProfileContributor] = useState("");
  const [profileStatus, setProfileStatus] = useState<(BountyStatus | "all")>("all");


  async function refresh(): Promise<void> {
    const [bountyData, issueData] = await Promise.all([listBounties(), listOpenIssues()]);
    setBounties(bountyData);
    setIssues(issueData);
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        await refresh();
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load project data.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void bootstrap();
    const timer = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 7000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (pathname.startsWith("/bounties/")) return;
    const params = new URLSearchParams();

    if (searchQuery.trim() !== "") {
      params.set("search", searchQuery);
    }

    if (statusFilter !== "all") {
      params.set("status", statusFilter);
    }

    if (minReward !== "") {
      params.set("minReward", minReward);
    }

    if (maxReward !== "") {
      params.set("maxReward", maxReward);
    }

    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", nextUrl);
  }, [maxReward, minReward, pathname, searchQuery, statusFilter]);

  useEffect(() => {
    function handlePopState() {
      const nextPathname = window.location.pathname;
      setPathname(nextPathname);

      if (nextPathname.startsWith("/bounties/")) return;
      const filters = readInitialFilters();
      setSearchQuery(filters.searchQuery);
      setStatusFilter(filters.statusFilter);
      setMinReward(filters.minReward);
      setMaxReward(filters.maxReward);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function navigate(nextPath: string) {
    if (nextPath === window.location.pathname) return;
    window.history.pushState(null, "", nextPath);
    setPathname(nextPath);
  }

  const metrics = useMemo(() => {
    const activePool = bounties.filter((bounty) =>
      ["open", "reserved", "submitted"].includes(bounty.status),
    );
    return {
      liveBounties: activePool.length,
      fundedVolume: bounties.reduce((sum, bounty) => sum + bounty.amount, 0),
      openIssues: bounties.filter((bounty) => bounty.status === "open").length,
      shippedRewards: bounties.filter((bounty) => bounty.status === "released").length,
    };
  }, [bounties]);

  const rewardBounds = useMemo(() => {
    if (bounties.length === 0) return { lowest: 0, highest: 0 };
    const amounts = bounties.map((bounty) => bounty.amount);
    return {
      lowest: Math.min(...amounts),
      highest: Math.max(...amounts),
    };
  }, [bounties]);

  const statusOptions = useMemo(() => {
    return [
      { value: "all" as const, label: "All" },
      { value: "open" as const, label: statusCopy.open.label },
      { value: "reserved" as const, label: statusCopy.reserved.label },
      { value: "submitted" as const, label: statusCopy.submitted.label },
      { value: "released" as const, label: statusCopy.released.label },
      { value: "refunded" as const, label: statusCopy.refunded.label },
      { value: "expired" as const, label: statusCopy.expired.label },
    ];
  }, []);

  const statusGlossary = useMemo(() => {
    return (Object.keys(statusCopy) as BountyStatus[]).map((status) => ({
      status,
      label: statusCopy[status].label,
      description: statusCopy[status].description,
    }));
  }, []);

  const filteredBounties = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const min = minReward.trim() ? Number(minReward) : null;
    const max = maxReward.trim() ? Number(maxReward) : null;

    return bounties.filter((bounty) => {
      if (statusFilter !== "all" && bounty.status !== statusFilter) return false;
      if (min !== null && Number.isFinite(min) && bounty.amount < min) return false;
      if (max !== null && Number.isFinite(max) && bounty.amount > max) return false;
      if (!query) return true;

      const haystack = [
        bounty.repo,
        String(bounty.issueNumber),
        bounty.title,
        bounty.summary,
        bounty.status,
        ...bounty.labels,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [bounties, maxReward, minReward, searchQuery, statusFilter]);

  const activeRewardLabel = useMemo(() => {
    const min = minReward.trim() ? minReward.trim() : "0";
    const max = maxReward.trim() ? maxReward.trim() : "No limit";
    return `${min} - ${max}`;
  }, [maxReward, minReward]);

  function clearFilters() {
    setSearchQuery("");
    setStatusFilter("all");
    setMinReward("");
    setMaxReward("");
  }

  async function handleExportReleasedPayouts(): Promise<void> {
    try {
      setExporting(true);
      setError(null);
      const result = await exportReleasedPayoutsCsv();
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export payouts.");
    } finally {
      setExporting(false);
    }
  }

  const contributorMetrics = useMemo(() => {
    const contributor = profileContributor.trim();
    if (!contributor) {
      return {
        contributor: null as string | null,
        filtered: [] as Bounty[],
        countsByStatus: new Map<BountyStatus, number>(),
        releasedTotalsByAsset: new Map<string, number>(),
      };
    }

    const owned = bounties.filter((bounty) => bounty.contributor === contributor);
    const filtered = owned.filter((bounty) => (profileStatus === "all" ? true : bounty.status === profileStatus));

    const countsByStatus = new Map<BountyStatus, number>();
    for (const bounty of owned) {
      countsByStatus.set(bounty.status, (countsByStatus.get(bounty.status) ?? 0) + 1);
    }

    const releasedTotalsByAsset = new Map<string, number>();
    for (const bounty of owned) {
      if (bounty.status !== "released") continue;
      releasedTotalsByAsset.set(
        bounty.tokenSymbol,
        (releasedTotalsByAsset.get(bounty.tokenSymbol) ?? 0) + bounty.amount,
      );
    }

    return {
      contributor,
      filtered,
      countsByStatus,
      releasedTotalsByAsset,
    };
  }, [bounties, profileContributor, profileStatus]);



  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const maintainerError = validateStellarPublicKey(form.maintainer);
      if (maintainerError) {
        setError(`Maintainer address: ${maintainerError}`);
        return;
      }
      await createBounty({
        ...form,
        maintainer: form.maintainer.trim(),
        labels: form.labels.filter(Boolean),
      });
      setForm({
        ...initialForm,
        issueNumber: form.issueNumber + 1,
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create bounty.");
    } finally {
      setSubmitting(false);
    }
  }

  function renderActionButton(
    bounty: Bounty,
    action: { action: BountyAction; label: string; title: string },
  ): ReactNode {
    const onClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (action.action === "reserve") {
        void handleReserve(bounty);
        return;
      }
      if (action.action === "submit") {
        void handleSubmit(bounty);
        return;
      }
      if (action.action === "release") {
        void handleRelease(bounty);
        return;
      }
      void handleRefund(bounty);
    };

    return (
      <button
        key={action.action}
        type="button"
        className={action.action === "refund" ? "ghost-button" : "secondary-button"}
        title={action.title}
        onClick={onClick}
      >
        {action.label}
      </button>
    );
  }

  const detailId = useMemo(() => {
    const match = pathname.match(/^\/bounties\/([^/]+)$/);
    return match ? decodeURIComponent(match[1] ?? "") : null;
  }, [pathname]);

  const detailBounty = useMemo(() => {
    if (!detailId) return null;
    return bounties.find((bounty) => bounty.id === detailId) ?? null;
  }, [bounties, detailId]);

  if (detailId) {
    const bounty = detailBounty;
    const owner = bounty ? repoOwner(bounty.repo) : "";
    const avatarUrl = bounty ? `https://github.com/${owner}.png?size=72` : "";

    return (
      <BountyDetailPage
        bounty={bounty}
        loading={loading}
        onBack={() => navigate("/")}
        owner={owner}
        avatarUrl={avatarUrl}
        statusCopy={statusCopy}
        actionCopy={actionCopy}
        renderActionButton={renderActionButton}
        formatTimestamp={formatTimestamp}
      />
    );
  }

  async function handleReserve(bounty: Bounty) {
    const contributor = window.prompt("Contributor Stellar address", bounty.contributor ?? "");
    if (!contributor) return;
    const contributorError = validateStellarPublicKey(contributor);
    if (contributorError) {
      window.alert(contributorError);
      return;
    }
    try {
      setError(null);
      await reserveBounty(bounty.id, contributor.trim());
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reserve bounty.");
    }
  }

  async function handleSubmit(bounty: Bounty) {
    const contributor = window.prompt("Contributor Stellar address", bounty.contributor ?? "");
    if (!contributor) return;
    const contributorError = validateStellarPublicKey(contributor);
    if (contributorError) {
      window.alert(contributorError);
      return;
    }
    const submissionUrl = window.prompt("Pull request or demo URL");
    if (!submissionUrl) return;
    const notes = window.prompt("Optional notes for the maintainer") ?? undefined;

    try {
      setError(null);
      await submitBounty(bounty.id, contributor.trim(), submissionUrl, notes);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit bounty.");
    }
  }

  async function handleRelease(bounty: Bounty) {
    const maintainer = window.prompt("Maintainer Stellar address", bounty.maintainer);
    if (!maintainer) return;
    const maintainerError = validateStellarPublicKey(maintainer);
    if (maintainerError) {
      window.alert(maintainerError);
      return;
    }
    const transactionHash = window.prompt("Transaction hash (64 hex chars, optional)") ?? undefined;
    try {
      setError(null);
      await releaseBounty(bounty.id, maintainer.trim(), transactionHash || undefined);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to release bounty.");
    }
  }

  async function handleRefund(bounty: Bounty) {
    const maintainer = window.prompt("Maintainer Stellar address", bounty.maintainer);
    if (!maintainer) return;
    const maintainerError = validateStellarPublicKey(maintainer);
    if (maintainerError) {
      window.alert(maintainerError);
      return;
    }
    const transactionHash = window.prompt("Transaction hash (64 hex chars, optional)") ?? undefined;
    try {
      setError(null);
      await refundBounty(bounty.id, maintainer.trim(), transactionHash || undefined);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refund bounty.");
    }
  }

  return (
    <div className="page-shell">
      <div className="glow glow-left" />
      <div className="glow glow-right" />

      <header className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Stellar + Open Source</span>
          <h1>Fund GitHub issues with on-chain style escrow.</h1>
          <p>
            Stellar Bounty Board turns backlog items into funded contribution lanes.
            Maintainers lock a reward, contributors reserve the work, and payout flows
            through a simple review lifecycle.
          </p>
          <div className="hero-actions">
            <a href="#create" className="primary-link">
              Launch a bounty
            </a>
            <a href="#issues" className="secondary-link">
              Contribution backlog
            </a>
            <button
              type="button"
              className="secondary-link"
              disabled={exporting}
              onClick={() => void handleExportReleasedPayouts()}
            >
              {exporting ? "Exporting..." : "Export released payouts (CSV)"}
            </button>
          </div>
        </div>

        <section className="hero-panel">
          <div className="hero-panel__row">
            <ShieldCheck size={18} />
            <span>Escrow-first maintainer controls</span>
          </div>
          <div className="hero-panel__row">
            <FolderGit2 size={18} />
            <span>GitHub issue and PR-linked lifecycle</span>
          </div>
          <div className="hero-panel__row">
            <Coins size={18} />
            <span>Built to graduate from demo backend to Soroban source of truth</span>
          </div>
        </section>
      </header>

      <section className="metrics">
        <article className="metric-card">
          <span>Live bounties</span>
          <strong>{metrics.liveBounties}</strong>
        </article>
        <article className="metric-card">
          <span>Funded volume</span>
          <strong>{metrics.fundedVolume} XLM</strong>
        </article>
        <article className="metric-card">
          <span>Open to claim</span>
          <strong>{metrics.openIssues}</strong>
        </article>
        <article className="metric-card">
          <span>Released payouts</span>
          <strong>{metrics.shippedRewards}</strong>
        </article>
      </section>

      {error && <div className="error-banner">{error}</div>}

      <main className="content-grid">
        <section className="panel form-panel" id="create">
          <div className="panel-header">
            <div>
              <span className="panel-kicker">Maintainer flow</span>
              <h2>Create a bounty</h2>
            </div>
            <Rocket size={18} />
          </div>

          <form className="bounty-form" onSubmit={handleCreate}>
            <label>
              Repository
              <input
                value={form.repo}
                onChange={(event) => setForm({ ...form, repo: event.target.value })}
                placeholder="owner/repo"
              />
            </label>

            <div className="two-up">
              <label>
                Issue number
                <input
                  type="number"
                  value={form.issueNumber}
                  onChange={(event) =>
                    setForm({ ...form, issueNumber: Number(event.target.value) })
                  }
                />
              </label>

              <label>
                Reward
                <input
                  type="number"
                  min="1"
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })}
                />
              </label>
            </div>

            <label>
              Issue title
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Example: Add WebSocket payout updates"
              />
            </label>

            <label>
              Summary
              <textarea
                value={form.summary}
                onChange={(event) => setForm({ ...form, summary: event.target.value })}
                placeholder="What should a contributor build?"
                rows={4}
              />
            </label>

            <div className="two-up">
              <label>
                Maintainer address
                <input
                  value={form.maintainer}
                  onChange={(event) => setForm({ ...form, maintainer: event.target.value })}
                  placeholder="G... (56 chars)"
                  inputMode="text"
                  autoComplete="off"
                  aria-invalid={Boolean(form.maintainer.trim() && validateStellarPublicKey(form.maintainer))}
                />
                <small className="field-hint">{STELLAR_PUBLIC_KEY_HINT}</small>
                {form.maintainer.trim() && validateStellarPublicKey(form.maintainer) && (
                  <small className="field-error">{validateStellarPublicKey(form.maintainer)}</small>
                )}
              </label>

              <label>
                Token
                <input
                  value={form.tokenSymbol}
                  onChange={(event) => setForm({ ...form, tokenSymbol: event.target.value })}
                />
              </label>
            </div>

            <div className="two-up">
              <label>
                Deadline in days
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={form.deadlineDays}
                  onChange={(event) =>
                    setForm({ ...form, deadlineDays: Number(event.target.value) })
                  }
                />
              </label>

              <label>
                Labels
                <input
                  value={form.labels.join(", ")}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      labels: event.target.value
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="help wanted, backend"
                />
              </label>
            </div>

            <GitHubIssuePreviewCard
              repo={form.repo}
              issueNumber={form.issueNumber}
              title={form.title}
              labels={form.labels}
            />

            <button className="primary-button" disabled={submitting}>
              {submitting ? "Publishing..." : "Publish bounty"}
            </button>
          </form>
        </section>

        <section className="panel board-panel">
          <div className="panel-header">
            <div>
              <span className="panel-kicker">Contributor flow</span>
              <h2>Bounty board</h2>
            </div>
            <HandCoins size={18} />
          </div>

          <div className="board-filters">
            <div className="board-filters__header">
              <div>
                <span className="panel-kicker">Board filters</span>
                <p>
                  Showing <strong>{filteredBounties.length}</strong> of <strong>{bounties.length}</strong>{" "}
                  bounties
                </p>
              </div>
              <button className="ghost-button filter-reset" type="button" onClick={clearFilters}>
                Clear filters
              </button>
            </div>

            <div className="filter-grid">
              <label className="filter-field filter-field--search">
                <span>Search</span>
                <div className="input-with-icon">
                  <Search size={16} />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search repo, title, labels, status"
                  />
                </div>
              </label>

              <label className="filter-field">
                <span>Status</span>
                <div className="input-with-icon">
                  <SlidersHorizontal size={16} />
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as "all" | BountyStatus)}
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="filter-field">
                <span>Min reward</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={minReward}
                  onChange={(event) => setMinReward(event.target.value)}
                  placeholder={rewardBounds.lowest > 0 ? `${rewardBounds.lowest}` : "0"}
                />
              </label>

              <label className="filter-field">
                <span>Max reward</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={maxReward}
                  onChange={(event) => setMaxReward(event.target.value)}
                  placeholder={rewardBounds.highest > 0 ? `${rewardBounds.highest}` : "No limit"}
                />
              </label>
            </div>

            <div className="active-range" aria-live="polite">
              <span className="active-range__label">Active reward range</span>
              <strong>{activeRewardLabel}</strong>
            </div>
          </div>

          <section className="status-glossary" aria-labelledby="status-glossary-title">
            <div className="status-glossary__header">
              <div>
                <span className="panel-kicker">Contributor guide</span>
                <h3 id="status-glossary-title">Status quick guide</h3>
              </div>
              <span className="status-glossary__hint">Hover or tap pills and buttons for a short explanation.</span>
            </div>
            <div className="status-glossary__list">
              {statusGlossary.map((item) => (
                <article className="status-glossary__item" key={item.status}>
                  <span className={`status-pill status-pill--${item.status}`}>{item.label}</span>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </section>

          {loading ? (
            <div className="board-list">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonBountyCard key={i} />
              ))}
            </div>
          ) : filteredBounties.length > 0 ? (
            <div className="board-list">
              {filteredBounties.map((bounty) => (
                <article
                  className="bounty-card"
                  key={bounty.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/bounties/${encodeURIComponent(bounty.id)}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigate(`/bounties/${encodeURIComponent(bounty.id)}`);
                    }
                  }}
                >
                  <div className="bounty-card__top">
                    <div>
                      <span
                        className={`status-pill status-pill--${bounty.status}`}
                        title={statusCopy[bounty.status].description}
                        aria-label={`${statusCopy[bounty.status].label}: ${statusCopy[bounty.status].description}`}
                      >
                        {statusCopy[bounty.status].label}
                      </span>
                      <h3>{bounty.title}</h3>
                    </div>
                    <div className="amount-chip">
                      {bounty.amount} {bounty.tokenSymbol}
                    </div>
                  </div>

                  <p className="bounty-summary">{bounty.summary}</p>

                  <div className="meta-grid">
                    <div>
                      <span className="meta-label">Issue</span>
                      <strong>
                        <a
                          className="inline-link"
                          href={`https://github.com/${bounty.repo}/issues/${bounty.issueNumber}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {bounty.repo} #{bounty.issueNumber}
                        </a>
                      </strong>
                    </div>
                    <div>
                      <span className="meta-label">Deadline</span>
                      <strong>{formatRelativeDeadline(bounty.deadlineAt)}</strong>
                    </div>
                    <div>
                      <span className="meta-label">Maintainer</span>
                      <strong>{shortAddress(bounty.maintainer)}</strong>
                    </div>
                    <div>
                      <span className="meta-label">Contributor</span>
                      <strong>{bounty.contributor ? shortAddress(bounty.contributor) : "Open"}</strong>
                    </div>
                    {bounty.status === "released" && bounty.releasedTxHash && (
                      <div>
                        <span className="meta-label">Release tx</span>
                        <strong>{`${bounty.releasedTxHash.slice(0, 10)}...`}</strong>
                      </div>
                    )}
                    {bounty.status === "refunded" && bounty.refundedTxHash && (
                      <div>
                        <span className="meta-label">Refund tx</span>
                        <strong>{`${bounty.refundedTxHash.slice(0, 10)}...`}</strong>
                      </div>
                    )}
                  </div>

                  <div className="chip-row">
                    {bounty.labels.map((label) => (
                      <span className="chip" key={label}>
                        {label}
                      </span>
                    ))}
                  </div>

                  <p className="status-helper">
                    <strong>{statusCopy[bounty.status].label}:</strong> {statusCopy[bounty.status].description}
                  </p>

                  {bounty.submissionUrl && (
                    <a className="submission-link" href={bounty.submissionUrl} target="_blank" rel="noreferrer">
                      Review submission <ArrowUpRight size={16} />
                    </a>
                  )}

                  <div className="action-row">
                    {(actionCopy[bounty.status] ?? []).map((action) => renderActionButton(bounty, action))}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              No bounties match the current search, status, and reward range filters.
            </div>
          )}
        </section>
      </main>

      <section className="panel issues-panel" id="issues">
        <div className="panel-header">
          <div>
            <span className="panel-kicker">Open source angle</span>
            <h2>Issue drafts to open next</h2>
          </div>
          <FolderGit2 size={18} />
        </div>

        <div className="issue-list">
          {issues.map((issue) => (
            <article className="issue-card" key={issue.id}>
              <div className="issue-card__top">
                <strong>{issue.id}</strong>
                <span className={`impact-chip impact-chip--${issue.impact}`}>{issue.impact}</span>
              </div>
              <h3>{issue.title}</h3>
              <p>{issue.summary}</p>
              <div className="chip-row">
                {issue.labels.map((label) => (
                  <span className="chip" key={label}>
                    {label}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel profile-panel" id="profile">
        <div className="panel-header">
          <div>
            <span className="panel-kicker">Contributor angle</span>
            <h2>Contributor profile</h2>
          </div>
          <UserRound size={18} />
        </div>

        <div className="profile-controls">
          <label>
            Contributor address
            <input
              value={profileContributor}
              onChange={(event) => setProfileContributor(event.target.value)}
              placeholder="G... (Stellar address)"
              inputMode="text"
              autoComplete="off"
              aria-invalid={Boolean(profileContributor.trim() && validateStellarPublicKey(profileContributor))}
            />
            <small className="field-hint">{STELLAR_PUBLIC_KEY_HINT}</small>
            {profileContributor.trim() && validateStellarPublicKey(profileContributor) && (
              <small className="field-error">{validateStellarPublicKey(profileContributor)}</small>
            )}
          </label>

          <div className="filter-row" role="tablist" aria-label="Filter by bounty status">
            {contributorStatuses.map((status) => (
              <button
                key={status}
                type="button"
                role="tab"
                aria-selected={profileStatus === status}
                className={`filter-chip ${profileStatus === status ? "filter-chip--active" : ""}`}
                onClick={() => setProfileStatus(status)}
                disabled={!contributorMetrics.contributor && status !== "all"}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Loading contributor history...</div>
        ) : !contributorMetrics.contributor ? (
          <div className="empty-state">
            Enter a contributor address to see reserved, submitted, and released bounties plus total
            earnings.
          </div>
        ) : contributorMetrics.filtered.length === 0 ? (
          <div className="empty-state">
            No bounties found for <strong>{shortAddress(contributorMetrics.contributor)}</strong>
            {profileStatus === "all" ? "." : ` in "${profileStatus}" status.`}
          </div>
        ) : (
          <div className="profile-grid">
            <div className="profile-metrics">
              <div className="profile-metric">
                <span className="meta-label">Reserved</span>
                <strong>{contributorMetrics.countsByStatus.get("reserved") ?? 0}</strong>
              </div>
              <div className="profile-metric">
                <span className="meta-label">Submitted</span>
                <strong>{contributorMetrics.countsByStatus.get("submitted") ?? 0}</strong>
              </div>
              <div className="profile-metric">
                <span className="meta-label">Released</span>
                <strong>{contributorMetrics.countsByStatus.get("released") ?? 0}</strong>
              </div>
              <div className="profile-metric">
                <span className="meta-label">Refunded</span>
                <strong>{contributorMetrics.countsByStatus.get("refunded") ?? 0}</strong>
              </div>
              <div className="profile-metric">
                <span className="meta-label">Expired</span>
                <strong>{contributorMetrics.countsByStatus.get("expired") ?? 0}</strong>
              </div>
            </div>

            <div className="profile-earnings">
              <span className="meta-label">Total earnings (released)</span>
              <div className="earnings-row">
                {Array.from(contributorMetrics.releasedTotalsByAsset.entries()).length === 0 ? (
                  <strong>0</strong>
                ) : (
                  Array.from(contributorMetrics.releasedTotalsByAsset.entries()).map(([asset, total]) => (
                    <div className="earnings-chip" key={asset}>
                      <strong>{total}</strong>
                      <span>{asset}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="profile-list">
              {contributorMetrics.filtered.map((bounty) => (
                <article className="bounty-card" key={bounty.id}>
                  <div className="bounty-card__top">
                    <div>
                      <span className={`status-pill status-pill--${bounty.status}`}>{bounty.status}</span>
                      <h3>{bounty.title}</h3>
                    </div>
                    <div className="amount-chip">
                      {bounty.amount} {bounty.tokenSymbol}
                    </div>
                  </div>

                  <p className="bounty-summary">{bounty.summary}</p>

                  <div className="meta-grid">
                    <div>
                      <span className="meta-label">Issue</span>
                      <strong>
                        <a
                          className="inline-link"
                          href={`https://github.com/${bounty.repo}/issues/${bounty.issueNumber}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {bounty.repo} #{bounty.issueNumber}
                        </a>
                      </strong>
                    </div>
                    <div>
                      <span className="meta-label">Maintainer</span>
                      <strong>{shortAddress(bounty.maintainer)}</strong>
                    </div>
                    {bounty.submissionUrl && (
                      <div>
                        <span className="meta-label">Submission</span>
                        <strong>
                          <a className="inline-link" href={bounty.submissionUrl} target="_blank" rel="noreferrer">
                            View link
                          </a>
                        </strong>
                      </div>
                    )}
                    {bounty.status === "released" && bounty.releasedTxHash && (
                      <div>
                        <span className="meta-label">Release tx</span>
                        <strong>{`${bounty.releasedTxHash.slice(0, 10)}...`}</strong>
                      </div>
                    )}
                    {bounty.status === "refunded" && bounty.refundedTxHash && (
                      <div>
                        <span className="meta-label">Refund tx</span>
                        <strong>{`${bounty.refundedTxHash.slice(0, 10)}...`}</strong>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default App;
