import * as core from "@actions/core";
import * as github from "@actions/github";
import { Octokit } from "@octokit/rest";

import { InputMethod } from "./interfaces";

function handleCustomInput(customInput: string): string[] {
  return customInput.split(/[\s,]+/).filter(Boolean);
}

async function handleLabelInput(octokit: Octokit): Promise<string[]> {
  const labels = await octokit.issues.listLabelsOnIssue();
  return labels.data.map((label) => label.name);
}

async function determineInputBranchBasedOnMethod(
  inputMethod: InputMethod,
  octokit: Octokit,
  customInput: string,
): Promise<string[]> {
  switch (inputMethod) {
    case "label":
      core.info("Using label detection method");
      return await handleLabelInput(octokit);

    case "comment":
      core.info("Using comment detection method");
      return []; // TODO: implement

    case "custom":
      core.info("Using custom input detection method");
      return handleCustomInput(customInput);

    default:
      throw new Error(`Unsupported input method: ${inputMethod}`);
  }

  // Split input based on , or space
}

export async function backport(
  inputMethod: InputMethod,
  octokit: Octokit,
  customInput: string,
) {
  const inputBranches = await determineInputBranchBasedOnMethod(
    inputMethod,
    octokit,
    customInput,
  );
  core.info(`Determined input branches: ${inputBranches.join(", ")}`);
  // Determine input method and get the correct input
  // Loop inputs
  //   Match input prefix and remove from the input
  //   Match target branch to target branch inputs/patterns
  //   Add branch prefix to target branch
  //   Check if branch already exists
  //     If not, create branch based on version (maybe setting)
  //   Create PR into branch
  // Add comment to original PR with summary of backport results (successes and failures)
  // Output something, maybe a list of backports created and their URLs
}

export const exportedForTesting = {
  handleCustomInput,
};
