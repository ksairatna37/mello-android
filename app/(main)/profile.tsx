/**
 * Profile Tab — SelfMind redesign.
 *
 * Renders the merged profile + settings surface (PROFILE in the new
 * tab bar). Wired to AuthContext for sign-out and user info; the older
 * Mello-token profile screen has been replaced.
 */

import React from 'react';
import SelfMindProfile from '@/components/profile/SelfMindProfile';

export default function ProfileTab() {
  return <SelfMindProfile />;
}
