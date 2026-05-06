/**
 * Home Tab — SelfMind redesign.
 *
 * Renders the new daily check-in surface. The legacy `HomeScreen` (and
 * its supporting Mello-token components in components/home/*) is no
 * longer mounted here; left in the codebase for now to avoid a sweeping
 * delete during the gradual main-app rebrand.
 */

import React from 'react';
import SelfMindHome from '@/components/home/SelfMindHome';

export default function HomeTab() {
  return <SelfMindHome />;
}
