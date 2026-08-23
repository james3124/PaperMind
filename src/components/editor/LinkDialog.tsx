import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';

interface Props {
  visible: boolean;
  onApply: (url: string) => void;
  onRemove: () => void;
  onDismiss: () => void;
}

export default function LinkDialog({
  visible,
  onApply,
  onRemove,
  onDismiss,
}: Props) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (visible) {
      setUrl('');
    }
  }, [visible]);

  function apply() {
    const trimmed = url.trim();
    if (!trimmed) {
      return;
    }
    const finalUrl = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    onApply(finalUrl);
    onDismiss();
  }

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
            <Text style={styles.title}>Insert Link</Text>
            <TextInput
              style={styles.input}
              value={url}
              onChangeText={setUrl}
              placeholder="https://example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              autoFocus
            />
            <View style={styles.row}>
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => {
                  onRemove();
                  onDismiss();
                }}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
              <View style={styles.flex} />
              <TouchableOpacity style={styles.cancelBtn} onPress={onDismiss}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={apply}>
                <Text style={styles.applyText}>Apply</Text>
              </TouchableOpacity>
            </View>
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
  sheet: {width: 300, backgroundColor: '#fff', borderRadius: 16, padding: 16},
  title: {fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12},
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 12,
  },
  row: {flexDirection: 'row', alignItems: 'center', gap: 8},
  flex: {flex: 1},
  removeBtn: {paddingHorizontal: 10, paddingVertical: 8},
  removeText: {fontSize: 13, color: '#dc2626', fontWeight: '600'},
  cancelBtn: {paddingHorizontal: 12, paddingVertical: 8},
  cancelText: {fontSize: 13, color: '#6b7280'},
  applyBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  applyText: {fontSize: 13, color: '#fff', fontWeight: '600'},
});
