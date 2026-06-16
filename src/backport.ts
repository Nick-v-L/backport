import * as core from "@actions/core";
import * as github from "@actions/github";
import type { Octokit } from "@octokit/rest";
import { execSync } from "node:child_process";
import { DetectionMethod } from "./interfaces.js";

function handleCustomInput(customInput: string): string[] {
  return customInput.split(/[\s,]+/).filter(Boolean);
}

function parseCommentInput(commentBody: string): string[] {
  const regex = /\/backport\s+([^\s,]+)/gi;
  const matches = Array.from(commentBody.matchAll(regex));
  return matches.map((match) => `backport-to-${match[1]}`);
}

function getCommentBody(): string {
  const payload = github.context.payload as any;
  return (
    payload.comment?.body ??
    payload.pull_request?.body ??
    payload.issue?.body ??
    ""
  );
}

async function listPullRequestComments(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<string[]> {
  const commentBodies: string[] = [];
  let page = 1;
  while (true) {
    const response = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
      page,
    });

    if (!response.data.length) {
      break;
    }

    for (const comment of response.data) {
      if (comment.body) {
        commentBodies.push(comment.body);
      }
    }

    page += 1;
  }

  return commentBodies;
}

async function getCommentInputs(
  githubToken: string | undefined,
  owner: string | undefined,
  repo: string | undefined,
  issueNumber: number | undefined,
): Promise<string[]> {
  const inputs = new Set<string>();
  const body = getCommentBody();
  parseCommentInput(body).forEach((input) => inputs.add(input));

  if (githubToken && owner && repo && issueNumber) {
    try {
      const octokit = github.getOctokit(githubToken) as unknown as Octokit;
      const commentBodies = await listPullRequestComments(
        octokit,
        owner,
        repo,
        issueNumber,
      );

      for (const commentBody of commentBodies) {
        parseCommentInput(commentBody).forEach((input) => inputs.add(input));
      }
    } catch {
      core.warning(
        "Unable to list pull request comments; falling back to current comment body only.",
      );
    }
  }

  return [...inputs];
}

function runGitCommand(command: string): string {
  core.debug(`Running git command: ${command}`);
  return execSync(command, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

function localBranchExists(branchName: string): boolean {
  try {
    runGitCommand(`git show-ref --verify --quiet refs/heads/${branchName}`);
    return true;
  } catch {
    return false;
  }
}

function remoteBranchExists(branchName: string): boolean {
  try {
    runGitCommand(`git ls-remote --heads origin ${branchName}`);
    return true;
  } catch {
    return false;
  }
}

export function findLatestMatchingTag(
  tags: string[],
  branchName: string,
): string | null {
  const branchBase = branchName.replace(/\.x$/, "");
  const normalizedBase = branchBase.startsWith("v")
    ? branchBase.slice(1)
    : branchBase;

  const versionRegexes = [
    new RegExp(
      `^${branchBase.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\.[0-9]+$`,
    ),
    new RegExp(
      `^v${normalizedBase.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\.[0-9]+$`,
    ),
  ];

  const matchingTags = tags.filter((tag) =>
    versionRegexes.some((regex) => regex.test(tag)),
  );

  matchingTags.sort((a, b) => {
    const parse = (tag: string) => tag.replace(/^v/, "").split(".").map(Number);
    const aParts = parse(a);
    const bParts = parse(b);

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aValue = aParts[i] ?? 0;
      const bValue = bParts[i] ?? 0;
      if (aValue !== bValue) {
        return bValue - aValue;
      }
    }
    return 0;
  });

  return matchingTags[0] ?? null;
}

export function getLatestTagForBranch(branchName: string): string | null {
  try {
    const allTags = runGitCommand("git tag --list");
    const tags = allTags.split("\n").filter(Boolean);
    return findLatestMatchingTag(tags, branchName);
  } catch {
    return null;
  }
}

function commitAlreadyOnBranch(commitSha: string): boolean {
  try {
    runGitCommand(`git merge-base --is-ancestor ${commitSha} HEAD`);
    return true;
  } catch {
    return false;
  }
}

export function checkoutBackportBranch(
  sourceBranch: string,
  tagName: string,
  baseBranch: string,
): void {
  if (localBranchExists(sourceBranch)) {
    core.info(`Checking out existing local backport branch ${sourceBranch}`);
    runGitCommand(`git checkout ${sourceBranch}`);
    return;
  }

  if (remoteBranchExists(sourceBranch)) {
    core.info(
      `Fetching and checking out existing remote backport branch ${sourceBranch}`,
    );
    runGitCommand(`git fetch origin ${sourceBranch}`);
    runGitCommand(`git checkout --track origin/${sourceBranch}`);
    return;
  }

  const localTag = getLatestTagForBranch(tagName);
  if (localTag) {
    core.info(
      `Creating new backport branch ${sourceBranch} from local tag ${localTag}`,
    );
    runGitCommand(`git checkout -b ${sourceBranch} ${localTag}`);
    return;
  }

  core.info(
    `Fetching tags from origin to look for a matching tag for ${tagName}`,
  );
  runGitCommand(`git fetch --tags origin`);
  const fetchedTag = getLatestTagForBranch(tagName);
  if (fetchedTag) {
    core.info(
      `Creating new backport branch ${sourceBranch} from fetched tag ${fetchedTag}`,
    );
    runGitCommand(`git checkout -b ${sourceBranch} ${fetchedTag}`);
    return;
  }

  core.info(`Creating new backport branch ${sourceBranch} from ${baseBranch}`);
  if (localBranchExists(baseBranch)) {
    runGitCommand(`git checkout -b ${sourceBranch} ${baseBranch}`);
    return;
  }

  if (remoteBranchExists(baseBranch)) {
    runGitCommand(`git fetch origin ${baseBranch}`);
    runGitCommand(`git checkout -b ${sourceBranch} origin/${baseBranch}`);
    return;
  }

  throw new Error(
    `Base branch ${baseBranch} does not exist locally or remotely. Cannot create ${sourceBranch}.`,
  );
}

type BackportResult = {
  request: string;
  targetBranch: string;
  status: string;
  branch: string;
  prUrl: string;
  error?: string;
};

export function prepareBackportPrBranch(backportBranch: string): void {
  if (localBranchExists(backportBranch)) {
    core.info(
      `Checking out existing local backport pull branch ${backportBranch}`,
    );
    runGitCommand(`git checkout ${backportBranch}`);
    return;
  }

  if (remoteBranchExists(backportBranch)) {
    core.info(
      `Fetching and checking out existing remote backport pull branch ${backportBranch}`,
    );
    runGitCommand(`git fetch origin ${backportBranch}`);
    runGitCommand(`git checkout --track origin/${backportBranch}`);
    return;
  }

  core.info(`Creating new backport pull branch ${backportBranch}`);
  runGitCommand(`git checkout -b ${backportBranch}`);
}

export function buildBackportComment(rows: BackportResult[]): string {
  const header = [
    "Backport action results:",
    "",
    "| Request | Target branch | Result | Backport branch | PR |",
    "|---|---|---|---|---|",
  ];

  const body = rows.map((row) => {
    const result = row.error ? `${row.status}: ${row.error}` : row.status;
    const branch = row.branch || "-";
    const prLink = row.prUrl ? `[link](${row.prUrl})` : "-";
    return `| ${row.request} | ${row.targetBranch} | ${result} | ${branch} | ${prLink} |`;
  });

  return [...header, ...body].join("\n");
}

async function commentOnOriginalPullRequest(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  rows: BackportResult[],
): Promise<void> {
  const body = buildBackportComment(rows);
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });
}

function cherryPickCommits(commitShas: string[]): void {
  for (const commitSha of commitShas) {
    if (commitAlreadyOnBranch(commitSha)) {
      core.info(
        `Commit ${commitSha} is already present on the target branch. Skipping.`,
      );
      continue;
    }

    try {
      core.info(`Cherry-picking commit ${commitSha}`);
      runGitCommand(`git cherry-pick ${commitSha}`);
    } catch (error) {
      core.error(
        `Cherry-pick failed for commit ${commitSha}. Attempting to abort.`,
      );
      try {
        runGitCommand("git cherry-pick --abort");
      } catch {
        core.warning(
          "Cherry-pick abort failed or there was no cherry-pick in progress.",
        );
      }
      throw new Error(
        `Failed to cherry-pick commit ${commitSha}: ${(error as Error).message}`,
      );
    }
  }
}

async function getPullRequestCommitShas(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullRequestNumber: number,
): Promise<string[]> {
  const commits = await octokit.rest.pulls.listCommits({
    owner,
    repo,
    pull_number: pullRequestNumber,
    per_page: 100,
  });

  return commits.data.map((commit) => commit.sha);
}

async function findExistingBackportPullRequest(
  octokit: Octokit,
  owner: string,
  repo: string,
  sourceBranch: string,
  targetBranch: string,
): Promise<null | { number: number; html_url: string }> {
  const response = await octokit.rest.pulls.list({
    owner,
    repo,
    state: "open",
    head: `${owner}:${sourceBranch}`,
    base: targetBranch,
    per_page: 100,
  });

  if (response.data.length > 0) {
    return {
      number: response.data[0].number,
      html_url: response.data[0].html_url,
    };
  }

  return null;
}

async function createBackportPullRequest(
  octokit: Octokit,
  owner: string,
  repo: string,
  sourceBranch: string,
  targetBranch: string,
  title: string,
  body: string,
): Promise<string> {
  const response = await octokit.rest.pulls.create({
    owner,
    repo,
    title,
    head: sourceBranch,
    base: targetBranch,
    body,
    maintainer_can_modify: true,
  });

  return response.data.html_url;
}

export async function getInputBasedOnMethod(
  detectionMethod: DetectionMethod,
  labels: string[],
  customInput: string,
  githubToken?: string,
  repoOwner?: string,
  repoName?: string,
  prNumber?: number,
): Promise<string[]> {
  switch (detectionMethod) {
    case "label":
      core.info("Using label input method");
      return labels;

    case "comment":
      core.info("Using comment input method");
      return getCommentInputs(githubToken, repoOwner, repoName, prNumber);

    case "custom":
      core.info("Using custom input method");
      return handleCustomInput(customInput);

    default:
      throw new Error(`Unsupported input method: ${detectionMethod}`);
  }
}

export async function backport(
  inputs: string[],
  inputPrefix: string,
  inputPattern: string[],
  targetBranchPrefix: string,
  prBaseBranch: string,
  githubToken: string,
  repoOwner: string,
  repoName: string,
  prNumber: number,
  prHeadBranch: string,
  prTitle: string,
  dryRun: boolean,
): Promise<void> {
  const octokit = github.getOctokit(githubToken) as unknown as Octokit;
  const results: BackportResult[] = [];

  for (const inputItem of inputs) {
    core.startGroup(`Processing input item: ${inputItem}`);
    core.debug(`Processing input: ${inputItem}`);

    if (!inputItem.startsWith(inputPrefix)) {
      core.info(
        `Input "${inputItem}" does not start with required prefix "${inputPrefix}". Skipping.`,
      );
      results.push({
        request: inputItem,
        targetBranch: inputItem,
        status: "skipped",
        branch: "",
        prUrl: "",
        error: `Invalid prefix; expected ${inputPrefix}`,
      });
      core.endGroup();
      continue;
    }

    const targetBranch = inputItem.substring(inputPrefix.length);
    core.debug(`Target branch after prefix removal: ${targetBranch}`);

    // TODO check if regex also can do v2.10.1039
    const isValidBranch = inputPattern.some((pattern) => {
      const regex = new RegExp(pattern);
      return regex.test(targetBranch);
    });

    if (!isValidBranch) {
      core.info(
        `Target branch "${targetBranch}" does not match any valid backport branch patterns. Skipping.`,
      );
      results.push({
        request: inputItem,
        targetBranch,
        status: "skipped",
        branch: "",
        prUrl: "",
        error: "Target branch does not match valid backport patterns",
      });
      core.endGroup();
      continue;
    }

    const targetBranchWithPrefix = `${targetBranchPrefix}${targetBranch}`;
    core.debug(`Backport target branch: ${targetBranchWithPrefix}`);

    const title = `Backport #${prNumber} to ${targetBranch}`;
    const body = `Backport of [#${prNumber}] from ${prHeadBranch} into ${targetBranch}.

    Original PR title: ${prTitle}`;

    const backportPrBranch = `${targetBranchWithPrefix}/pr-${prNumber}`;

    try {
      checkoutBackportBranch(
        targetBranchWithPrefix,
        targetBranch,
        prBaseBranch,
      );
      prepareBackportPrBranch(backportPrBranch);

      const commitShas = await getPullRequestCommitShas(
        octokit,
        repoOwner,
        repoName,
        prNumber,
      );

      if (commitShas.length === 0) {
        throw new Error(
          `Pull request #${prNumber} contains no commits. Cannot backport.`,
        );
      }

      cherryPickCommits(commitShas);

      core.info(`Pushing backport branch ${backportPrBranch} to origin`);
      runGitCommand(`git push --set-upstream origin ${backportPrBranch}`);

      const existingPr = await findExistingBackportPullRequest(
        octokit,
        repoOwner,
        repoName,
        backportPrBranch,
        targetBranch,
      );

      let prUrl: string;
      let status: string;

      if (existingPr) {
        core.info(
          `Backport pull request already exists: ${existingPr.html_url}`,
        );
        prUrl = existingPr.html_url;
        status = "already exists";
      } else {
        prUrl = await createBackportPullRequest(
          octokit,
          repoOwner,
          repoName,
          backportPrBranch,
          targetBranch,
          title,
          body,
        );
        core.info(`Created backport pull request: ${prUrl}`);
        status = "created";
      }

      results.push({
        request: inputItem,
        targetBranch,
        status,
        branch: backportPrBranch,
        prUrl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      core.error(`Backport failed for ${inputItem}: ${message}`);
      results.push({
        request: inputItem,
        targetBranch,
        status: "failed",
        branch: backportPrBranch,
        prUrl: "",
        error: message,
      });
    } finally {
      core.endGroup();
    }
  }

  if (results.length > 0) {
    await commentOnOriginalPullRequest(
      octokit,
      repoOwner,
      repoName,
      prNumber,
      results,
    );
  }
}
