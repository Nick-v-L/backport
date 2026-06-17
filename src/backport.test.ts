vi.mock("node:child_process", () => ({ execSync: vi.fn() }));
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import * as core from "@actions/core";
import * as github from "@actions/github";
import {
  getInputBasedOnMethod,
  backport,
  getLatestTagForBranch,
  findLatestMatchingTag,
  checkoutBackportBranch,
  prepareBackportPrBranch,
  buildBackportComment,
} from "./backport.js";

vi.mock("@actions/core", () => ({
  info: vi.fn(),
  debug: vi.fn(),
  startGroup: vi.fn(),
  endGroup: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  setFailed: vi.fn(),
  getBooleanInput: vi.fn(),
  getInput: vi.fn(),
}));

vi.mock("@actions/github", () => ({
  getOctokit: vi.fn(),
  context: {
    payload: {},
    repo: { owner: "test-owner", repo: "test-repo" },
  },
}));

describe("getInputBasedOnMethod", () => {
  it("returns labels when detection method is label", async () => {
    const result = await getInputBasedOnMethod(
      "label",
      ["backport-to-v1.0.x"],
      "",
    );
    expect(result).toEqual(["backport-to-v1.0.x"]);
  });

  it("returns custom input values when detection method is custom", async () => {
    const result = await getInputBasedOnMethod(
      "custom",
      [],
      "backport-to-v1.0.x, backport-to-v2.0.x",
    );
    expect(result).toEqual(["backport-to-v1.0.x", "backport-to-v2.0.x"]);
  });

  it("returns backport commands from a PR comment when detection method is comment", async () => {
    (github.context.payload as any) = {
      comment: {
        body: "/backport v2.2.x\n/backport v3.0.x",
      },
    };

    const result = await getInputBasedOnMethod(
      "comment",
      [],
      "",
      "token",
      "owner",
      "repo",
      1,
    );

    expect(result.sort()).toEqual(["backport-to-v2.2.x", "backport-to-v3.0.x"]);
  });

  it("returns backport commands from multiple PR comments", async () => {
    (github.context.payload as any) = {
      comment: {
        body: "Looks good",
      },
    };

    const gitHubMock = {
      rest: {
        issues: {
          listComments: vi
            .fn()
            .mockResolvedValueOnce({
              data: [{ body: "/backport v2.2.x" }],
            })
            .mockResolvedValueOnce({ data: [{ body: "/backport v3.0.x" }] })
            .mockResolvedValueOnce({ data: [] }),
        },
      },
    };
    (github.getOctokit as unknown as vi.Mock).mockReturnValue(gitHubMock);

    const result = await getInputBasedOnMethod(
      "comment",
      [],
      "",
      "token",
      "owner",
      "repo",
      1,
    );

    expect(result.sort()).toEqual(["backport-to-v2.2.x", "backport-to-v3.0.x"]);
    expect(gitHubMock.rest.issues.listComments).toHaveBeenCalledTimes(3);
  });

  it("returns an empty array when no backport commands exist in comment mode", async () => {
    (github.context.payload as any) = {
      comment: {
        body: "Looks good to me",
      },
    };

    const gitHubMock = {
      rest: {
        issues: {
          listComments: vi.fn().mockResolvedValue({ data: [] }),
        },
      },
    };
    (github.getOctokit as unknown as vi.Mock).mockReturnValue(gitHubMock);

    const result = await getInputBasedOnMethod(
      "comment",
      [],
      "",
      "token",
      "owner",
      "repo",
      1,
    );

    expect(result).toEqual([]);
  });

  it("throws for unsupported detection methods", async () => {
    await expect(
      getInputBasedOnMethod("unsupported" as any, [], ""),
    ).rejects.toThrow("Unsupported input method: unsupported");
  });
});

describe("findLatestMatchingTag", () => {
  it("returns the newest matching tag for branch patterns without v prefix", () => {
    expect(findLatestMatchingTag(["2.2.0", "2.2.3", "2.1.7"], "2.2.x")).toBe(
      "2.2.3",
    );
  });

  it("returns the newest matching tag for branch patterns with v prefix", () => {
    expect(
      findLatestMatchingTag(["v2.2.1", "v2.2.5", "v2.1.9"], "v2.2.x"),
    ).toBe("v2.2.5");
  });

  it("returns the newest matching tag for branch patterns with two-digit minor versions", () => {
    expect(
      findLatestMatchingTag(["2.25.0", "2.25.3", "2.24.9"], "2.25.x"),
    ).toBe("2.25.3");
  });

  it("returns the newest matching tag for branch patterns with two-digit major versions", () => {
    expect(findLatestMatchingTag(["10.0.0", "10.0.2", "9.9.9"], "10.0.x")).toBe(
      "10.0.2",
    );
  });

  it("returns the newest matching prefixed semantic tag for a branch with prefix", () => {
    expect(
      findLatestMatchingTag(
        ["software-v1.0.7", "software-v1.0.9", "hardware-v1.0.9"],
        "software-v1.0.x",
      ),
    ).toBe("software-v1.0.9");
  });

  it("returns null when no matching tags exist", () => {
    expect(findLatestMatchingTag(["2.3.0", "2.4.1"], "2.2.x")).toBeNull();
  });

  it("returns the newest matching tag (only major, minor) for branch patterns with v prefix", () => {
    expect(findLatestMatchingTag(["2.3", "2.4", "3.0"], "2.x")).toBe("2.4");
  });
});

describe("getLatestTagForBranch", () => {
  const execMock = vi.fn();

  beforeEach(() => {
    execMock.mockReset();
    (execSync as unknown as vi.Mock).mockImplementation(execMock);
  });

  it("returns the latest matching tag from git tag list", () => {
    execMock.mockReturnValue("2.2.0\n2.2.4\n2.2.3\n");

    expect(getLatestTagForBranch("2.2.x")).toBe("2.2.4");
    expect(execMock).toHaveBeenCalledWith("git tag --list", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  });
});

describe("buildBackportComment", () => {
  it("formats backport results into a markdown table", () => {
    const rows = [
      {
        request: "backport-to-v2.2.x",
        targetBranch: "v2.2.x",
        status: "created",
        branch: "backport/v2.2.x/pr-1",
        prUrl: "https://example.com/pr/123",
      },
      {
        request: "backport-to-v3.0.x",
        targetBranch: "v3.0.x",
        status: "failed",
        branch: "backport/v3.0.x/pr-1",
        prUrl: "",
        error: "Cherry-pick conflict",
      },
    ];

    const comment = buildBackportComment(rows as any);

    expect(comment).toContain("**⚠️ Some backports failed**");
    expect(comment).toContain("| Status | Branch | Result | PR |");
    expect(comment).toContain(
      "| ✅ created | v2.2.x | Backport created | [link](https://example.com/pr/123) |",
    );
    expect(comment).toContain(
      "| ❌ failed | v3.0.x | ❌ Cherry-pick conflict | - |",
    );
  });

  it("shows a success header when all backports are created", () => {
    const rows = [
      {
        request: "backport-to-v2.2.x",
        targetBranch: "v2.2.x",
        status: "created",
        branch: "backport/v2.2.x/pr-1",
        prUrl: "https://example.com/pr/123",
      },
    ];

    const comment = buildBackportComment(rows as any);

    expect(comment).toContain("**💚 All backports created successfully**");
    expect(comment).toContain(
      "| ✅ created | v2.2.x | Backport created | [link](https://example.com/pr/123) |",
    );
  });

  it("collapses newlines in error messages for markdown table output", () => {
    const rows = [
      {
        request: "backport-to-v1.1.x",
        targetBranch: "v1.1.x",
        status: "failed",
        branch: "backport/v1.1.x/pr-20",
        prUrl: "",
        error:
          "Command failed: git fetch origin backport/v1.1.x\nfatal: couldn't find remote ref backport/v1.1.x",
      },
    ];

    const comment = buildBackportComment(rows as any);

    expect(comment).toContain(
      "| ❌ failed | v1.1.x | ❌ Command failed: git fetch origin backport/v1.1.x fatal: couldn't find remote ref backport/v1.1.x | - |",
    );
    expect(comment).not.toContain("\nFatal:");
  });
});

describe("prepareBackportPrBranch", () => {
  const execMock = vi.fn();

  beforeEach(() => {
    execMock.mockReset();
    (execSync as unknown as vi.Mock).mockImplementation(execMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("checks out an existing local backport pull branch", () => {
    execMock.mockReturnValue("");

    prepareBackportPrBranch("backport/v2.2.x/pr-1");

    expect(execMock).toHaveBeenCalledWith(
      "git show-ref --verify --quiet refs/heads/backport/v2.2.x/pr-1",
      {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
  });

  it("fetches and tracks an existing remote backport pull branch when no local branch exists", () => {
    execMock
      .mockImplementationOnce(() => {
        throw new Error("branch not found");
      })
      .mockReturnValueOnce("abcdef1234\trefs/heads/backport/v2.2.x/pr-1\n")
      .mockReturnValueOnce("")
      .mockReturnValueOnce("");

    prepareBackportPrBranch("backport/v2.2.x/pr-1");

    expect(execMock).toHaveBeenNthCalledWith(
      1,
      "git show-ref --verify --quiet refs/heads/backport/v2.2.x/pr-1",
      {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    expect(execMock).toHaveBeenNthCalledWith(
      2,
      "git ls-remote --heads origin backport/v2.2.x/pr-1",
      {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    expect(execMock).toHaveBeenNthCalledWith(
      3,
      "git fetch origin backport/v2.2.x/pr-1",
      {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    expect(execMock).toHaveBeenNthCalledWith(
      4,
      "git checkout --track origin/backport/v2.2.x/pr-1",
      {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
  });
});

describe("backport", () => {
  it("creates a new backport PR and comments the original PR", async () => {
    const execMock = vi.fn();
    (execSync as unknown as vi.Mock).mockImplementation(execMock);

    execMock
      .mockImplementationOnce(() => {
        throw new Error("branch not found");
      })
      .mockImplementationOnce(() => {
        throw new Error("remote branch not found");
      })
      .mockReturnValueOnce("v2.2.5\n")
      .mockReturnValueOnce("")
      .mockImplementationOnce(() => {
        throw new Error("branch not found");
      })
      .mockImplementationOnce(() => {
        throw new Error("remote branch not found");
      })
      .mockReturnValueOnce("")
      .mockReturnValueOnce("")
      .mockReturnValueOnce("")
      .mockReturnValueOnce("")
      .mockReturnValueOnce("\n");

    const gitHubMock = {
      rest: {
        pulls: {
          listCommits: vi.fn().mockResolvedValue({
            data: [{ sha: "abc123" }],
          }),
          list: vi.fn().mockResolvedValue({ data: [] }),
          create: vi.fn().mockResolvedValue({
            data: { html_url: "https://example.com/pr/456" },
          }),
        },
        issues: {
          createComment: vi.fn().mockResolvedValue({}),
        },
      },
    };

    (github.getOctokit as unknown as vi.Mock).mockReturnValue(gitHubMock);

    await backport(
      ["backport-to-v2.2.x"],
      "backport-to-",
      ["^v\\d+\\.\\d+\\.x$"],
      "backport/",
      "main",
      "token",
      "owner",
      "repo",
      123,
      "feature-branch",
      "Test PR",
      false,
    );

    expect(gitHubMock.rest.pulls.create).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      title: "Backport #123 to v2.2.x",
      head: "backport/v2.2.x/pr-123",
      base: "v2.2.x",
      body: expect.stringContaining(
        "Backport of [#123] from feature-branch into v2.2.x",
      ),
      maintainer_can_modify: true,
    });
    expect(gitHubMock.rest.issues.createComment).toHaveBeenCalledOnce();
  });
});

describe("checkoutBackportBranch", () => {
  const execMock = vi.fn();

  beforeEach(() => {
    execMock.mockReset();
    (execSync as unknown as vi.Mock).mockImplementation(execMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a new branch from the latest local matching tag when no backport branch exists", () => {
    execMock
      .mockImplementationOnce(() => {
        throw new Error("branch not found");
      })
      .mockImplementationOnce(() => {
        throw new Error("remote branch not found");
      })
      .mockImplementationOnce(() => "2.2.1\n2.2.3\n")
      .mockImplementationOnce(() => "");

    checkoutBackportBranch("backport/v2.2.x", "2.2.x", "main");

    const childProcessOptions = {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    };

    expect(execMock).toHaveBeenNthCalledWith(
      1,
      "git show-ref --verify --quiet refs/heads/backport/v2.2.x",
      childProcessOptions,
    );
    expect(execMock).toHaveBeenNthCalledWith(
      2,
      "git ls-remote --heads origin backport/v2.2.x",
      childProcessOptions,
    );
    expect(execMock).toHaveBeenNthCalledWith(
      3,
      "git tag --list",
      childProcessOptions,
    );
    expect(execMock).toHaveBeenNthCalledWith(
      4,
      "git checkout -b backport/v2.2.x 2.2.3",
      childProcessOptions,
    );
  });

  it("does not treat an empty git ls-remote result as an existing remote branch", () => {
    execMock
      .mockImplementationOnce(() => {
        throw new Error("branch not found");
      })
      .mockReturnValueOnce("")
      .mockImplementationOnce(() => "2.2.1\n2.2.3\n")
      .mockImplementationOnce(() => "");

    checkoutBackportBranch("backport/v2.2.x", "2.2.x", "main");

    expect(execMock).toHaveBeenNthCalledWith(
      2,
      "git ls-remote --heads origin backport/v2.2.x",
      {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    expect(execMock).toHaveBeenNthCalledWith(3, "git tag --list", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  });
});

describe("backport", () => {
  it("skips inputs that do not start with the prefix", async () => {
    const gitHubMock = {
      rest: {
        pulls: {
          listCommits: vi.fn(),
          list: vi.fn(),
          create: vi.fn(),
        },
        issues: {
          createComment: vi.fn(),
        },
      },
    };
    (github.getOctokit as unknown as vi.Mock).mockReturnValue(gitHubMock);

    await backport(
      ["not-backport-to-v1.0.x"],
      "backport-to-",
      ["^v\\d+\\.\\d+\\.x$"],
      "backport/",
      "main",
      "token",
      "owner",
      "repo",
      1,
      "feature-branch",
      "Test PR",
      true,
    );

    expect(core.info).toHaveBeenCalledWith(
      'Input "not-backport-to-v1.0.x" does not start with required prefix "backport-to-". Skipping.',
    );
    expect(gitHubMock.rest.issues.createComment).toHaveBeenCalledOnce();
  });

  it("skips invalid target branches", async () => {
    const gitHubMock = {
      rest: {
        pulls: {
          listCommits: vi.fn(),
          list: vi.fn(),
          create: vi.fn(),
        },
        issues: {
          createComment: vi.fn(),
        },
      },
    };
    (github.getOctokit as unknown as vi.Mock).mockReturnValue(gitHubMock);

    await backport(
      ["backport-to-v1.1.1"],
      "backport-to-",
      ["^v\\d+\\.\\d+\\.x$"],
      "backport/",
      "main",
      "token",
      "owner",
      "repo",
      1,
      "feature-branch",
      "Test PR",
      true,
    );

    expect(core.info).toHaveBeenCalledWith(
      'Target branch "v1.1.1" does not match any valid backport branch patterns. Skipping.',
    );
    expect(gitHubMock.rest.issues.createComment).toHaveBeenCalledOnce();
  });
});
