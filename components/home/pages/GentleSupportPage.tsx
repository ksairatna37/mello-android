/**
 * GentleSupportPage - "Gentle Support" (Crisis Resources) tab content
 * Crisis hotlines, breathing exercises, grounding techniques
 */

import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { LIGHT_THEME, CARD_SHADOW } from '@/components/common/LightGradient';

// Crisis Resources (India)
const CRISIS_RESOURCES = [
  {
    id: 'aasra',
    name: 'AASRA',
    number: '9820466626',
    description: 'Free, confidential support 24/7',
    color: '#E3F2FD',
  },
  {
    id: 'vandrevala',
    name: 'Vandrevala Foundation',
    number: '18602662345',
    description: '24/7 mental health helpline',
    color: '#E8F5E9',
  },
  {
    id: 'icall',
    name: 'iCall',
    number: '9152987821',
    description: 'Mon-Sat 8am-10pm',
    color: '#FFF3E0',
  },
  {
    id: 'nimhans',
    name: 'NIMHANS',
    number: '08046110007',
    description: '24/7 mental health support',
    color: '#F3E5F5',
  },
  {
    id: 'emergency',
    name: 'Emergency Services',
    number: '112',
    description: 'National emergency helpline',
    color: '#FFEBEE',
  },
];

// Grounding Techniques
const GROUNDING_TECHNIQUES = [
  {
    id: '5-4-3-2-1',
    name: '5-4-3-2-1 Technique',
    icon: 'eye-outline',
    description: 'Name 5 things you see, 4 you feel, 3 you hear, 2 you smell, 1 you taste',
  },
  {
    id: 'box-breathing',
    name: 'Box Breathing',
    icon: 'square-outline',
    description: 'Breathe in 4s, hold 4s, out 4s, hold 4s',
  },
  {
    id: 'cold-water',
    name: 'Cold Water',
    icon: 'water-outline',
    description: 'Splash cold water on your face or hold ice',
  },
];

export default function GentleSupportPage() {
  const router = useRouter();

  const handleCallResource = useCallback((number: string) => {
    if (number.startsWith('Text')) {
      // Open SMS app
      Linking.openURL('sms:741741?body=HOME');
    } else {
      // Call the number
      Linking.openURL(`tel:${number.replace(/-/g, '')}`);
    }
  }, []);

  const handleTalkToMello = useCallback(() => {
    router.navigate('/(main)/chat');
  }, [router]);

  const handleBreathingExercise = useCallback(() => {
    router.navigate('/(main)/breathing');
  }, [router]);

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <Animated.View style={styles.headerSection} entering={FadeInUp.delay(100).duration(400)}>
        <Text style={styles.pageTitle}>Gentle Support</Text>
        <Text style={styles.pageSubtitle}>You're not alone. Help is always here.</Text>
      </Animated.View>

      {/* Talk to Mello */}
      <Animated.View entering={FadeInUp.delay(200).duration(400)}>
        <Pressable style={styles.melloCard} onPress={handleTalkToMello}>
          <View style={styles.melloIcon}>
            <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.melloContent}>
            <Text style={styles.melloTitle}>Talk to Mello</Text>
            <Text style={styles.melloText}>
              I'm here to listen, anytime you need.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
        </Pressable>
      </Animated.View>

      {/* Breathing Exercise Quick Start */}
      <Animated.View style={styles.breathingCard} entering={FadeInUp.delay(300).duration(400)}>
        <View style={styles.breathingHeader}>
          <View style={styles.breathingIcon}>
            <Ionicons name="leaf" size={20} color={LIGHT_THEME.accent} />
          </View>
          <Text style={styles.breathingTitle}>Take a Breath</Text>
        </View>
        <Text style={styles.breathingText}>
          A moment of calm can make all the difference.
        </Text>
        <Pressable style={styles.breathingButton} onPress={handleBreathingExercise}>
          <Text style={styles.breathingButtonText}>Start 2-Min Breathing</Text>
          <Ionicons name="play" size={16} color={LIGHT_THEME.accent} />
        </Pressable>
      </Animated.View>

      {/* Grounding Techniques */}
      <Animated.View style={styles.groundingSection} entering={FadeInUp.delay(400).duration(400)}>
        <Text style={styles.sectionTitle}>Grounding Techniques</Text>
        {GROUNDING_TECHNIQUES.map((technique) => (
          <View key={technique.id} style={styles.techniqueCard}>
            <View style={styles.techniqueIcon}>
              <Ionicons name={technique.icon as any} size={20} color={LIGHT_THEME.textPrimary} />
            </View>
            <View style={styles.techniqueContent}>
              <Text style={styles.techniqueName}>{technique.name}</Text>
              <Text style={styles.techniqueDesc}>{technique.description}</Text>
            </View>
          </View>
        ))}
      </Animated.View>

      {/* Crisis Resources */}
      <Animated.View style={styles.crisisSection} entering={FadeInUp.delay(500).duration(400)}>
        <Text style={styles.sectionTitle}>Crisis Resources</Text>
        <Text style={styles.crisisSubtitle}>
          If you're in crisis, please reach out. These services are free and confidential.
        </Text>

        {CRISIS_RESOURCES.map((resource) => (
          <Pressable
            key={resource.id}
            style={[styles.resourceCard, { backgroundColor: resource.color }]}
            onPress={() => handleCallResource(resource.number)}
          >
            <View style={styles.resourceContent}>
              <Text style={styles.resourceName}>{resource.name}</Text>
              <Text style={styles.resourceNumber}>{resource.number}</Text>
              <Text style={styles.resourceDesc}>{resource.description}</Text>
            </View>
            <View style={styles.resourceAction}>
              <Ionicons
                name={resource.number.startsWith('Text') ? 'chatbubble' : 'call'}
                size={24}
                color={LIGHT_THEME.textPrimary}
              />
            </View>
          </Pressable>
        ))}
      </Animated.View>

      {/* Reassurance */}
      <Animated.View style={styles.reassuranceCard} entering={FadeInUp.delay(600).duration(400)}>
        <Ionicons name="heart" size={24} color="#E57373" />
        <Text style={styles.reassuranceText}>
          It's okay to not be okay. Asking for help is a sign of strength, not weakness.
        </Text>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 20,
  },
  headerSection: {
    marginTop: 8,
  },
  pageTitle: {
    fontSize: 36,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textPrimary,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 16,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textSecondary,
    marginTop: 4,
  },
  melloCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LIGHT_THEME.accent,
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  melloIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  melloContent: {
    flex: 1,
  },
  melloTitle: {
    fontSize: 18,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
  },
  melloText: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  breathingCard: {
    backgroundColor: LIGHT_THEME.surface,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    ...CARD_SHADOW,
  },
  breathingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  breathingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: LIGHT_THEME.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breathingTitle: {
    fontSize: 18,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.textPrimary,
  },
  breathingText: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textSecondary,
    lineHeight: 20,
  },
  breathingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: LIGHT_THEME.accentLight,
    borderRadius: 16,
    paddingVertical: 14,
  },
  breathingButtonText: {
    fontSize: 15,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.accent,
  },
  groundingSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.textPrimary,
    marginBottom: 4,
  },
  techniqueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LIGHT_THEME.surface,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    ...CARD_SHADOW,
  },
  techniqueIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: LIGHT_THEME.cardMint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  techniqueContent: {
    flex: 1,
  },
  techniqueName: {
    fontSize: 15,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.textPrimary,
  },
  techniqueDesc: {
    fontSize: 13,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  crisisSection: {
    gap: 12,
  },
  crisisSubtitle: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  resourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  resourceContent: {
    flex: 1,
  },
  resourceName: {
    fontSize: 14,
    fontFamily: 'Outfit-SemiBold',
    color: LIGHT_THEME.textPrimary,
  },
  resourceNumber: {
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
    color: LIGHT_THEME.textPrimary,
    marginTop: 2,
  },
  resourceDesc: {
    fontSize: 12,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textSecondary,
    marginTop: 2,
  },
  resourceAction: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reassuranceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  reassuranceText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: LIGHT_THEME.textPrimary,
    lineHeight: 20,
  },
});
