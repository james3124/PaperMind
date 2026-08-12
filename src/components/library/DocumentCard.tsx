import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import Document, { STATUS_LABELS, STATUS_COLORS } from '@/db/models/Document';

interface Props {
  document:    Document;
  onTap:       () => void;
  onStar:      () => void;
  onDuplicate: () => void;
  onMarkFinal: () => void;
  onDelete:    () => void;
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function DocumentCard({
  document, onTap, onStar, onDuplicate, onMarkFinal, onDelete,
}: Props) {
  const statusColor = STATUS_COLORS[document.status] ?? '#9E9E9E';
  const statusLabel = STATUS_LABELS[document.status] ?? 'Draft';

  function confirmDelete() {
    Alert.alert(
      'Delete paper?',
      `Delete "${document.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]
    );
  }

  return (
    <TouchableOpacity style={styles.card} onPress={onTap} activeOpacity={0.85}>
      {/* Icon */}
      <View style={styles.icon}>
        <Text style={styles.iconText}>📄</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{document.title}</Text>
        <Text style={styles.meta}>
          {timeAgo(document.updatedAt)}
          {document.wordCount > 0 ? ` · ${document.wordCount} words` : ''}
        </Text>
      </View>

      {/* Status badge */}
      <View style={[styles.badge, { backgroundColor: `${statusColor}20` }]}>
        <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
      </View>

      {/* Star */}
      <TouchableOpacity style={styles.iconBtn} onPress={onStar}>
        <Text style={styles.starIcon}>{document.starred ? '⭐' : '☆'}</Text>
      </TouchableOpacity>

      {/* More */}
      <TouchableOpacity
        style={styles.iconBtn}
        onPress={() => {
          Alert.alert(
            document.title,
            undefined,
            [
              { text: 'Duplicate',    onPress: onDuplicate },
              { text: 'Mark as Final', onPress: onMarkFinal },
              { text: 'Delete',       onPress: confirmDelete, style: 'destructive' },
              { text: 'Cancel',       style: 'cancel' },
            ]
          );
        }}
      >
        <Text style={styles.moreIcon}>⋯</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginVertical: 4, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#f3f4f6', gap: 10 },
  icon:      { width: 40, height: 48, backgroundColor: '#eef2ff', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  iconText:  { fontSize: 22 },
  content:   { flex: 1 },
  title:     { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 3 },
  meta:      { fontSize: 12, color: '#9ca3af' },
  badge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  iconBtn:   { padding: 4 },
  starIcon:  { fontSize: 18 },
  moreIcon:  { fontSize: 20, color: '#9ca3af' },
});
