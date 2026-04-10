Check the latest GitHub Actions errors for the open pull request on the current branch.

Use the `gh-pr-errors` skill.

After running the skill:

- Report the latest run metadata in a compact summary.
- If the run is still in progress, say that there are no completed errors yet.
- If the run failed, summarize the first actionable error from the failed logs.
- If the run succeeded, say that clearly.
