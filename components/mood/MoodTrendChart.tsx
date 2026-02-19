/**
 * MoodTrendChart Component
 * SVG line chart for mood data using react-native-svg
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

interface DataPoint {
  date: string;
  score: number;
}

interface MoodTrendChartProps {
  data: DataPoint[];
  period: 'weekly' | 'monthly';
}

const CHART_HEIGHT = 180;
const CHART_PADDING = { top: 20, right: 16, bottom: 30, left: 40 };
const MOOD_LABELS = ['', 'Rough', 'Low', 'Okay', 'Good', 'Great'];

function formatDate(dateStr: string, period: 'weekly' | 'monthly'): string {
  const date = new Date(dateStr + 'T00:00:00');
  if (period === 'weekly') {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default function MoodTrendChart({ data, period }: MoodTrendChartProps) {
  const chartWidth = 320; // Will be constrained by container

  const plotWidth = chartWidth - CHART_PADDING.left - CHART_PADDING.right;
  const plotHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

  const points = useMemo(() => {
    if (data.length === 0) return [];
    return data.map((d, i) => ({
      x: CHART_PADDING.left + (data.length > 1 ? (i / (data.length - 1)) * plotWidth : plotWidth / 2),
      y: CHART_PADDING.top + plotHeight - ((d.score - 1) / 4) * plotHeight,
      date: d.date,
      score: d.score,
    }));
  }, [data, plotWidth, plotHeight]);

  const linePath = useMemo(() => {
    if (points.length < 2) return '';
    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`)
      .join(' ');
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length < 2) return '';
    const bottom = CHART_PADDING.top + plotHeight;
    return (
      linePath +
      ` L${points[points.length - 1].x},${bottom}` +
      ` L${points[0].x},${bottom} Z`
    );
  }, [linePath, points, plotHeight]);

  if (data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No mood data yet. Start checking in daily!</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`}>
        <Defs>
          <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#b9a6ff" stopOpacity="0.3" />
            <Stop offset="100%" stopColor="#b9a6ff" stopOpacity="0.02" />
          </LinearGradient>
        </Defs>

        {/* Grid lines */}
        {[1, 2, 3, 4, 5].map((score) => {
          const y = CHART_PADDING.top + plotHeight - ((score - 1) / 4) * plotHeight;
          return (
            <Line
              key={score}
              x1={CHART_PADDING.left}
              y1={y}
              x2={chartWidth - CHART_PADDING.right}
              y2={y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
          );
        })}

        {/* Area fill */}
        {points.length >= 2 && (
          <Path d={areaPath} fill="url(#areaFill)" />
        )}

        {/* Line */}
        {points.length >= 2 && (
          <Path
            d={linePath}
            stroke="#b9a6ff"
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Data points */}
        {points.map((p, i) => (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={4}
            fill="#b9a6ff"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth={1.5}
          />
        ))}
      </Svg>

      {/* Y-axis labels */}
      <View style={styles.yLabels}>
        {[5, 4, 3, 2, 1].map((score) => (
          <Text key={score} style={styles.yLabel}>
            {MOOD_LABELS[score]}
          </Text>
        ))}
      </View>

      {/* X-axis labels */}
      <View style={[styles.xLabels, { marginLeft: CHART_PADDING.left }]}>
        {data.length <= 10
          ? data.map((d, i) => (
              <Text key={i} style={styles.xLabel}>
                {formatDate(d.date, period)}
              </Text>
            ))
          : // Show first, middle, last for >10 points
            [0, Math.floor(data.length / 2), data.length - 1].map((idx) => (
              <Text key={idx} style={styles.xLabel}>
                {formatDate(data[idx].date, period)}
              </Text>
            ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  emptyContainer: {
    height: CHART_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: 'rgba(255,255,255,0.4)',
  },
  yLabels: {
    position: 'absolute',
    left: 0,
    top: CHART_PADDING.top,
    height: CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom,
    justifyContent: 'space-between',
  },
  yLabel: {
    fontSize: 10,
    fontFamily: 'Outfit-Regular',
    color: 'rgba(255,255,255,0.35)',
    width: 36,
    textAlign: 'right',
  },
  xLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: CHART_PADDING.right,
    marginTop: -22,
  },
  xLabel: {
    fontSize: 10,
    fontFamily: 'Outfit-Regular',
    color: 'rgba(255,255,255,0.35)',
  },
});
