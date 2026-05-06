/**
 * Mood History / Progress Tab — SelfMind redesign.
 *
 * Renders the weekly + 30-day progress overview wired to mood and
 * emotional-profile data. Hidden from the tab bar; reached from a
 * future "Your week" tap on Home.
 */

import React from 'react';
import SelfMindProgress from '@/components/mood/SelfMindProgress';

export default function MoodHistoryTab() {
  return <SelfMindProgress />;
}
