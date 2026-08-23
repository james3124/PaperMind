import React, {useState} from 'react';
import {
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  Modal,
  FlatList,
} from 'react-native';
import {EDITOR_FONTS, DEFAULT_FONT_KEY, fontLabelFor} from './fonts';

const STYLES = [
  {label: 'Normal', key: 'header', value: false},
  {label: 'Heading 1', key: 'header', value: 1},
  {label: 'Heading 2', key: 'header', value: 2},
  {label: 'Heading 3', key: 'header', value: 3},
  {label: 'Quote', key: 'blockquote', value: true},
] as const;

interface Props {
  onStyle: (key: string, value: unknown) => void;
  fontSize?: number;
  onFontSizeChange?: (size: number) => void;
  font?: string;
  onFontChange?: (key: string) => void;
}

const SIZES = [14, 16, 18, 20];

export default function StyleBar({
  onStyle,
  fontSize,
  onFontSizeChange,
  font,
  onFontChange,
}: Props) {
  const [fontModalVisible, setFontModalVisible] = useState(false);

  const step = (dir: -1 | 1) => {
    if (!onFontSizeChange || fontSize === undefined) {
      return;
    }
    const idx = SIZES.indexOf(fontSize);
    const current = idx === -1 ? SIZES.indexOf(16) : idx;
    const next = Math.min(SIZES.length - 1, Math.max(0, current + dir));
    onFontSizeChange(SIZES[next]);
  };

  const selectFont = (key: string) => {
    setFontModalVisible(false);
    onFontChange?.(key);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        {onFontChange && (
          <TouchableOpacity
            style={styles.pill}
            onPress={() => setFontModalVisible(true)}>
            <Text style={styles.pillText}>Aa · {fontLabelFor(font)}</Text>
          </TouchableOpacity>
        )}
        {STYLES.map(s => (
          <TouchableOpacity
            key={s.label}
            style={styles.pill}
            onPress={() => onStyle(s.key, s.value)}>
            <Text style={styles.pillText}>{s.label}</Text>
          </TouchableOpacity>
        ))}
        {onFontSizeChange && fontSize !== undefined && (
          <>
            <TouchableOpacity
              style={styles.pill}
              disabled={fontSize <= SIZES[0]}
              onPress={() => step(-1)}>
              <Text style={styles.pillText}>A−</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.pill}
              disabled={fontSize >= SIZES[SIZES.length - 1]}
              onPress={() => step(1)}>
              <Text style={styles.pillText}>A+</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <Modal
        visible={fontModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFontModalVisible(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFontModalVisible(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Font</Text>
            <FlatList
              data={EDITOR_FONTS}
              keyExtractor={item => item.key}
              renderItem={({item}) => {
                const selected = (font ?? DEFAULT_FONT_KEY) === item.key;
                return (
                  <TouchableOpacity
                    style={styles.fontRow}
                    onPress={() => selectFont(item.key)}>
                    <View style={styles.fontInfo}>
                      <Text style={styles.fontName}>{item.label}</Text>
                      <Text style={styles.fontStack} numberOfLines={1}>
                        {item.stack}
                      </Text>
                    </View>
                    {selected && <Text style={styles.check}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  row: {alignItems: 'center', paddingHorizontal: 12, gap: 8},
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: '#e5e7eb',
    borderRadius: 20,
  },
  pillText: {fontSize: 13, color: '#374151', fontWeight: '500'},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: 420,
    paddingVertical: 8,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  fontRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  fontInfo: {flex: 1, marginRight: 8},
  fontName: {fontSize: 15, color: '#111827'},
  fontStack: {fontSize: 11, color: '#9ca3af', marginTop: 2},
  check: {fontSize: 16, color: '#6366f1', fontWeight: '700'},
});
