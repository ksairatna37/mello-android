/**
 * SoundSpacesCard — home-screen entry tile for Sound Spaces.
 *
 * 1:1 port of MBSoundSpacesCard in
 * /Users/warmachine37/Downloads/selfmind app design screens/mobile-screens-spaces.jsx
 *
 * Painterly background via the shared <SpaceArt variant="tile" moving />,
 * a mono kicker, a Fraunces display headline with italic emphasis on
 * "for a while", italic sub-line, and an ink circular arrow CTA.
 * Featured space is Radiant Horizon (FEATURED_SPACE_ID).
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Glyphs, BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';
import SpaceArt from '@/components/spaces/SpaceArt';
import { FEATURED_SPACE_ID, SPACES_BY_ID } from '@/services/spaces/spaces';

type Props = { onPress?: () => void };

export default function SoundSpacesCard({ onPress }: Props) {
  const featured = SPACES_BY_ID.get(FEATURED_SPACE_ID)!;

  return (
    <TouchableOpacity activeOpacity={0.92} onPress={onPress} style={styles.card}>
      <SpaceArt palette={featured.palette} variant="tile" showDot={false} />

      <View style={styles.content}>
        <View>
          <Text style={styles.kicker}>— sound spaces · new</Text>
          <Text style={styles.headline}>
            A place to sit{' '}
            <Text style={styles.headlineItalic}>for a while</Text>.
          </Text>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.sub} numberOfLines={2}>
            Ambient · Sleep · Focus music
          </Text>
          <View style={styles.arrowBtn}>
            <Glyphs.Arrow size={13} color={C.cream} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    height: 168,
    borderRadius: RADIUS.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.line,
    position: 'relative',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  kicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10,
    letterSpacing: 1.6,
    color: C.ink2,
    textTransform: 'lowercase',
  },
  headline: {
    marginTop: 8,
    maxWidth: 240,
    fontFamily: 'Fraunces-Medium',
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: -0.5,
    color: C.ink,
  },
  headlineItalic: { fontFamily: 'Fraunces-MediumItalic' },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sub: {
    flex: 1,
    fontFamily: 'Fraunces-Text-Italic',
    fontSize: 12,
    lineHeight: 16,
    color: C.ink2,
  },
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
