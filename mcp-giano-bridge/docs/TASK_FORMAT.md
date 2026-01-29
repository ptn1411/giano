# Task format (v0.2)

The bridge accepts tasks posted to the Giano bot chat in several formats.

## A) Quick /task (minimal)

```text
/task Fix bug in refresh token flow. DoD: tests pass.
```

Bridge will produce a v2 payload with:
- `goal` = message text (without `/task`)
- `taskId` = `updateId` (unless you explicitly provide a taskId)

## B) YAML-ish key/value (recommended for humans)

```text
taskId: auth-rot-001
title: Refresh token rotation
goal: Implement refresh token rotation in backend
repoPath: /root/clawd/giano
dod:
- tests pass
- no breaking change
steps:
- Inspect current refresh implementation
- Implement rotation
- Add tests
files:
- backend/src/services/auth.rs
commandsAllowed:
- cargo test
- cargo run
notes: Focus on security + invalidate old tokens.
```

## C) JSON (recommended for machines)

```json
{
  "taskId": "auth-rot-001",
  "title": "Refresh token rotation",
  "goal": "Implement refresh token rotation in backend",
  "repoPath": "/root/clawd/giano",
  "acceptanceCriteria": ["tests pass", "no breaking change"],
  "steps": ["..."],
  "files": ["backend/src/services/auth.rs"],
  "commandsAllowed": ["cargo test"],
  "notes": "Focus on security"
}
```

## Output schema

`giano_task_pull` returns:

```json
{
  "version": "v2",
  "task": {
    "taskId": "...",
    "chatId": "...",
    "messageId": "...",
    "replyToId": "...",
    "fromUserId": "...",
    "receivedAt": "...",
    "payload": {
      "version": "v2",
      "taskId": "...",
      "title": "...",
      "goal": "...",
      "acceptanceCriteria": [],
      "steps": [],
      "repoPath": "...",
      "files": [],
      "commandsAllowed": [],
      "notes": "..."
    },
    "rawText": "..."
  }
}
```
