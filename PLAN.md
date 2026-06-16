# Plan

## Backport structure

### Scenario 1

v1.0.0 has been build
v2.0.0 has been build
PR#1 has been created to main, but is needed for v1.0.1
Backport to v1.0.x

### Scenario 2

v1.0.0 has been build
v1.1.0 has been build
v1.1.2 has been build
PR#1 has been created to main, but is needed for v1.1.3
Backport to v1.1.x

### Scenario 3

v1.0.0 has been build
v1.1.0 has been build
v2.0.0 has been build
PR#1 has been created to main, but is needed for v1.0.1 and v1.1.1
Backport to v1.0.x AND v1.1.x

## Inputs

- Detection method (options: label, comment, custom)
- Valid backport branches (default: [^v\d+\.\d+\.x$] (example v1.1.x or v1.2.x)) # list, supports regex
- Input prefix
- Custom input
- Github token (default: github token via env)
- Dry run
- PR title (supports inputs {branch-from}, {branch-to}, {commitMessage})
- Target PR labels

- Target branch prefix

## Flow

- What is the input -> label, comment or custom
- Get all inputs
- Loop through the inputs
  - Check if inputs match a valid prefix
  - Remove input prefix
  - Check the input against the valid backport branches, if not valid continue
  - Add backport branch prefix to target branch
  - Check if branch already exists
    - If not, create branch based on version (maybe setting)
  - Create PR into branch
  - Add comment to original PR with summary of backport results (successes and failures)
  - Output something, maybe a list of backports created and their URLs

TODO: Prefix maybe pattern

# Create job summary about created backports

https://github.com/actions/toolkit/tree/main/packages/core
