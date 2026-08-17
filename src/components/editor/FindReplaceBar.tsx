import React, {useState} from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';

interface Props {
  onFindReplace: (find: string, replace: string) => void;
  onClose: () => void;
  lastCount?: number;
}

export default function FindReplaceBar({
  onFindReplace,
  onClose,
  lastCount,
}: Props) {
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [showReplace, setShowReplace] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={find}
          onChangeText={setFind}
          placeholder="Find"
          autoFocus
        />
        {lastCount !== undefined && (
          <Text style={styles.count}>{lastCount} found</Text>
        )}
        <TouchableOpacity onPress={() => setShowReplace(v => !v)}>
          <Text style={styles.icon}>⇄</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.icon}>✕</Text>
        </TouchableOpacity>
      </View>
      {showReplace && (
        <View style={styles.row}>
          <TextInput
            style={styles.input}
            value={replace}
            onChangeText={setReplace}
            placeholder="Replace with"
          />
          <TouchableOpacity
            style={styles.replaceBtn}
            onPress={() => onFindReplace(find, replace)}>
            <Text style={styles.replaceBtnText}>Replace All</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    padding: 8,
  },
  row: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4},
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff',
    fontSize: 14,
  },
  count: {fontSize: 12, color: '#6b7280', minWidth: 60},
  icon: {fontSize: 18, color: '#6b7280', paddingHorizontal: 4},
  replaceBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  replaceBtnText: {color: '#fff', fontWeight: '600', fontSize: 13},
});
