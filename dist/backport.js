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
exports.exportedForTesting = void 0;
exports.backport = backport;
const core = __importStar(require("@actions/core"));
function handleCustomInput(customInput) {
    return customInput.split(/[\s,]+/).filter(Boolean);
}
async function handleLabelInput(octokit) {
    const labels = await octokit.issues.listLabelsOnIssue();
    return labels.data.map((label) => label.name);
}
async function determineInputBranchBasedOnMethod(inputMethod, octokit, customInput) {
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
async function backport(inputMethod, octokit, customInput) {
    const inputBranches = await determineInputBranchBasedOnMethod(inputMethod, octokit, customInput);
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
exports.exportedForTesting = {
    handleCustomInput,
};
