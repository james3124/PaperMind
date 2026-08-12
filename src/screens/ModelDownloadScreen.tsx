import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import RNFS from 'react-native-fs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { MODEL_URL, MODEL_PATH, ensureModelDir } from '@/utils/modelPaths';
import { initModel } from '@/services/llamaService';
import { useSettingsStore } from '@/stores/settingsStore';

type Props = NativeStackScreenProps<RootStackParamList, 'ModelDownload'>;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ModelDownloadScreen({ navigation }: Props) {
  const setModelLoaded = useSettingsStore((s) => s.setModelLoaded);

  const [status,      setStatus]      = useState<'idle' | 'downloading' | 'loading' | 'done' | 'error'>('idle');
  const [progress,    setProgress]    = useState(0);        // 0–1
  const [downloaded,  setDownloaded]  = useState(0);
  const [total,       setTotal]       = useState(0);
  const [errorMsg,    setErrorMsg]    = useState('');

  let downloadJob: { jobId: number } | null = null;

  async function startDownload() {
    setStatus('downloading');
    setProgress(0);

    try {
      await ensureModelDir();

      // Delete partial file if exists
      const exists = await RNFS.exists(MODEL_PATH);
      if (exists) await RNFS.unlink(MODEL_PATH);

      const job = RNFS.downloadFile({
        fromUrl:         MODEL_URL,
        toFile:          MODEL_PATH,
        background:      false,
        discretionary:   false,
        progress: (res) => {
          const p = res.bytesWritten / res.contentLength;
          setProgress(p);
          setDownloaded(res.bytesWritten);
          setTotal(res.contentLength);
        },
      });

      downloadJob = job;
      const result = await job.promise;

      if (result.statusCode !== 200) {
        throw new Error(`Download failed with status ${result.statusCode}`);
      }

      // Load model
      setStatus('loading');
      await initModel(MODEL_PATH);
      setModelLoaded(true);
      setStatus('done');

      navigation.replace('Library');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMsg(msg);
      setStatus('error');
    }
  }

  function cancelDownload() {
    if (downloadJob) {
      RNFS.stopDownload(downloadJob.jobId);
    }
    setStatus('idle');
    setProgress(0);
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <Text style={styles.title}>PaperMind</Text>
      <Text style={styles.subtitle}>AI-powered academic paper editor</Text>

      {/* Model info card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Local AI Model Required</Text>
        <Text style={styles.cardBody}>
          PaperMind uses an on-device AI model to generate and edit papers — no internet or API key needed after download.
        </Text>
        <View style={styles.modelInfo}>
          <Text style={styles.modelInfoRow}>📦 <Text style={styles.bold}>Model:</Text> Qwen2.5-0.5B-Instruct</Text>
          <Text style={styles.modelInfoRow}>💾 <Text style={styles.bold}>Size:</Text> ~676 MB</Text>
          <Text style={styles.modelInfoRow}>🌐 <Text style={styles.bold}>Source:</Text> HuggingFace</Text>
          <Text style={styles.modelInfoRow}>🔒 <Text style={styles.bold}>After download:</Text> Fully offline</Text>
        </View>
      </View>

      {/* Progress */}
      {(status === 'downloading' || status === 'loading') && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          {status === 'downloading' && (
            <Text style={styles.progressText}>
              {formatBytes(downloaded)} / {total > 0 ? formatBytes(total) : '676 MB'} ({Math.round(progress * 100)}%)
            </Text>
          )}
          {status === 'loading' && (
            <Text style={styles.progressText}>Loading model into memory…</Text>
          )}
        </View>
      )}

      {/* Error */}
      {status === 'error' && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Download failed: {errorMsg}</Text>
          <Text style={styles.errorHint}>Check your internet connection and try again.</Text>
        </View>
      )}

      {/* Actions */}
      {(status === 'idle' || status === 'error') && (
        <TouchableOpacity style={styles.downloadBtn} onPress={startDownload}>
          <Text style={styles.downloadBtnText}>
            {status === 'error' ? 'Retry Download' : 'Download Model (676 MB)'}
          </Text>
        </TouchableOpacity>
      )}

      {status === 'downloading' && (
        <TouchableOpacity style={styles.cancelBtn} onPress={cancelDownload}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: '#fff', padding: 24, justifyContent: 'center' },
  title:             { fontSize: 32, fontWeight: '800', color: '#6366f1', textAlign: 'center', marginBottom: 6 },
  subtitle:          { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 32 },
  card:              { backgroundColor: '#f9fafb', borderRadius: 16, padding: 20, marginBottom: 28, borderWidth: 1, borderColor: '#e5e7eb' },
  cardTitle:         { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 10 },
  cardBody:          { fontSize: 14, color: '#6b7280', lineHeight: 20, marginBottom: 16 },
  modelInfo:         { gap: 6 },
  modelInfoRow:      { fontSize: 14, color: '#374151' },
  bold:              { fontWeight: '600' },
  progressContainer: { marginBottom: 20 },
  progressBar:       { height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill:      { height: '100%', backgroundColor: '#6366f1', borderRadius: 4 },
  progressText:      { fontSize: 13, color: '#6b7280', textAlign: 'center' },
  errorBox:          { backgroundColor: '#fef2f2', borderRadius: 10, padding: 14, marginBottom: 16 },
  errorText:         { fontSize: 13, color: '#dc2626', marginBottom: 4 },
  errorHint:         { fontSize: 12, color: '#9ca3af' },
  downloadBtn:       { backgroundColor: '#6366f1', padding: 18, borderRadius: 14, alignItems: 'center' },
  downloadBtnText:   { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn:         { marginTop: 12, padding: 14, alignItems: 'center' },
  cancelBtnText:     { color: '#6b7280', fontWeight: '600', fontSize: 15 },
});