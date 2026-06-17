# Backport Action

A GitHub Action that creates backport pull requests by detecting target branches from labels, comments, or custom input.

## Semantic version support

This action only supports semantic versioning for backport targets. Target branch names must use a semantic version pattern such as:

- `v1.0.x`
- `1.2.x`
- `software-v1.0.x`
- `hardware-v2.1.x`
- `release-v1.2.x-beta`

The action can match tags that include the same semantic version with optional prefix or suffix, for example:

- `software-v1.0.9`
- `hardware-v2.1.0`
- `release-v1.2.3-beta`

## Inputs

- `github-token`: GitHub token with permissions to create pull requests. Defaults to `${{ github.token }}`.
- `detection-method`: How backport targets are detected. One of `label`, `comment`, or `custom`. Default: `label`.
- `input-pattern`: Regular expression used to validate the target branch extracted from inputs. Default: `^.*v?\d+\.\d+\.x$`.
- `input-prefix`: Prefix required for detected inputs. Example: `backport-to-`.
- `target-branch-prefix`: Prefix for the source branch created for the backport. Default: `backport/`.
- `custom-input`: Custom backport target input when `detection-method` is `custom`.
- `dry-run`: When `true`, only logs intended backports without creating them.

## Example tags

If your repository contains both software and hardware artifacts in one repo, tags like these are supported:

- `software-v1.0.9`
- `hardware-v2.1.0`

Use corresponding backport targets such as:

- `backport-to-software-v1.0.x`
- `backport-to-hardware-v2.1.x`

## Notes

- The action validates targets against semantic versioning patterns only.
- Custom prefixes and suffixes around the version are allowed, but the version itself must remain semantic.
