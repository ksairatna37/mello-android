/**
 * SpaceCard — reusable Sound Space tile, fixed width for horizontal lists.
 *
 * Memo'd so a horizontal FlatList doesn't re-render every card on a
 * parent state change (e.g. switching Library/Saved tabs). The artwork
 * `moving` flag is opt-in per usage site; default static keeps long
 * lists calm.
 *
 * Visual structure (kept faithful to the design's MBSoundSpacesIndex
 * card): 130h painterly artwork strip with duration chip top-right,
 * paper text bay below with title / arc, italic line, and a footer
 * row of `bed` mono text + coral STEP IN.
 */

import React, { memo, useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';
import SpaceArt from '@/components/spaces/SpaceArt';
import type { SoundSpace } from '@/services/spaces/spaces';
import { getSpaceDurationLabel } from '@/services/spaces/spaceBeds';

interface Props {
  space: SoundSpace;
  width: number;
  moving?: boolean;
  onPress: (id: string) => void;
}

function SpaceCardImpl({ space, width, moving = false, onPress }: Props) {
  const handlePress = useCallback(() => onPress(space.id), [onPress, space.id]);
  const durationLabel = getSpaceDurationLabel(space.id);

  return (
    <TouchableOpacity
      style={[styles.card, { width }]}
      onPress={handlePress}
      activeOpacity={0.92}
    >
      <View style={styles.art}>
        <SpaceArt palette={space.palette} variant="tile" moving={moving} showDot={false} />
        <View style={styles.durationChip}>
          <Text style={styles.durationLabel}>{durationLabel}</Text>
        </View>
      </View>

      <View style={styles.bay}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{space.title}</Text>
          <Text style={styles.arc}>{space.arc.toUpperCase()}</Text>
        </View>
        <Text style={styles.line} numberOfLines={2}>{space.line}</Text>
        <View style={styles.footer}>
          <Text style={styles.bed} numberOfLines={1}>{space.bed}</Text>
          <Text style={styles.cta}>STEP IN →</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const SpaceCard = memo(SpaceCardImpl);
export default SpaceCard;

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.paper,
  },
  art: {
    height: 130,
    position: 'relative',
  },
  durationChip: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  durationLabel: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10,
    letterSpacing: 1.2,
    color: C.ink,
    textTransform: 'uppercase',
  },
  bay: {
    padding: 18,
    paddingTop: 16,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
  },
  title: {
    flex: 1,
    fontFamily: 'Fraunces-Medium',
    fontSize: 20,
    lineHeight: 29,
    letterSpacing: -0.3,
    color: C.ink,
  },
  arc: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 9,
    letterSpacing: 1.4,
    color: C.ink3,
  },
  line: {
    marginTop: 6,
    fontFamily: 'Fraunces-Text-Italic',
    fontSize: 13,
    lineHeight: 19,
    color: C.ink2,
    minHeight: 38,
  },
  footer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.line,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  bed: {
    flex: 1,
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10,
    letterSpacing: 0.5,
    color: C.ink3,
  },
  cta: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 1.2,
    color: C.coral,
  },
});
