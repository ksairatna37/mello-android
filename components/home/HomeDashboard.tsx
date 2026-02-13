/**
 * HomeDashboard Component
 * Based on mockup 18 - Welcome banner with shortcuts
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';

interface Shortcut {
  id: string;
  title: string;
  description: string;
  isNew?: boolean;
}

const SHORTCUTS: Shortcut[] = [
  {
    id: '1',
    title: 'Daily Routine Planner',
    description: 'Ask AI to plan your daily routine.',
    isNew: true,
  },
  {
    id: '2',
    title: 'Mood Journal',
    description: 'Track how you feel today.',
    isNew: false,
  },
  {
    id: '3',
    title: 'Breathing Exercise',
    description: 'Guided breathing for calm.',
    isNew: false,
  },
];

interface HomeDashboardProps {
  onProfilePress?: () => void;
  onSearchPress?: () => void;
  onShortcutPress?: (shortcut: Shortcut) => void;
  onShortcutDismiss?: (shortcut: Shortcut) => void;
  onSendMessage?: (message: string) => void;
  onSettingsPress?: () => void;
}

const WelcomeOrb = () => (
  <Svg width={60} height={60} viewBox="0 0 60 60">
    <Defs>
      <RadialGradient id="welcomeOrb" cx="50%" cy="50%" rx="50%" ry="50%">
        <Stop offset="0%" stopColor="#FCE4EC" stopOpacity="1" />
        <Stop offset="50%" stopColor="#F8BBD9" stopOpacity="0.8" />
        <Stop offset="100%" stopColor="#E1BEE7" stopOpacity="0.4" />
      </RadialGradient>
    </Defs>
    <Circle cx="30" cy="30" r="28" fill="url(#welcomeOrb)" />
  </Svg>
);

export default function HomeDashboard({
  onProfilePress,
  onSearchPress,
  onShortcutPress,
  onShortcutDismiss,
  onSendMessage,
  onSettingsPress,
}: HomeDashboardProps) {
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = React.useState('');

  const handleSend = () => {
    if (inputText.trim() && onSendMessage) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  const renderShortcut = ({ item }: { item: Shortcut }) => (
    <TouchableOpacity
      style={styles.shortcutCard}
      onPress={() => onShortcutPress?.(item)}
      activeOpacity={0.8}
    >
      <View style={styles.shortcutHeader}>
        <View style={styles.shortcutTitleRow}>
          <Text style={styles.shortcutTitle}>{item.title}</Text>
          {item.isNew && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={() => onShortcutDismiss?.(item)}
        >
          <Ionicons name="close" size={16} color="#999" />
        </TouchableOpacity>
      </View>
      <Text style={styles.shortcutDescription}>{item.description}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Main Card */}
      <View style={[styles.mainCard, { marginTop: insets.top + 20 }]}>
        {/* Top Icons */}
        <View style={styles.topIcons}>
          <TouchableOpacity style={styles.iconButton} onPress={onProfilePress}>
            <Ionicons name="person-outline" size={22} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={onSearchPress}>
            <Ionicons name="search-outline" size={22} color="#666" />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
        </View>

        {/* Welcome Banner */}
        <View style={styles.welcomeBanner}>
          <WelcomeOrb />
          <View style={styles.welcomeText}>
            <Text style={styles.welcomeTitle}>Welcome to Mello</Text>
            <Text style={styles.welcomeDescription} numberOfLines={1}>
              Your safe space for mental wellness...
            </Text>
          </View>
        </View>

        {/* Your Shortcuts */}
        <Text style={styles.sectionTitle}>Your Shortcuts</Text>

        <FlatList
          data={SHORTCUTS}
          renderItem={renderShortcut}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.shortcutsList}
        />

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.plusButton}>
            <Ionicons name="add" size={24} color="#666" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Start here..."
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity style={styles.settingsButton} onPress={onSettingsPress}>
            <Ionicons name="settings-outline" size={22} color="#666" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Footer text */}
      <Text style={styles.footerText}>
        Generation from descriptive prompts.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
    paddingHorizontal: 20,
  },
  mainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  topIcons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginBottom: 16,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2196F3',
  },
  welcomeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 14,
  },
  welcomeText: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
    fontFamily: 'Outfit-SemiBold',
  },
  welcomeDescription: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Outfit-Regular',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '300',
    color: '#CCCCCC',
    marginBottom: 16,
    fontFamily: 'Outfit-Light',
  },
  shortcutsList: {
    gap: 12,
    marginBottom: 20,
  },
  shortcutCard: {
    width: 180,
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
  },
  shortcutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  shortcutTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  shortcutTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    fontFamily: 'Outfit-SemiBold',
  },
  newBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Outfit-Bold',
  },
  dismissButton: {
    padding: 4,
  },
  shortcutDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    fontFamily: 'Outfit-Regular',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
    borderRadius: 25,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  plusButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    paddingVertical: 8,
    fontFamily: 'Outfit-Regular',
  },
  settingsButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    marginTop: 'auto',
    marginBottom: 40,
    fontFamily: 'Outfit-Regular',
  },
});
