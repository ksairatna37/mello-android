import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Modal,
  Pressable,
  Image,
  Platform,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import RNShare from 'react-native-share';
import Ionicons from '@expo/vector-icons/Ionicons';
import MelloGradient from '@/components/common/MelloGradient';
import { getEmotionalProfile } from '@/utils/emotionalProfileCache';
import { getOnboardingData, saveCurrentStep } from '@/utils/onboardingStorage';
import type { EmotionalProfile } from '@/services/chat/bedrockService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const DIMENSION_LABELS: Record<string, string> = {
  calm: 'Calm',
  clarity: 'Clarity',
  focus: 'Focus',
  confidence: 'Confidence',
  positivity: 'Positivity',
};

const DIMENSION_KEYS = ['calm', 'clarity', 'focus', 'confidence', 'positivity'] as const;

// ─── Dimension Row ────────────────────────────────────────────────────────────

function DimensionRow({ label, value, isTop }: { label: string; value: number; isTop: boolean }) {
  const pct = Math.round(value);
  return (
    <View style={row.container}>
      <Text style={[row.label, isTop && row.labelTop]}>{label}</Text>
      <View style={row.track}>
        <View style={[row.fill, { width: `${pct}%` }, isTop && row.fillTop]} />
      </View>
      <Text style={[row.pct, isTop && row.pctTop]}>{pct}</Text>
    </View>
  );
}

const row = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { width: 86, fontSize: 13, fontFamily: 'Outfit-Medium', color: 'rgba(26,26,26,0.45)', letterSpacing: 0.2 },
  labelTop: { color: '#1A1A1A' },
  track: { flex: 1, height: 4, backgroundColor: 'rgba(139,126,248,0.12)', borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: 'rgba(139,126,248,0.35)', borderRadius: 2 },
  fillTop: { backgroundColor: '#8B7EF8' },
  pct: { width: 30, fontSize: 13, fontFamily: 'Outfit-Regular', color: 'rgba(26,26,26,0.35)', textAlign: 'right' },
  pctTop: { color: '#8B7EF8', fontFamily: 'Outfit-SemiBold' },
});

// ─── Share Bottom Sheet ───────────────────────────────────────────────────────

const SOCIAL = [
  { id: 'x',        label: 'X',         icon: 'logo-twitter' as const,   color: '#000000' },
  { id: 'instagram',label: 'Instagram', icon: 'logo-instagram' as const,  color: '#E1306C' },
  { id: 'whatsapp', label: 'WhatsApp',  icon: 'logo-whatsapp' as const,   color: '#25D366' },
  { id: 'telegram', label: 'Telegram',  icon: 'paper-plane' as const,     color: '#229ED9' },
];

interface ShareSheetProps {
  visible: boolean;
  imageUri: string | null;
  shareText: string;
  onClose: () => void;
}

function ShareSheet({ visible, imageUri, shareText, onClose }: ShareSheetProps) {
  const insets = useSafeAreaInsets();
  const [isVisible, setIsVisible] = React.useState(false);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  const hideModal = useCallback(() => {
    setIsVisible(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (visible) {
      setIsVisible(true);
      backdropOpacity.value = withTiming(1, { duration: 300 });
      translateY.value = withSpring(0, { damping: 50, stiffness: 150, mass: 0.5 });
    } else if (isVisible) {
      backdropOpacity.value = withTiming(0, { duration: 250 });
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 }, (finished) => {
        if (finished) runOnJS(hideModal)();
      });
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: 250 });
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 }, (finished) => {
      if (finished) runOnJS(hideModal)();
    });
  }, []);

  const handleSocial = useCallback(async (_id: string) => {
    if (!imageUri) return;
    try {
      if (Platform.OS === 'ios') {
        // iOS: Share.share supports image (url) + text (message) together
        await Share.share({ message: shareText, url: imageUri });
      } else {
        // Android: react-native-share sends both image + text in one intent
        await RNShare.open({
          title: 'Your Emotional Profile',
          message: shareText,
          url: imageUri,
          type: 'image/png',
          failOnCancel: false,
        });
      }
    } catch {}
  }, [imageUri, shareText]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  if (!isVisible) return null;

  const previewWidth = SCREEN_WIDTH - 24 - 24 - 48; // sheet margins + content padding

  return (
    <Modal transparent visible={isVisible} animationType="none" statusBarTranslucent>
      <View style={sheet.container}>
        {/* Backdrop */}
        <Animated.View style={[sheet.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View style={[sheet.sheet, sheetStyle, { bottom: 16 }]}>
          <View style={sheet.handleBar} />

          <View style={[sheet.content, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>

            {/* Card preview */}
            {imageUri ? (
              <View style={[sheet.previewWrap, { width: previewWidth }]}>
                <Image
                  source={{ uri: imageUri }}
                  style={[sheet.preview, { width: previewWidth }]}
                  resizeMode="contain"
                />
              </View>
            ) : (
              <View style={[sheet.previewPlaceholder, { width: previewWidth, height: 160 }]} />
            )}

            {/* Label */}
            <Text style={sheet.shareLabel}>Share to</Text>

            {/* Social icons row */}
            <View style={sheet.socialRow}>
              {SOCIAL.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={sheet.socialItem}
                  onPress={() => handleSocial(s.id)}
                  activeOpacity={0.75}
                >
                  <View style={[sheet.socialCircle, { backgroundColor: s.color }]}>
                    <Ionicons name={s.icon} size={24} color="#FFFFFF" />
                  </View>
                  <Text style={sheet.socialLabel}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Cancel */}
            <TouchableOpacity style={sheet.cancelBtn} onPress={handleClose} activeOpacity={0.7}>
              <Text style={sheet.cancelText}>Cancel</Text>
            </TouchableOpacity>

          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const sheet = StyleSheet.create({
  container: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 998 },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 999,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 24,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: 'center',
    gap: 20,
  },
  previewWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0D0A1E',
  },
  preview: {
    height: 200,
  },
  previewPlaceholder: {
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
  },
  shareLabel: {
    fontFamily: 'Outfit-Medium',
    fontSize: 13,
    color: '#888',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  socialItem: {
    alignItems: 'center',
    gap: 8,
  },
  socialCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialLabel: {
    fontFamily: 'Outfit-Regular',
    fontSize: 11,
    color: '#555',
  },
  cancelBtn: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  cancelText: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 16,
    color: '#666',
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ShareResultScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<EmotionalProfile | null>(null);
  const [firstName, setFirstName] = useState('');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);

  const cardRef = useRef<View>(null);
  const flashAnim = useSharedValue(0);

  const headerAnim = useSharedValue(0);
  const cardAnim = useSharedValue(0);
  const btnAnim = useSharedValue(0);

  useEffect(() => {
    void saveCurrentStep('share-result').catch(() => {});

    const ease = Easing.out(Easing.cubic);
    headerAnim.value = withTiming(1, { duration: 550, easing: ease });
    cardAnim.value = withDelay(150, withTiming(1, { duration: 600, easing: ease }));
    btnAnim.value = withDelay(400, withTiming(1, { duration: 450, easing: ease }));

    Promise.all([getEmotionalProfile(), getOnboardingData()]).then(([ep, data]) => {
      if (ep) setProfile(ep);
      if (data.firstName) setFirstName(data.firstName);
    });
  }, []);

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerAnim.value,
    transform: [{ translateY: (1 - headerAnim.value) * 14 }],
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardAnim.value,
    transform: [{ translateY: (1 - cardAnim.value) * 20 }],
  }));
  const btnStyle = useAnimatedStyle(() => ({
    opacity: btnAnim.value,
    transform: [{ translateY: (1 - btnAnim.value) * 10 }],
  }));

  const topKey = profile
    ? DIMENSION_KEYS.reduce((a, b) => ((profile[a] ?? 0) >= (profile[b] ?? 0) ? a : b))
    : null;
  const topLabel = topKey ? DIMENSION_LABELS[topKey] : '—';
  const topScore = topKey ? Math.round(profile?.[topKey] ?? 0) : 0;
  const interpretation = profile?.interpretation ?? '';

  const shareText = `My emotional profile on SelfMind:\n\nTop strength: ${topLabel} · ${topScore}%\n\n"${interpretation.length > 120 ? interpretation.slice(0, 117) + '...' : interpretation}"\n\nFind yours → SelfMind.app`;

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashAnim.value,
  }));

  const handleShare = async () => {
    // Flash: quick white burst then fade
    flashAnim.value = withSequence(
      withTiming(0.85, { duration: 180 }),
      withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) })
    );

    // Capture at peak of flash, before sheet opens
    await new Promise<void>((r) => setTimeout(r, 180));
    let uri: string | null = null;
    try {
      uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      setCapturedUri(uri);
    } catch {}

    // Wait for flash to settle then open sheet
    await new Promise<void>((r) => setTimeout(r, 600));
    setSheetVisible(true);
  };

  const handleContinue = () => {
    router.replace('/(onboarding-new)/save-profile' as any);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <MelloGradient />

      {/* Header */}
      <Animated.View style={[styles.header, { paddingTop: insets.top + 15 }, headerStyle]}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => router.replace('/(onboarding-new)/emotional-mindwave' as any)}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.heading}>Your Result</Text>
      </Animated.View>

      {/* Card */}
      <Animated.View style={[styles.cardWrapper, cardStyle]}>
        <View style={styles.cardContainer}>
          <View ref={cardRef} style={styles.card} collapsable={false}>

          <View style={styles.cardHeader}>
            <Text style={styles.wordmark}>SelfMind</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.heroSection}>
            <Text style={styles.heroLabel}>
              {firstName ? `${firstName}'s top strength` : 'Your top strength'}
            </Text>
            <Text style={styles.heroDimension}>{topLabel}</Text>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreNumber}>{topScore}</Text>
              <Text style={styles.scoreUnit}>/100</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.barsSection}>
            {DIMENSION_KEYS.map((key) => (
              <DimensionRow
                key={key}
                label={DIMENSION_LABELS[key]}
                value={profile?.[key] ?? 0}
                isTop={key === topKey}
              />
            ))}
          </View>

          <View style={styles.divider} />

          <View style={styles.quoteSection}>
            <View style={styles.quoteBar} />
            <Text style={styles.quoteText} numberOfLines={3}>
              {interpretation || "Your emotional landscape is unique. Every answer shapes the person you're becoming."}
            </Text>
          </View>

          <View style={styles.cardFooter}>
            <Text style={styles.footerUrl}>SelfMind.app</Text>
          </View>

          </View>

          {/* Flash overlay — outside cardRef so it isn't captured */}
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.flashOverlay, flashStyle]}
            pointerEvents="none"
          />
        </View>
      </Animated.View>

      {/* Buttons */}
      <Animated.View style={[styles.buttonContainer, { paddingBottom: insets.bottom + 10 }, btnStyle]}>
        <TouchableOpacity style={styles.shareButton} onPress={handleShare} activeOpacity={0.85}>
          <Text style={styles.shareButtonText}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipButton} onPress={handleContinue} activeOpacity={0.6}>
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Share Bottom Sheet */}
      <ShareSheet
        visible={sheetVisible}
        imageUri={capturedUri}
        shareText={shareText}
        onClose={() => setSheetVisible(false)}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F0FF' },

  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    minHeight: 56,
    gap: 6,
    position: 'relative',
  },
  headerBackButton: {
    position: 'absolute',
    left: 24,
    bottom: 0,
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
    zIndex: 1,
  },
  eyebrow: {
    fontFamily: 'Outfit-Medium',
    fontSize: 11,
    color: '#8B7EF8',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  heading: {
    fontFamily: 'DMSerif',
    fontSize: 32,
    color: '#1A1A1A',
    lineHeight: 42,
    textAlign: 'center',
  },

  cardWrapper: { flex: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 20 },
  cardContainer: { position: 'relative' },
  flashOverlay: {
    borderRadius: 24,
    backgroundColor: 'rgba(139,126,248,0.25)',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 18,
    shadowColor: '#8B7EF8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  wordmark: { fontFamily: 'DMSerif', fontSize: 22, color: '#1A1A1A', letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: 'rgba(139,126,248,0.12)' },

  heroSection: { gap: 4 },
  heroLabel: {
    fontFamily: 'Outfit-Regular',
    fontSize: 12,
    color: 'rgba(26,26,26,0.45)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroDimension: { fontFamily: 'DMSerif', fontSize: 48, color: '#1A1A1A', lineHeight: 54, letterSpacing: -0.5 },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 2 },
  scoreNumber: { fontFamily: 'Outfit-SemiBold', fontSize: 28, color: '#8B7EF8', lineHeight: 32 },
  scoreUnit: { fontFamily: 'Outfit-Regular', fontSize: 14, color: 'rgba(139,126,248,0.6)', marginBottom: 2 },

  barsSection: { gap: 12 },

  quoteSection: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  quoteBar: { width: 3, alignSelf: 'stretch', backgroundColor: '#8B7EF8', borderRadius: 2, minHeight: 40 },
  quoteText: {
    flex: 1,
    fontFamily: 'Outfit-Regular',
    fontSize: 14,
    color: 'rgba(26,26,26,0.6)',
    lineHeight: 21,
    fontStyle: 'italic',
  },

  cardFooter: { alignItems: 'flex-end' },
  footerUrl: { fontFamily: 'Outfit-Medium', fontSize: 11, color: 'rgba(26,26,26,0.25)', letterSpacing: 0.5 },

  buttonContainer: { paddingHorizontal: 24, gap: 14 },
  shareButton: {
    backgroundColor: '#8B7EF8',
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: 'center',
    shadowColor: '#8B7EF8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  shareButtonText: { fontSize: 18, fontFamily: 'Outfit-SemiBold', color: '#FFFFFF' },
  skipButton: { alignItems: 'center', paddingVertical: 6 },
  skipButtonText: { fontSize: 14, fontFamily: 'Outfit-Regular', color: '#9999B0' },
});
