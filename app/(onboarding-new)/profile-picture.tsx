/**
 * Profile Picture / Avatar Screen
 * Step 4 of new onboarding flow - "Put a face to your space"
 *
 * Emotionally-aware UX:
 * - Invitation, not instruction
 * - Multiple avatar options (photo, emoji, icon)
 * - No pressure, all choices are equal
 * - Immediate affirmation on selection
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  TextInput,
  FlatList,
  Pressable,
  Modal,
  Image,
  Alert,
} from 'react-native';
import { saveAvatar } from '@/utils/onboardingStorage';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import Feather from '@expo/vector-icons/Feather';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const AVATAR_SIZE = 240;
const CURRENT_STEP = 4;

// Calculate emoji grid dimensions to fit properly
// Sheet: left: 12, right: 12 = 24px total margin
// sheetContent: paddingHorizontal: 24 = 48px total padding
// Available width for grid = SCREEN_WIDTH - 24 - 48 = SCREEN_WIDTH - 72
const EMOJI_COLUMNS = 6;
const EMOJI_GRID_AVAILABLE_WIDTH = SCREEN_WIDTH - 72;
const EMOJI_ITEM_WIDTH = Math.floor(EMOJI_GRID_AVAILABLE_WIDTH / EMOJI_COLUMNS);
const EMOJI_ITEM_HEIGHT = EMOJI_ITEM_WIDTH + 4; // Slightly taller than wide

// Smooth ease-out curve (no spring, no bounce)
const EASE_OUT = Easing.bezier(0.25, 0.1, 0.25, 1);

// Emoji list with keywords for search
const EMOJI_DATA = [
  { emoji: '😀', keywords: ['smile', 'happy', 'grin'] },
  { emoji: '😃', keywords: ['smile', 'happy', 'open'] },
  { emoji: '😄', keywords: ['smile', 'happy', 'laugh'] },
  { emoji: '😁', keywords: ['grin', 'happy', 'teeth'] },
  { emoji: '😆', keywords: ['laugh', 'happy', 'squint'] },
  { emoji: '🤩', keywords: ['star', 'excited', 'wow'] },
  { emoji: '🤣', keywords: ['rofl', 'laugh', 'rolling'] },
  { emoji: '😂', keywords: ['joy', 'laugh', 'tears', 'cry'] },
  { emoji: '🙂', keywords: ['smile', 'slight'] },
  { emoji: '😶', keywords: ['silent', 'quiet', 'no mouth'] },
  { emoji: '🫠', keywords: ['melting', 'melt'] },
  { emoji: '😉', keywords: ['wink', 'flirt'] },
  { emoji: '😊', keywords: ['blush', 'happy', 'smile'] },
  { emoji: '😇', keywords: ['angel', 'innocent', 'halo'] },
  { emoji: '🥰', keywords: ['love', 'hearts', 'adore'] },
  { emoji: '😍', keywords: ['love', 'heart', 'eyes'] },
  { emoji: '🤠', keywords: ['cowboy', 'hat'] },
  { emoji: '😘', keywords: ['kiss', 'love', 'heart'] },
  { emoji: '😗', keywords: ['kiss', 'whistle'] },
  { emoji: '😚', keywords: ['kiss', 'blush'] },
  { emoji: '😙', keywords: ['kiss', 'smile'] },
  { emoji: '🥲', keywords: ['cry', 'happy', 'tear'] },
  { emoji: '🥹', keywords: ['holding', 'tears', 'grateful'] },
  { emoji: '😋', keywords: ['yum', 'delicious', 'tongue'] },
  { emoji: '😛', keywords: ['tongue', 'playful'] },
  { emoji: '😜', keywords: ['wink', 'tongue', 'crazy'] },
  { emoji: '🤪', keywords: ['crazy', 'zany', 'wild'] },
  { emoji: '🤑', keywords: ['money', 'rich', 'dollar'] },
  { emoji: '🤗', keywords: ['hug', 'hugging'] },
  { emoji: '🤭', keywords: ['giggle', 'shy', 'cover'] },
  { emoji: '🫢', keywords: ['gasp', 'surprise', 'shock'] },
  { emoji: '🫣', keywords: ['peek', 'shy', 'cover'] },
  { emoji: '🤫', keywords: ['shush', 'quiet', 'secret'] },
  { emoji: '🤔', keywords: ['think', 'hmm', 'wonder'] },
  { emoji: '🫡', keywords: ['salute'] },
  { emoji: '🤐', keywords: ['zip', 'quiet', 'secret'] },
  { emoji: '🤨', keywords: ['raised', 'eyebrow', 'skeptic'] },
  { emoji: '😐', keywords: ['neutral', 'blank'] },
  { emoji: '😑', keywords: ['expressionless', 'blank'] },
  { emoji: '🫥', keywords: ['dotted', 'invisible'] },
  { emoji: '😏', keywords: ['smirk', 'sly'] },
  { emoji: '😒', keywords: ['unamused', 'bored'] },
  { emoji: '🙄', keywords: ['eye roll', 'annoyed'] },
  { emoji: '😬', keywords: ['grimace', 'awkward'] },
  { emoji: '🤥', keywords: ['lie', 'pinocchio'] },
  { emoji: '🫨', keywords: ['shake', 'vibrate'] },
  { emoji: '😌', keywords: ['relieved', 'calm', 'peaceful'] },
  { emoji: '😔', keywords: ['sad', 'pensive', 'down'] },
  { emoji: '😪', keywords: ['sleepy', 'tired'] },
  { emoji: '🤤', keywords: ['drool', 'hungry'] },
  { emoji: '😴', keywords: ['sleep', 'zzz', 'tired'] },
  { emoji: '😷', keywords: ['mask', 'sick'] },
  { emoji: '🤒', keywords: ['sick', 'fever', 'thermometer'] },
  { emoji: '🤕', keywords: ['hurt', 'bandage', 'injured'] },
  { emoji: '🤢', keywords: ['sick', 'nauseous', 'green'] },
  { emoji: '🥳', keywords: ['party', 'celebrate', 'birthday'] },
  { emoji: '🥸', keywords: ['disguise', 'glasses', 'mustache'] },
  { emoji: '😎', keywords: ['cool', 'sunglasses', 'awesome'] },
  { emoji: '🤓', keywords: ['nerd', 'glasses', 'smart'] },
  { emoji: '🧐', keywords: ['monocle', 'fancy', 'inspect'] },
  { emoji: '😕', keywords: ['confused', 'puzzled'] },
  { emoji: '🫤', keywords: ['diagonal', 'skeptic', 'meh'] },
  { emoji: '😟', keywords: ['worried', 'concerned'] },
  { emoji: '❤️', keywords: ['heart', 'love', 'red'] },
  { emoji: '🧡', keywords: ['heart', 'orange', 'love'] },
  { emoji: '💛', keywords: ['heart', 'yellow', 'love'] },
  { emoji: '💚', keywords: ['heart', 'green', 'love'] },
  { emoji: '💙', keywords: ['heart', 'blue', 'love'] },
  { emoji: '💜', keywords: ['heart', 'purple', 'love'] },
  { emoji: '🖤', keywords: ['heart', 'black', 'love'] },
  { emoji: '🤍', keywords: ['heart', 'white', 'love'] },
  { emoji: '🐶', keywords: ['dog', 'puppy', 'pet'] },
  { emoji: '🐱', keywords: ['cat', 'kitty', 'pet'] },
  { emoji: '🐭', keywords: ['mouse', 'rat'] },
  { emoji: '🐹', keywords: ['hamster', 'pet'] },
  { emoji: '🐰', keywords: ['rabbit', 'bunny'] },
  { emoji: '🦊', keywords: ['fox', 'animal'] },
  { emoji: '🐻', keywords: ['bear', 'teddy'] },
  { emoji: '🐼', keywords: ['panda', 'bear'] },
  { emoji: '🦄', keywords: ['unicorn', 'magic', 'fantasy'] },
  { emoji: '🐝', keywords: ['bee', 'honey', 'insect'] },
  { emoji: '🦋', keywords: ['butterfly', 'insect', 'pretty'] },
  { emoji: '🌸', keywords: ['flower', 'cherry', 'blossom', 'pink'] },
  { emoji: '🌺', keywords: ['flower', 'hibiscus'] },
  { emoji: '🌻', keywords: ['flower', 'sunflower', 'yellow'] },
  { emoji: '⭐', keywords: ['star', 'favorite'] },
  { emoji: '🌞', keywords: ['rainbow', 'pride', 'color'] },
  { emoji: '✨', keywords: ['rainbow', 'pride', 'color'] },
  { emoji: '🪄', keywords: ['rainbow', 'pride', 'color'] },
  { emoji: '🌻', keywords: ['rainbow', 'pride', 'color'] },
];

const EMOJI_LIST = EMOJI_DATA.map(e => e.emoji);

// Icon options for avatar (valid Ionicons names)
const ICON_LIST = [
  'heart-outline',        // care, warmth, being held
  'moon-outline',         // softness, night, introspection
  'cloud-outline',        // lightness, drifting thoughts
  'leaf-outline',         // healing, growth, renewal
  'flower-outline',       // gentleness, self-bloom
  'water-outline',        // flow, emotion, release
  'sparkles-outline',     // quiet hope, inner light
  'infinite-outline'      // continuity, “this will pass”
];




type AvatarType = 'emoji' | 'icon' | 'image' | null;
type SheetType = 'select' | 'emoji' | 'icon' | null;

// Dashed Circle Component using SVG
const DashedCircle = ({ size }: { size: number }) => {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const dashLength = 18;
  const gapLength = 25;

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#B5B0A8"
        strokeWidth={strokeWidth}
        strokeDasharray={`${dashLength} ${gapLength}`}
        strokeLinecap="round"
        fill="transparent"
      />
    </Svg>
  );
};

export default function ProfilePictureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ firstName?: string; lastName?: string }>();
  const firstName = params.firstName || '';

  const [avatarType, setAvatarType] = useState<AvatarType>(null);
  const [avatarValue, setAvatarValue] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState<SheetType>(null);
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState('');

  // Animation values for bottom sheet
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  const canContinue = avatarValue !== null;

  const handleBack = () => {
    router.back();
  };

  const handleContinue = () => {
    if (canContinue) {
      router.push({
        pathname: '/(onboarding-new)/feelings-select',
        params: { firstName, avatarType, avatarValue },
      } as any);
    }
  };

  // Sheet animation functions
  const showSheet = useCallback((sheet: SheetType) => {
    setActiveSheet(sheet);
    setIsSheetVisible(true);
    backdropOpacity.value = withTiming(1, { duration: 350, easing: EASE_OUT });
    translateY.value = withTiming(0, { duration: 400, easing: EASE_OUT });
  }, []);

  const hideSheetComplete = useCallback(() => {
    setIsSheetVisible(false);
    setActiveSheet(null);
    setEmojiSearch('');
  }, []);

  const hideSheet = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: 300, easing: EASE_OUT });
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 350, easing: EASE_OUT }, (finished) => {
      if (finished) {
        runOnJS(hideSheetComplete)();
      }
    });
  }, []);

  const openSelectSheet = useCallback(() => {
    showSheet('select');
  }, [showSheet]);

  const handleSelectOption = async (option: string) => {
    if (option === 'emoji') {
      setActiveSheet('emoji');
    } else if (option === 'icon') {
      setActiveSheet('icon');
    } else if (option === 'photo') {
      // Take photo with camera
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'We need camera access to take a photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setAvatarType('image');
        setAvatarValue(result.assets[0].uri);
        saveAvatar('image', result.assets[0].uri);
        hideSheet();
      }
    } else if (option === 'image') {
      // Pick image from local gallery
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'We need access to your photos to choose an image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        legacy: true, // Use legacy picker to show local gallery
      });

      if (!result.canceled && result.assets[0]) {
        setAvatarType('image');
        setAvatarValue(result.assets[0].uri);
        saveAvatar('image', result.assets[0].uri);
        hideSheet();
      }
    }
  };

  const handleSelectEmoji = (emoji: string) => {
    setAvatarType('emoji');
    setAvatarValue(emoji);
    saveAvatar('emoji', emoji);
    hideSheet();
  };

  const handleSelectIcon = (iconName: string) => {
    setAvatarType('icon');
    setAvatarValue(iconName);
    saveAvatar('icon', iconName);
    hideSheet();
  };

  const filteredEmojis = emojiSearch.trim()
    ? EMOJI_DATA.filter(({ emoji, keywords }) => {
        const query = emojiSearch.toLowerCase().trim();
        // Match emoji itself or any keyword
        if (emoji.includes(query)) return true;
        return keywords.some(keyword => keyword.includes(query));
      }).map(e => e.emoji)
    : EMOJI_LIST;

  // Animated styles
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const renderAvatar = () => {
    if (!avatarValue) {
      // Empty state - dashed circle with plus
      return (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={openSelectSheet}
          style={styles.emptyAvatarTouchable}
        >
          <View style={styles.emptyAvatar}>
            <DashedCircle size={AVATAR_SIZE} />
            <View style={styles.plusIconContainer}>
              {/* <Ionicons name="add" size={150} color="#A8A29E" /> */}
              <FontAwesome6 name="plus" size={110} color="#A8A29E" />
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // Filled state
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={openSelectSheet}
        style={styles.filledAvatarTouchable}
      >
        <View style={styles.filledAvatar}>
          {avatarType === 'emoji' && (
            <Text style={styles.avatarEmoji}>{avatarValue}</Text>
          )}
          {avatarType === 'icon' && (
            <Ionicons name={avatarValue as any} size={120} color="#000000" />
          )}
          {avatarType === 'image' && avatarValue && (
            <Image
              source={{ uri: avatarValue }}
              style={styles.avatarImage}
              resizeMode="cover"
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Emoji grid render item
  const renderEmojiItem = ({ item }: { item: string }) => (
    <Pressable
      onPress={() => handleSelectEmoji(item)}
      style={styles.emojiOption}
    >
      <Text style={styles.emojiText}>{item}</Text>
    </Pressable>
  );

  // Icon grid render item
  const renderIconItem = ({ item }: { item: string }) => (
    <Pressable
      onPress={() => handleSelectIcon(item)}
      style={styles.iconOption}
    >
      <Ionicons name={item as any} size={32} color="#666" />
    </Pressable>
  );

  return (
    <OnboardingLayout
      currentStep={CURRENT_STEP}
      onBack={handleBack}
      onNext={handleContinue}
      canGoBack={true}
      canGoNext={canContinue}
      showHelp={false}
    >
      <View style={styles.content}>
        {/* Subtitle */}
        <Text style={styles.subtitle}>Choose a avatar that feels like you</Text>

        {/* Title */}
        <Text style={styles.title}>Put a face to your{'\n'}space</Text>

        {/* Privacy Note */}
        <View style={styles.privacyNote}>
          <Ionicons name="lock-closed" size={14} color="#9E9E9E" />
          <Text style={styles.privacyText} numberOfLines={2}>
            We'll only use this information to personalize your experience.
          </Text>
        </View>

        {/* Avatar Area - Positioned below content */}
        <View style={styles.avatarContainer}>
          {/* Tooltip + Avatar as a unit */}
          <View style={styles.avatarUnit}>
            {/* Tooltip - only show when empty */}
            {!avatarValue && (
              <Animated.View
                style={styles.tooltip}
                entering={FadeIn.delay(300)}
              >
                <Text style={styles.tooltipText}>Tap to add an avatar</Text>
                <View style={styles.tooltipArrow} />
              </Animated.View>
            )}

            {/* Avatar Circle */}
            {renderAvatar()}
          </View>
        </View>
      </View>

      {/* Bottom Sheet Modal */}
      <Modal
        transparent
        visible={isSheetVisible}
        animationType="none"
        statusBarTranslucent
        onRequestClose={hideSheet}
      >
        <View style={styles.modalContainer}>
          {/* Backdrop */}
          <Animated.View style={[styles.backdrop, backdropStyle]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={hideSheet} />
          </Animated.View>

          {/* Sheet */}
          <Animated.View style={[styles.sheet, sheetStyle, { bottom: 16 }]}>
            {/* Handle Bar */}
            <View style={styles.handleBar} />

            <View style={[styles.sheetContent, { paddingBottom: insets.bottom > 0 ? insets.bottom : 24 }]}>
              {/* Select Icon Sheet */}
              {activeSheet === 'select' && (
                <>
                  <View style={styles.sheetHeader}>
                    <Text style={styles.sheetTitle}>Select Icon</Text>
                    <TouchableOpacity onPress={hideSheet} style={styles.closeButton}>
                      <Ionicons name="close" size={20} color="#666" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.sheetDivider} />

                  <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => handleSelectOption('photo')}
                  >
                    <View style={styles.optionIcon}>
                      <Feather name="camera" size={22} color="#888" />
                    </View>
                    <Text style={styles.optionText}>Take Photo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => handleSelectOption('image')}
                  >
                    <View style={styles.optionIcon}>
                      <Feather name="image" size={22} color="#888" />
                    </View>
                    <Text style={styles.optionText}>Choose Image</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => handleSelectOption('emoji')}
                  >
                    <Text style={styles.optionEmoji}>🙂</Text>
                    <Text style={styles.optionText}>Use Emoji</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => handleSelectOption('icon')}
                  >
                    <View style={styles.optionIcon}>
                      <Feather name="star" size={22} color="#888" />
                    </View>
                    <Text style={styles.optionText}>Use Icon</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Emoji Picker Sheet */}
              {activeSheet === 'emoji' && (
                <>
                  <View style={styles.sheetHeader}>
                    <Text style={styles.sheetTitle}>Choose an Emoji</Text>
                    <TouchableOpacity onPress={hideSheet} style={styles.closeButton}>
                      <Ionicons name="close" size={20} color="#666" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.sheetDivider} />

                  {/* Search Input */}
                  <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#999" />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search Emojis"
                      placeholderTextColor="#999"
                      value={emojiSearch}
                      onChangeText={setEmojiSearch}
                    />
                  </View>

                  {/* Emoji Grid with Fade Zones */}
                  <View style={styles.emojiGridContainer}>
                    {/* Top Fade Zone */}
                    <LinearGradient
                      colors={['#FFFFFF', 'rgba(255, 255, 255, 0)']}
                      style={styles.topFadeZone}
                      pointerEvents="none"
                    />

                    <FlatList
                      data={filteredEmojis}
                      renderItem={renderEmojiItem}
                      keyExtractor={(item, index) => `${item}-${index}`}
                      numColumns={6}
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={styles.emojiGrid}
                      columnWrapperStyle={styles.emojiRow}
                      style={styles.emojiList}
                    />

                    {/* Bottom Fade Zone */}
                    <LinearGradient
                      colors={['rgba(255, 255, 255, 0)', '#FFFFFF']}
                      style={styles.bottomFadeZone}
                      pointerEvents="none"
                    />
                  </View>
                </>
              )}

              {/* Icon Picker Sheet */}
              {activeSheet === 'icon' && (
                <>
                  <View style={styles.sheetHeader}>
                    <Text style={styles.sheetTitle}>Choose an Icon</Text>
                    <TouchableOpacity onPress={hideSheet} style={styles.closeButton}>
                      <Ionicons name="close" size={20} color="#666" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.sheetDivider} />

                  {/* Icon Grid with Fade Zones */}
                  <View style={styles.iconGridContainer}>
                    {/* Top Fade Zone */}
                    <LinearGradient
                      colors={['#FFFFFF', 'rgba(255, 255, 255, 0)']}
                      style={styles.topFadeZone}
                      pointerEvents="none"
                    />

                    <FlatList
                      data={ICON_LIST}
                      renderItem={renderIconItem}
                      keyExtractor={(item) => item}
                      numColumns={4}
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={styles.iconGrid}
                      columnWrapperStyle={styles.iconRow}
                      style={styles.iconList}
                    />

                    {/* Bottom Fade Zone */}
                    <LinearGradient
                      colors={['rgba(255, 255, 255, 0)', '#FFFFFF']}
                      style={styles.bottomFadeZone}
                      pointerEvents="none"
                    />
                  </View>
                </>
              )}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Outfit-Regular',
    color: '#888888',
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Outfit-Bold',
    color: '#1A1A1A',
    lineHeight: 40,
    marginBottom: 12,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  privacyText: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: '#9E9E9E',
    flex: 1,
  },
  // Avatar container - positions avatar below content
  avatarContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 10,
  },
  // Avatar unit - groups tooltip and circle together
  avatarUnit: {
    alignItems: 'center',
  },
  // Tooltip - positioned above circle
  tooltip: {
    backgroundColor: '#78756F',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginBottom: 25,
  },
  tooltipText: {
    fontSize: 16,
    fontFamily: 'Outfit-Medium',
    color: '#FFFFFF',
  },
  tooltipArrow: {
    position: 'absolute',
    bottom: -8,
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#78756F',
  },
  // Empty avatar with dashed circle
  emptyAvatarTouchable: {
  },
  emptyAvatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusIconContainer: {
    position: 'absolute',
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Filled avatar
  filledAvatarTouchable: {
  },
  filledAvatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#D4EAF7',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarEmoji: {
    fontSize: 110,
    lineHeight: 130,
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  // Modal & Bottom Sheet Styles - Matching CrisisCheckSheet
  modalContainer: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    zIndex: 998,
  },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 999,
    overflow: 'hidden',
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
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
    marginBottom: 20,
  },
  sheetContent: {
    paddingHorizontal: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 22,
    fontFamily: 'Outfit-SemiBold',
    color: '#1A1A1A',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetDivider: {
    height: 1,
    backgroundColor: '#E8E4E0',
    marginBottom: 16,
  },
  // Option rows
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F0EB',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    gap: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(200, 195, 190, 0.4)',
  },
  optionText: {
    fontSize: 16,
    fontFamily: 'Outfit-Medium',
    color: '#1A1A1A',
  },
  optionEmoji: {
    fontSize: 24,
    width: 24,
    textAlign: 'center',
  },
  optionIcon: {
    width: 24,
    alignItems: 'center',
  },
  // Search Input
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F0EB',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 48,
    marginBottom: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E8E4E0',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Outfit-Regular',
    color: '#1A1A1A',
    padding: 0,
  },
  // Emoji Grid Container with Fade Zones
  emojiGridContainer: {
    position: 'relative',
    maxHeight: 340,
  },
  topFadeZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 36,
    zIndex: 10,
  },
  bottomFadeZone: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 56,
    zIndex: 10,
  },
  emojiList: {
    maxHeight: 340,
  },
  emojiGrid: {
    paddingTop: 16,
    paddingBottom: 32,
  },
  emojiRow: {
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  emojiOption: {
    width: EMOJI_ITEM_WIDTH,
    height: EMOJI_ITEM_HEIGHT,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 32,
    lineHeight: 42,
    textAlign: 'center',
  },
  // Icon Grid Container with Fade Zones
  iconGridContainer: {
    position: 'relative',
    maxHeight: 300,
  },
  iconList: {
    maxHeight: 300,
  },
  iconGrid: {
    paddingTop: 20,
    paddingBottom: 40,
  },
  iconRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  iconOption: {
    width: 70,
    height: 70,
    borderRadius: 16,
    backgroundColor: '#F5F0EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8E4E0',
  },
});
