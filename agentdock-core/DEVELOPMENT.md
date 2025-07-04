# AgentDock Core - Development Guide

## Package Development Pattern

This package is being developed locally as part of the AgentDock monorepo but will be published as a separate npm package when ready for production.

### Current Structure
```
agentdock-web/
├── package.json (main project)
├── agentdock-core/ (future npm package)
│   ├── package.json (separate package deps)
│   ├── src/
│   └── dist/
```

### Installation Process
The root `package.json` has a special postinstall pattern:

```bash
# Tries secure approach first, falls back if needed
install:agentdock-core: cd agentdock-core && (pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile)
```

## Security Considerations

**Why `--no-frozen-lockfile` fallback?**
- During active development, dependencies may change frequently
- Lockfile conflicts can occur when switching branches
- Development velocity vs security tradeoff

**Security Measures:**
1. Try `--frozen-lockfile` first (secure)
2. Fallback to `--no-frozen-lockfile` only if needed
3. Documented in package.json comments
4. Will be removed when published to npm

## Future State
When `agentdock-core` is published:
```json
{
  "dependencies": {
    "agentdock-core": "^1.0.0"
  }
}
```

The postinstall complexity will be removed entirely. 