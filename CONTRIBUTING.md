# Contributing to AgentDock

## Development Setup

1. **Requirements**
   - Node.js ≥ 20.11.0 (LTS)
   - pnpm ≥ 9.15.0 (Required)

2. **Install Dependencies**
   ```bash
   pnpm install
   ```

3. **Set up Git Hooks**
   ```bash
   # Initialize Husky
   pnpm dlx husky init
   
   # Make the pre-push hook executable
   chmod +x .husky/pre-push
   ```

   This will set up pre-push hooks that run:
   - TypeScript checks
   - ESLint validation
   - Unit tests

   > **Note**: The hooks can be bypassed in emergencies with `git push --no-verify`, but this is discouraged.

4. **Start Development Server**
   ```bash
   pnpm dev
   ```

## Git Hooks

AgentDock uses Husky to enforce code quality through git hooks:

- **Pre-Push Hook**: Runs before pushing changes to remote
  - TypeScript type checking
  - ESLint validation
  - Unit tests
  - Project-specific validation

The validation process ensures:
- No type errors
- Code style consistency
- Test coverage
- Project-specific requirements

## Testing Your Changes

Before submitting a PR:
1. Ensure all tests pass: `pnpm test`
2. Run type checking: `pnpm tsc --noEmit`
3. Check linting: `pnpm lint`
4. Run validation: `pnpm run validate`

The pre-push hook will run these automatically, but it's good practice to check them manually during development.

[Rest of the existing CONTRIBUTING.md content...] 