# Issue tracker: GitHub

Issues and specs for this repository live in GitHub Issues. Use the `gh` CLI for every operation.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for a multiline body.
- **Read an issue**: `gh issue view <number> --json number,title,body,author,createdAt,updatedAt,state,labels,comments`.
- **List issues**: `gh issue list --state open --limit 1000 --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`, with suitable `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`.
- **Add or remove a label**: `gh issue edit <number> --add-label "..."` or `gh issue edit <number> --remove-label "..."`.
- **Close an issue**: `gh issue close <number> --comment "..."`.

Infer the repository from `git remote -v`. `gh` does this automatically when it runs inside this clone.

## Pull requests in the triage queue

**PRs as a request surface: no.** Change this value to `yes` if the repository later treats external pull requests as feature requests. The `/triage` skill reads this choice.

If this changes to `yes`, apply the same labels and states to pull requests with the `gh pr` commands:

- **Read a pull request**: `gh pr view <number> --comments`, then `gh pr diff <number>` for the diff.
- **List external pull requests**: `gh api --paginate 'repos/{owner}/{repo}/pulls?state=open&per_page=100' | jq -s 'add | map(select(.author_association == "CONTRIBUTOR" or .author_association == "FIRST_TIME_CONTRIBUTOR" or .author_association == "NONE"))'`.
- **Comment, label, or close**: use `gh pr comment`, `gh pr edit --add-label`, `gh pr edit --remove-label`, and `gh pr close`.

GitHub shares one number space across issues and pull requests. To resolve a reference such as `#42`, try `gh pr view 42`, then `gh issue view 42`.

## When a skill says to publish to the issue tracker

Create a GitHub issue.

## When a skill asks for the relevant ticket

Run `gh issue view <number> --comments`.

## Wayfinding operations

The `/wayfinder` skill uses one main issue as a map and sub-issues as tickets.

- **Map**: one issue labelled `wayfinder:map`. Its body holds notes, decisions so far, and unresolved areas. Create it with `gh issue create --label wayfinder:map`.
- **Child ticket**: a GitHub sub-issue linked to the map through the sub-issues endpoint with `gh api`. If sub-issues are unavailable, add the child to a task list in the map and put `Part of #<map>` at the top of its body. Use a `wayfinder:<type>` label from `research`, `prototype`, `grilling`, and `task`. Assign a claimed ticket to the developer driving the work.
- **Blocking**: use GitHub's native issue dependencies. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-database-id>`. Fetch the numeric database ID with `gh api repos/<owner>/<repo>/issues/<number> --jq .id`. It is neither the `#<number>` nor the `node_id`. If dependencies are unavailable, put `Blocked by: #<number>, #<number>` at the top of the body.
- **Frontier query**: list the map's open children, remove those with an open blocker or an assignee, then take the first in map order.
- **Claim**: run `gh issue edit <number> --add-assignee @me`. This is the session's first write.
- **Resolve**: comment with `gh issue comment <number> --body "<answer>"`, close the issue, then add a context pointer with its link to the map's decisions.
