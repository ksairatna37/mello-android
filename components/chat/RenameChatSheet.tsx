/**
 * RenameChatSheet — chat rename bottom sheet (Claude design).
 *
 * Visual port to BRAND tokens (Fraunces / JetBrainsMono / Inter,
 * cream + paper + ink) matching the rest of the SelfMind redesign.
 * Animation + onSave/onClose contract is unchanged so callers in
 * SelfMindChatHistory and ChatScreen don't need updates.
 */

import React, { useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface RenameChatSheetProps {
  visible: boolean;
  currentTitle: string;
  onClose: () => void;
  onSave: (newTitle: string) => void;
}

export default function RenameChatSheet({
  visible,
  currentTitle,
  onClose,
  onSave,
}: RenameChatSheetProps) {
  const insets = useSafeAreaInsets();
  const [isVisible, setIsVisible] = React.useState(false);
  const [value, setValue] = React.useState('');
  const inputRef = useRef<TextInput>(null);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  const hideModal = useCallback(() => {
    setIsVisible(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (visible) {
      setValue(currentTitle === 'New chat' ? '' : currentTitle);
      setIsVisible(true);
      backdropOpacity.value = withTiming(1, { duration: 300 });
      translateY.value = withSpring(0, { damping: 50, stiffness: 150, mass: 0.5 });
      setTimeout(() => inputRef.current?.focus(), 350);
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

  const handleSave = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSave(trimmed);
    handleClose();
  }, [value, onSave, handleClose]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!isVisible) return null;

  return (
    <Modal transparent visible={isVisible} animationType="none" statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        <Animated.View style={[styles.sheet, sheetStyle, { bottom: 16 }]}>
          <View style={styles.handleBar} />

          <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            <Text style={styles.kicker}>RENAME · A SOFTER LABEL</Text>
            <Text style={styles.title}>
              Give it a <Text style={styles.titleItalic}>name</Text>.
            </Text>

            <TextInput
              ref={inputRef}
              style={styles.input}
              value={value}
              onChangeText={setValue}
              placeholder="What would you call this thread?"
              placeholderTextColor={C.ink3}
              maxLength={80}
              returnKeyType="done"
              onSubmitEditing={handleSave}
              selectionColor={C.lavenderDeep}
            />

            <View style={styles.buttons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} activeOpacity={0.85}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, !value.trim() && styles.saveBtnDisabled]}
                onPress={handleSave}
                activeOpacity={0.9}
                disabled={!value.trim()}
              >
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,31,54,0.42)',
    zIndex: 998,
  },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 999,
    borderRadius: 32,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 24,
  },
  handleBar: {
    width: 38,
    height: 4,
    backgroundColor: C.line2,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 16,
  },

  kicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 2,
    color: C.ink3,
  },
  title: {
    marginTop: 8,
    fontFamily: 'Fraunces-Medium',
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: -0.3,
    color: C.ink,
  },
  titleItalic: { fontFamily: 'Fraunces-MediumItalic' },

  input: {
    marginTop: 18,
    fontFamily: 'Fraunces-Text',
    fontSize: 16,
    color: C.ink,
    backgroundColor: C.cream,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  buttons: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: RADIUS.btn,
    alignItems: 'center',
    backgroundColor: C.cream2,
    borderWidth: 1,
    borderColor: C.line,
  },
  cancelBtnText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: C.ink2,
    letterSpacing: 0.2,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: RADIUS.btn,
    alignItems: 'center',
    backgroundColor: C.ink,
  },
  saveBtnDisabled: {
    backgroundColor: C.ink3,
  },
  saveBtnText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: C.cream,
    letterSpacing: 0.2,
  },
});
