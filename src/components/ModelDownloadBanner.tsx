import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useModelDownloadStore} from '@/stores/modelDownloadStore';
import {useTheme} from '@/theme/theme';

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
  const {palette} = useTheme();
  const insets = useSafeAreaInsets();

  if (!downloading && !downloadError) {
    return null;
  }

  const pct = Math.round(downloadProgress * 100);

  return (
    <View style={[styles.wrapper, {bottom: insets.bottom + 8}]}>
      <View
        style={[
          styles.banner,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
          },
        ]}>
        {downloadError ? (
          <View style={styles.row}>
            <Ionicons name="alert-circle" size={15} color={palette.danger} />
            <Text
              style={[styles.errorText, {color: palette.danger}]}
              numberOfLines={1}>
              Model download failed
            </Text>
            <TouchableOpacity
              onPress={startDownload}
              style={[styles.retryBtn, {backgroundColor: palette.accent}]}>
              <Text style={[styles.retryText, {color: palette.onAccent}]}>
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.row}>
              <Text style={[styles.label, {color: palette.textSoft}]}>
                Downloading AI model · {pct}%
                {totalBytes > 0
                  ? `  (${toMB(downloadedBytes)} / ${toMB(totalBytes)} MB)`
                  : ''}
              </Text>
              <TouchableOpacity
                onPress={cancelDownload}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                <Ionicons name="close" size={16} color={palette.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={[styles.track, {backgroundColor: palette.surfaceAlt}]}>
              <View
                style={[
                  styles.fill,
                  {width: `${pct}%`, backgroundColor: palette.accent},
                ]}
              />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  banner: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 11,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: {width: 0, height: 5},
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 7,
  },
  label: {
    fontSize: 12,
    flex: 1,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    borderRadius: 2,
  },
  errorText: {fontSize: 12, flex: 1},
  retryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  retryText: {fontSize: 12, fontWeight: '600'},
});
