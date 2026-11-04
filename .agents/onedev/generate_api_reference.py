#!/usr/bin/env python3
"""Regenerate API_REFERENCE.md from a OneDev instance's own API help.

Only sends anonymous GETs to /~api/help. Rerun after every OneDev upgrade:

    python3 -I .agents/onedev/generate_api_reference.py [server-url]
"""
import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

SERVER = (sys.argv[1] if len(sys.argv) > 1 else "https://code.weexnes.dev").rstrip("/")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "API_REFERENCE.md")

# Domain -> (intro, resource class names). Unknown resources land in "Other"
# so a new OneDev release can never drop out of the reference silently.
DOMAINS = [
    ("Server", "Health and version. Both are readable anonymously on this instance.", ["ServerResource"]),
    ("Projects", "Projects, their labels, iterations and workspaces. `POST /projects/{projectId}/setting` carries branch protections, job secrets and web hooks.",
     ["ProjectResource", "ProjectLabelResource", "IterationResource", "WorkspaceResource"]),
    ("Repositories", "Branches, tags, commits and files through the API. Prefer plain `git` for anything a checkout can do.", ["RepositoryResource"]),
    ("Builds and jobs", "Most operations take a build **id**, not the build number shown in the UI.",
     ["BuildResource", "BuildLabelResource", "BuildLogStreamResource", "JobRunResource", "TriggerJobResource", "ArtifactResource"]),
    ("Pull requests and code review", "Most operations take a request **id**, not the PR number.",
     ["PullRequestResource", "PullRequestCommentResource", "PullRequestLabelResource", "PullRequestWatchResource", "CodeCommentResource", "CodeCommentReplyResource"]),
    ("Issues", "Most operations take an issue **id**, not the issue number.",
     ["IssueResource", "IssueCommentResource", "IssueLinkResource", "IssueVoteResource", "IssueWatchResource", "IssueWorkResource"]),
    ("Packages", "Package registry entries, blobs and labels.", ["PackResource", "PackBlobResource", "PackLabelResource"]),
    ("Users and credentials", "**Admin or credential-bearing.** Never print responses from these resources.",
     ["UserResource", "EmailAddressResource", "SshKeyResource", "AccessTokenResource", "AccessTokenAuthorizationResource", "SsoProviderResource"]),
    ("Groups, roles and authorizations", "**Changes who can do what.** Treat every write as high impact.",
     ["GroupResource", "MembershipResource", "RoleResource", "BaseAuthorizationResource", "GroupAuthorizationResource", "UserAuthorizationResource", "IssueAuthorizationResource"]),
    ("Agents", "Build agents and the tokens that enroll them. **Agent tokens are credentials.**", ["AgentResource", "AgentTokenResource"]),
    ("Instance settings", "**Instance-wide admin.** Reads can return secrets; writes affect every project.", ["SettingResource", "LabelSpecResource"]),
]


def fetch_text(path):
    # curl rather than urllib: python.org builds on macOS ship without a CA bundle.
    result = subprocess.run(["curl", "-fsS", "-m", "30", "--retry", "3", "--retry-all-errors", SERVER + path], capture_output=True, text=True, check=True)
    return result.stdout


def fetch(path):
    return json.loads(fetch_text(path))


def cell(text):
    return str(text).replace("|", "\\|").replace("\n", " ").strip()


def risk(res, method):
    # A GET here still starts a job, so the HTTP verb alone would mislead.
    if res == "TriggerJobResource":
        return "WRITE"
    return {"GET": "READ", "DELETE": "DELETE"}.get(method, "WRITE")


def body_summary(detail):
    body = detail.get("requestBody")
    if not body:
        return ""
    example = body.get("example")
    defs = detail.get("$defs", {})
    ref = (body.get("schema") or {}).get("$ref", "").split("/")[-1]
    variants = []
    for variant in defs.get(ref, {}).get("oneOf", []):
        for part in variant.get("allOf", []):
            const = part.get("properties", {}).get("@type", {}).get("const")
            if const:
                variants.append(const)
    if isinstance(example, dict):
        text = ", ".join(f"`{key}`" for key in example)
    elif example is None:
        text = f"`{body.get('contentType', 'binary')}`"
    else:
        text = f"JSON {'string' if isinstance(example, str) else type(example).__name__}"
    if variants:
        text = "one of " + ", ".join(f"`{v}`" for v in variants) + "; e.g. " + text
    return text


def query_summary(detail):
    return ", ".join(
        f"`{q['name']}`" + ("\\*" if q.get("required") else "") for q in detail.get("queryParameters", [])
    )


def response_summary(detail):
    success = detail.get("response", {}).get("success", {})
    parts = []
    if success.get("description"):
        parts.append(success["description"])
    content = (success.get("body") or {}).get("contentType")
    if content and content != "application/json":
        parts.append(f"`{content}`")
    return "; ".join(parts)


def main():
    # Served as application/json, but the body is a bare 17.0.0, not valid JSON.
    version = fetch_text("/~api/server/version").strip()
    index = fetch("/~api/help")
    resources = {}
    with ThreadPoolExecutor(4) as pool:
        for entry, doc in zip(index["resources"], pool.map(lambda r: fetch(r["help"]), index["resources"])):
            methods = doc["methods"]
            details = list(pool.map(lambda m: fetch(m["help"]), methods))
            resources[entry["id"].split(".")[-1]] = (entry, doc, details)

    known = {name for _, _, names in DOMAINS for name in names}
    domains = list(DOMAINS)
    other = sorted(set(resources) - known)
    if other:
        domains.append(("Other", "New resources not yet sorted into a domain.", other))

    total = sum(len(details) for _, _, details in resources.values())
    lines = [
        "# OneDev REST API Reference",
        "",
        f"Generated from `{SERVER}/~api/help` on OneDev **{version}**: {len(resources)} resources, {total} operations.",
        "**Do not edit by hand.** Rerun `generate_api_reference.py` after an upgrade. Workflows and safety rules are in [PLAYBOOK.md](PLAYBOOK.md) and [AGENT_INSTRUCTIONS.md](AGENT_INSTRUCTIONS.md).",
        "",
        "**How far this is verified:** every row is what the instance's own help says exists. A row does not mean the call was run. Only the read calls marked in PLAYBOOK.md section 1 were executed.",
        "",
        "## Conventions",
        "",
        f"- **Base URL:** `{index['baseUrl']}`. Paths below omit the `/~api` prefix.",
        f"- **Auth (from the instance's help):** {index['authentication']}",
        "- **`offset` and `count`** are required on list operations that declare them. `\\*` marks a required query parameter.",
        "- **Risk:** `READ`, `WRITE` or `DELETE`. See AGENT_INSTRUCTIONS.md for which ones need confirmation. `GET /trigger-job` is `WRITE` because it starts a job.",
        "- **Body** lists top-level fields from the help's example. Not all are mandatory, and the help does not always say which are.",
        "- **Full schema for one operation:** `GET /~api/help/io.onedev.server.rest.resource.<Resource>/<operation>`, using the names shown in each section heading and the **Operation** column.",
        "",
        "## Contents",
        "",
    ]
    for title, _, names in domains:
        anchor = title.lower().replace(" ", "-").replace(",", "")
        lines.append(f"- [{title}](#{anchor}) ({sum(len(resources[n][2]) for n in names if n in resources)} operations)")
    lines.append("")

    for title, intro, names in domains:
        lines += [f"## {title}", "", intro, ""]
        for name in names:
            if name not in resources:
                continue
            entry, doc, details = resources[name]
            lines += [f"### {entry['title']} (`{entry['path']}`, `{name}`)", ""]
            if doc.get("description"):
                lines += [cell(doc["description"]), ""]
            lines += ["| Risk | Method | Path | Operation | Query | Body | Returns |", "| --- | --- | --- | --- | --- | --- | --- |"]
            for method, detail in zip(doc["methods"], details):
                op = method["help"].split("/")[-1]
                path = detail["path"].removeprefix("/~api")
                row = [
                    risk(name, detail["httpMethod"]),
                    detail["httpMethod"],
                    f"`{cell(path)}`",
                    f"{cell(detail['title'])} (`{op}`)",
                    query_summary(detail),
                    body_summary(detail),
                    cell(response_summary(detail)),
                ]
                lines.append("| " + " | ".join(row) + " |")
            lines.append("")

    with open(OUT, "w") as handle:
        handle.write("\n".join(lines))
    print(f"wrote {OUT}: {len(resources)} resources, {total} operations, OneDev {version}")


if __name__ == "__main__":
    main()
