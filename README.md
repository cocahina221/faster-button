# faster-button

A Claude Code mod that adds a **⚡ Faster** switch above the prompt box. Turning it on:

- turns on Claude Code's built-in fast mode (the same as `/fast`), so the model generates output faster;
- asks Claude to work faster on every prompt (fewer steps, shorter replies);
- if Claude is mid-response, passes the request along right after its next tool call.

Each flip plays a sound. The setting is remembered across sessions. Fast mode is billed at a
higher rate than normal usage.

## Install

```
/plugin install faster-button --marketplace cocahina221/faster-button
```

Pair it with the built-in `/fast` for faster output generation too.
