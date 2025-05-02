# Contributing to AgentDock

Thank you for your interest in contributing to AgentDock! This document provides guidelines for contributions to help maintain code quality and project consistency.

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

For testing guidelines, refer to the [Testing Strategy](docs/testing.md) document, which outlines the mocking strategy and best practices for unit testing, particularly for the `agentdock-core` module.

The pre-push hook will run these automatically, but it's good practice to check them manually during development.

## Documentation Guidelines

When adding or modifying features, please follow these documentation guidelines:

1. **Code Documentation**
   - Document all public APIs with JSDoc/TSDoc comments
   - Include examples where appropriate
   - Explain complex algorithms or non-obvious design decisions

2. **README Updates**
   - Update the relevant README.md files when adding new features
   - Ensure examples and usage instructions are current

3. **Feature Documentation**
   - For significant features, add documentation to the `/docs/` folder
   - Follow the established format of existing documentation
   - Include usage examples, configuration options, and edge cases

## Pull Request Process

1. **Fork the Repository**
   - Create a fork of the repository to make your changes

2. **Create a Branch**
   - Create a branch with a descriptive name (e.g., `feature/add-vector-support`)

3. **Make Your Changes**
   - Follow the coding standards and documentation guidelines
   - Ensure all tests pass and add new tests for your changes

4. **Submit a Pull Request**
   - Provide a clear description of your changes
   - Reference any related issues
   - Complete the PR template with all required information

5. **Code Review**
   - Be responsive to feedback and make requested changes
   - Ensure CI checks pass before requesting review

## Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing to ensure a positive and inclusive community experience.

## Questions or Help?

If you have questions or need help with the contribution process, please reach out through:
- GitHub Issues
- Community Discord
- Email at [oguz@agentdock.ai](mailto:oguz@agentdock.ai)

Thank you for contributing to AgentDock!
