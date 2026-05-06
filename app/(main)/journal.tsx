/**
 * Journal Tab — SelfMind redesign.
 *
 * Renders the journal index wired to /rest/v1/journal_entries via
 * services/journal/journalService. Hidden from the tab bar — reached
 * from Home's "Journal prompt" card today, and from PROFILE later
 * when the journal entry-detail screen lands.
 */

import React from 'react';
import SelfMindJournalHome from '@/components/journal/SelfMindJournalHome';

export default function JournalTab() {
  return <SelfMindJournalHome />;
}
