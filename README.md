# cchistory

Extract and compare system prompts and tools from different Claude Code versions.

## Prerequisites

- Claude Code must be installed locally
- You must be logged in to Claude Code
- Note: Each version tested will send a single `-p "hey"` request to Claude, which may incur costs if you're on a pay-per-token plan instead of Claude Max

## Installation

```bash
npm install -g @mariozechner/cchistory
```

## Usage

```bash
cchistory <version> [--latest]
```

Examples:
```bash
# Extract prompts from a single version
cchistory 1.0.0

# Extract prompts from version 1.0.0 to latest
cchistory 1.0.0 --latest
```

## How it works

1. Downloads the specified Claude Code version from npm
2. Patches the version check to prevent auto-updates
3. Runs the patched version with claude-trace to intercept API requests
4. Sends a single test message (`-p "hey"`) to trigger an API call
5. Extracts the system prompt, user message format, and available tools from the intercepted request
6. Saves the results to `prompts-{version}.md`

Existing prompt files are automatically skipped to avoid redundant downloads and API calls.

## Output Format

Each `prompts-{version}.md` file contains:
- **User Message**: The format of user messages sent to Claude
- **System Prompt**: The system instructions Claude receives
- **Tools**: Available tools with their descriptions and input schemas (excluding MCP tools)