import React from 'react';
import {Pressable, Text, StyleSheet, StyleProp, ViewStyle} from 'react-native';
import {useTheme} from '@/theme/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  style,
}: Props) {
  const {palette} = useTheme();

  const bg = {
    primary: palette.accent,
    secondary: palette.surface,
    ghost: 'transparent',
    danger: palette.dangerSubtle,
  }[variant];

  const textColor = {
    primary: palette.onAccent,
    secondary: palette.text,
    ghost: palette.accent,
    danger: palette.danger,
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{disabled}}
      onPress={onPress}
      disabled={disabled}
      style={({pressed}) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        {
          backgroundColor: bg,
          borderColor: variant === 'secondary' ? palette.border : 'transparent',
        },
        style,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}>
      <Text
        style={[
          styles.label,
          size === 'lg' ? styles.labelLg : styles.labelMd,
          {color: textColor},
        ]}
        numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  md: {paddingVertical: 11, paddingHorizontal: 18, minHeight: 42},
  lg: {paddingVertical: 15, paddingHorizontal: 24, minHeight: 52},
  pressed: {transform: [{scale: 0.98}], opacity: 0.88},
  disabled: {opacity: 0.4},
  label: {fontWeight: '700'},
  labelMd: {fontSize: 14},
  labelLg: {fontSize: 16},
});
