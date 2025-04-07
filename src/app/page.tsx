/**
 * @fileoverview Root page of the AgentDock application
 * Implements server-side redirect with proper dynamic directive
 */

import { redirect } from "next/navigation";

// Ensure dynamic rendering for proper redirects
export const dynamic = 'force-dynamic';

/**
 * Root page that redirects to agents page
 */
export default function HomePage() {
  // Redirect to agents page
  redirect("/agents");
}
