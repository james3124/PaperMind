import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useModelDownloadStore } from '@/stores/modelDownloadStore';

function toMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

export default function ModelDownloadBanner() {
  const {
    downloading,
    downloadProgress,
    downloadedBytes,
    totalBytes,
    downloadError,
    startDownload,
    cancelDownload,
  } = useModelDownloadStore();

  if (!downloading && !downloadError) return null;

  const pct = Math.round(downloadProgress * 100);

  return (
    <View style={styles.banner}>
      {downloadError ? (
        <View style={styles.row}>
          <Text style={styles.errorText} numberOfLines={1}>
            ⚠️ Model download failed
          </Text>
          <TouchableOpacity onPress={startDownload} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.row}>
            <Text style={styles.label}>
              Downloading AI model… {pct}%
              {totalBytes > 0
                ? `  (${toMB(downloadedBytes)} / ${toMB(totalBytes)} MB)`
                : ''}
            </Text>
            <TouchableOpacity onPress={cancelDownload} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.cancel}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${pct}%` }]} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    backgroundColor: '#1e1b4b',
    paddingHorizontal: 16,
    paddingVertical:   10,
    zIndex:          9999,
    elevation:       8,
  },
  row: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:    6,
  },
  label:     { color: '#c7d2fe', fontSize: 12, flex: 1 },
  cancel:    { color: '#818cf8', fontSize: 15, paddingLeft: 12 },
  track:     { height: 3, backgroundColor: '#3730a3', borderRadius: 2, overflow: 'hidden' },
  fill:      { height: 3, backgroundColor: '#6366f1', borderRadius: 2 },
  errorText: { color: '#fca5a5', fontSize: 12, flex: 1 },
  retryBtn:  {
    marginLeft:        12,
    paddingHorizontal: 10,
    paddingVertical:    4,
    backgroundColor:  '#6366f1',
    borderRadius:      4,
  },
  retryText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
