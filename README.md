# cchistory

Extract and compare system prompts and tools from different Claude Code versions.

## Prerequisites

- You must be logged in to Claude Code (authentication required for all modes)
- Claude Code installation is optional if using `--binary-path` with a custom binary
- Note: Each version tested will send a single haiku request to Claude, which may incur costs if you're on a pay-per-token plan instead of Claude Max

## Installation

```bash
npm install -g @mariozechner/cchistory
```

## Usage

```bash
cchistory [version] [--latest] [--binary-path <path>] [--claude-args "<args>"]
```

### Options

- `version` - NPM version of Claude Code to extract (e.g., `1.0.0`)
- `--latest` - Extract all versions from the specified version to the latest published version
- `--binary-path <path>` - Use a custom/local Claude Code binary instead of downloading from npm
- `--claude-args "<args>"` - Pass additional arguments to Claude Code during execution
- `--version`, `-v` - Show cchistory version
- `--help`, `-h` - Show help message

### Examples

```bash
# Extract prompts from a single version
cchistory 1.0.0

# Extract prompts from version 1.0.0 to latest
cchistory 1.0.0 --latest

# Test a custom/local build of Claude Code
cchistory --binary-path /path/to/custom/cli.js

# Test with additional Claude Code arguments
cchistory 1.0.0 --claude-args "--mcp-config /path/to/config.json"

# Combine custom binary with custom arguments
cchistory --binary-path ./build/cli.js --claude-args "--verbose"

# Pass system prompt modifiers to any version
cchistory 1.5.0 --claude-args "--append-system-prompt"
```

## How it works

### Standard Mode (NPM versions)

1. Downloads the specified Claude Code version from npm
2. Patches the version check to prevent auto-updates
3. Runs the patched version with claude-trace to intercept API requests
4. Sends a single test haiku request to trigger an API call
5. Extracts the system prompt, user message format, and available tools from the intercepted request
6. Saves the results to `prompts-{version}.md`

### Custom Binary Mode (`--binary-path`)

1. Uses the specified binary directly (skips download and patching)
2. Runs it with claude-trace to intercept API requests
3. Sends a single test haiku request to trigger an API call
4. Extracts the system prompt, user message format, and available tools from the intercepted request
5. Saves the results to `prompts-custom-{timestamp}.md`

Existing prompt files are automatically skipped to avoid redundant downloads and API calls.

## Output Format

Each `prompts-{version}.md` file contains:
- **User Message**: The format of user messages sent to Claude
- **System Prompt**: The system instructions Claude receives
- **Tools**: Available tools with their descriptions and input schemas (excluding MCP tools)

## Advanced Usage

### Testing Local/Development Builds

The `--binary-path` flag is particularly useful for:
- Testing local modifications to Claude Code before publishing
- Comparing development builds against released versions
- Debugging prompt or tool changes in your fork

```bash
# Test your local development build
cchistory --binary-path /path/to/your/fork/cli.js

# Compare with a released version
cchistory 1.0.0
# Now you have both prompts-1.0.0.md and prompts-custom-*.md to compare
```

### Passing Arguments to Claude Code

The `--claude-args` flag allows you to test Claude Code with different configurations:

```bash
# Test with MCP server configuration
cchistory 1.5.0 --claude-args "--mcp-config ~/.config/claude/mcp.json"

# Test with verbose logging
cchistory --binary-path ./build/cli.js --claude-args "--verbose"

# Combine multiple flags
cchistory 1.0.0 --claude-args "--debug --no-cache"
```

**Note**: Arguments are parsed safely using shell-quote to prevent command injection. Shell operators and control characters are filtered out.

### Debugging

Enable debug output to see detailed information about the extraction process:

```bash
DEBUG=1 cchistory 1.0.0
```

This will show:
- All API requests found in the claude-trace log
- Model names and tool counts for each request
- Full stack traces for any errors

### Security Notes

- All shell commands use proper escaping via the `shell-quote` library
- The `--claude-args` parameter filters out shell operators for safety
- Version patching only modifies the version check function (no other code changes)
- Custom binaries are executed directly without modification