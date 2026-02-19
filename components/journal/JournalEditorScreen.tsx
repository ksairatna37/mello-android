/**
 * JournalEditorScreen Component - Light Theme
 * Write/edit journal entry with clean light aesthetic
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn } from 'react-native-reanimated';

import EmotionPicker from './EmotionPicker';
import SpeechToTextButton from './SpeechToTextButton';
import LightGradient, { LIGHT_THEME, CARD_SHADOW } from '@/components/common/LightGradient';
import { addJournalEntry } from '@/utils/melloStorage';

const WRITING_PROMPTS = [
  'What made you smile today?',
  "What's weighing on your mind?",
  'What are you grateful for?',
];

interface JournalEditorScreenProps {
  onCancel: () => void;
  onSaved: () => void;
}

export default function JournalEditorScreen({ onCancel, onSaved }: JournalEditorScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [content, setContent] = useState('');
  const [emotion, setEmotion] = useState<string | null>(null);
  const [emotionEmoji, setEmotionEmoji] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [showPrompts, setShowPrompts] = useState(false);
  const [usedPrompt, setUsedPrompt] = useState<string | undefined>();
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleEmotionSelect = useCallback((emotionId: string, emoji: string) => {
    setEmotion(emotionId);
    setEmotionEmoji(emoji);
  }, []);

  const handlePromptSelect = useCallback((prompt: string) => {
    setContent((prev) => (prev ? prev + '\n\n' + prompt + '\n' : prompt + '\n'));
    setUsedPrompt(prompt);
    setShowPrompts(false);
  }, []);

  const handleSpeechText = useCallback((text: string) => {
    setContent((prev) => prev + text);
  }, []);

  const handleAddPhoto = useCallback(async () => {
    try {
      const ImagePicker = require('expo-image-picker');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photos to add images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: true,
      });
      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'Could not open photo library.');
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!content.trim()) {
      Alert.alert('Empty Entry', 'Please write something before saving.');
      return;
    }

    setIsSaving(true);
    try {
      await addJournalEntry({
        content: content.trim(),
        emotion: emotion || 'neutral',
        emotionEmoji: emotionEmoji || '😐',
        photoUri: photoUri || undefined,
        prompt: usedPrompt,
      });
      setShowSaveConfirm(true);
    } catch {
      Alert.alert('Error', 'Could not save entry. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [content, emotion, emotionEmoji, photoUri, usedPrompt]);

  const handleTalkToMello = useCallback(() => {
    router.navigate('/(main)/chat');
  }, [router]);

  // Post-save confirmation
  if (showSaveConfirm) {
    return (
      <View style={styles.confirmContainer}>
        <LightGradient variant="warm" />
        <Animated.View style={styles.confirmCard} entering={FadeIn.duration(400)}>
          <Text style={styles.confirmCheck}>✅</Text>
          <Text style={styles.confirmTitle}>Entry saved!</Text>
          {emotion && emotion !== 'neutral' && (
            <Text style={styles.confirmText}>
              Mello noticed you're feeling {emotion}.{'\n'}Want to talk about it?
            </Text>
          )}
          <View style={styles.confirmButtons}>
            <Pressable style={styles.talkButton} onPress={handleTalkToMello}>
              <Text style={styles.talkButtonText}>Talk to Mello</Text>
            </Pressable>
            <Pressable style={styles.noThanksButton} onPress={onSaved}>
              <Text style={styles.noThanksText}>No thanks</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <LightGradient variant="warm" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>New Entry</Text>
        <Pressable onPress={handleSave} disabled={isSaving}>
          <Text style={[styles.saveText, isSaving && styles.saveTextDisabled]}>Save</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Emotion Picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>HOW ARE YOU FEELING?</Text>
          <EmotionPicker selected={emotion} onSelect={handleEmotionSelect} />
        </View>

        {/* Text Input */}
        <View style={styles.inputCard}>
          <TextInput
            style={styles.textInput}
            placeholder="Write your thoughts..."
            placeholderTextColor={LIGHT_THEME.textMuted}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
            autoFocus
          />
        </View>

        {/* Photo Preview */}
        {photoUri && (
          <View style={styles.photoContainer}>
            <Image source={{ uri: photoUri }} style={styles.photoPreview} />
            <Pressable
              style={styles.removePhoto}
              onPress={() => setPhotoUri(null)}
            >
              <Ionicons name="close-circle" size={24} color={LIGHT_THEME.textSecondary} />
            </Pressable>
          </View>
        )}

        {/* Toolbar */}
        <View style={styles.toolbar}>
          <SpeechToTextButton onTextRecognized={handleSpeechText} />
          <Pressable style={styles.toolButton} onPress={handleAddPhoto}>
            <Ionicons name="camera-outline" size={22} color={LIGHT_THEME.textSecondary} />
          </Pressable>
          <Pressable
            style={[styles.toolButton, showPrompts && styles.toolButtonActive]}
            onPress={() => setShowPrompts(!showPrompts)}
          >
            <Ionicons
              name="bulb-outline"
              size={22}
              color={showPrompts ? LIGHT_THEME.accent : LIGHT_THEME.textSecondary}
            />
          </Pressable>
        </View>

        {/* Writing Prompts */}
        {showPrompts && (
          <Animated.View style={styles.promptsPanel} entering={FadeIn.duration(300)}>
            <Text style={styles.promptsTitle}>Need inspiration?</Text>
            {WRITING_PROMPTS.map((prompt, i) => (
              <Pressable
                key={i}
                style={styles.promptItem}
                onPress={() => handlePromptSelect(prompt)}
              >
                <Ionicons name="sparkles-outline" size={16} color={LIGHT_THEME.accent} />
                <Text style={styles.promptText}>{prompt}</Text>
              </Pressable>
            ))}
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  cancelText: {
    fontSize: 15,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textSecondary,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.textPrimary,
  },
  saveText: {
    fontSize: 15,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.accent,
  },
  saveTextDisabled: {
    opacity: 0.4,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    gap: 16,
    paddingBottom: 120,
  },

  // Section
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 4,
  },

  // Input
  inputCard: {
    backgroundColor: LIGHT_THEME.surface,
    borderRadius: 20,
    padding: 16,
    minHeight: 180,
    ...CARD_SHADOW,
  },
  textInput: {
    fontSize: 16,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textPrimary,
    lineHeight: 24,
    flex: 1,
    minHeight: 150,
  },

  // Photo
  photoContainer: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  photoPreview: {
    width: 100,
    height: 100,
    borderRadius: 16,
  },
  removePhoto: {
    position: 'absolute',
    top: -8,
    right: -8,
  },

  // Toolbar
  toolbar: {
    flexDirection: 'row',
    gap: 10,
  },
  toolButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: LIGHT_THEME.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...CARD_SHADOW,
  },
  toolButtonActive: {
    backgroundColor: LIGHT_THEME.accentLight,
  },

  // Prompts
  promptsPanel: {
    backgroundColor: LIGHT_THEME.surface,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    ...CARD_SHADOW,
  },
  promptsTitle: {
    fontSize: 14,
    fontFamily: 'Outfit-Medium',
    color: LIGHT_THEME.textSecondary,
  },
  promptItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  promptText: {
    fontSize: 15,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textPrimary,
  },

  // Confirm
  confirmContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  confirmCard: {
    backgroundColor: LIGHT_THEME.surface,
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    width: '100%',
    ...CARD_SHADOW,
  },
  confirmCheck: {
    fontSize: 40,
  },
  confirmTitle: {
    fontSize: 22,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.textPrimary,
  },
  confirmText: {
    fontSize: 15,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  confirmButtons: {
    width: '100%',
    gap: 10,
    marginTop: 8,
  },
  talkButton: {
    backgroundColor: LIGHT_THEME.accent,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  talkButtonText: {
    fontSize: 16,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
  },
  noThanksButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  noThanksText: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textMuted,
  },
});
