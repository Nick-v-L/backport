/**
 * The entrypoint for the action. This file simply imports and runs the action's
 * main logic.
 */
import { run } from "./main.ts";

/* istanbul ignore next */
run();

// import * as core from "@actions/core";
// import * as github from "@actions/github";
// import { Octokit } from "@octokit/rest";

// // import { InputMethod } from "./interfaces";
// // import { backport } from "./backport";

// async function run() {
//   try {
//     const inputMethod = core.getInput("input-method") as InputMethod;
//     const targetBranchesInput = core.getMultilineInput("target-branch-pattern");
//     const inputPrefix = core.getInput("input-prefix");
//     const customInput = core.getInput("custom-input");
//     const branchPrefix = core.getInput("branch-prefix");
//     const githubToken = core.getInput("github-token");
//     const dryRun = core.getBooleanInput("dry-run");

//     core.startGroup("Action Inputs");
//     core.debug(`Input method: ${inputMethod}`);
//     core.debug(`Target branches: ${targetBranchesInput.join(", ")}`);
//     core.debug(`Input prefix: ${inputPrefix}`);
//     core.debug(`Custom input: ${customInput}`);
//     core.debug(`Branch prefix: ${branchPrefix}`);
//     core.debug(`GitHub token: ${githubToken}`);
//     core.debug(`Dry run: ${dryRun}`);
//     core.endGroup();

//     if (!["label", "comment", "custom"].includes(inputMethod)) {
//       throw new Error(
//         `Invalid detection method: ${inputMethod}. Valid options are: label, comment, custom.`,
//       );
//     }

//     if (customInput && inputMethod !== "custom") {
//       core.warning(
//         `Custom input provided, but input method is not set to custom. Custom input will be ignored.`,
//       );
//     }

//     if (!github.context.payload.pull_request) {
//       throw new Error(
//         `This action can only be run in the context of a pull request.`,
//       );
//     }

//     if (dryRun) {
//       core.notice(`Dry run mode enabled. No actual backports will be created.`);
//     }

//     const octokit = github.getOctokit(githubToken) as unknown as Octokit;
//     await backport(inputMethod, octokit, customInput);
//   } catch (error) {
//     if (error instanceof Error) {
//       core.setFailed(error.message);
//     } else {
//       core.setFailed(String(error));
//     }
//   }
// }

// run();
