/**
 * @fileoverview Root page that redirects to the Agents page
 */

import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/agents');
}
