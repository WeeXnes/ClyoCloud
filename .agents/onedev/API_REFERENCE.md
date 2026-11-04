# OneDev REST API Reference

Generated from `https://code.weexnes.dev/~api/help` on OneDev **17.0.0**: 44 resources, 308 operations.
**Do not edit by hand.** Rerun `generate_api_reference.py` after an upgrade. Workflows and safety rules are in [PLAYBOOK.md](PLAYBOOK.md) and [AGENT_INSTRUCTIONS.md](AGENT_INSTRUCTIONS.md).

**How far this is verified:** every row is what the instance's own help says exists. A row does not mean the call was run. Only the read calls marked in PLAYBOOK.md section 1 were executed.

## Conventions

- **Base URL:** `https://code.weexnes.dev/~api`. Paths below omit the `/~api` prefix.
- **Auth (from the instance's help):** When anonymous access is disabled or lacks permission, authenticate with a user name and password (or access token) via the HTTP Basic authorization header.
- **`offset` and `count`** are required on list operations that declare them. `\*` marks a required query parameter.
- **Risk:** `READ`, `WRITE` or `DELETE`. See AGENT_INSTRUCTIONS.md for which ones need confirmation. `GET /trigger-job` is `WRITE` because it starts a job.
- **Body** lists top-level fields from the help's example. Not all are mandatory, and the help does not always say which are.
- **Full schema for one operation:** `GET /~api/help/io.onedev.server.rest.resource.<Resource>/<operation>`, using the names shown in each section heading and the **Operation** column.

## Contents

- [Server](#server) (2 operations)
- [Projects](#projects) (27 operations)
- [Repositories](#repositories) (15 operations)
- [Builds and jobs](#builds-and-jobs) (21 operations)
- [Pull requests and code review](#pull-requests-and-code-review) (55 operations)
- [Issues](#issues) (42 operations)
- [Packages](#packages) (10 operations)
- [Users and credentials](#users-and-credentials) (56 operations)
- [Groups, roles and authorizations](#groups-roles-and-authorizations) (29 operations)
- [Agents](#agents) (9 operations)
- [Instance settings](#instance-settings) (42 operations)

## Server

Health and version. Both are readable anonymously on this instance.

### Server (`/server`, `ServerResource`)

Server readiness and version

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/server/ready` | Is Ready (`isReady`) |  |  |  |
| READ | GET | `/server/version` | Get Version (`getVersion`) |  |  |  |

## Projects

Projects, their labels, iterations and workspaces. `POST /projects/{projectId}/setting` carries branch protections, job secrets and web hooks.

### Project (`/projects`, `ProjectResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/projects/{projectId}` | Get Project (`getProject`) |  |  |  |
| READ | GET | `/projects/ids/{path:.*}` | Get Project Id (`getProjectId`) |  |  |  |
| READ | GET | `/projects/{projectId}/clone-url` | Get Clone URL (`getCloneURL`) |  |  |  |
| READ | GET | `/projects/{projectId}/setting` | Get Setting (`getSetting`) |  |  |  |
| READ | GET | `/projects/{projectId}/forks` | Get Forks (`getForks`) |  |  |  |
| READ | GET | `/projects/{projectId}/base-authorizations` | Get Base Authorizations (`getBaseAuthorizations`) |  |  |  |
| READ | GET | `/projects/{projectId}/group-authorizations` | Get Group Authorizations (`getGroupAuthorizations`) |  |  |  |
| READ | GET | `/projects/{projectId}/user-authorizations` | Get User Authorizations (`getUserAuthorizations`) |  |  |  |
| READ | GET | `/projects/{projectId}/labels` | Get Labels (`getLabels`) |  |  |  |
| READ | GET | `/projects` | Query Projects (`queryProjects`) | `query`, `offset`\*, `count`\* |  |  |
| READ | GET | `/projects/{projectId}/iterations` | Query Iterations (`queryIterations`) | `name`, `startBefore`, `startAfter`, `dueBefore`, `dueAfter`, `closed`, `offset`\*, `count`\* |  |  |
| READ | GET | `/projects/{projectId}/top-contributors` | Get Top Contributors (`getTopContributors`) | `sinceDate`\*, `untilDate`\*, `count`\* |  |  |
| WRITE | POST | `/projects` | Create Project (`createProject`) |  | `parentId`, `forkedFromId`, `name`, `key`, `description`, `codeManagement`, `wikiManagement`, `packManagement`, `issueManagement`, `timeTracking`, `serviceDeskEmailAddress`, `gitPackConfig`, `codeIndexingSetting` | Id of created project |
| WRITE | POST | `/projects/{projectId}` | Update Project (`updateProject`) |  | `parentId`, `forkedFromId`, `name`, `key`, `description`, `codeManagement`, `wikiManagement`, `packManagement`, `issueManagement`, `timeTracking`, `serviceDeskEmailAddress`, `gitPackConfig`, `codeIndexingSetting` |  |
| WRITE | POST | `/projects/{projectId}/setting` | Update Setting (`updateSetting`) |  | `branchProtections`, `tagProtections`, `issueSetting`, `wikiSetting`, `buildSetting`, `packSetting`, `pullRequestSetting`, `workspaceSetting`, `namedCommitQueries`, `namedCodeCommentQueries`, `webHooks`, `contributedSettings` |  |
| DELETE | DELETE | `/projects/{projectId}` | Delete Project (`deleteProject`) |  |  |  |

### Project Label (`/project-labels`, `ProjectLabelResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| WRITE | POST | `/project-labels` | Add Label (`addLabel`) |  | `projectId`, `specId` | Id of created project label |
| DELETE | DELETE | `/project-labels/{projectLabelId}` | Remove Label (`removeLabel`) |  |  |  |

### Iteration (`/iterations`, `IterationResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/iterations/{iterationId}` | Get Iteration (`getIteration`) |  |  |  |
| WRITE | POST | `/iterations` | Create Iteration (`createIteration`) |  | `description`, `startDay`, `dueDay`, `projectId`, `name`, `closed` | Id of created iteration |
| WRITE | POST | `/iterations/{iterationId}` | Update Iteration (`updateIteration`) |  | `description`, `startDay`, `dueDay`, `name`, `closed` | Id of created iteration |
| DELETE | DELETE | `/iterations/{iterationId}` | Delete Iteration (`deleteIteration`) |  |  |  |

### Workspace (`/workspaces`, `WorkspaceResource`)

In most cases, workspace resource is operated with workspace id, which is different from workspace number. To get workspace id of a particular workspace number, use the Query Workspaces (/~help/api/io.onedev.server.rest.resource.WorkspaceResource/queryWorkspaces) operation with query for instance "Number" is "path/to/project#100" or "Number" is "PROJECTKEY-100"

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/workspaces/{workspaceId}` | Get Workspace (`getWorkspace`) |  |  |  |
| READ | GET | `/workspaces` | Query Workspaces (`queryWorkspaces`) | `query`, `offset`\*, `count`\* |  |  |
| WRITE | POST | `/workspaces` | Create Workspace (`createWorkspace`) |  | `projectId`, `commitHash`, `specName`, `branch`, `issueId`, `pullRequestId` | Id of created workspace |
| WRITE | POST | `/workspaces/{workspaceId}/reprovision` | Reprovision Workspace (`reprovisionWorkspace`) |  |  |  |
| DELETE | DELETE | `/workspaces/{workspaceId}` | Delete Workspace (`deleteWorkspace`) |  |  |  |

## Repositories

Branches, tags, commits and files through the API. Prefer plain `git` for anything a checkout can do.

### Repository (`/repositories`, `RepositoryResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/repositories/{projectId}/branches` | Get Branches (`getBranches`) |  |  |  |
| READ | GET | `/repositories/{projectId}/default-branch` | Get Default Branch (`getDefaultBranch`) |  |  |  |
| WRITE | POST | `/repositories/{projectId}/default-branch` | Set Default Branch (`setDefaultBranch`) |  | JSON string |  |
| READ | GET | `/repositories/{projectId}/branches/{branch:.*}` | Get Branch (`getBranch`) |  |  |  |
| WRITE | POST | `/repositories/{projectId}/branches` | Create Branch (`createBranch`) |  | `revision`, `branchName` |  |
| DELETE | DELETE | `/repositories/{projectId}/branches/{branch:.*}` | Delete Branch (`deleteBranch`) |  |  |  |
| READ | GET | `/repositories/{projectId}/tags` | Get Tags (`getTags`) |  |  |  |
| READ | GET | `/repositories/{projectId}/tags/{tag:.*}` | Get Tag (`getTag`) |  |  |  |
| WRITE | POST | `/repositories/{projectId}/tags` | Create Tag (`createTag`) |  | `revision`, `tagName`, `tagMessage` |  |
| DELETE | DELETE | `/repositories/{projectId}/tags/{tag:.*}` | Delete Tag (`deleteTag`) |  |  |  |
| READ | GET | `/repositories/{projectId}/commits` | Query Commits (`queryCommits`) | `query`, `count`\*, `field` |  |  |
| READ | GET | `/repositories/{projectId}/commits/{commitHash}` | Get Commit (`getCommit`) | `field` |  |  |
| READ | GET | `/repositories/{projectId}/directories/{revisionAndDirectory:.*}` | Get Directory (`getDirectory`) |  |  |  |
| READ | GET | `/repositories/{projectId}/files` | Get File (`getFile`) | `revision`\*, `file`\* |  |  |
| WRITE | POST | `/repositories/{projectId}/files/{branchAndFile:.*}` | Edit File (`editFile`) |  | one of `FileCreateOrUpdateRequest`, `FileDeleteRequest`; e.g. `@type`, `base64Content`, `commitMessage` |  |

## Builds and jobs

Most operations take a build **id**, not the build number shown in the UI.

### Build (`/builds`, `BuildResource`)

In most cases, build resource is operated with build id, which is different from build number. To get build id of a particular build number, use the Query Basic Info (/~help/api/io.onedev.server.rest.BuildResource/queryBasicInfo) operation with query for instance "Number" is "path/to/project#100" or "Number" is "PROJECTKEY-100"

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/builds/{buildId}` | Get Build (`getBuild`) |  |  |  |
| READ | GET | `/builds/{buildId}/labels` | Get Labels (`getLabels`) |  |  |  |
| READ | GET | `/builds/{buildId}/params` | Get Params (`getParams`) |  |  |  |
| READ | GET | `/builds/{buildId}/dependencies` | Get Dependencies (`getDependencies`) |  |  |  |
| READ | GET | `/builds/{buildId}/dependents` | Get Dependents (`getDependents`) |  |  |  |
| READ | GET | `/builds/{buildId}/fixed-issue-ids` | Get Fixed Issue Ids (`getFixedIssueIds`) |  |  |  |
| READ | GET | `/builds` | Query Builds (`queryBuilds`) | `query`, `offset`\*, `count`\* |  |  |
| WRITE | POST | `/builds/{buildId}/description` | Set Description (`setDescription`) |  | JSON string |  |
| DELETE | DELETE | `/builds/{buildId}` | Delete Build (`deleteBuild`) |  |  |  |

### Build Label (`/build-labels`, `BuildLabelResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| WRITE | POST | `/build-labels` | Create Label (`createLabel`) |  | `buildId`, `specId` | Id of created build label |
| DELETE | DELETE | `/build-labels/{buildLabelId}` | Delete Label (`deleteLabel`) |  |  |  |

### Build Log Stream (`/streaming/build-logs`, `BuildLogStreamResource`)

Build log stream resource is operated with build id, which is different from build number. To get build id of a particular build number, use the Query Basic Info (/~help/api/io.onedev.server.rest.BuildResource/queryBasicInfo) operation with query for instance "Number" is "path/to/project#100" or "Number" is "PROJECTKEY-100"

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/streaming/build-logs/{buildId}` | Download Log (`downloadLog`) |  |  | `application/octet-stream` |

### Job Run (`/job-runs`, `JobRunResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| WRITE | POST | `/job-runs` | Run Build (`runBuild`) |  | one of `JobRunOnCommit`, `JobRunOnPullRequest`; e.g. `@type`, `projectId`, `commitHash`, `jobName`, `params`, `refName`, `reason` |  |
| WRITE | POST | `/job-runs/rebuild` | Rebuild (`rebuild`) |  | `buildId`, `reason` |  |
| DELETE | DELETE | `/job-runs/{buildId}` | Cancel Build (`cancelBuild`) |  |  |  |

### Trigger Job (`/trigger-job`, `TriggerJobResource`)

This resource provides an alternative way to run job by passing all parameters via url

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| WRITE | GET | `/trigger-job` | Trigger Job Via Get (`triggerJobViaGet`) | `project`\*, `branch`, `tag`, `job`\*, `access-token`\* |  |  |
| WRITE | POST | `/trigger-job` | Trigger Job Via Post (`triggerJobViaPost`) | `project`\*, `branch`, `tag`, `job`\*, `access-token`\* |  |  |

### Artifact (`/artifacts`, `ArtifactResource`)

In most cases, artifact resource is operated with build id, which is different from build number. To get build id of a particular build number, use the Query Basic Info (/~help/api/io.onedev.server.rest.BuildResource/queryBasicInfo) operation with query for instance "Number" is "path/to/project#100" or "Number" is "PROJECTKEY-100"

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/artifacts/{buildId}/infos{artifactPath:(/.*)?}` | Get Artifact Info (`getArtifactInfo`) |  |  |  |
| READ | GET | `/artifacts/{buildId}/contents/{artifactPath:(.*)}` | Download Artifact (`downloadArtifact`) |  |  | `application/octet-stream` |
| WRITE | POST | `/artifacts/{buildId}/{artifactPath:(.*)}` | Upload Artifact (`uploadArtifact`) |  | `application/octet-stream` |  |
| DELETE | DELETE | `/artifacts/{buildId}{artifactPath:(/.*)?}` | Delete Artifact (`deleteArtifact`) |  |  |  |

## Pull requests and code review

Most operations take a request **id**, not the PR number.

### Pull Request (`/pulls`, `PullRequestResource`)

In most cases, pull request resource is operated with pull request id, which is different from pull request number. To get pull request id of a particular pull request number, use the Query Basic Info (/~help/api/io.onedev.server.rest.PullRequestResource/queryBasicInfo) operation with query for instance "Number" is "path/to/project#100" or "Number" is "PROJECTKEY-100"

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/pulls/{requestId}` | Get Pull Request (`getPullRequest`) |  |  |  |
| READ | GET | `/pulls/{requestId}/labels` | Get Labels (`getLabels`) |  |  |  |
| READ | GET | `/pulls/{requestId}/merge-preview` | Get Merge Preview (`getMergePreview`) |  |  |  |
| READ | GET | `/pulls/{requestId}/assignments` | Get Assignments (`getAssignments`) |  |  |  |
| READ | GET | `/pulls/{requestId}/reviews` | Get Reviews (`getReviews`) |  |  |  |
| READ | GET | `/pulls/{requestId}/comments` | Get Comments (`getComments`) |  |  |  |
| READ | GET | `/pulls/{requestId}/code-comments` | Get Code Comments (`getCodeComments`) |  |  |  |
| READ | GET | `/pulls/{requestId}/watches` | Get Watches (`getWatches`) |  |  |  |
| READ | GET | `/pulls/{requestId}/updates` | Get Updates (`getUpdates`) |  |  |  |
| READ | GET | `/pulls/{requestId}/current-builds` | Get Current Builds (`getCurrentBuilds`) |  |  |  |
| READ | GET | `/pulls/{requestId}/changes` | Get Changes (`getChanges`) |  |  |  |
| READ | GET | `/pulls/{requestId}/fixed-issue-ids` | Get Fixed Issue Ids (`getFixedIssueIds`) |  |  |  |
| READ | GET | `/pulls` | Query Pull Requests (`queryPullRequests`) | `query`, `offset`\*, `count`\* |  |  |
| WRITE | POST | `/pulls` | Create Pull Request (`createPullRequest`) |  | `targetProjectId`, `sourceProjectId`, `targetBranch`, `sourceBranch`, `title`, `workInProgress`, `description`, `mergeStrategy`, `reviewerIds`, `assigneeIds` |  |
| WRITE | POST | `/pulls/{requestId}/title` | Set Title (`setTitle`) |  | JSON string |  |
| WRITE | POST | `/pulls/{requestId}/work-in-progress` | Set Work In Progress (`setWorkInProgress`) |  | JSON bool |  |
| WRITE | POST | `/pulls/{requestId}/description` | Set Description (`setDescription`) |  | JSON string |  |
| WRITE | POST | `/pulls/{requestId}/reviewers/{userId}` | Add Reviewer (`addReviewer`) |  |  |  |
| WRITE | POST | `/pulls/{requestId}/approve` | Approve (`approve`) |  | JSON string |  |
| WRITE | POST | `/pulls/{requestId}/request-for-changes` | Request For Changes (`requestForChanges`) |  | JSON string |  |
| DELETE | DELETE | `/pulls/{requestId}/reviewers/{userId}` | Remove Reviewer (`removeReviewer`) |  |  |  |
| WRITE | POST | `/pulls/{requestId}/assignees/{userId}` | Add Assignee (`addAssignee`) |  |  |  |
| DELETE | DELETE | `/pulls/{requestId}/assignees/{userId}` | Remove Assignee (`removeAssignee`) |  |  |  |
| WRITE | POST | `/pulls/{requestId}/merge-strategy` | Set Merge Strategy (`setMergeStrategy`) |  | JSON string |  |
| WRITE | POST | `/pulls/{requestId}/auto-merge` | Set Auto Merge (`setAutoMerge`) |  | `commitMessage`, `enabled` |  |
| WRITE | POST | `/pulls/{requestId}/reopen` | Reopen Pull Request (`reopenPullRequest`) |  | JSON string |  |
| WRITE | POST | `/pulls/{requestId}/discard` | Discard Pull Request (`discardPullRequest`) |  | JSON string |  |
| WRITE | POST | `/pulls/{requestId}/merge` | Merge Pull Request (`mergePullRequest`) |  | JSON string |  |
| WRITE | POST | `/pulls/{requestId}/delete-source-branch` | Delete Source Branch (`deleteSourceBranch`) |  | JSON string |  |
| WRITE | POST | `/pulls/{requestId}/restore-source-branch` | Restore Source Branch (`restoreSourceBranch`) |  | JSON string |  |
| WRITE | POST | `/pulls/{requestId}/attachments/{preferredAttachmentName}` | Upload Attachment (`uploadAttachment`) |  | `application/octet-stream` |  |
| DELETE | DELETE | `/pulls/{requestId}` | Delete Pull Request (`deletePullRequest`) |  |  |  |

### Pull Request Comment (`/pull-request-comments`, `PullRequestCommentResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/pull-request-comments/{commentId}` | Get (`get`) |  |  |  |
| WRITE | POST | `/pull-request-comments` | Create (`create`) |  | `requestId`, `messageId`, `userId`, `content` | Id of created pull request comment |
| WRITE | POST | `/pull-request-comments/{commentId}` | Update (`update`) |  | JSON string |  |
| DELETE | DELETE | `/pull-request-comments/{commentId}` | Delete (`delete`) |  |  |  |

### Pull Request Label (`/pull-request-labels`, `PullRequestLabelResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| WRITE | POST | `/pull-request-labels` | Create (`create`) |  | `requestId`, `specId` | Id of created pull request label |
| DELETE | DELETE | `/pull-request-labels/{pullRequestLabelId}` | Delete (`delete`) |  |  |  |

### Pull Request Watch (`/pull-request-watches`, `PullRequestWatchResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/pull-request-watches/{watchId}` | Get (`get`) |  |  |  |
| WRITE | POST | `/pull-request-watches` | Create (`create`) |  | `requestId`, `userId`, `watching` | Id of created pull request watch |
| WRITE | POST | `/pull-request-watches/{watchId}` | Update (`update`) |  | `watching` |  |
| DELETE | DELETE | `/pull-request-watches/{watchId}` | Delete (`delete`) |  |  |  |

### Code Comment (`/code-comments`, `CodeCommentResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/code-comments/{commentId}` | Get Comment (`getComment`) |  |  |  |
| READ | GET | `/code-comments/{commentId}/mark` | Get Mark (`getMark`) | `commitHash` |  |  |
| READ | GET | `/code-comments/{commentId}/replies` | Get Replies (`getReplies`) |  |  |  |
| READ | GET | `/code-comments` | Query Comments (`queryComments`) | `projectId`\*, `query`, `offset`\*, `count`\* |  |  |
| WRITE | POST | `/code-comments` | Create Comment (`createComment`) |  | `projectId`, `content`, `mark`, `compareContext` | Id of created code comment |
| WRITE | POST | `/code-comments/{commentId}` | Update Comment (`updateComment`) |  | JSON string |  |
| WRITE | POST | `/code-comments/{commentId}/resolve` | Resolve Comment (`resolveComment`) |  | JSON string |  |
| WRITE | POST | `/code-comments/{commentId}/unresolve` | Unresolve Comment (`unresolveComment`) |  | JSON string |  |
| DELETE | DELETE | `/code-comments/{commentId}` | Delete Comment (`deleteComment`) |  |  |  |

### Code Comment Reply (`/code-comment-replies`, `CodeCommentReplyResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/code-comment-replies/{replyId}` | Get Reply (`getReply`) |  |  |  |
| WRITE | POST | `/code-comment-replies` | Create Reply (`createReply`) |  | `commentId`, `content` | Id of created code comment reply |
| WRITE | POST | `/code-comment-replies/{replyId}` | Update Reply (`updateReply`) |  | JSON string |  |
| DELETE | DELETE | `/code-comment-replies/{replyId}` | Delete Reply (`deleteReply`) |  |  |  |

## Issues

Most operations take an issue **id**, not the issue number.

### Issue (`/issues`, `IssueResource`)

In most cases, issue resource is operated with issue id, which is different from issue number. To get issue id of a particular issue number, use the Query Basic Info (/~help/api/io.onedev.server.rest.IssueResource/queryBasicInfo) operation with query for instance "Number" is "path/to/project#100" or "Number" is "PROJECTKEY-100"

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/issues/{issueId}` | Get Issue (`getIssue`) |  |  |  |
| READ | GET | `/issues/{issueId}/fields` | Get Fields (`getFields`) |  |  |  |
| READ | GET | `/issues/{issueId}/changes` | Get Changes (`getChanges`) |  |  |  |
| READ | GET | `/issues/{issueId}/comments` | Get Comments (`getComments`) |  |  |  |
| READ | GET | `/issues/{issueId}/works` | Get Works (`getWorks`) |  |  |  |
| READ | GET | `/issues/{issueId}/iterations` | Get Iterations (`getIterations`) |  |  |  |
| READ | GET | `/issues/{issueId}/votes` | Get Votes (`getVotes`) |  |  |  |
| READ | GET | `/issues/{issueId}/watches` | Get Watches (`getWatches`) |  |  |  |
| READ | GET | `/issues/{issueId}/authorizations` | Get Authorizations (`getAuthorizations`) |  |  |  |
| READ | GET | `/issues/{issueId}/links` | Get Links (`getLinks`) |  |  |  |
| READ | GET | `/issues/{issueId}/pulls` | Get Pull Requests (`getPullRequests`) |  |  |  |
| READ | GET | `/issues/{issueId}/commits` | Get Commits (`getCommits`) |  |  |  |
| READ | GET | `/issues` | Query Issues (`queryIssues`) | `query`, `withFields`, `offset`\*, `count`\* |  |  |
| WRITE | POST | `/issues` | Create Issue (`createIssue`) |  | `projectId`, `title`, `description`, `confidential`, `ownEstimatedTime`, `iterationIds`, `fields` | Id of created issue |
| WRITE | POST | `/issues/{issueId}/title` | Set Title (`setTitle`) |  | JSON string |  |
| WRITE | POST | `/issues/{issueId}/description` | Set Description (`setDescription`) |  | JSON string |  |
| WRITE | POST | `/issues/{issueId}/confidential` | Set Confidential (`setConfidential`) |  | JSON bool |  |
| WRITE | POST | `/issues/{issueId}/own-estimated-time` | Set Own Estimated Time (`setOwnEstimatedTime`) |  | JSON int |  |
| WRITE | POST | `/issues/{issueId}/iterations` | Set Iterations (`setIterations`) |  | JSON list |  |
| WRITE | POST | `/issues/{issueId}/fields` | Set Fields (`setFields`) |  | `field1`, `field2` |  |
| WRITE | POST | `/issues/{issueId}/state-transitions` | Transit State (`transitState`) |  | `state`, `fields`, `comment` |  |
| WRITE | POST | `/issues/{issueId}/attachments/{preferredAttachmentName}` | Upload Attachment (`uploadAttachment`) |  | `application/octet-stream` |  |
| WRITE | POST | `/issues/{issueId}/branch` | Create Branch (`createBranch`) |  |  |  |
| DELETE | DELETE | `/issues/{issueId}` | Delete Issue (`deleteIssue`) |  |  |  |

### Issue Comment (`/issue-comments`, `IssueCommentResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/issue-comments/{commentId}` | Get Comment (`getComment`) |  |  |  |
| WRITE | POST | `/issue-comments` | Create Comment (`createComment`) |  | `issueId`, `onBehalfOf`, `messageId`, `userId`, `content` | Id of created issue comment |
| WRITE | POST | `/issue-comments/{commentId}` | Update Comment (`updateComment`) |  | JSON string |  |
| DELETE | DELETE | `/issue-comments/{commentId}` | Delete Comment (`deleteComment`) |  |  |  |

### Issue Link (`/issue-links`, `IssueLinkResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/issue-links/{linkId}` | Get Link (`getLink`) |  |  |  |
| WRITE | POST | `/issue-links` | Create Link (`createLink`) |  | `sourceId`, `targetId`, `specId` | Id of created issue link |
| DELETE | DELETE | `/issue-links/{linkId}` | Delete Link (`deleteLink`) |  |  |  |

### Issue Vote (`/issue-votes`, `IssueVoteResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/issue-votes/{voteId}` | Get Vote (`getVote`) |  |  |  |
| WRITE | POST | `/issue-votes` | Create Vote (`createVote`) |  | `issueId`, `userId` | Id of created issue vote |
| DELETE | DELETE | `/issue-votes/{voteId}` | Delete Vote (`deleteVote`) |  |  |  |

### Issue Watch (`/issue-watches`, `IssueWatchResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/issue-watches/{watchId}` | Get Watch (`getWatch`) |  |  |  |
| WRITE | POST | `/issue-watches` | Create Watch (`createWatch`) |  | `issueId`, `userId`, `watching` | Id of created issue watch |
| WRITE | POST | `/issue-watches/{watchId}` | Update Watch (`updateWatch`) |  | `watching` |  |
| DELETE | DELETE | `/issue-watches/{watchId}` | Delete Watch (`deleteWatch`) |  |  |  |

### Issue Work (`/issue-works`, `IssueWorkResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/issue-works/{workId}` | Get Work (`getWork`) |  |  |  |
| WRITE | POST | `/issue-works` | Create Work (`createWork`) |  | `issueId`, `userId`, `minutes`, `note` | Id of created issue work |
| WRITE | POST | `/issue-works/{workId}` | Update Work (`updateWork`) |  | `minutes`, `note` |  |
| DELETE | DELETE | `/issue-works/{workId}` | Delete Work (`deleteWork`) |  |  |  |

## Packages

Package registry entries, blobs and labels.

### Package (`/packages`, `PackResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/packages/{packId}` | Get Pack (`getPack`) |  |  |  |
| READ | GET | `/packages/{packId}/labels` | Get Labels (`getLabels`) |  |  |  |
| READ | GET | `/packages/{packId}/blobs` | Get Blobs (`getBlobs`) |  |  |  |
| READ | GET | `/packages` | Query Packs (`queryPacks`) | `query`, `offset`\*, `count`\* |  |  |
| DELETE | DELETE | `/packages/{packId}` | Delete Pack (`deletePack`) |  |  |  |
| DELETE | DELETE | `/packages` | Delete Packs (`deletePacks`) | `query` |  |  |

### Package Blob (`/package-blobs`, `PackBlobResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/package-blobs/{packBlobId}/content` | Download Blob (`downloadBlob`) |  |  | `application/octet-stream` |
| READ | GET | `/package-blobs` | Find By Hash (`findByHash`) | `projectId`, `hash` |  |  |

### Package Label (`/package-labels`, `PackLabelResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| WRITE | POST | `/package-labels` | Create Label (`createLabel`) |  | `packId`, `specId` | Id of created pack label |
| DELETE | DELETE | `/package-labels/{packLabelId}` | Delete Label (`deleteLabel`) |  |  |  |

## Users and credentials

**Admin or credential-bearing.** Never print responses from these resources.

### User (`/users`, `UserResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/users/{userId}` | Get User (`getUser`) |  |  |  |
| READ | GET | `/users/me` | Get Me (`getMe`) |  |  |  |
| READ | GET | `/users/{userId}/access-tokens` | Get Access Tokens (`getAccessTokens`) |  |  |  |
| READ | GET | `/users/{userId}/email-addresses` | Get Email Addresses (`getEmailAddresses`) |  |  |  |
| READ | GET | `/users/{userId}/authorizations` | Get Authorizations (`getAuthorizations`) |  |  |  |
| READ | GET | `/users/{userId}/memberships` | Get Memberships (`getMemberships`) |  |  |  |
| READ | GET | `/users/{userId}/pull-request-reviews` | Get Pull Request Reviews (`getPullRequestReviews`) |  |  |  |
| READ | GET | `/users/{userId}/issue-votes` | Get Issue Votes (`getIssueVotes`) |  |  |  |
| READ | GET | `/users/{userId}/issue-watches` | Get Issue Watches (`getIssueWatches`) |  |  |  |
| READ | GET | `/users/{userId}/project-build-query-personalizations` | Get Project Build Query Personalizations (`getProjectBuildQueryPersonalizations`) |  |  |  |
| READ | GET | `/users/{userId}/project-code-comment-query-personalizations` | Get Project Code Comment Query Personalizations (`getProjectCodeCommentQueryPersonalizations`) |  |  |  |
| READ | GET | `/users/{userId}/project-commit-query-personalizations` | Get Project Commit Query Personalizations (`getProjectCommitQueryPersonalizations`) |  |  |  |
| READ | GET | `/users/{userId}/project-issue-query-personalizations` | Get Projec Issue Query Personalizations (`getProjecIssueQueryPersonalizations`) |  |  |  |
| READ | GET | `/users/{userId}/project-pull-request-query-personalizations` | Get Projec Pull Request Query Personalizations (`getProjecPullRequestQueryPersonalizations`) |  |  |  |
| READ | GET | `/users/{userId}/project-workspace-query-personalizations` | Get Project Workspace Query Personalizations (`getProjectWorkspaceQueryPersonalizations`) |  |  |  |
| READ | GET | `/users/{userId}/pull-request-assignments` | Get Pull Request Assignments (`getPullRequestAssignments`) |  |  |  |
| READ | GET | `/users/{userId}/pull-request-watches` | Get Pull Request Watches (`getPullRequestWatches`) |  |  |  |
| READ | GET | `/users/{userId}/ssh-keys` | Get Ssh Keys (`getSshKeys`) |  |  |  |
| READ | GET | `/users/{userId}/queries-and-watches` | Get Queries And Watches (`getQueriesAndWatches`) |  |  |  |
| READ | GET | `/users` | Query Users (`queryUsers`) | `term`, `offset`\*, `count`\* |  |  |
| READ | GET | `/users/ids/{name}` | Get User Id (`getUserId`) |  |  |  |
| WRITE | POST | `/users` | Create User (`createUser`) |  | `type`, `name`, `password`, `emailAddress`, `notifyOwnEvents`, `aiSetting`, `fullName` | Id of created user |
| WRITE | POST | `/users/{userId}` | Update user (`updateUser`) |  | `name`, `fullName`, `notifyOwnEvents`, `keepEmailAddressesPrivate` |  |
| WRITE | POST | `/users/{userId}/disable` | Disable User (`disableUser`) |  |  |  |
| WRITE | POST | `/users/{userId}/enable` | Enable User (`enableUser`) |  |  |  |
| WRITE | POST | `/users/{userId}/convert-to-service-account` | Convert To Service Account (`convertToServiceAccount`) |  |  |  |
| WRITE | POST | `/users/{userId}/password` | Set Password (`setPassword`) |  | JSON string |  |
| WRITE | POST | `/users/{userId}/ai-setting` | Set Ai Setting (`setAiSetting`) |  | `modelSetting`, `entitleToAll`, `systemPrompt`, `pullRequestAssigneeResponsibilities`, `proactive`, `maxLoopCount` |  |
| DELETE | DELETE | `/users/{userId}/two-factor-authentication` | Reset Two Factor Authentication (`resetTwoFactorAuthentication`) |  |  |  |
| WRITE | POST | `/users/{userId}/queries-and-watches` | Set Queries And Watches (`setQueriesAndWatches`) |  | `projectQueries`, `issueQueries`, `issueQueryWatches`, `pullRequestQueries`, `pullRequestQueryWatches`, `buildQueries`, `buildQuerySubscriptions`, `packQueries`, `packQuerySubscriptions`, `workspaceQueries`, `workspaceQuerySubscriptions` |  |
| WRITE | POST | `/users/{userId}/ssh-keys` | Add Ssh Key (`addSshKey`) |  | JSON string |  |
| DELETE | DELETE | `/users/{userId}` | Delete User (`deleteUser`) |  |  |  |

### Email Address (`/email-addresses`, `EmailAddressResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/email-addresses/{emailAddressId}` | Get Email Address (`getEmailAddress`) |  |  |  |
| READ | GET | `/email-addresses/{emailAddressId}/verified` | Is Email Address Verified (`isEmailAddressVerified`) |  |  |  |
| WRITE | POST | `/email-addresses` | Create Email Address (`createEmailAddress`) |  | `value`, `ownerId` | Id of created email address |
| WRITE | POST | `/email-addresses/primary` | Set As Primary (`setAsPrimary`) |  | JSON int |  |
| WRITE | POST | `/email-addresses/resend-verification-email` | Resend Verification Email (`resendVerificationEmail`) |  | JSON int |  |
| DELETE | DELETE | `/email-addresses/{emailAddressId}` | Delete Email Address (`deleteEmailAddress`) |  |  |  |

### Ssh Key (`/ssh-keys`, `SshKeyResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/ssh-keys/{sshKeyId}` | Get Key (`getKey`) |  |  |  |
| WRITE | POST | `/ssh-keys` | Create Key (`createKey`) |  | `content`, `ownerId` | Id of created ssh key |
| DELETE | DELETE | `/ssh-keys/{sshKeyId}` | Delete Key (`deleteKey`) |  |  |  |

### Access Token (`/access-tokens`, `AccessTokenResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/access-tokens/{accessTokenId}` | Get Token (`getToken`) |  |  |  |
| READ | GET | `/access-tokens/{accessTokenId}/authorizations` | Get Authorizations (`getAuthorizations`) |  |  |  |
| WRITE | POST | `/access-tokens` | Create Token (`createToken`) |  | `name`, `ownerId`, `hasOwnerPermissions`, `expireDate` | Id of created access token |
| WRITE | POST | `/access-tokens/{accessTokenId}` | Update Token (`updateToken`) |  | `name`, `hasOwnerPermissions`, `expireDate` |  |
| DELETE | DELETE | `/access-tokens/{accessTokenId}` | Delete Token (`deleteToken`) |  |  |  |

### Access Token Authorization (`/access-token-authorizations`, `AccessTokenAuthorizationResource`)

This resource manages project authorizations of access tokens. Note that project authorizations will not take effect if option hasOwnerPermissions is enabled for associated access token

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/access-token-authorizations/{authorizationId}` | Get Authorization (`getAuthorization`) |  |  |  |
| WRITE | POST | `/access-token-authorizations` | Create Authorization (`createAuthorization`) |  | `projectId`, `tokenId`, `roleId` | Id of created access token authorization |
| WRITE | POST | `/access-token-authorizations/{authorizationId}` | Update Authorization (`updateAuthorization`) |  | `projectId`, `roleId` |  |
| DELETE | DELETE | `/access-token-authorizations/{authorizationId}` | Delete Authorization (`deleteAuthorization`) |  |  |  |

### Sso Provider (`/sso-providers`, `SsoProviderResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/sso-providers/{ssoProviderId}` | Get Sso Provider (`getSsoProvider`) |  |  |  |
| READ | GET | `/sso-providers` | List Sso Providers (`listSsoProviders`) |  |  |  |
| READ | GET | `/sso-providers/ids/{name}` | Get Sso Provider Id (`getSsoProviderId`) |  |  |  |
| WRITE | POST | `/sso-providers` | Create Sso Provider (`createSsoProvider`) |  | `name`, `defaultGroupId`, `connector` | Id of created sso provider |
| WRITE | POST | `/sso-providers/{ssoProviderId}` | Update Sso Provider (`updateSsoProvider`) |  | `name`, `defaultGroupId`, `connector` |  |
| DELETE | DELETE | `/sso-providers/{ssoProviderId}` | Delete Sso Provider (`deleteSsoProvider`) |  |  |  |

## Groups, roles and authorizations

**Changes who can do what.** Treat every write as high impact.

### Group (`/groups`, `GroupResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/groups/{groupId}` | Get Group (`getGroup`) |  |  |  |
| READ | GET | `/groups/{groupId}/authorizations` | Get Authorizations (`getAuthorizations`) |  |  |  |
| READ | GET | `/groups/{groupId}/memberships` | Get Memberships (`getMemberships`) |  |  |  |
| READ | GET | `/groups` | Query Groups (`queryGroups`) | `name`, `offset`\*, `count`\* |  |  |
| READ | GET | `/groups/ids/{name}` | Get Group Id (`getGroupId`) |  |  |  |
| WRITE | POST | `/groups` | Create Group (`createGroup`) |  | `name`, `description`, `administrator`, `createRootProjects`, `enforce2FA` | Id of created group |
| WRITE | POST | `/groups/{groupId}` | Update Group (`updateGroup`) |  | `name`, `description`, `administrator`, `createRootProjects`, `enforce2FA` |  |
| DELETE | DELETE | `/groups/{groupId}` | Delete Group (`deleteGroup`) |  |  |  |

### Membership (`/memberships`, `MembershipResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/memberships/{membershipId}` | Get Membership (`getMembership`) |  |  |  |
| WRITE | POST | `/memberships` | Create Membership (`createMembership`) |  | `userId`, `groupId` | Id of created membership |
| DELETE | DELETE | `/memberships/{membershipId}` | Delete Membership (`deleteMembership`) |  |  |  |

### Role (`/roles`, `RoleResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/roles/{roleId}` | Get Role (`getRole`) |  |  |  |
| READ | GET | `/roles` | Query Roles (`queryRoles`) | `name`, `offset`\*, `count`\* |  |  |
| READ | GET | `/roles/ids/{name}` | Get Role Id (`getRoleId`) |  |  |  |
| WRITE | POST | `/roles` | Create Role (`createRole`) |  | `name`, `description`, `manageProject`, `createChildren`, `managePullRequests`, `manageCodeComments`, `codePrivilege`, `packPrivilege`, `manageIssues`, `accessConfidentialIssues`, `accessTimeTracking`, `scheduleIssues`, `editableIssueFields`, `canEditFieldsOfOtherIssues`, `manageBuilds`, `uploadCache`, `jobPrivileges`, `accessibleSites`, `manageWorkspaces`, `createWorkspaces` | Id of created role |
| WRITE | POST | `/roles/{roleId}` | Update Role (`updateRole`) |  | `name`, `description`, `manageProject`, `createChildren`, `managePullRequests`, `manageCodeComments`, `codePrivilege`, `packPrivilege`, `manageIssues`, `accessConfidentialIssues`, `accessTimeTracking`, `scheduleIssues`, `editableIssueFields`, `canEditFieldsOfOtherIssues`, `manageBuilds`, `uploadCache`, `jobPrivileges`, `accessibleSites`, `manageWorkspaces`, `createWorkspaces` |  |
| DELETE | DELETE | `/roles/{roleId}` | Delete Role (`deleteRole`) |  |  |  |

### Base Authorization (`/base-authorizations`, `BaseAuthorizationResource`)

This resource manages default roles of project

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/base-authorizations/{authorizationId}` | Get Authorization (`getAuthorization`) |  |  |  |
| WRITE | POST | `/base-authorizations` | Create Authorization (`createAuthorization`) |  | `projectId`, `roleId` | Id of created base authorization |
| DELETE | DELETE | `/base-authorizations/{authorizationId}` | Delete Authorization (`deleteAuthorization`) |  |  |  |

### Group Authorization (`/group-authorizations`, `GroupAuthorizationResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/group-authorizations/{authorizationId}` | Get Authorization (`getAuthorization`) |  |  |  |
| WRITE | POST | `/group-authorizations` | Create Authorization (`createAuthorization`) |  | `projectId`, `groupId`, `roleId` | Id of created group authorization |
| DELETE | DELETE | `/group-authorizations/{authorizationId}` | Delete Authorization (`deleteAuthorization`) |  |  |  |

### User Authorization (`/user-authorizations`, `UserAuthorizationResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/user-authorizations/{authorizationId}` | Get Authorization (`getAuthorization`) |  |  |  |
| WRITE | POST | `/user-authorizations` | Create Authorization (`createAuthorization`) |  | `projectId`, `userId`, `roleId` | Id of created user authorization |
| DELETE | DELETE | `/user-authorizations/{authorizationId}` | Delete Authorization (`deleteAuthorization`) |  |  |  |

### Issue Authorization (`/issue-authorizations`, `IssueAuthorizationResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/issue-authorizations/{authorizationId}` | Get Authorization (`getAuthorization`) |  |  |  |
| WRITE | POST | `/issue-authorizations` | Create Authorization (`createAuthorization`) |  | `issueId`, `userId` | Id of created issue authorization |
| DELETE | DELETE | `/issue-authorizations/{authorizationId}` | Delete Authorization (`deleteAuthorization`) |  |  |  |

## Agents

Build agents and the tokens that enroll them. **Agent tokens are credentials.**

### Agent (`/agents`, `AgentResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/agents/{agentId}` | Get Agent (`getAgent`) |  |  |  |
| READ | GET | `/agents/{agentId}/attributes` | Get Attributes (`getAttributes`) |  |  |  |
| READ | GET | `/agents` | Query Agents (`queryAgents`) | `query`, `offset`\*, `count`\* |  |  |
| WRITE | POST | `/agents/{agentId}/attributes` | Update Attributes (`updateAttributes`) |  | `string` |  |

### Agent Token (`/agent-tokens`, `AgentTokenResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/agent-tokens/{tokenId}/agent` | Get Agent (`getAgent`) |  |  |  |
| READ | GET | `/agent-tokens/{tokenId}` | Get Token (`getToken`) |  |  |  |
| READ | GET | `/agent-tokens` | Query Tokens (`queryTokens`) | `value`, `offset`\*, `count`\* |  |  |
| WRITE | POST | `/agent-tokens` | Create Token (`createToken`) |  |  |  |
| DELETE | DELETE | `/agent-tokens/{tokenId}` | Delete Token (`deleteToken`) |  |  |  |

## Instance settings

**Instance-wide admin.** Reads can return secrets; writes affect every project.

### Setting (`/settings`, `SettingResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/settings/system` | Get System Setting (`getSystemSetting`) |  |  |  |
| READ | GET | `/settings/authenticator` | Get Authenticator (`getAuthenticator`) |  |  |  |
| READ | GET | `/settings/backup` | Get Backup Setting (`getBackupSetting`) |  |  |  |
| READ | GET | `/settings/build` | Get Build Setting (`getBuildSetting`) |  |  |  |
| READ | GET | `/settings/groovy-scripts` | Get Groovy Scripts (`getGroovyScripts`) |  |  |  |
| READ | GET | `/settings/issue` | Get Issue Setting (`getIssueSetting`) |  |  |  |
| READ | GET | `/settings/job-executors` | Get Job Executors (`getJobExecutors`) |  |  |  |
| READ | GET | `/settings/mail-service` | Get Mail Connector (`getMailConnector`) |  |  |  |
| READ | GET | `/settings/service-desk` | Get Service Desk Setting (`getServiceDeskSetting`) |  |  |  |
| READ | GET | `/settings/notification-template` | Get Notificiation Template Setting (`getNotificiationTemplateSetting`) |  |  |  |
| READ | GET | `/settings/project` | Get Project Setting (`getProjectSetting`) |  |  |  |
| READ | GET | `/settings/pull-request` | Get Pull Request Setting (`getPullRequestSetting`) |  |  |  |
| READ | GET | `/settings/workspace` | Get Workspace Setting (`getWorkspaceSetting`) |  |  |  |
| READ | GET | `/settings/security` | Get Security Setting (`getSecuritySetting`) |  |  |  |
| READ | GET | `/settings/ssh` | Get Ssh Setting (`getSshSetting`) |  |  |  |
| READ | GET | `/settings/contributed-settings` | Get Contributed Settings (`getContributedSettings`) |  |  |  |
| WRITE | POST | `/settings/system` | Set System Setting (`setSystemSetting`) |  | `serverUrl`, `sshRootUrl`, `gitLocation`, `curlLocation`, `sessionTimeout`, `disableAutoUpdateCheck`, `disableDashboard`, `useAvatarService`, `avatarServiceUrl`, `defaultForkRoot`, `noreplyEmailDomain` |  |
| WRITE | POST | `/settings/authenticator` | Set Authenticator (`setAuthenticator`) |  | one of `ActiveDirectoryAuthenticator`, `LdapAuthenticator`; e.g. `@type`, `groupSearchBase`, `ldapUrl`, `authenticationRequired`, `managerDN`, `managerPassword`, `userSearchBases`, `userSearchFilter`, `userFullNameAttribute`, `userEmailAttribute`, `userSshKeyAttribute`, `groupRetrieval`, `defaultGroup`, `timeout` |  |
| WRITE | POST | `/settings/backup` | Set Backup Setting (`setBackupSetting`) |  | `schedule` |  |
| WRITE | POST | `/settings/build` | Set Build Setting (`setBuildSetting`) |  | `namedQueries`, `listParams` |  |
| WRITE | POST | `/settings/groovy-scripts` | Set Groovy Scripts (`setGroovyScripts`) |  | JSON list |  |
| WRITE | POST | `/settings/issue` | Set Issue Setting (`setIssueSetting`) |  | `stateSpecs`, `transitionSpecs`, `fieldSpecs`, `boardSpecs`, `timeTrackingSetting`, `listFields`, `listLinks`, `namedQueries`, `issueTemplates`, `commitMessageFixSetting`, `externalIssueTransformers`, `reconciled` |  |
| WRITE | POST | `/settings/job-executors` | Set Job Executors (`setJobExecutors`) |  | JSON list |  |
| WRITE | POST | `/settings/mail-service` | Set Mail Service (`setMailService`) |  | one of `SendgridConnector`, `GmailConnector`, `Office365Connector`, `SmtpImapConnector`; e.g. `@type`, `apiKey`, `systemAddress`, `concurrency`, `timeout`, `webhookSetting` |  |
| WRITE | POST | `/settings/service-desk` | Set Service Desk Setting (`setServiceDeskSetting`) |  | `issueCreationSettings` |  |
| WRITE | POST | `/settings/notification-template` | Set Notification Template Setting (`setNotificationTemplateSetting`) |  | `issueNotification`, `pullRequestNotification`, `buildNotification`, `packNotification`, `workspaceNotification`, `commitNotification`, `issueNotificationUnsubscribed`, `pullRequestNotificationUnsubscribed`, `serviceDeskIssueOpened`, `serviceDeskIssueOpenFailed`, `userInvitation`, `emailVerification`, `passwordReset`, `stopwatchOverdue`, `alert` |  |
| WRITE | POST | `/settings/project` | Set Project Setting (`setProjectSetting`) |  | `namedQueries` |  |
| WRITE | POST | `/settings/pull-request` | Set Pull Request Setting (`setPullRequestSetting`) |  | `namedQueries` |  |
| WRITE | POST | `/settings/workspace` | Set Workspace Setting (`setWorkspaceSetting`) |  | `namedQueries` |  |
| WRITE | POST | `/settings/security` | Set Security Setting (`setSecuritySetting`) |  | `enableAnonymousAccess`, `disableInternalLogin`, `enableSelfRegister`, `allowedSelfRegisterEmailDomain`, `enableSelfDeregister`, `passwordPolicy`, `defaultGroupName`, `enforce2FA`, `corsAllowedOrigins` |  |
| WRITE | POST | `/settings/ssh` | Set Ssh Setting (`setSshSetting`) |  | `pemPrivateKey` |  |
| WRITE | POST | `/settings/contributed-settings` | Set Contributed Settings (`setContributedSettings`) |  | JSON list |  |
| READ | GET | `/settings/project-defaults` | Get Project Defaults (`getProjectDefaults`) |  |  |  |
| WRITE | POST | `/settings/project-defaults` | Set Project Defaults (`setProjectDefaults`) |  | `branchProtections`, `tagProtections`, `codeIndexingSetting`, `aiSetting`, `workspaceSpecs`, `wikiSetting`, `webHooks`, `contributedSettings`, `buildSetting`, `issueSetting`, `pullRequestSetting` |  |
| READ | GET | `/settings/project-defaults/user-authorizations` | Get Project Default User Authorizations (`getProjectDefaultUserAuthorizations`) |  |  |  |
| READ | GET | `/settings/project-defaults/group-authorizations` | Get Project Default Group Authorizations (`getProjectDefaultGroupAuthorizations`) |  |  |  |
| READ | GET | `/settings/project-defaults/base-authorizations` | Get Project Default Base Authorizations (`getProjectDefaultBaseAuthorizations`) |  |  |  |

### Label Spec (`/label-specs`, `LabelSpecResource`)

| Risk | Method | Path | Operation | Query | Body | Returns |
| --- | --- | --- | --- | --- | --- | --- |
| READ | GET | `/label-specs/{labelSpecId}` | Get Spec (`getSpec`) |  |  |  |
| READ | GET | `/label-specs` | Query Specs (`querySpecs`) | `name`, `offset`\*, `count`\* |  |  |
| WRITE | POST | `/label-specs` | Create Spec (`createSpec`) |  | `color`, `name` | Id of created label spec |
| WRITE | POST | `/label-specs/{labelSpecId}` | Update Spec (`updateSpec`) |  | `color`, `name` |  |
| DELETE | DELETE | `/label-specs/{labelSpecId}` | Delete Spec (`deleteSpec`) |  |  |  |
