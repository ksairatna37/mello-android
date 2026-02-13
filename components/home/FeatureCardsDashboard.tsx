/**
 * FeatureCardsDashboard Component
 * Based on mockup 20 - Grid of feature cards with filters
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Defs, RadialGradient, LinearGradient, Stop, Rect } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 60) / 2;

interface FeatureCard {
  id: string;
  title: string;
  subtitle: string;
  gradientColors: string[];
  category: 'all' | 'documents' | 'voice';
}

const FEATURE_CARDS: FeatureCard[] = [
  {
    id: '1',
    title: 'Mood Tracker',
    subtitle: 'Daily check-in',
    gradientColors: ['#C8E6C9', '#A5D6A7', '#81C784'],
    category: 'all',
  },
  {
    id: '2',
    title: 'Guided Meditation',
    subtitle: 'Voice-based',
    gradientColors: ['#B3E5FC', '#81D4FA', '#4FC3F7'],
    category: 'voice',
  },
  {
    id: '3',
    title: 'Journal Entry',
    subtitle: 'Write your thoughts',
    gradientColors: ['#F8BBD9', '#F48FB1', '#F06292'],
    category: 'documents',
  },
  {
    id: '4',
    title: 'Breathing Exercise',
    subtitle: 'Recommended',
    gradientColors: ['#FFE0B2', '#FFCC80', '#FFB74D'],
    category: 'voice',
  },
];

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'documents', label: 'Documents' },
  { id: 'voice', label: 'Voice-based' },
];

interface FeatureCardsDashboardProps {
  greeting?: string;
  onBackPress?: () => void;
  onMenuPress?: () => void;
  onSearchPress?: () => void;
  onCardPress?: (card: FeatureCard) => void;
  onAskAIPress?: () => void;
}

const GradientCard = ({ colors }: { colors: string[] }) => (
  <Svg width="100%" height={100} viewBox="0 0 100 100" style={styles.gradientSvg}>
    <Defs>
      <RadialGradient id="cardGrad" cx="30%" cy="30%" rx="70%" ry="70%">
        <Stop offset="0%" stopColor={colors[0]} stopOpacity="0.9" />
        <Stop offset="50%" stopColor={colors[1]} stopOpacity="0.7" />
        <Stop offset="100%" stopColor={colors[2]} stopOpacity="0.4" />
      </RadialGradient>
    </Defs>
    <Rect x="0" y="0" width="100" height="100" rx="16" fill="url(#cardGrad)" />
  </Svg>
);

const AskAIAvatar = () => (
  <Svg width={44} height={44} viewBox="0 0 44 44">
    <Defs>
      <RadialGradient id="aiAvatar" cx="50%" cy="50%" rx="50%" ry="50%">
        <Stop offset="0%" stopColor="#E1BEE7" stopOpacity="0.9" />
        <Stop offset="100%" stopColor="#CE93D8" stopOpacity="0.5" />
      </RadialGradient>
    </Defs>
    <Svg.Circle cx="22" cy="22" r="20" fill="url(#aiAvatar)" />
  </Svg>
);

export default function FeatureCardsDashboard({
  greeting = 'Good Morning',
  onBackPress,
  onMenuPress,
  onSearchPress,
  onCardPress,
  onAskAIPress,
}: FeatureCardsDashboardProps) {
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState('all');

  const filteredCards = FEATURE_CARDS.filter(
    (card) => activeFilter === 'all' || card.category === activeFilter
  );

  const renderCard = ({ item }: { item: FeatureCard }) => (
    <TouchableOpacity
      style={styles.featureCard}
      onPress={() => onCardPress?.(item)}
      activeOpacity={0.8}
    >
      <View style={styles.cardGradient}>
        <GradientCard colors={item.gradientColors} />
      </View>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Main Card */}
      <View style={[styles.mainCard, { marginTop: insets.top + 20 }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
            <Ionicons name="chevron-back" size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.greeting}>{greeting}</Text>
          <TouchableOpacity style={styles.menuButton} onPress={onMenuPress}>
            <Ionicons name="menu" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <TouchableOpacity style={styles.searchButton} onPress={onSearchPress}>
            <Ionicons name="search-outline" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Filters */}
        <View style={styles.filtersRow}>
          {FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterChip,
                activeFilter === filter.id && styles.filterChipActive,
              ]}
              onPress={() => setActiveFilter(filter.id)}
            >
              <Text
                style={[
                  styles.filterText,
                  activeFilter === filter.id && styles.filterTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.moreButton}>
            <Ionicons name="chevron-forward" size={18} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Feature Cards Grid */}
        <FlatList
          data={filteredCards}
          renderItem={renderCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.cardsGrid}
          columnWrapperStyle={styles.cardsRow}
          showsVerticalScrollIndicator={false}
        />

        {/* Ask AI Floating Prompt */}
        <TouchableOpacity style={styles.askAIPrompt} onPress={onAskAIPress}>
          <View style={styles.askAIAvatar}>
            <Svg width={40} height={40} viewBox="0 0 40 40">
              <Defs>
                <RadialGradient id="promptAvatar" cx="50%" cy="50%" rx="50%" ry="50%">
                  <Stop offset="0%" stopColor="#E1BEE7" stopOpacity="0.9" />
                  <Stop offset="100%" stopColor="#CE93D8" stopOpacity="0.5" />
                </RadialGradient>
              </Defs>
              <Svg.Circle cx="20" cy="20" r="18" fill="url(#promptAvatar)" />
            </Svg>
          </View>
          <Text style={styles.askAIText}>Don't know where to start? Ask AI</Text>
        </TouchableOpacity>
      </View>

      {/* Footer text */}
      <Text style={styles.footerText}>
        Document planner and generator using AI.
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
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
    maxHeight: 600,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4CAF50',
    fontFamily: 'Outfit-SemiBold',
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  searchButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F7',
  },
  filterChipActive: {
    backgroundColor: '#4CAF50',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Outfit-Medium',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  moreButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardsGrid: {
    paddingBottom: 80,
  },
  cardsRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  featureCard: {
    width: CARD_WIDTH,
    backgroundColor: '#FAFAFA',
    borderRadius: 20,
    padding: 12,
    overflow: 'hidden',
  },
  cardGradient: {
    height: 100,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  gradientSvg: {
    borderRadius: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
    fontFamily: 'Outfit-SemiBold',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'Outfit-Regular',
  },
  askAIPrompt: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    padding: 8,
    paddingRight: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    gap: 12,
  },
  askAIAvatar: {
    width: 40,
    height: 40,
  },
  askAIText: {
    fontSize: 15,
    color: '#1A1A1A',
    fontFamily: 'Outfit-Medium',
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
