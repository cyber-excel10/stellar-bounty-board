import { ArrowUpRight, FolderGit2 } from "lucide-react";

type Props = {
  repo: string;
  issueNumber: number;
  title?: string;
  labels?: string[];
};

function isValidRepo(value: string): boolean {
  return /^[^/\s]+\/[^/\s]+$/.test(value.trim());
}

export default function GitHubIssuePreviewCard({ repo, issueNumber, title, labels }: Props) {
  const normalizedRepo = repo.trim();
  const canLink = isValidRepo(normalizedRepo) && Number.isFinite(issueNumber) && issueNumber > 0;
  const href = canLink ? `https://github.com/${normalizedRepo}/issues/${issueNumber}` : undefined;

  const content = (
    <>
      <div className="github-issue-card__top">
        <div className="github-issue-card__heading">
          <FolderGit2 size={16} />
          <span className="github-issue-card__repo">
            {isValidRepo(normalizedRepo) ? normalizedRepo : "owner/repo"}
          </span>
          <span className="github-issue-card__number">{canLink ? `#${issueNumber}` : "#—"}</span>
        </div>
        <span className="github-issue-card__cta">
          View on GitHub <ArrowUpRight size={16} />
        </span>
      </div>

      <strong className="github-issue-card__title">{title?.trim() ? title : "Issue title preview"}</strong>

      {labels && labels.length > 0 ? (
        <div className="chip-row">
          {labels.map((label) => (
            <span className="chip" key={label}>
              {label}
            </span>
          ))}
        </div>
      ) : (
        <div className="github-issue-card__empty">Add labels to help contributors filter.</div>
      )}
    </>
  );

  if (!canLink) {
    return (
      <div className="github-issue-card github-issue-card--disabled" aria-disabled="true">
        {content}
      </div>
    );
  }

  return (
    <a className="github-issue-card" href={href} target="_blank" rel="noreferrer">
      {content}
    </a>
  );
}

