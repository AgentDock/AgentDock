import { execSync } from 'child_process';
import { logger, LogCategory } from 'agentdock-core';
import chalk from 'chalk';

interface ValidationResult {
  passed: boolean;
  error?: string;
}

async function runCommand(command: string): Promise<ValidationResult> {
  try {
    execSync(command, { stdio: 'inherit' });
    return { passed: true };
  } catch (error) {
    return {
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function validateTypecheck(): Promise<ValidationResult> {
  console.log(chalk.blue('🔍 Running TypeScript checks...'));
  return runCommand('pnpm tsc --noEmit');
}

async function validateLint(): Promise<ValidationResult> {
  console.log(chalk.blue('🔍 Running ESLint...'));
  return runCommand('pnpm lint');
}

async function validateTests(): Promise<ValidationResult> {
  console.log(chalk.blue('🧪 Running tests...'));
  return runCommand('pnpm test:unit');
}

async function validateFormat(): Promise<ValidationResult> {
  console.log(chalk.blue('💅 Checking code formatting...'));
  return runCommand('pnpm format:check');
}

async function main() {
  try {
    // Run validations in sequence
    const typecheck = await validateTypecheck();
    if (!typecheck.passed) {
      throw new Error(`TypeScript check failed: ${typecheck.error}`);
    }

    const lint = await validateLint();
    if (!lint.passed) {
      throw new Error(`Lint check failed: ${lint.error}`);
    }

    const format = await validateFormat();
    if (!format.passed) {
      throw new Error(`Format check failed: ${format.error}`);
    }

    const tests = await validateTests();
    if (!tests.passed) {
      throw new Error(`Tests failed: ${tests.error}`);
    }

    console.log(chalk.green('✅ All pre-push checks passed!'));
    process.exit(0);
  } catch (error) {
    logger.error(LogCategory.SYSTEM, 'GitHooks', 'Pre-push validation failed', { error });
    console.error(chalk.red('❌ Pre-push checks failed'));
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

main();
