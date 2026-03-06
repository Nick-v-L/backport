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
- Target branches (default: [^v\d+\.\d+\.\x$] (example v1.1.x or v1.2.x)) # list, supports regex
- Backport label pattern
- Custom input
- Github token (default: github token via env)
- Dry run
- PR title (supports inputs {branch-from}, {branch-to}, {commitMessage})
- Target PR labels

- Target branch prefix

# Create job summary about created backports

https://github.com/actions/toolkit/tree/main/packages/core
