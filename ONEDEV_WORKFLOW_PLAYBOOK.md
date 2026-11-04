# OneDev CI/CD & `tod` CLI Workflow Playbook for AI Agents

This playbook is the authoritative reference for AI coding agents working with OneDev repositories (`https://code.weexnes.dev/*`), `.onedev-buildspec.yml` CI/CD pipelines, and the `tod` (TheOneDev) command-line tool.

When referenced in `AGENTS.md` or a user prompt, follow the exact workflows, YAML schemas, and CLI commands below to author, validate, execute, and monitor OneDev builds, issues, and pull requests end-to-end.

---

## 1. Core End-to-End CI/CD Loop for Agents

Whenever you create or modify `.onedev-buildspec.yml` or build scripts, **always** run this closed-loop workflow until the OneDev build reaches `"status": "SUCCESSFUL"`:

1. **Author / Edit** `.onedev-buildspec.yml` in the repository root.
2. **Validate & Auto-Upgrade Schema Locally** before committing:
   ```bash
   tod build check-spec
   ```
   - `tod build check-spec` validates the YAML against the OneDev server's current schema (e.g. `version: 57`) and automatically upgrades/rewrites `.onedev-buildspec.yml` in place if needed.
   - If you are unsure about a step type or field name, inspect the live server schema via:
     ```bash
     tod build get-spec-schema
     ```
3. **Test Without Committing (Optional)** or **Commit & Push**:
   - You can test local uncommitted changes directly on the OneDev runner without polluting git history:
     ```bash
     tod build run "<Job Name>" --local
     ```
   - Or commit and push to trigger `BranchUpdateTrigger`:
     ```bash
     git add .onedev-buildspec.yml && git commit -m "Update OneDev buildspec" && git push origin main
     ```
4. **Monitor Build Execution & Inspect Logs**:
   - List recent builds in the current repository (returns JSON with `number`, `status`, and per-step `stepExecutions`):
     ```bash
     tod build list --count 5
     ```
   - Stream/fetch the full console output of build `<number>` (e.g., `1`, `2`, `#3`):
     ```bash
     tod build get-log <build-number>
     ```
   - Fetch structured build details (including published artifacts and step statuses):
     ```bash
     tod build get <build-number>
     ```
5. **Fix & Iterate**:
   - If `"status": "FAILED"`, read `tod build get-log <build-number>`, fix the root cause, run `tod build check-spec`, push, and monitor the new build until it succeeds.

---

## 2. `.onedev-buildspec.yml` Syntax & Reference Templates

### Key Rules for OneDev Buildspecs on This System
- **Schema Version**: Use `version: 57` (or run `tod build check-spec` to auto-upgrade from older versions like `43` or `53`).
- **Job Executor**: Always set `jobExecutor: Builder` (unless deploying to a dedicated target like `ClyoCloud`).
- **Runner Environment**: The `Builder` agent runs on **Arch Linux (`x86_64`)** (`runInContainer: false`).
  - Standard tools available: `git`, `node`, `npm`, `npx`, `dotnet`, `v`, `cargo`, `go`, `zip`, `tar`, `curl`, `makepkg`.
  - **Pitfall with `electron-builder` on Arch Linux**:
    1. Avoid `deb`/`rpm` targets that invoke electron-builder's bundled `fpm` binary (`fpm` fails on Arch Linux due to missing legacy `libcrypt.so.1`). Prefer `AppImage`, `tar.gz`, and `zip` for Linux.
    2. When cross-packaging Windows targets on Linux without Wine installed, set `win.signAndEditExecutable: false` in `electron-builder.yml` (or pass `-c.win.signAndEditExecutable=false`) so `rcedit` does not require `wine`.
  - **Escaping `@` in Shell Commands**: OneDev uses `@variable@` for build interpolation (e.g., `@commit_hash@`, `@tag@`, `@file:version.txt@`). If your shell script contains a literal `@` (such as an SSH URL `ssh://aur@@aur.archlinux.org/...` or `v -path "src:@@vlib"`), you **must escape it as `@@`**.

### Template A: Multi-Platform Build & Artifact Upload (`PublishArtifactStep`)

```yaml
version: 57
jobs:
- name: Build & Package Release
  executeInSandbox: false
  jobExecutor: Builder
  steps:
  - type: CheckoutStep
    name: checkout code
    cloneCredential:
      type: DefaultCredential
    withLfs: false
    withSubmodules: false
    condition: SUCCESSFUL
    optional: false
  - type: CommandStep
    name: Build & Test
    runInContainer: false
    interpreter:
      type: PosixInterpreter
      shell: sh
      commands: |
        set -e
        npm install
        npm test
        npm run build
    runAs: 0:0
    useTTY: true
    condition: SUCCESSFUL
    optional: false
  - type: CommandStep
    name: Package Artifacts
    runInContainer: false
    interpreter:
      type: PosixInterpreter
      shell: sh
      commands: |
        set -e
        rm -rf artifacts
        mkdir -p artifacts
        # Place all output binaries/archives into ./artifacts/
        cp -r dist/* artifacts/
    runAs: 0:0
    useTTY: true
    condition: SUCCESSFUL
    optional: false
  - type: PublishArtifactStep
    name: Upload Artifacts
    sourcePath: artifacts
    artifacts: '**'
    condition: SUCCESSFUL
    optional: false
  triggers:
  - type: BranchUpdateTrigger
    userMatch: anyone
  - type: PullRequestUpdateTrigger
  retryCondition: never
  maxAttempts: 4
  retryDelay: 30
  includeUpstreamWhenRebuild: false
  includeDownstreamWhenRebuild: false
  timeout: 14400
```

### Template B: Auto-Version Extraction & Tag Creation (`SetBuildVersionStep` + `CreateTagStep`)

Used when a push to `main`/`master` should extract the version from `package.json` or `Directory.Build.props`, set the OneDev build version, and create a release tag that triggers downstream release jobs:

```yaml
  - type: CommandStep
    name: get version
    runInContainer: false
    interpreter:
      type: PosixInterpreter
      shell: sh
      commands: |
        grep -oP '"version":\s*"\K[^"]+' package.json > version.txt
        version=$(cat version.txt)
        if git ls-remote --tags origin | grep -q "refs/tags/${version}$"; then
          echo "${version}-@commit_hash@" > version.txt
        fi
    runAs: 0:0
    useTTY: true
    condition: SUCCESSFUL
    optional: false
  - type: SetBuildVersionStep
    name: set build version
    buildVersion: '@file:version.txt@'
    condition: ALWAYS
    optional: false
  - type: CreateTagStep
    name: create tag
    tagName: '@file:version.txt@'
    tagMessage: 'Release @file:version.txt@'
    condition: SUCCESSFUL
    optional: false
```

---

## 3. Complete `tod` CLI Reference for AI Agents

`tod` automatically infers the OneDev project from the current working directory's git remote (or accepts `--working-dir <path>` / `--project <name>`).

### A. Builds (`tod build`)
| Command | Description |
| :--- | :--- |
| `tod build check-spec` | Validate and upgrade `.onedev-buildspec.yml` in the current repo. |
| `tod build get-spec-schema` | Print the complete YAML schema for `.onedev-buildspec.yml`. |
| `tod build list [--count N] [--query "..."]` | List builds in JSON (`number`, `status`, `stepExecutions`, `link`). |
| `tod build get <build-number>` | Get full metadata and artifact list for a specific build (`1` or `#1`). |
| `tod build get-log <build-number>` | Fetch the complete console output log of a build. |
| `tod build run "<job-name>" --local` | Run a CI job against uncommitted local changes without pushing. |
| `tod build run "<job-name>" --branch main` | Trigger a CI job on a specific remote branch (or `--tag <tag>`). |
| `tod build get-changes-since-success <num>` | Show file changes since the last successful build. |
| `tod build get-code-problems <num>` | Get compiler/linter code problems reported in a build. |
| `tod build get-unit-test-report <num>` | Get unit test report from a build. |

### B. Issues (`tod issue`)
| Command | Description |
| :--- | :--- |
| `tod issue list [--query "..."]` | List issues in the current project (run `tod issue get-query-description` for DSL). |
| `tod issue get <issue-number>` | Get detailed JSON info of an issue (title, description, state, custom fields). |
| `tod issue get-comments <issue-number>` | Read all comments on an issue. |
| `tod issue create --title "..." --description "..."` | Create a new issue (check `tod issue get-valid-fields` for `--field key=val`). |
| `tod issue edit <issue-number> ...` | Edit an existing issue's title, description, or fields. |
| `tod issue add-comment <issue-number> --content "..."` | Post a Markdown comment on an issue. |
| `tod issue change-state <issue-number> --state "..."` | Transition an issue state (e.g., `Open`, `In Progress`, `Closed`). |
| `tod issue checkout <issue-number>` | Checkout or create a branch for the given issue (`tod issue create-branch`). |
| `tod issue link <src> <link-name> <target>` | Link two issues (`tod issue get-valid-links` to see link types). |

### C. Pull Requests & Code Review (`tod pr` & `tod code-comment`)
| Command | Description |
| :--- | :--- |
| `tod pr list [--query "..."]` | List pull requests in the project. |
| `tod pr get <pr-number>` | Get PR metadata, merge status, and reviews. |
| `tod pr get-patch <pr-number>` | Get the unified diff patch for a pull request. |
| `tod pr get-builds <pr-number>` | List CI builds associated with a pull request. |
| `tod pr get-comments <pr-number>` | Get general conversation comments on a PR. |
| `tod pr get-code-comments <pr-number>` | Get line-anchored inline code comments in JSON (`id`, `filePath`, `startLine`, `resolved`). |
| `tod pr create --title "..." --target-branch main` | Open a new pull request from the current branch. |
| `tod pr checkout <pr-number>` | Checkout a pull request locally. |
| `tod pr add-comment <pr-number> --content "..."` | Add a general Markdown comment to a PR. |
| `tod pr add-code-comment <pr-number> ...` | Add an inline code review comment on a file/line range. |
| `tod pr approve <pr-number>` | Approve a pull request (`tod pr request-changes <pr-number>` to request changes). |
| `tod pr merge <pr-number>` | Merge an approved pull request (`tod pr discard <pr-number>` to close). |
| `tod code-comment add-reply <comment-id> --content "..."` | Reply to an inline code comment. |
| `tod code-comment resolve <comment-id>` | Mark an inline code comment as resolved (`unresolve` to reopen). |

### D. Projects & Utilities (`tod project`, `tod download`, etc.)
| Command | Description |
| :--- | :--- |
| `tod project current` | Print the OneDev project path inferred from the current directory. |
| `tod project list` | List all accessible OneDev projects on the server. |
| `tod get-valid-labels` | List valid label names on the OneDev server. |
| `tod get-commit-message-requirement` | Check if the project enforces a commit message regex/format. |
| `tod download <url-or-markdown-path>` | Download an attachment or image referenced in an issue/PR comment. |
