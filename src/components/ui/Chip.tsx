import React from 'react';
import {Pressable, Text, StyleSheet, StyleProp, ViewStyle} from 'react-native';
import {useTheme} from '@/theme/theme';

interface Props {
  label: string;
  sublabel?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function Chip({
  label,
  sublabel,
  selected,
  onPress,
  disabled = false,
  style,
}: Props) {
  const {palette} = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{selected, disabled}}
      onPress={onPress}
      disabled={disabled}
      style={({pressed}) => [
        styles.chip,
        {
          backgroundColor: selected ? palette.accentSubtle : palette.surfaceAlt,
          borderColor: selected ? palette.accent : palette.border,
        },
        pressed && styles.pressed,
        style,
      ]}>
      <Text
        style={[
          styles.label,
          {color: selected ? palette.accent : palette.textSoft},
          selected && styles.labelSelected,
        ]}>
        {label}
      </Text>
      {sublabel ? (
        <Text
          style={[
            styles.sublabel,
            {color: selected ? palette.accent : palette.textMuted},
            selected && styles.labelSelected,
          ]}>
          {sublabel}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
  },
  pressed: {opacity: 0.75},
  label: {fontSize: 13, fontWeight: '500'},
  labelSelected: {fontWeight: '600'},
  sublabel: {fontSize: 10, marginTop: 1},
});
