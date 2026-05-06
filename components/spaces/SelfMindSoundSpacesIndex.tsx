/**
 * SelfMindSoundSpacesIndex — Sound Spaces catalog.
 *
 * Top: Library / Saved segmented toggle.
 *
 * Library tab → vertical column of sections; each section is a horizontal
 * card carousel (FlatList horizontal, snap-to-start, momentum-friendly).
 * Section header is a kicker glyph + lowercase title, matching the
 * design's "Atoms 101 / Productivity / Self-Improvement" pattern but
 * dressed in our SelfMind tokens.
 *
 * Saved tab → vertical stack of liked spaces (or a soft empty state when
 * the user has saved nothing yet).
 *
 * Card visuals are kept verbatim — see `<SpaceCard />`. Only the layout
 * (vertical-stacked → horizontal-carousel) changed.
 *
 * Performance: `SpaceCard` is `memo`'d, FlatList carousels use
 * `keyExtractor` + `getItemLayout` so off-screen cards aren't allocated.
 * Only the first card of the first section "drifts" — the rest of the
 * eight artworks render static so the screen feels calm.
 *
 * Routing:
 *  - Header back chevron → `router.back()` (matches the rest of /(main)).
 *  - Card tap → `router.push('/space?id=<id>')`.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  ScrollView,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type ListRenderItem,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glyphs, BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';
import { FadingScrollWrapper } from '@/components/get-rolling/ScrollFadeEdges';
import LibrarySavedTabs, { type SpacesTab } from '@/components/spaces/LibrarySavedTabs';
import SpaceCard from '@/components/spaces/SpaceCard';
import {
  SOUND_SPACES,
  SPACE_SECTIONS,
  SPACES_BY_ID,
  type SectionGlyph,
  type SoundSpace,
  type SpaceSection,
} from '@/services/spaces/spaces';
import {
  getLikedSpaces,
  getLikedSpacesSync,
  subscribeLikedSpaces,
} from '@/services/spaces/likedSpaces';

/* Card sizing — width is fixed for predictable horizontal scroll snap.
 * GAP is the inter-card spacing inside each carousel; H_PAD is the
 * outer padding of the screen so the first/last card kisses the edge
 * the same way the design's iOS-style carousels do. */
const CARD_WIDTH = 286;
const CARD_GAP = 14;
const H_PAD = 20;

function glyphFor(name: SectionGlyph) {
  // Component lookup — keeps switch statements out of the render tree.
  return Glyphs[name];
}

export default function SelfMindSoundSpacesIndex() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<SpacesTab>('library');
  const [likedSet, setLikedSet] = useState<ReadonlySet<string>>(() => new Set());
  const [refreshing, setRefreshing] = useState(false);

  // Hydrate liked set on mount + on every focus (so a like done on the
  // sitting screen reflects when the user steps back here).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getLikedSpaces().then((set) => {
        if (!cancelled) setLikedSet(new Set(set));
      });
      return () => { cancelled = true; };
    }, []),
  );

  // Subscribe so a like action elsewhere updates the Saved tab live.
  // Prefer the sync cache snapshot — guaranteed hydrated by the time
  // any like notification fires (the only way to trigger one is to
  // call `toggleSpaceLike`, which awaits hydration first). Falling
  // back to async would race with a concurrent `useFocusEffect` reader.
  useEffect(() => {
    return subscribeLikedSpaces(() => {
      const sync = getLikedSpacesSync();
      if (sync) setLikedSet(new Set(sync));
      else void getLikedSpaces().then((set) => setLikedSet(new Set(set)));
    });
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const set = await getLikedSpaces();
      setLikedSet(new Set(set));
    } catch {
      // silent
    } finally {
      setRefreshing(false);
    }
  }, []);

  const goBack = useCallback(() => router.back(), [router]);
  const openSpace = useCallback(
    (id: string) => router.push({ pathname: '/space', params: { id } } as any),
    [router],
  );

  const savedSpaces = useMemo<ReadonlyArray<SoundSpace>>(
    () => SOUND_SPACES.filter((s) => likedSet.has(s.id)),
    [likedSet],
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Sticky chrome — OUTSIDE the fade wrapper. */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={goBack}
          style={styles.iconBtn}
          activeOpacity={0.85}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Glyphs.Back size={18} color={C.ink} />
        </TouchableOpacity>
        <View style={{ width: 36 }} />
      </View>

      <FadingScrollWrapper topFadeHeight={20} bottomFadeHeight={64}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: 120 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.ink2} colors={[C.coral]} />
          }
        >
          <Text style={styles.kicker}>— sound spaces</Text>
          <Text style={styles.headline}>
            Where do you want{'\n'}to <Text style={styles.headlineItalic}>sit</Text> today?
          </Text>
          <Text style={styles.lede}>
            Eight rooms, each with their own weather. Stay as long or as short as you like.
          </Text>

          {/* Library / Saved toggle */}
          <View style={styles.tabsRow}>
            <LibrarySavedTabs value={tab} onChange={setTab} />
          </View>

          {tab === 'library' ? (
            <View style={styles.sections}>
              {SPACE_SECTIONS.map((section, idx) => (
                <SectionRow
                  key={section.id}
                  section={section}
                  isFirst={idx === 0}
                  onPress={openSpace}
                />
              ))}
            </View>
          ) : (
            <SavedList spaces={savedSpaces} onPress={openSpace} />
          )}
        </ScrollView>
      </FadingScrollWrapper>
    </View>
  );
}

/* ─── Section row — glyph header + horizontal card carousel ───────── */

interface SectionRowProps {
  section: SpaceSection;
  /** Only the first card of the first section drifts — keeps the screen
   *  calm and minimizes Animated overhead. */
  isFirst: boolean;
  onPress: (id: string) => void;
}

function SectionRow({ section, isFirst, onPress }: SectionRowProps) {
  const Glyph = glyphFor(section.glyph);
  const items = useMemo<ReadonlyArray<SoundSpace>>(
    () => section.spaceIds.map((id) => SPACES_BY_ID.get(id)).filter(Boolean) as SoundSpace[],
    [section.spaceIds],
  );

  const renderItem = useCallback<ListRenderItem<SoundSpace>>(
    ({ item, index }) => (
      <SpaceCard
        space={item}
        width={CARD_WIDTH}
        moving={isFirst && index === 0}
        onPress={onPress}
      />
    ),
    [isFirst, onPress],
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<SoundSpace> | null | undefined, index: number) => ({
      length: CARD_WIDTH,
      offset: (CARD_WIDTH + CARD_GAP) * index,
      index,
    }),
    [],
  );

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Glyph size={18} color={C.ink} />
          <Text style={styles.sectionTitle}>{section.title}</Text>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={keyOfSpace}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + CARD_GAP}
        snapToAlignment="start"
        contentContainerStyle={styles.carousel}
        ItemSeparatorComponent={CardGap}
        getItemLayout={getItemLayout}
        removeClippedSubviews
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
      />
    </View>
  );
}

function CardGap() {
  return <View style={{ width: CARD_GAP }} />;
}

function keyOfSpace(s: SoundSpace) {
  return s.id;
}

/* ─── Saved tab content ───────────────────────────────────────────── */

interface SavedListProps {
  spaces: ReadonlyArray<SoundSpace>;
  onPress: (id: string) => void;
}

function SavedList({ spaces, onPress }: SavedListProps) {
  const { width: screenW } = useWindowDimensions();
  const cardWidth = Math.max(0, screenW - H_PAD * 2);
  if (spaces.length === 0) {
    return (
      <View style={styles.emptySaved}>
        <Glyphs.Heart size={22} color={C.ink3} />
        <Text style={styles.emptyTitle}>Nothing saved yet.</Text>
        <Text style={styles.emptyLine}>
          Tap the heart inside a room and it’ll wait for you here.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.savedStack}>
      {spaces.map((s) => (
        <SpaceCard
          key={s.id}
          space={s}
          width={cardWidth}
          onPress={onPress}
        />
      ))}
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },

  topBar: {
    paddingHorizontal: H_PAD,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.paper,
    borderWidth: 1, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center',
  },

  scroll: { paddingTop: 8 },

  kicker: {
    paddingHorizontal: H_PAD,
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 2.2,
    color: C.ink3,
    textTransform: 'uppercase',
  },
  headline: {
    paddingHorizontal: H_PAD,
    marginTop: 10,
    fontFamily: 'Fraunces-Medium',
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: -0.5,
    color: C.ink,
  },
  headlineItalic: { fontFamily: 'Fraunces-MediumItalic' },
  lede: {
    paddingHorizontal: H_PAD,
    marginTop: 12,
    maxWidth: 320,
    fontFamily: 'Fraunces-Text-Italic',
    fontSize: 13.5,
    lineHeight: 21,
    color: C.ink2,
  },

  tabsRow: {
    paddingHorizontal: H_PAD,
    marginTop: 22,
  },

  sections: {
    marginTop: 8,
  },
  section: {
    marginTop: 22,
  },
  sectionHeader: {
    paddingHorizontal: H_PAD,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.2,
    color: C.ink,
  },
  carousel: {
    paddingHorizontal: H_PAD,
  },

  /* Saved */
  savedStack: {
    paddingHorizontal: H_PAD,
    marginTop: 18,
    gap: 14,
  },
  emptySaved: {
    marginTop: 36,
    paddingHorizontal: H_PAD,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 18,
    letterSpacing: -0.1,
    color: C.ink,
    marginTop: 6,
  },
  emptyLine: {
    fontFamily: 'Fraunces-Text-Italic',
    fontSize: 13,
    lineHeight: 19,
    color: C.ink2,
    textAlign: 'center',
    maxWidth: 280,
  },
});
