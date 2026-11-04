# OneDev Playbook

How to manage projects, builds, pull requests and issues on `https://code.weexnes.dev`.

| File | Use it for |
| --- | --- |
| [AGENT_INSTRUCTIONS.md](AGENT_INSTRUCTIONS.md) | The rules a coding agent follows. Read these first. |
| PLAYBOOK.md (this file) | Workflows, the `tod` reference, build specs, REST recipes |
| [API_REFERENCE.md](API_REFERENCE.md) | Every REST operation: 44 resources, 308 operations |
| [onedev-helpers.sh](onedev-helpers.sh) | `od` (REST call) and `od_wait_build` (poll a build) |
| [generate_api_reference.py](generate_api_reference.py) | Rebuilds the API reference after a OneDev upgrade |

The original `ONEDEV_WORKFLOW_PLAYBOOK.md` is kept word for word in [Appendix A](#appendix-a-original-workflow-playbook). Where it disagrees with this file, this file wins. [Section 4](#4-corrections-to-the-original-playbook) lists each difference.

## 1. What has been verified

Checked on 2026-10-30 against OneDev 17.0.0 and `tod` 4.4.0. **Nothing on the instance was created, changed or deleted to write this.** That has one consequence: no write call in this playbook has ever been run. Each one comes from the instance's help and may need adjusting the first time it is used.

| Tag | Meaning |
| --- | --- |
| **[live]** | Run against the instance, read-only |
| **[help]** | Read from the instance's API help or `tod --help`, but not run |
| **[upstream]** | From docs.onedev.io or the `tod` repository, but not run |
| **[unverified]** | Inferred, or the sources are silent. Check before relying on it |

**Open questions:**

| # | Question | What is known | How to settle it |
| --- | --- | --- | --- |
| 1 | **`tod build get-log` returned nothing.** | **[live]** On builds 232, 233, 234 and failed build 204 it printed 0 bytes and exited 0, with or without a TTY. Cause unknown. It could be a permissions, retention or `tod`/server version issue. | Open the build's `link` in the browser and compare. Until then, **empty output never means a clean log.** |
| 2 | **REST auth with a token.** | **[help]** Basic auth with "user name and password (or access token)". The exact `login:token` form has not been run against the server. The docs read for this playbook describe no Bearer form, so do not use one. | `od GET /users/me` with your env vars set. It should return your own user. |
| 3 | **Do `runInContainer: false` steps run as root?** | **[help]** The schema defines `runAs` only under `runInContainer: true`, as "uid:gid to run container as", so `runAs: 0:0` on a host step looks like a no-op. **[upstream]** Host jobs run "with the agent process's OS permissions", and the agent service defaults to root unless configured otherwise. **[live]** Work directories are `/home/onedev/.agent/...` (Build & Test, Release Stable AUR) and `/home/weexnes/.agent/...` (Deploy to Server), which hints at non-root agents but does not prove it. | Add `id` to a test job, or run `ps -o user= -C java` on each agent host. |
| 4 | **`Builder` tool list and Arch Linux claims.** | Carried over from the original playbook. | Run the tools from a test job. |
| 5 | **Replace or merge on settings writes.** | **[unverified]** The help says only "Update project settings" for `POST /projects/{id}/setting`. Assume it replaces the whole object. | Always read, modify, write. See [recipe 8.3](#83-branch-protection-and-project-settings). |
| 6 | **String bodies.** | **[help]** Several writes (merge, discard, set title) take a "JSON string". Whether that means `"text"` with quotes has not been tried. | Send a quoted JSON string with `Content-Type: application/json`, and check the result. |
| 7 | **`tod build run` streaming.** | **[upstream]** Streams the log and final status. Not run here because it creates a build. What Ctrl-C does to the job is unknown. | Observe on a harmless job. |
| 8 | **The help's `"Number" is "path#100"` build lookup.** | **[live]** Anonymously, `"Number" is "ClyoCloud#234"` returned HTTP 406, while `"Project" is "ClyoCloud" and "Number" is "234"` worked. Not tried with auth. | Use the form that worked. |

**Also observed:** anonymous access is on for this instance. **[live]** Without a token, `GET /projects`, `/builds`, and `/projects/ids/ClyoCloud` all return data, including work directory paths. `/streaming/build-logs/{id}`, `/settings/system` and `/tod/*` return 401. Assume project names and build metadata are public, so keep secrets out of job names, branch names and build descriptions.

## 2. Setup

### Install and configure `tod`

**[upstream]** Installs from `code.onedev.io/onedev/tod` and needs OneDev 16.9.5 or later.

```bash
tod version
```

**[live]** It takes configuration from the environment, which overrides the config file. `tod config get` redacts the token.

```bash
export ONEDEV_SERVER_URL=https://code.weexnes.dev
```

```bash
export ONEDEV_USER=your-login
```

```bash
read -rs ONEDEV_ACCESS_TOKEN && export ONEDEV_ACCESS_TOKEN
```

```bash
tod config get
```

Without those variables, `tod` falls back to `~/.config/tod/config` (mode 0600). That file is fine for `tod` itself, but agents must never read it or copy from it.

### Tokens

- **Create** one under your account's access tokens in the web UI.
- **Scope it.** Create it without `hasOwnerPermissions` and grant only the projects it needs. **[help]** Project authorizations are ignored while `hasOwnerPermissions` is on.
- **Give it an expiry date**, and rotate it if it might have leaked.
- **Never put a token in a git remote URL**, a commit, a build spec, a build log or a query string. Job secrets belong in project settings and are referenced from the spec.

### REST helper

```bash
. .agents/onedev/onedev-helpers.sh
```

`od METHOD /path [curl args]` adds `/~api` and sends credentials without exposing them in `ps`. **[live]** The credential handling was tested against a local listener only.

## 3. Choosing a tool

| Task | Use |
| --- | --- |
| Clone, commit, push, branch | `git` |
| Builds, PRs, issues, reviews | `tod` |
| Create or configure a project, labels, iterations, artifacts | REST (`od`), since `tod` has no command for these |
| Users, groups, roles, agents, tokens, instance settings | REST, and always with explicit approval |
| Any option you can't find | [API_REFERENCE.md](API_REFERENCE.md), then `/~api/help` |

**Three things to remember:**

- **`tod` takes references, REST takes ids.** `#234` is a build number, while REST wants the id (784). The same goes for PRs and issues. See [recipe 8.5](#85-translating-numbers-to-ids).
- **`tod` needs a checkout or `--project`.** It infers the project from the git remote, and `--working-dir` can point it elsewhere. Only some commands accept `--project`, including `build list`, `build run`, `issue create`, `issue list`, `pr list`.
- **`tod` list commands print pagination notes on stderr**, so stdout stays valid JSON. **[live]**

## 4. Corrections to the original playbook

Each is checked against `tod --help` from version 4.4.0. **[help]**

| Original | Correct |
| --- | --- |
| `tod issue create --title "..."` | `tod issue create "<title>" --description "..."` |
| `tod pr create --title "..." --target-branch main` | `tod pr create "<title>" --target-branch master` |
| `tod issue add-comment <n> --content "..."` | `tod issue add-comment <n> "text"` or `--file <path>` |
| `tod pr add-comment <n> --content "..."` | `tod pr add-comment <n> "text"` or `--file <path>` |
| `tod code-comment add-reply <id> --content "..."` | `tod code-comment add-reply <id> "text"` or `--file <path>` |
| `tod issue change-state <n> --state "..."` | `tod issue change-state <n> "<state>"` |
| `tod build get-code-problems <num>` | `tod build get-code-problems <ref> <report-name> <CRITICAL\|HIGH\|MEDIUM\|LOW>` |
| `tod build get-unit-test-report <num>` | `tod build get-unit-test-report <ref> <report-name>` |
| `tod download <url>` | `tod download <url> <output-file>` |
| `tod pr add-code-comment <n> ...` | Requires `--on-file` and `--from-line`; `--to-line` is optional |

**Corrections in substance:**

| Original says | What actually happens |
| --- | --- |
| `--local` tests "without polluting git history" | It does not touch your branch, but it **pushes a snapshot to `refs/onedev/tod` and runs on the server's executor**, not on your machine. **[upstream]** It includes staged changes and unstaged changes to tracked files. Untracked files are left out until staged. Treat it as an outward-facing action. |
| `check-spec` validates | It also **rewrites `.onedev-buildspec.yml` in place**. Review the diff afterwards, and don't run it while someone else is editing the file. |
| Always loop "until SUCCESSFUL" | Keep the loop, but stop and report after 3 failures with the same cause. Pushing needs authorization first. |
| `git push origin main` | Check `defaultBranch` first. It's `master` on ClyoCloud. |
| Templates use `PullRequestUpdateTrigger` with host steps | That runs PR-supplied code directly on the agent. Only use it where every PR author is trusted. |
| Templates use `npm install` | Prefer `npm ci` when a lockfile is committed. |

**Commands the original left out:** `tod pr edit`, `pr current-reference`, `pr get-title-and-description-requirement`, `pr get-commit-message-requirement`, `pr get-query-description`, `issue log-work`, `issue unlink`, `issue create-branch`, `issue current-reference`, `issue get-valid-fields`, `issue get-valid-links`, `issue get-query-description`, `build get-query-description`, `project get`, `project get-query-description`, `config`, `remote`, `get-login-name`, `get-unix-timestamp`, `version`.

## 5. `tod` reference

Complete for `tod` 4.4.0. **[help]** `tod <command> --help` gives the same detail.

### Builds

| Command | Purpose |
| --- | --- |
| `tod build list [--count N] [--offset N] [--project P] [--query Q]` | Query builds. Default 25, maximum 100. |
| `tod build get <ref>` | Status, step executions, submit reason, agent and `link`. **[live]** |
| `tod build get-log <ref>` | Fetch the log. **See open question 1.** |
| `tod build run <job> --branch B\|--tag T\|--local [-p key=value] [--project P]` | Run a job. Exactly one of branch, tag or local. `--project` only with branch or tag. |
| `tod build check-spec` | Validate **and rewrite** the local spec. |
| `tod build get-spec-schema` | Live YAML schema. **[live]** |
| `tod build get-changes-since-success <ref>` | Files changed since the last similar success. |
| `tod build get-code-problems <ref> <report> <severity>` | Problems at or above a severity. |
| `tod build get-unit-test-report <ref> <report> [--artifact PATH]` | Test report, or download one of its artifacts. |
| `tod build get-query-description` | Query grammar. **[live]** |

### Pull requests

| Command | Purpose |
| --- | --- |
| `tod pr list [--count] [--offset] [--project] [--query]` | Query PRs. **[live]** |
| `tod pr get <ref>` | Details, without comments. |
| `tod pr get-patch <ref> [--for-code-review]` | The diff. |
| `tod pr get-builds <ref>` | Builds of the PR. |
| `tod pr get-comments <ref>` | Conversation comments. |
| `tod pr get-code-comments <ref>` | Inline comments as JSON, with `id`, `filePath`, `startLine`, `endLine`, `resolved`, `replies`. |
| `tod pr create <title> [--description\|--description-file] [--source-branch] [--target-branch] [--source-project] [--target-project] [--reviewer] [--assignee] [--label] [--merge-strategy]` | Open a PR. |
| `tod pr edit <ref> [--title] [--description\|--description-file] [--add-reviewer] [--remove-reviewer] [--assignee] [--label] [--merge-strategy] [--auto-merge] [--auto-merge-commit-message]` | Change a PR. |
| `tod pr checkout <ref> [--for-write]` | Check it out locally. |
| `tod pr add-comment <ref> [text] [--file]` | Add a comment. |
| `tod pr add-code-comment <ref> [text] [--file] --on-file F --from-line N [--to-line N]` | Inline comment, on lines visible on the patch's right side. |
| `tod pr approve <ref> [--summary\|--summary-file]` | Approve as a pending reviewer. |
| `tod pr request-changes <ref> [--summary\|--summary-file]` | Request changes as a pending reviewer. |
| `tod pr merge <ref> [--commit-message]` | Merge. |
| `tod pr discard <ref> [--comment\|--comment-file]` | Close without merging. |
| `tod pr current-reference` | PR number for the current branch. |
| `tod pr get-commit-message-requirement [--source-branch] [--target-branch] [--source-project] [--target-project]` | Commit rule that applies. |
| `tod pr get-title-and-description-requirement [same flags]` | Title and description rule that applies. |
| `tod pr get-query-description` | Query grammar. **[live]** |

Merge strategies: `CREATE_MERGE_COMMIT`, `CREATE_MERGE_COMMIT_IF_NECESSARY`, `SQUASH_SOURCE_BRANCH_COMMITS`, `REBASE_SOURCE_BRANCH_COMMITS`.

### Code comments

| Command | Purpose |
| --- | --- |
| `tod code-comment add-reply <id> [text] [--file]` | Reply. Get ids from `tod pr get-code-comments`. |
| `tod code-comment resolve <id> [--note\|--note-file]` | Mark resolved. |
| `tod code-comment unresolve <id> [--note\|--note-file]` | Reopen. |

### Issues

| Command | Purpose |
| --- | --- |
| `tod issue list [--count] [--offset] [--project] [--query]` | Query issues. **[live]** |
| `tod issue get <ref>` | Details, without comments. |
| `tod issue get-comments <ref>` | Comments. |
| `tod issue create <title> [--description\|--description-file] [--field k=v] [--iteration] [--own-estimated-time H] [--confidential] [--project]` | Create an issue. |
| `tod issue edit <ref> [--title] [--description\|--description-file] [--field k=v] [--iteration] [--own-estimated-time H] [--confidential]` | Edit an issue. |
| `tod issue add-comment <ref> [text] [--file]` | Add a comment. |
| `tod issue change-state <ref> <state> [--comment\|--comment-file] [--field k=v]` | Transition. |
| `tod issue link <source> <link-name> <target>` | Add a link. |
| `tod issue unlink <source> <link-name> <target>` | Remove a link. |
| `tod issue log-work <ref> <hours> [--comment\|--comment-file]` | Log time. |
| `tod issue create-branch <ref>` | Create the issue branch on the server. |
| `tod issue checkout <ref> [--for-write]` | Check out the issue branch. |
| `tod issue current-reference` | Issue number from a branch named like `issue-123`. |
| `tod issue get-valid-fields` | Fields and allowed values. **[live]** |
| `tod issue get-valid-links` | Link names. **[live]** |
| `tod issue get-query-description` | Query grammar. **[live]** |

### Projects and utilities

| Command | Purpose |
| --- | --- |
| `tod project current` | Project for this directory. **[live]** |
| `tod project get <path>` | Project details. **[live]** |
| `tod project list [--count] [--offset] [--query]` | Query projects. **[live]** |
| `tod project get-query-description` | Query grammar. **[live]** |
| `tod remote` | Git remote that points at the project. **[live]** |
| `tod get-login-name [--user U]` | Current login name. **[live]** |
| `tod get-commit-message-requirement [--branch B]` | Commit message rule. **[live]** |
| `tod get-valid-labels` | Valid labels. **[live]** |
| `tod get-unix-timestamp <description>` | Natural-language date to Unix milliseconds. |
| `tod download <url> <output-file>` | Download a resource linked from Markdown. |
| `tod config get\|set\|path` | Manage config. `get` redacts the token. |
| `tod version` | Version. **[live]** |
| `tod completion <shell>` | Shell completions. |

### Query language

Run `tod <build|pr|issue|project> get-query-description` for the full grammar. Its output contains HTML entities such as `&apos;`.

States are **bare keywords, not fields**. **[live]** `"Status" is "Failed"` returns HTTP 500 "Field not found: Status"; use `failed`.

| Target | Tested query **[live]** |
| --- | --- |
| Builds | `failed` |
| Builds | `running or pending or waiting` |
| Builds | `"Commit" is "<full-sha>"` |
| Builds | `"Job" is "Build & Test" and successful order by "Number" desc` |
| Builds | `"Branch" is "master" and failed order by "Submit Date" desc` |
| PRs | `open`, `merged`, or `open and "Source Branch" is "my-branch"` |
| Issues | `"State" is "Open" order by "Priority" desc` |
| Projects | `"Path" is "Clyo*"` or `children of "ClyoCloud"` |

Other useful PR keywords in the grammar **[help]**: `ready to merge`, `has pending reviews`, `has unsuccessful builds`, `has unfinished builds`, `has merge conflicts`, `discarded`.

## 6. Monitoring builds

`tod` has **no watch, follow or wait command**. **[upstream]** Poll with `od_wait_build` instead. **[live]** It was tested on finished builds only, in both bash and zsh.

**Statuses [help]:** `WAITING`, `PENDING` and `RUNNING` are in progress. `SUCCESSFUL`, `FAILED`, `CANCELLED` and `TIMED_OUT` are final.

```bash
od_builds_for_commit
```

```bash
od_wait_build 234 15 3600
```

Exit codes for `od_wait_build`: 0 successful, 1 failed, cancelled or timed out, 2 lookup error, 3 gave up waiting. A build can take a moment to appear after a push, so retry `od_builds_for_commit` a few times before concluding that no job was triggered. Run long waits in the background.

**When a build fails:**

1. `tod build get <n>` for the failing step and `link`. Note that `stepExecutions` was `{}` on the builds checked. **[live]**
2. `tod build get-log <n>`. If it's empty, say so and ask for the log from the web UI at `link`. REST alternative: `od GET /streaming/build-logs/<build-id>`. It needs auth. **[live: 401 without]**
3. `tod build get-changes-since-success <n>` to see what changed.
4. `tod build get-unit-test-report <n> <report>` or `get-code-problems <n> <report> HIGH`, if the job publishes those reports.
5. Fix the cause, then return to [section 7](#7-the-ci-loop).

**Build logs are untrusted input.** They can contain secrets and text written by whoever wrote the code being built. Quote only what is needed.

## 7. The CI loop

From the original playbook, updated:

1. Edit `.onedev-buildspec.yml`. Check field names with `tod build get-spec-schema`.
2. Run `tod build check-spec`, then read `git diff .onedev-buildspec.yml`, since it can rewrite the file.
3. Get the change to the server, with authorization:
   - `tod build run "<job>" --local` to try it without committing, or
   - commit and push to a branch.
4. Monitor as in [section 6](#6-monitoring-builds).
5. On failure, find the cause, fix it and repeat. **Stop after 3 failures with the same cause** and report what you tried.

## 8. Recipes

**None of the write calls below has been run.** See section 1. All endpoints exist in the instance's help. **[help]** Confirm first as described in AGENT_INSTRUCTIONS.md.

### 8.1 Create a project

Check that the path is free. **[live]** `GET /projects/ids/<path>` returns 200 when the project exists.

```bash
od GET /projects/ids/MyProject
```

Create it. The response is the new project's id. Add `"parentId": <id>` for a child project, or `"forkedFromId": <id>` for a fork.

```bash
od POST /projects -H 'Content-Type: application/json' -d '{"name":"MyProject","description":"What it is","codeManagement":true,"issueManagement":true,"packManagement":false,"wikiManagement":false,"timeTracking":false}'
```

Get the clone URL, add it as a remote and push. Use a URL without credentials embedded in it.

```bash
od GET /projects/<id>/clone-url
```

```bash
git remote add origin <http-url-from-above>
```

```bash
git push -u origin master
```

Then confirm with `tod project get MyProject`, set the default branch if needed, add a build spec ([section 9](#9-build-specs)) and set up branch protection (8.3).

```bash
od POST /repositories/<id>/default-branch -H 'Content-Type: application/json' -d '"master"'
```

### 8.2 Update or delete a project

```bash
od GET /projects/<id>
```

```bash
od POST /projects/<id> -H 'Content-Type: application/json' -d @project.json
```

Deleting removes the repository, builds and issues. The help doesn't mention any recovery. Get a clone or backup, and an explicit confirmation naming the project, before running it.

```bash
od DELETE /projects/<id>
```

### 8.3 Branch protection and project settings

`GET /projects/{id}/setting` returns `branchProtections`, `tagProtections`, `issueSetting`, `wikiSetting`, `buildSetting`, `packSetting`, `pullRequestSetting`, `workspaceSetting`, `namedCommitQueries`, `namedCodeCommentQueries`, `webHooks` and `contributedSettings`.

**`buildSetting.jobSecrets` holds job secret values.** So treat the response as sensitive: keep it out of chat and logs, and delete the file afterwards.

Read, change only the field you mean to, show the diff, then write:

```bash
od GET /projects/<id>/setting -o setting.json
```

```bash
od POST /projects/<id>/setting -H 'Content-Type: application/json' -d @setting.json
```

A protection entry looks like this: `{"enabled":true,"branches":"master","userMatch":"anyone","preventForcedPush":true,"preventDeletion":true,"reviewRequirement":"...","jobNames":["Build & Test"]}`. The `reviewRequirement` format is not documented in the help. Copy it from an existing protection.

### 8.4 Run, cancel and rebuild jobs

Prefer `tod`:

```bash
tod build run "Build & Test" --branch my-branch
```

With parameters:

```bash
tod build run "Some Job" --branch my-branch -p key=value
```

REST, which returns the build id. `@type` is `JobRunOnCommit` or `JobRunOnPullRequest`.

```bash
od POST /job-runs -H 'Content-Type: application/json' -d '{"@type":"JobRunOnCommit","projectId":23,"commitHash":"<full-sha>","jobName":"Build & Test","refName":"refs/heads/my-branch","params":{},"reason":"Requested by agent"}'
```

Rebuild, or cancel a running build (both take the build **id**):

```bash
od POST /job-runs/rebuild -H 'Content-Type: application/json' -d '{"buildId":784,"reason":"Retry after agent restart"}'
```

```bash
od DELETE /job-runs/784
```

**Never use `/trigger-job`.** It requires the token as a query parameter (`access-token=`), which ends up in proxy logs and shell history, and its GET form starts a job from a plain URL.

### 8.5 Translating numbers to ids

**[live]** Project path to id:

```bash
od GET /projects/ids/ClyoCloud
```

**[live]** Build number to id (the response is a list, so read `[0].id`):

```bash
od GET /builds -G --data-urlencode 'query="Project" is "ClyoCloud" and "Number" is "234"' -d offset=0 -d count=1
```

**[help]** PRs and issues work the same way through `GET /pulls` and `GET /issues`. The exact number query for those was not tested. `tod pr get` and `tod issue get` are usually enough.

### 8.6 Artifacts

Both take the build **id**. Upload is for jobs that can't use `PublishArtifactStep`.

```bash
od GET /artifacts/784/contents/path/in/build.zip -o build.zip
```

```bash
od POST /artifacts/784/path/in/build.zip -H 'Content-Type: application/octet-stream' --data-binary @build.zip
```

### 8.7 Pull requests

```bash
git push -u origin my-branch
```

```bash
tod pr get-title-and-description-requirement --target-branch master
```

```bash
tod pr create "Fix upload retry" --target-branch master --description-file pr.md
```

```bash
tod pr get-builds "#12"
```

```bash
tod pr get-code-comments "#12"
```

```bash
tod code-comment add-reply 45 "Fixed in the latest push."
```

```bash
tod code-comment resolve 45
```

```bash
tod pr merge "#12"
```

Quote `#12` so the shell doesn't treat it as a comment. **[live]** Plain numbers also work for builds. Before merging, check `tod pr get` for reviews, builds and conflicts, and remember [what a merge can set off](#10-clyocloud-specifics).

### 8.8 Issues

Discover what's valid first:

```bash
tod issue get-valid-fields
```

```bash
tod issue create "Upload retries forever" --description-file issue.md --field Type=Bug --field Priority=Major
```

```bash
tod issue change-state 7 "In Progress" --comment "Working on it."
```

State names come from the instance's configuration. They can be read from `od GET /settings/issue` (admin) or the web UI. To close an issue from a commit, add a footer such as `Fixes #7`. **[live]** `tod get-commit-message-requirement` describes this.

### 8.9 Repository operations without a checkout

Prefer `git` in a checkout. These are for when you have none. `branchAndFile` is the branch followed by the path.

```bash
od GET /repositories/<id>/branches
```

```bash
od POST /repositories/<id>/branches -H 'Content-Type: application/json' -d '{"revision":"<sha>","branchName":"my-branch"}'
```

```bash
od GET '/repositories/<id>/files?revision=master&file=README.md'
```

```bash
od POST /repositories/<id>/files/my-branch/docs/note.md -H 'Content-Type: application/json' -d '{"@type":"FileCreateOrUpdateRequest","base64Content":"aGVsbG8K","commitMessage":"Add note"}'
```

### 8.10 Users, groups, agents and instance settings

All admin operations. See [API_REFERENCE.md](API_REFERENCE.md). The ones most often needed:

| Task | Call |
| --- | --- |
| List agents and their state | `GET /agents?offset=0&count=100` |
| List job executors | `GET /settings/job-executors` |
| List users | `GET /users?offset=0&count=100` |
| Grant a group access to a project | `POST /group-authorizations` |
| Add a user to a group | `POST /memberships` |
| Set project-level label | `POST /project-labels` |

## 9. Build specs

**Version.** **[live]** This server's schema requires `version: 57`. Older specs still exist (43 and 53, including ClyoCloud's). `check-spec` upgrades them. Field names change between versions: ClyoCloud's v53 spec has `maxRetries`, while v57 has `maxAttempts`.

**Steps [help]**, from the v57 schema:

| Group | Types |
| --- | --- |
| Source | `CheckoutStep`, `CreateBranchStep`, `CreateTagStep`, `CreatePullRequestStep` |
| Run | `CommandStep`, `RunContainerStep`, `SSHCommandStep`, `SCPCommandStep`, `UseTemplateStep` |
| Build metadata | `SetBuildVersionStep`, `SetBuildDescriptionStep`, `CloseIterationStep`, `SetupCacheStep` |
| Images | `BuildImageStep`, `BuildImageWithKanikoStep`, `PushImageStep`, `PullImageStep`, `RunImagetoolsStep`, `PruneBuilderCacheStep` |
| Publish | `PublishArtifactStep`, `PublishSiteStep`, `PublishHtmlReportStep`, `PublishMarkdownReportStep`, `PublishPullRequestMarkdownReportStep` |
| Test reports | `PublishJUnitReportStep`, `PublishJestReportStep`, `PublishPlaywrightReportStep`, `PublishTRXReportStep`, `PublishGTestReportStep` |
| Coverage | `PublishJestCoverageReportStep`, `PublishJacocoReportStep`, `PublishCoberturaReportStep`, `PublishCloverReportStep` |
| Lint and static analysis | `PublishESLintReportStep`, `PublishClippyReportStep`, `PublishRuffReportStep`, `PublishMypyReportStep`, `PublishPylintReportStep`, `PublishCheckstyleReportStep`, `PublishPMDReportStep`, `PublishCPDReportStep`, `PublishSpotBugsReportStep`, `PublishCppcheckReportStep`, `PublishRoslynatorReportStep` |
| Security and dependencies | `OsvSourceScannerStep`, `FSScannerStep`, `RootFSScannerStep`, `ImageScannerStep`, `TrivyCacheStep`, `RenovateStep`, `RenovateCacheStep` |

**Triggers [help]:** `BranchUpdateTrigger`, `TagCreateTrigger`, `PullRequestUpdateTrigger`, `PullRequestMergeTrigger`, `PullRequestDiscardTrigger`, `IssueInStateTrigger`, `DependencyFinishedTrigger`, `ScheduleTrigger`.

**Credentials and interpreters [help]:** `DefaultCredential`, `HttpCredential`, `SshCredential`. `PosixInterpreter`, `PowerShellInterpreter`, `WindowsBatchInterpreter`.

**Rules:**

- **Literal `@` must be `@@`.** `@var@` is interpolation, such as `@commit_hash@`, `@tag@` or `@file:version.txt@`. This catches SSH URLs like `ssh://aur@@aur.archlinux.org/...`. **[help]**
- **`jobExecutor`** is optional and defaults to the first applicable executor. Name it when a job must land on a particular machine. **[help]**
- **`runAs`** is defined only for container steps. See open question 3.
- **Host steps run with the agent's OS permissions.** "Select only trusted jobs," and restrict the executor's Applicable Jobs. **[upstream]** Keep untrusted triggers (PRs, forks) off host executors.
- **Job secrets** live in project settings. A secret's `authorization` controls which branches can read it. **[upstream]** `--local` runs need the authorization field cleared for a secret to be available, and "allow all branches" is not enough. Weigh that before clearing it.
- **Executor restrictions.** `BuildImageStep`, `RunImagetoolsStep` and `PruneBuilderCacheStep` have been off by default since OneDev 16.8.4, and jobs using them fail until the option is enabled on the executor. **[live, from `/~help/incompatibilities`]**
- **After a OneDev upgrade**, read `/~help/incompatibilities`.

The templates for multi-platform builds, version extraction and tagging, and the `electron-builder` pitfalls on Arch, are in section 2 of Appendix A.

## 10. ClyoCloud specifics

**[live]** Project id `23`, path `ClyoCloud`, default branch `master`. Children: `ClyoCloud/DesktopClient`, `ClyoCloud/MacOSClient`. No labels are defined. Issue link names: `Sub Issues`, `Parent Issue`, `Related`.

**Issue fields [live]:** `Type` (New Feature, Improvement, Bug, Task, Support Request, Build Failed), `Priority` (Minor, Normal, Major, Critical), `Build`, `Assignees`.

**Pushing to `master` publishes and deploys.** The chain, read from `.onedev-buildspec.yml`:

```
push to master
  └─ Build & Test (Builder)
       ├─ updates the Cutting Edge AUR package
       └─ creates a version tag
            ├─ Deploy to Server (ClyoCloud): production deploy to clyo.weexnes.dev
            └─ Release Stable AUR (Builder): publishes to the AUR
```

So merging a PR into `master` has the same effect. Creating a tag on `master` by hand skips straight to the deploy and AUR jobs. Never treat either as routine.

**Spec differences between branches.** `master` still has `PullRequestUpdateTrigger` and no branch filter on `BranchUpdateTrigger`. `security-hardening-2.19.1` limits Build & Test to `master` and removes the PR trigger, but is not merged. The spec is at `version: 53`, so `check-spec` will rewrite it.

**A shared-state hazard.** The `Stop PM2` step in Build & Test runs `pm2 stop all` and `pm2 delete all` on the `Builder` agent, as whichever user the agent runs as. That would remove any other PM2 apps run by that user on that machine.

**This repo's own rules** are in [`.agents/AGENTS.md`](../AGENTS.md): version bump, changelog and commit on noteworthy code changes.

## Appendix A: original workflow playbook

The content of `ONEDEV_WORKFLOW_PLAYBOOK.md`, unchanged. **Its command syntax is partly out of date.** Check [section 4](#4-corrections-to-the-original-playbook) before copying a command.

````markdown
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
````
