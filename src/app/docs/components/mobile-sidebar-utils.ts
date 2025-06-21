/**
 * Utility functions for mobile sidebar management
 * Extracted to prevent circular dependencies between doc-search and docs-sidebar
 */

export function closeMobileSidebar() {
  // Find and uncheck the sidebar toggle checkbox
  if (typeof window !== 'undefined') {
    const sidebarToggle = document.getElementById(
      'sidebar-mobile-toggle'
    ) as HTMLInputElement;
    if (sidebarToggle) {
      sidebarToggle.checked = false;
    }
  }
}
