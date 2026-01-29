# Giano Bridge — Agent Workflow

Use this checklist when working tasks pulled from Giano.

## Loop

1) Pull a task
- Call `giano_task_pull` (use a timeout if you want blocking behavior)

2) If you got a task, ACK start
- Call `giano_task_ack(taskId, "🟦 Started. I will report progress.")`

3) Do the work
- Make changes in repo
- Run tests/build
- Validate outputs

4) Report progress at milestones
- Call `giano_task_progress(taskId, "🟪 Progress: ...")`

5) Complete
- success: `giano_task_complete(taskId, success, summary)`
- blocked: `giano_task_complete(taskId, blocked, summary + what you need)`
- failed: `giano_task_complete(taskId, failed, summary + logs)`

## Summary format (recommended)

- What changed
- Files touched
- Commands to verify
- Notes/risks
