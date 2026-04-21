import React from 'react';
import { View, Text, Pressable, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BatterySlider } from './BatterySlider';
import { DidYouKnow } from './DidYouKnow';
import { LeafGrowth } from './LeafGrowth';
import { OptionCard } from './OptionCard';
import type { Question } from './types';
import { TOTAL_QUESTIONS } from './types';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Question Page ────────────────────────────────────────────────────────────

export interface QuestionPageProps {
  question: Question;
  qIndex: number;
  questionNumber: number | null; // null for fact/break pages
  settledIndex: number;
  answer: string | undefined;
  multiAnswer?: string[];
  firstName: string;
  topInset: number;
  bottomInset: number;
  onSelect: (question: Question, optionId: string, qIndex: number) => void;
  onMultiToggle?: (question: Question, optionId: string) => void;
  onMultiContinue?: (qIndex: number) => void;
  onBack: (fromIndex: number) => void;
}

export function QuestionPage({
  question,
  qIndex,
  questionNumber,
  settledIndex,
  answer,
  multiAnswer,
  firstName,
  topInset,
  bottomInset,
  onSelect,
  onMultiToggle,
  onMultiContinue,
  onBack,
}: QuestionPageProps) {
  const isFact = question.type === 'fact';
  const progressWidth = questionNumber !== null
    ? (questionNumber / TOTAL_QUESTIONS) * 100
    : ((TOTAL_QUESTIONS / 2) / TOTAL_QUESTIONS) * 100; // midpoint for fact page

  return (
    <View style={[styles.page, { height: SCREEN_HEIGHT, width: SCREEN_WIDTH }]}>
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <View style={styles.progressWrapper}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressWidth}%` }]} />
          </View>
        </View>

        <View style={styles.counterRow}>
          <Pressable style={styles.headerBtn} hitSlop={8} onPress={() => onBack(qIndex)}>
            <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
          </Pressable>
          {!isFact && (
            <Text style={styles.counterText}>Question {questionNumber} of {TOTAL_QUESTIONS}</Text>
          )}
          {isFact && <View style={{ flex: 1 }} />}
          <View style={styles.headerBtn} />
        </View>
      </View>

      <View style={[styles.content, { paddingBottom: bottomInset + 20 }]}>
        {!isFact && <Text style={styles.questionTitle}>{question.title}</Text>}
        {!isFact && <Text style={styles.questionSubtitle}>{question.subtitle}</Text>}

        {question.type === 'battery' ? (
          <BatterySlider
            key={`battery-${settledIndex === qIndex ? 'active' : 'inactive'}`}
            initialPct={answer ? Number(answer) : 50}
            onConfirm={(pct) => onSelect(question, String(pct), qIndex)}
          />
        ) : question.type === 'leaf' ? (
          <LeafGrowth
            key={`leaf-${settledIndex === qIndex ? 'active' : 'inactive'}`}
            onConfirm={(level) => onSelect(question, String(level), qIndex)}
          />
        ) : isFact ? (
          <DidYouKnow firstName={firstName} onContinue={() => onSelect(question, 'seen', qIndex)} />
        ) : question.multiSelect ? (
          <>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.multiScrollView}>
              <View style={styles.optionsContainer}>
                {question.options.map((option) => (
                  <OptionCard
                    key={option.id}
                    option={option}
                    selected={multiAnswer?.includes(option.id) ?? false}
                    dimmed={false}
                    onPress={() => onMultiToggle?.(question, option.id)}
                  />
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity
              style={[styles.continueButton, !(multiAnswer?.length) && styles.continueButtonDisabled]}
              onPress={() => onMultiContinue?.(qIndex)}
              disabled={!(multiAnswer?.length)}
              activeOpacity={0.8}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.optionsContainer}>
            {question.options.map((option) => (
              <OptionCard
                key={option.id}
                option={option}
                selected={answer === option.id}
                dimmed={answer !== undefined && answer !== option.id}
                onPress={() => onSelect(question, option.id, qIndex)}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    width: '100%',
  },
  header: {
    paddingBottom: 8,
  },
  progressWrapper: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#ffffffac',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#b9a6ff',
    borderRadius: 2,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontFamily: 'Outfit-Medium',
    color: '#1A1A1A',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 0,
  },
  questionTitle: {
    fontSize: 22,
    fontFamily: 'Outfit-Medium',
    color: '#1A1A1A',
    lineHeight: 30,
    marginBottom: 4,
    width: '100%',
  },
  questionSubtitle: {
    fontSize: 13,
    fontFamily: 'Outfit-Regular',
    color: '#999999',
    marginBottom: 16,
  },
  optionsContainer: {
    gap: 8,
  },
  multiScrollView: {
    flex: 1,
  },
  continueButton: {
    backgroundColor: '#8B7EF8',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#8B7EF8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  continueButtonDisabled: {
    backgroundColor: '#BDBDBD',
  },
  continueButtonText: {
    fontSize: 17,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
  },
});
