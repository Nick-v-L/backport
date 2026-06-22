import * as core from "@actions/core";
import * as github from "@actions/github";
import { DetectionMethod } from "./interfaces.js";
import { getInputBasedOnMethod, backport } from "./backport.js";

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const githubToken = core.getInput("github-token");
    const detectionMethod = core.getInput(
      "detection-method",
    ) as DetectionMethod;
    const inputPattern = core
      .getInput("input-pattern")
      .split(",")
      .map((branch) => branch.trim());
    const inputPrefix = core.getInput("input-prefix");
    const customInput = core.getInput("custom-input");
    const dryRun = core.getBooleanInput("dry-run");

    core.startGroup("Action Inputs");
    core.debug(`Input method: ${detectionMethod}`);
    core.debug(`Input pattern: ${inputPattern.join(", ")}`);
    core.debug(`Input prefix: ${inputPrefix}`);
    core.debug(`Custom input: ${customInput}`);
    core.debug(`GitHub token provided: ${Boolean(githubToken)}`);
    core.debug(`Dry run: ${dryRun}`);
    core.endGroup();

    if (!["label", "comment", "custom"].includes(detectionMethod)) {
      throw new Error(
        `Invalid detection method: ${detectionMethod}. Valid options are: label, comment, custom.`,
      );
    }

    if (customInput && detectionMethod !== "custom") {
      core.warning(
        `Custom input provided, but input method is not set to custom. Custom input will be ignored.`,
      );
    }

    if (!github.context.payload.pull_request) {
      throw new Error(
        `This action can only be run in the context of a pull request.`,
      );
    }

    const pullRequest = github.context.payload.pull_request;
    const repoOwner = github.context.repo.owner;
    const repoName = github.context.repo.repo;
    const prNumber = pullRequest.number;
    const prHeadBranch = pullRequest.head.ref;
    const prTitle = pullRequest.title;
    const prUrl = pullRequest.html_url as string;

    core.startGroup("Pull Request Context");
    core.debug(`PR number: ${prNumber}`);
    core.debug(`PR title: ${prTitle}`);
    core.debug(`PR head branch: ${prHeadBranch}`);

    const labels: string[] = pullRequest.labels.map(
      (label: { name: string }) => label.name,
    );
    core.debug(`PR labels: ${labels.join(", ")}`);
    core.debug(`PR URL: ${prUrl}`);
    core.debug(`Full PR payload: ${JSON.stringify(pullRequest, null, 2)}`);
    core.endGroup();

    if (dryRun) {
      core.notice(`Dry run mode enabled. No actual backports will be created.`);
    }

    const input = await getInputBasedOnMethod(
      detectionMethod,
      labels,
      customInput,
      githubToken,
      repoOwner,
      repoName,
      prNumber,
    );

    core.info(`Input: ${input.join(", ")}`);

    await backport(
      input,
      inputPrefix,
      inputPattern,
      githubToken,
      repoOwner,
      repoName,
      prNumber,
      prHeadBranch,
      prTitle,
      prUrl,
      dryRun,
    );
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed(String(error));
    }
  }
}
