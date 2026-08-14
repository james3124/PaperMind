import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';

export type ColorKind = 'color' | 'background';

const FONT_COLORS = [
  '#000000',
  '#374151',
  '#9ca3af',
  '#ffffff',
  '#dc2626',
  '#ea580c',
  '#d97706',
  '#ca8a04',
  '#16a34a',
  '#059669',
  '#0891b2',
  '#0284c7',
  '#2563eb',
  '#4f46e5',
  '#7c3aed',
  '#c026d3',
];

const HIGHLIGHTS = [
  '#ffffff',
  '#fef9c3',
  '#fef3c7',
  '#ffedd5',
  '#fee2e2',
  '#fce7f3',
  '#f3e8ff',
  '#ede9fe',
  '#e0e7ff',
  '#dbeafe',
  '#e0f2fe',
  '#cffafe',
  '#d1fae5',
  '#dcfce7',
  '#fef08a',
  '#fcd34d',
];

interface Props {
  visible: boolean;
  kind: ColorKind;
  onSelect: (hex: string) => void;
  onClear: () => void;
  onDismiss: () => void;
}

export default function ColorPaletteModal({
  visible,
  kind,
  onSelect,
  onClear,
  onDismiss,
}: Props) {
  const colors = kind === 'color' ? FONT_COLORS : HIGHLIGHTS;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onDismiss}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>
                {kind === 'color' ? 'Text Color' : 'Highlight Color'}
              </Text>
              <TouchableOpacity onPress={onDismiss}>
                <Text style={styles.close}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.grid}>
              {colors.map(hex => (
                <TouchableOpacity
                  key={hex}
                  style={[styles.swatch, {backgroundColor: hex}]}
                  onPress={() => {
                    onSelect(hex);
                    onDismiss();
                  }}>
                  <View style={styles.swatchBorder} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => {
                onClear();
                onDismiss();
              }}>
              <Text style={styles.clearText}>Clear formatting</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {width: 280, backgroundColor: '#fff', borderRadius: 16, padding: 16},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {fontSize: 15, fontWeight: '700', color: '#111827'},
  close: {fontSize: 16, color: '#6b7280'},
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  swatchBorder: {flex: 1, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)'},
  clearBtn: {
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  clearText: {fontSize: 13, color: '#374151', fontWeight: '600'},
});
