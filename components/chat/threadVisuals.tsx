import type { ComponentType } from 'react';
import { Glyphs, BRAND as C } from '@/components/common/BrandGlyphs';
import type { ChatListItem } from '@/services/chat/chatService';

type ThreadGlyph = ComponentType<{ size?: number; color?: string }>;

export type ThreadVisual = {
  bg: string;
  border: string;
  iconColor: string;
  Icon: ThreadGlyph;
};

const FALLBACK_SWATCHES = [
  { bg: '#F9E1D1', border: 'rgba(244,169,136,0.42)', iconColor: C.ink },
  { bg: '#E9E6FA', border: 'rgba(77,64,138,0.18)', iconColor: C.lavenderDeep },
  { bg: '#DCEBD6', border: 'rgba(91,122,77,0.18)', iconColor: C.ink },
  { bg: '#F7EDC6', border: 'rgba(151,123,36,0.18)', iconColor: C.ink },
  { bg: '#FAD0BF', border: 'rgba(244,169,136,0.46)', iconColor: C.ink },
];

const KEYWORD_VISUALS: Array<{ words: string[]; visual: ThreadVisual }> = [
  {
    words: ['sleep', 'sleeping', 'tired', 'insomnia', 'night', 'dream', 'rest'],
    visual: {
      bg: '#F7EDC6',
      border: 'rgba(151,123,36,0.18)',
      iconColor: C.ink,
      Icon: Glyphs.Moon,
    },
  },
  {
    words: ['crisis', 'support', 'down', 'sad', 'lonely', 'alone', 'overwhelmed', 'heavy'],
    visual: {
      bg: '#DCEBD6',
      border: 'rgba(91,122,77,0.18)',
      iconColor: C.ink,
      Icon: Glyphs.Heart,
    },
  },
  {
    words: ['breath', 'breathing', 'anxious', 'anxiety', 'panic', 'stress', 'stressed', 'calm'],
    visual: {
      bg: '#E9E6FA',
      border: 'rgba(77,64,138,0.18)',
      iconColor: C.lavenderDeep,
      Icon: Glyphs.Breath,
    },
  },
  {
    words: ['friend', 'family', 'partner', 'relationship', 'talking', 'talk'],
    visual: {
      bg: '#F9E1D1',
      border: 'rgba(244,169,136,0.42)',
      iconColor: C.ink,
      Icon: Glyphs.Chat,
    },
  },
  {
    words: ['know', 'reflect', 'reflection', 'journal', 'remember', 'before'],
    visual: {
      bg: '#E9E6FA',
      border: 'rgba(77,64,138,0.18)',
      iconColor: C.lavenderDeep,
      Icon: Glyphs.Book,
    },
  },
];

function fallbackFor(id: string): ThreadVisual {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const swatch = FALLBACK_SWATCHES[h % FALLBACK_SWATCHES.length];
  return { ...swatch, Icon: Glyphs.Sparkle };
}

export function threadVisualFor(thread: ChatListItem): ThreadVisual {
  if (thread.type === 'voicechat') {
    return {
      bg: '#E9E6FA',
      border: 'rgba(77,64,138,0.18)',
      iconColor: C.lavenderDeep,
      Icon: Glyphs.Mic,
    };
  }

  const title = thread.title.toLowerCase();
  const matched = KEYWORD_VISUALS.find(({ words }) => words.some((word) => title.includes(word)));

  return matched?.visual ?? fallbackFor(thread.id);
}
