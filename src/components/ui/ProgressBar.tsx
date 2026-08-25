import React, {useEffect, useRef} from 'react';
import {Animated, StyleSheet, View, StyleProp, ViewStyle} from 'react-native';
import {useTheme} from '@/theme/theme';

interface Props {
  /** 0–1 */
  progress: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export default function ProgressBar({progress, height = 6, style}: Props) {
  const {palette} = useTheme();
  const clamped = Math.min(1, Math.max(0, progress));
  const anim = useRef(new Animated.Value(clamped));

  useEffect(() => {
    Animated.timing(anim.current, {
      toValue: clamped,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [clamped]);

  const width = anim.current.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View
      style={[
        styles.track,
        {height, backgroundColor: palette.surfaceAlt},
        style,
      ]}>
      <Animated.View
        style={[styles.fill, {width}, {backgroundColor: palette.accent}]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});
