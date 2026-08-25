import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import RNFS from 'react-native-fs';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '@/navigation/AppNavigator';
import {MODEL_URL, getModelPath, ensureModelDir} from '@/utils/modelPaths';
import {initModel} from '@/services/llamaService';
import {useTheme} from '@/theme/theme';
import Button from '@/components/ui/Button';
import ProgressBar from '@/components/ui/ProgressBar';

type Props = NativeStackScreenProps<RootStackParamList, 'ModelDownload'>;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const FACTS = [
  {
    icon: 'hardware-chip-outline',
    label: 'Model',
    value: 'Qwen2.5-0.5B-Instruct',
  },
  {icon: 'download-outline', label: 'Size', value: '~676 MB'},
  {icon: 'globe-outline', label: 'Source', value: 'HuggingFace'},
  {
    icon: 'lock-closed-outline',
    label: 'After download',
    value: 'Fully offline',
  },
] as const;

export default function ModelDownloadScreen({navigation}: Props) {
  const [status, setStatus] = useState<
    'idle' | 'downloading' | 'loading' | 'done' | 'error'
  >('idle');
  const [progress, setProgress] = useState(0); // 0–1
  const [downloaded, setDownloaded] = useState(0);
  const [total, setTotal] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const {palette} = useTheme();
  const insets = useSafeAreaInsets();
  const {height} = useWindowDimensions();

  let downloadJob: {jobId: number} | null = null;

  async function startDownload() {
    setStatus('downloading');
    setProgress(0);

    try {
      await ensureModelDir();

      // Delete partial file if exists
      const exists = await RNFS.exists(getModelPath());
      if (exists) {
        await RNFS.unlink(getModelPath());
      }

      const job = RNFS.downloadFile({
        fromUrl: MODEL_URL,
        toFile: getModelPath(),
        background: false,
        discretionary: false,
        progress: res => {
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
      await initModel(getModelPath());
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
    <View
      style={[
        styles.container,
        {backgroundColor: palette.bg, paddingTop: insets.top + 24},
      ]}>
      {/* Header */}
      <Text style={[styles.title, {color: palette.text}]}>
        Paper<Text style={{color: palette.accent}}>Mind</Text>
      </Text>
      <Text style={[styles.subtitle, {color: palette.textSoft}]}>
        One download and your phone writes papers — no internet or API key
        needed after this.
      </Text>

      {/* Facts */}
      <View
        style={[
          styles.factsCard,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
          },
        ]}>
        {FACTS.map((f, i) => (
          <View
            key={f.label}
            style={[
              styles.factRow,
              i < FACTS.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: palette.border,
              },
            ]}>
            <View
              style={[
                styles.factIconWrap,
                {backgroundColor: palette.accentSubtle},
              ]}>
              <Ionicons name={f.icon} size={17} color={palette.accent} />
            </View>
            <Text style={[styles.factLabel, {color: palette.textMuted}]}>
              {f.label}
            </Text>
            <Text
              style={[styles.factValue, {color: palette.text}]}
              numberOfLines={1}>
              {f.value}
            </Text>
          </View>
        ))}
      </View>

      {/* Progress */}
      {(status === 'downloading' || status === 'loading') && (
        <View style={styles.progressContainer}>
          <ProgressBar progress={progress} height={8} />
          {status === 'downloading' && (
            <Text style={[styles.progressText, {color: palette.textSoft}]}>
              {formatBytes(downloaded)} /{' '}
              {total > 0 ? formatBytes(total) : '676 MB'} ·{' '}
              {Math.round(progress * 100)}%
            </Text>
          )}
          {status === 'loading' && (
            <Text style={[styles.progressText, {color: palette.textSoft}]}>
              Loading model into memory…
            </Text>
          )}
        </View>
      )}

      {/* Error */}
      {status === 'error' && (
        <View
          style={[styles.errorBox, {backgroundColor: palette.dangerSubtle}]}>
          <Ionicons name="alert-circle" size={16} color={palette.danger} />
          <Text style={[styles.errorText, {color: palette.danger}]}>
            Download failed: {errorMsg}
          </Text>
        </View>
      )}

      {/* Actions */}
      {(status === 'idle' || status === 'error') && (
        <Button
          label={
            status === 'error' ? 'Retry download' : 'Download model (676 MB)'
          }
          onPress={startDownload}
        />
      )}

      {status === 'downloading' && (
        <TouchableOpacity onPress={cancelDownload} style={styles.cancelBtn}>
          <Text style={[styles.cancelBtnText, {color: palette.textMuted}]}>
            Cancel
          </Text>
        </TouchableOpacity>
      )}

      <Text
        style={[
          styles.footerNote,
          {color: palette.textMuted, marginTop: Math.min(height * 0.06, 48)},
        ]}>
        Your papers never leave your device.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 34,
    fontWeight: '300',
    letterSpacing: -0.8,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 12,
  },
  factsCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 12,
  },
  factIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  factLabel: {
    fontSize: 13,
    width: 110,
  },
  factValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  progressContainer: {marginBottom: 20},
  progressText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    fontVariant: ['tabular-nums'],
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 12,
    padding: 13,
    marginBottom: 16,
  },
  errorText: {fontSize: 13, lineHeight: 18, flex: 1},
  cancelBtn: {marginTop: 12, padding: 14, alignItems: 'center'},
  cancelBtnText: {fontWeight: '600', fontSize: 15},
  footerNote: {fontSize: 12, textAlign: 'center'},
});
