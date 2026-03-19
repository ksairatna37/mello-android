import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

type Props = {
  size?: number;
  color?: string;
};

export default function TranscriptIcon({ size = 25, color = '#9999a8' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Rounded speech bubble with tail */}
      <Path
        d="M3 5.5C3 4.12 4.12 3 5.5 3h13C19.88 3 21 4.12 21 5.5v9c0 1.38-1.12 2.5-2.5 2.5H9.5l-3.6 3.3c-.44.4-1.12.1-1.12-.5V17H5.5C4.12 17 3 15.88 3 14.5v-9Z"
        fill={color}
      />
      {/* Left quote mark: circle + comma tail */}
      <Circle cx="8.5" cy="8.5" r="1.6" fill="white" />
      <Path
        d="M9.6 9.6c-.15 1.3-1 2.3-2.1 2.8l-.5-.85c.8-.4 1.35-1.1 1.5-1.95H9.6Z"
        fill="white"
      />
      {/* Right quote mark: circle + comma tail */}
      <Circle cx="14.5" cy="8.5" r="1.6" fill="white" />
      <Path
        d="M15.6 9.6c-.15 1.3-1 2.3-2.1 2.8l-.5-.85c.8-.4 1.35-1.1 1.5-1.95H15.6Z"
        fill="white"
      />
    </Svg>
  );
}
