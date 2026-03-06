"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const backport_1 = require("./backport");
async function run() {
    try {
        const inputMethod = core.getInput("input-method");
        const targetBranchesInput = core.getMultilineInput("target-branch-pattern");
        const inputPrefix = core.getInput("input-prefix");
        const customInput = core.getInput("custom-input");
        const branchPrefix = core.getInput("branch-prefix");
        const githubToken = core.getInput("github-token");
        const dryRun = core.getBooleanInput("dry-run");
        core.startGroup("Action Inputs");
        core.debug(`Input method: ${inputMethod}`);
        core.debug(`Target branches: ${targetBranchesInput.join(", ")}`);
        core.debug(`Input prefix: ${inputPrefix}`);
        core.debug(`Custom input: ${customInput}`);
        core.debug(`Branch prefix: ${branchPrefix}`);
        core.debug(`GitHub token: ${githubToken}`);
        core.debug(`Dry run: ${dryRun}`);
        core.endGroup();
        if (!["label", "comment", "custom"].includes(inputMethod)) {
            throw new Error(`Invalid detection method: ${inputMethod}. Valid options are: label, comment, custom.`);
        }
        if (customInput && inputMethod !== "custom") {
            core.warning(`Custom input provided, but input method is not set to custom. Custom input will be ignored.`);
        }
        if (!github.context.payload.pull_request) {
            throw new Error(`This action can only be run in the context of a pull request.`);
        }
        if (dryRun) {
            core.notice(`Dry run mode enabled. No actual backports will be created.`);
        }
        const octokit = github.getOctokit(githubToken);
        await (0, backport_1.backport)(inputMethod, octokit, customInput);
    }
    catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        }
        else {
            core.setFailed(String(error));
        }
    }
}
run();
