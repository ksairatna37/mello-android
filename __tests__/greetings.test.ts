jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

import { getTimeBucket } from '@/services/home/greetings';

describe('home greetings', () => {
  const originalTimezone = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = 'Asia/Kolkata';
  });

  afterAll(() => {
    process.env.TZ = originalTimezone;
  });

  it('treats post-midnight as late night', () => {
    expect(getTimeBucket(new Date(2026, 4, 6, 0, 50))).toBe('lateNight');
  });

  it('uses the local device timezone for absolute timestamps', () => {
    const localMidnight = new Date('2026-05-06T00:50:00+05:30');
    expect(getTimeBucket(localMidnight)).toBe('lateNight');
  });

  it('does not call early morning morning', () => {
    expect(getTimeBucket(new Date(2026, 4, 6, 4, 30))).toBe('veryLate');
    expect(getTimeBucket(new Date(2026, 4, 6, 5, 0))).toBe('earlyMorning');
  });
});
