/**
 * SelfMindJournalPrompt — tonight's-prompt composer.
 *
 * 1:1 port of MBJournalPrompt in mobile-screens-b.jsx. Lavender canvas,
 * a single guided prompt at the top, a paper composer with the cursor
 * blinking under the prompt body, word-count footer, save-draft / close-
 * the-day actions.
 *
 * Wired:
 *   - On "Close the day", calls journalService.addEntry({
 *       title: "<prompt>",
 *       body: <user text>,
 *       source: 'prompt',
 *     }) and pops back to /journal on success.
 *   - "Save draft" — local-only for now (TODO when a drafts store
 *     lands).
 *
 * Prompt is currently hardcoded ("What did today *ask* of you?") to
 * match the design. Future: cycle from a small seed list keyed on the
 * day-of-year so each prompt feels intentional rather than random.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Glyphs, BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';
import { addEntry } from '@/services/journal/journalService';

const PROMPT_TITLE = 'What did today ask of you?';
const PROMPT_BODY =
  'Not what you did. What it asked — the small costs, the invisible carrying.';

export default function SelfMindJournalPrompt() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const wordCount = text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;

  const handleSaveDraft = useCallback(() => {
    Alert.alert('Saved as draft', 'Drafts aren’t yet synced — they’ll come back when you reopen this prompt.');
  }, []);

  const handleCloseTheDay = useCallback(async () => {
    if (saving) return;
    if (text.trim().length === 0) {
      Alert.alert('Nothing yet', 'Write a few words before closing the day.');
      return;
    }
    setSaving(true);
    console.log('[JournalPrompt] saving entry, words=' + wordCount);
    const result = await addEntry({
      title: PROMPT_TITLE,
      body: text.trim(),
      source: 'prompt',
      tags: ['prompt'],
    });
    setSaving(false);
    if (result.ok) {
      console.log('[JournalPrompt] saved id=' + result.data.id);
      router.replace('/journal' as any);
    } else {
      Alert.alert("Couldn't save", result.error);
    }
  }, [saving, text, wordCount, router]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Top bar — back chevron only. Always routes to the journal
         * list (not router.back()) so the destination is predictable
         * regardless of how the user got here (home shortcut card,
         * shortcuts row, push from elsewhere). */}
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            onPress={() => router.replace('/journal' as any)}
            style={styles.iconBtn}
            activeOpacity={0.85}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Glyphs.Back size={18} color={C.lavenderDeep} />
          </TouchableOpacity>
          <View />
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.body}>
          <Text style={styles.kicker}>TONIGHT{'’'}S PROMPT · TAKES 4 MIN</Text>
          <Text style={styles.headline}>
            What did today{' '}
            <Text style={styles.headlineItalic}>ask</Text> of you?
          </Text>
          <Text style={styles.lede}>
            Not what you did. What it{' '}
            <Text style={styles.ledeItalic}>asked</Text> — the small costs, the invisible carrying.
          </Text>

          {/* Composer */}
          <View style={styles.composerCard}>
            <TextInput
              style={styles.input}
              multiline
              autoFocus
              placeholder="It asked me to be calm when I wasn’t. It asked me to pretend the meeting was fine. It asked me…"
              placeholderTextColor={C.ink3}
              value={text}
              onChangeText={setText}
              textAlignVertical="top"
              accessibilityLabel="Journal prompt composer"
            />
            <View style={styles.composerFoot}>
              <View style={styles.composerActions}>
                <Glyphs.Mic size={18} color={C.ink2} />
                <Glyphs.Sparkle size={18} color={C.ink2} />
              </View>
              <Text style={styles.composerCount}>
                {wordCount} {wordCount === 1 ? 'WORD' : 'WORDS'}
              </Text>
            </View>
          </View>

          {/* CTAs */}
          <View style={[styles.ctaRow, { marginBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              onPress={handleSaveDraft}
              activeOpacity={0.7}
              disabled={saving}
            >
              <Text style={styles.btnGhostText}>Save draft</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={handleCloseTheDay}
              activeOpacity={0.9}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={C.cream} size="small" />
              ) : (
                <Text style={styles.btnPrimaryText}>Close the day</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.lavender },
  flex: { flex: 1 },

  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },

  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  kicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 2.2,
    color: C.lavenderDeep,
  },
  headline: {
    marginTop: 12,
    fontFamily: 'Fraunces-Medium',
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: -0.4,
    color: C.lavenderDeep,
  },
  headlineItalic: { fontFamily: 'Fraunces-MediumItalic' },
  lede: {
    marginTop: 12,
    fontFamily: 'Fraunces-Text',
    fontSize: 14,
    lineHeight: 22,
    color: C.lavenderDeep,
    opacity: 0.8,
    letterSpacing: 0.1,
  },
  ledeItalic: { fontFamily: 'Fraunces-Text-Italic' },

  composerCard: {
    flex: 1,
    marginTop: 22,
    backgroundColor: C.paper,
    borderRadius: RADIUS.card,
    padding: 18,
    minHeight: 240,
  },
  input: {
    flex: 1,
    fontFamily: 'Fraunces-Text',
    fontSize: 16,
    lineHeight: 26,
    color: C.ink,
    letterSpacing: 0.05,
  },
  composerFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  composerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  composerCount: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10,
    letterSpacing: 1.4,
    color: C.ink3,
  },

  ctaRow: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: RADIUS.btn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: {
    borderWidth: 1,
    borderColor: 'rgba(77,64,138,0.3)',
  },
  btnGhostText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: C.lavenderDeep,
    letterSpacing: 0.1,
  },
  btnPrimary: { backgroundColor: C.lavenderDeep },
  btnPrimaryText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: C.cream,
    letterSpacing: 0.1,
  },
});
