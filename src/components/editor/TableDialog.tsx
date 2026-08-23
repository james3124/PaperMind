import React, {useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Modal} from 'react-native';

interface Props {
  visible: boolean;
  onInsert: (rows: number, cols: number) => void;
  onDismiss: () => void;
}

const MAX = 6;

export default function TableDialog({visible, onInsert, onDismiss}: Props) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);

  function Stepper({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
  }) {
    return (
      <View style={styles.stepperRow}>
        <Text style={styles.stepperLabel}>{label}</Text>
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() => onChange(Math.max(1, value - 1))}>
          <Text style={styles.stepText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{value}</Text>
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() => onChange(Math.min(MAX, value + 1))}>
          <Text style={styles.stepText}>+</Text>
        </TouchableOpacity>
      </View>
    );
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
            <Text style={styles.title}>Insert Table</Text>
            <View style={styles.steppers}>
              <Stepper label="Rows" value={rows} onChange={setRows} />
              <Stepper label="Columns" value={cols} onChange={setCols} />
            </View>
            <View style={styles.row}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onDismiss}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <View style={styles.flex} />
              <TouchableOpacity
                style={styles.insertBtn}
                onPress={() => {
                  onInsert(rows, cols);
                  onDismiss();
                }}>
                <Text style={styles.insertText}>
                  Insert {rows}×{cols}
                </Text>
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
  title: {fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 16},
  steppers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  stepperRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  stepperLabel: {fontSize: 13, color: '#6b7280', width: 60},
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepText: {fontSize: 18, color: '#374151', lineHeight: 20},
  stepperValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    minWidth: 20,
    textAlign: 'center',
  },
  row: {flexDirection: 'row', alignItems: 'center'},
  flex: {flex: 1},
  cancelBtn: {paddingHorizontal: 12, paddingVertical: 8},
  cancelText: {fontSize: 13, color: '#6b7280'},
  insertBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  insertText: {fontSize: 13, color: '#fff', fontWeight: '600'},
});
