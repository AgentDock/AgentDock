import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { LogCategory, logger } from 'agentdock-core';

interface AppPathsManifest {
  [key: string]: string;
}

interface PagesManifest {
  [key: string]: string;
}

interface RoutesManifest {
  version: number;
  pages: {
    [key: string]: {
      page: string;
      regex: string;
    };
  };
  dynamicRoutes: Array<{
    page: string;
    regex: string;
    routeKeys?: { [key: string]: string };
    namedRegex?: string;
  }>;
  staticRoutes: Array<{
    page: string;
    regex: string;
  }>;
}

async function generateRoutesManifest() {
  try {
    const appManifestPath = join(
      process.cwd(),
      '.next/server/app-paths-manifest.json'
    );
    const pagesManifestPath = join(
      process.cwd(),
      '.next/server/pages-manifest.json'
    );
    const outputPath = join(process.cwd(), '.next/routes-manifest.json');

    // Check if manifests exist
    if (!existsSync(appManifestPath) || !existsSync(pagesManifestPath)) {
      throw new Error('Required manifest files not found');
    }

    // Read manifests
    const appManifest: AppPathsManifest = JSON.parse(
      readFileSync(appManifestPath, 'utf8')
    );
    const pagesManifest: PagesManifest = JSON.parse(
      readFileSync(pagesManifestPath, 'utf8')
    );

    // Create routes manifest structure
    const routesManifest: RoutesManifest = {
      version: 3,
      pages: {},
      dynamicRoutes: [],
      staticRoutes: []
    };

    // Process app router routes
    Object.entries(appManifest).forEach(([route, file]) => {
      if (route.includes('[') && route.includes(']')) {
        // Dynamic route
        const dynamicRoute = {
          page: route,
          regex: `^${route.replace(/\[([^\]]+)\]/g, '([^/]+)')}/?$`,
          routeKeys: {},
          namedRegex: `^${route.replace(/\[([^\]]+)\]/g, '(?<$1>[^/]+)')}/?$`
        };
        routesManifest.dynamicRoutes.push(dynamicRoute);
      } else {
        // Static route
        routesManifest.staticRoutes.push({
          page: route,
          regex: `^${route.replace(/\//g, '\\/')}/?$`
        });
      }
      routesManifest.pages[route] = { page: file, regex: route };
    });

    // Process pages router routes
    Object.entries(pagesManifest).forEach(([route, file]) => {
      if (route.includes('[') && route.includes(']')) {
        routesManifest.dynamicRoutes.push({
          page: route,
          regex: `^${route.replace(/\[([^\]]+)\]/g, '([^/]+)')}/?$`
        });
      } else {
        routesManifest.staticRoutes.push({
          page: route,
          regex: `^${route.replace(/\//g, '\\/')}/?$`
        });
      }
      routesManifest.pages[route] = { page: file, regex: route };
    });

    // Write the manifest
    writeFileSync(outputPath, JSON.stringify(routesManifest, null, 2));

    logger.info(
      LogCategory.CONFIG,
      'Post-build',
      'Generated routes-manifest.json successfully',
      {
        dynamicRoutes: routesManifest.dynamicRoutes.length,
        staticRoutes: routesManifest.staticRoutes.length,
        totalPages: Object.keys(routesManifest.pages).length
      }
    );
  } catch (error) {
    logger.error(
      LogCategory.CONFIG,
      'Post-build',
      'Failed to generate routes-manifest.json',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
    process.exit(1);
  }
}

generateRoutesManifest();
