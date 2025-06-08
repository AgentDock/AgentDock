import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

interface ValidationStep {
  name: string;
  check: () => Promise<boolean>;
  error: string;
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

async function runCommand(command: string): Promise<string> {
  try {
    console.log(`Running command: ${command}`);
    return execSync(command, { encoding: 'utf8', stdio: 'inherit' });
  } catch (error) {
    throw new ValidationError(`Command failed: ${command}\n${error}`);
  }
}

async function validateBuild(): Promise<boolean> {
  console.log(chalk.blue('🔍 Validating build...'));

  // Clean previous build
  if (existsSync('.next')) {
    await runCommand('rm -rf .next');
  }

  // Run prebuild
  await runCommand('pnpm run prebuild');

  // Run build
  await runCommand('pnpm run build');

  // Verify build output
  const requiredFiles = [
    '.next/routes-manifest.json',
    '.next/build-manifest.json',
    '.next/server/app-paths-manifest.json'
  ];

  for (const file of requiredFiles) {
    if (!existsSync(join(process.cwd(), file))) {
      throw new ValidationError(`Required build file not found: ${file}`);
    }
    console.log(chalk.green(`✓ Found ${file}`));
  }

  // Verify routes-manifest.json content
  const routesManifest = JSON.parse(
    readFileSync(join(process.cwd(), '.next/routes-manifest.json'), 'utf8')
  );

  // Next.js 15.1.6 structure
  if (!routesManifest.staticRoutes && !routesManifest.dynamicRoutes) {
    throw new ValidationError(
      'Invalid routes-manifest.json structure - missing routes definitions'
    );
  }

  return true;
}

async function validateTypes(): Promise<boolean> {
  console.log(chalk.blue('🔍 Checking TypeScript types...'));
  await runCommand('pnpm tsc --noEmit');
  return true;
}

async function validateRouteHandler(): Promise<boolean> {
  console.log(chalk.blue('🔍 Validating route handler...'));

  const routePath = 'src/app/api/chat/[agentId]/route.ts';
  if (!existsSync(routePath)) {
    throw new ValidationError('Route handler file not found');
  }

  // Read file content directly
  const fileContent = readFileSync(routePath, 'utf8');
  if (
    !fileContent.includes("export const runtime = 'edge'") &&
    !fileContent.includes("export const runtime = 'nodejs'")
  ) {
    throw new ValidationError(
      'Runtime not properly configured - must be either "edge" or "nodejs"'
    );
  }

  return true;
}

async function validateDependencies(): Promise<boolean> {
  console.log(chalk.blue('🔍 Validating dependencies...'));

  // Check for package.json
  if (!existsSync('package.json')) {
    throw new ValidationError('package.json not found');
  }

  // Verify pnpm-lock.yaml
  if (!existsSync('pnpm-lock.yaml')) {
    throw new ValidationError('pnpm-lock.yaml not found');
  }

  // Install dependencies
  await runCommand('pnpm install');

  return true;
}

async function validateVercelConfig(): Promise<boolean> {
  console.log(chalk.blue('🔍 Validating Vercel configuration...'));

  // Check for vercel.json
  if (!existsSync('vercel.json')) {
    throw new ValidationError('vercel.json not found');
  }

  // Verify configuration
  const config = require(join(process.cwd(), 'vercel.json'));

  const requiredFields = [
    'buildCommand',
    'installCommand',
    'framework',
    'outputDirectory'
  ];

  for (const field of requiredFields) {
    if (!config[field]) {
      throw new ValidationError(
        `Missing required field in vercel.json: ${field}`
      );
    }
  }

  return true;
}

async function validateRouteManifest(): Promise<boolean> {
  console.log(chalk.blue('🔍 Validating route manifest...'));

  const manifestPath = join(
    process.cwd(),
    '.next/server/app-paths-manifest.json'
  );
  const pagesManifestPath = join(
    process.cwd(),
    '.next/server/pages-manifest.json'
  );

  if (!existsSync(manifestPath)) {
    // Try to generate it
    console.log(
      chalk.yellow('Route manifest not found, attempting to generate...')
    );
    await runCommand('pnpm next build');

    if (!existsSync(manifestPath)) {
      throw new ValidationError('Failed to generate app-paths-manifest.json');
    }
  }

  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const pagesManifest = existsSync(pagesManifestPath)
      ? JSON.parse(readFileSync(pagesManifestPath, 'utf8'))
      : {};

    // Check for our API routes in app directory
    const hasAppApiRoutes = Object.keys(manifest).some((route) =>
      route.startsWith('/api/')
    );

    // Check for our API routes in pages directory
    const hasPagesApiRoutes = Object.keys(pagesManifest).some((route) =>
      route.startsWith('/api/')
    );

    // Log all routes for debugging
    console.log('Available routes in app directory:');
    Object.keys(manifest).forEach((route) => console.log(`  - ${route}`));
    console.log('Available routes in pages directory:');
    Object.keys(pagesManifest).forEach((route) => console.log(`  - ${route}`));

    // Check for dynamic routes in the filesystem
    const dynamicRoutes = execSync(
      'find src/app/api -name "route.ts" -type f',
      { encoding: 'utf8' }
    );
    console.log('Dynamic routes found in filesystem:');
    dynamicRoutes
      .split('\n')
      .filter(Boolean)
      .forEach((route) => console.log(`  - ${route}`));

    const hasDynamicRoutes =
      dynamicRoutes.split('\n').filter(Boolean).length > 0;

    if (!hasAppApiRoutes && !hasPagesApiRoutes && !hasDynamicRoutes) {
      throw new ValidationError(
        'No API routes found in manifests or filesystem'
      );
    }

    // Log found routes for debugging
    console.log(chalk.green('Found API routes:'));
    Object.keys(manifest)
      .filter((route) => route.startsWith('/api/'))
      .forEach((route) => console.log(chalk.green(`  - ${route}`)));

    console.log(chalk.green('✓ Route manifest validation passed'));
    return true;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(`Invalid route manifest: ${error}`);
  }
}

const validationSteps: ValidationStep[] = [
  {
    name: 'Dependencies',
    check: validateDependencies,
    error: 'Dependency validation failed'
  },
  {
    name: 'TypeScript',
    check: validateTypes,
    error: 'TypeScript validation failed'
  },
  {
    name: 'Route Handler',
    check: validateRouteHandler,
    error: 'Route handler validation failed'
  },
  {
    name: 'Vercel Config',
    check: validateVercelConfig,
    error: 'Vercel configuration validation failed'
  },
  {
    name: 'Route Manifest',
    check: validateRouteManifest,
    error: 'Route manifest validation failed'
  },
  {
    name: 'Build',
    check: validateBuild,
    error: 'Build validation failed'
  }
];

async function runValidation() {
  console.log('\n=== Starting pre-deployment validation ===\n');

  for (const step of validationSteps) {
    console.log(`\n→ Running ${step.name} validation...\n`);
    try {
      const success = await step.check();
      if (success) {
        console.log(`\n✓ ${step.name} validation passed\n`);
      } else {
        throw new ValidationError(step.error);
      }
    } catch (error) {
      console.error(`\n✗ ${step.name} validation failed:`);
      console.error(error);
      process.exit(1);
    }
  }

  console.log('\n✓ All validations passed! Ready for deployment.\n');
}

runValidation().catch((error) => {
  console.error('\nValidation failed:', error);
  process.exit(1);
});
