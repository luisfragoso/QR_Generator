import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import WebView from 'react-native-webview';

type CenterMode = 'none' | 'image' | 'text';

type DotType =
  | 'rounded'
  | 'dots'
  | 'classy'
  | 'classy-rounded'
  | 'square'
  | 'extra-rounded';

type CornerSquareType = 'square' | 'dot' | 'extra-rounded';
type CornerDotType = 'square' | 'dot';

type QrState = {
  data: string;
  size: number;
  margin: number;
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
  dotsColor: string;
  dotsType: DotType;
  cornersSquareColor: string;
  cornersSquareType: CornerSquareType;
  cornersDotColor: string;
  cornersDotType: CornerDotType;
  backgroundColor: string;
  centerMode: CenterMode;
  centerText: string;
  centerImageUri: string | null;
  centerImageDataUrl: string | null;
};

const DEFAULT_STATE: QrState = {
  data: 'https://qr.canteradigital.io/',
  size: 340,
  margin: 0,
  errorCorrectionLevel: 'Q',
  dotsColor: '#111111',
  dotsType: 'rounded',
  cornersSquareColor: '#111111',
  cornersSquareType: 'square',
  cornersDotColor: '#111111',
  cornersDotType: 'dot',
  backgroundColor: '#ffffff',
  centerMode: 'none',
  centerText: 'QR',
  centerImageUri: null,
  centerImageDataUrl: null,
};

function clampInt(value: string, fallback: number, min: number, max: number) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function isHexColor(v: string) {
  return /^#([0-9a-fA-F]{6})$/.test(v.trim());
}

function Section({
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <Pressable onPress={onToggle} style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <ThemedText type="subtitle">{title}</ThemedText>
          {subtitle ? <ThemedText style={styles.sectionSubtitle}>{subtitle}</ThemedText> : null}
        </View>
        <ThemedText style={styles.sectionChevron}>{open ? '▾' : '▸'}</ThemedText>
      </Pressable>
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

export default function HomeScreen() {
  const webviewRef = useRef<WebView>(null);
  const [form, setForm] = useState<QrState>(DEFAULT_STATE);
  const formRef = useRef<QrState>(DEFAULT_STATE);
  const [previewPngDataUrl, setPreviewPngDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [qrStylingScript, setQrStylingScript] = useState<string | null>(null);

  const [openMain, setOpenMain] = useState(true);
  const [openDots, setOpenDots] = useState(false);
  const [openCorners, setOpenCorners] = useState(false);
  const [openBackground, setOpenBackground] = useState(false);
  const [openCenter, setOpenCenter] = useState(false);

  const canUseCenterImage = form.centerMode === 'image' && !!form.centerImageDataUrl;
  const canUseCenterText = form.centerMode === 'text' && !!form.centerText.trim();

  const updateForm = useCallback((updater: (prev: QrState) => QrState) => {
    setForm((prev) => {
      const next = updater(prev);
      formRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const asset = Asset.fromModule(require('@/assets/qr/qr-code-styling.txt'));
        await asset.downloadAsync();
        const uri = asset.localUri || asset.uri;
        const content = await FileSystem.readAsStringAsync(uri);
        if (!cancelled) setQrStylingScript(content);
      } catch {
        if (!cancelled) setQrStylingScript(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
    });

    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;

    const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' as any });
    const mime = asset.mimeType || 'image/png';
    const dataUrl = `data:${mime};base64,${base64}`;

    updateForm((s) => ({
      ...s,
      centerImageUri: asset.uri,
      centerImageDataUrl: dataUrl,
      centerMode: 'image',
    }));
  }, [updateForm]);

  const webHtml = useMemo(() => {
    if (!qrStylingScript) return null;
    const safeScript = qrStylingScript.replace(/<\//g, '<\\/');
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body { margin: 0; padding: 0; background: transparent; }
      #wrap { width: 1px; height: 1px; overflow: hidden; }
    </style>
  </head>
  <body>
    <div id="wrap"></div>
    <script>${safeScript}</script>
    <script>
      let qr = null;
      function toDataUrl(blob) {
        return new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onerror = reject;
          r.onload = () => resolve(r.result);
          r.readAsDataURL(blob);
        });
      }

      async function render(payload) {
        const options = payload.options;

        if (!qr) {
          qr = new window.QRCodeStyling(options);
          qr.append(document.getElementById('wrap'));
        } else {
          qr.update(options);
        }

        const blob = await qr.getRawData('png');
        const dataUrl = await toDataUrl(blob);
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'png', dataUrl }));
      }

      function onMessage(event) {
        try {
          const payload = JSON.parse(event.data);
          if (payload && payload.type === 'render') {
            render(payload);
          }
        } catch (e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: String(e) }));
        }
      }

      document.addEventListener('message', onMessage);
      window.addEventListener('message', onMessage);
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
    </script>
  </body>
</html>`;
  }, [qrStylingScript]);

  const makeQrOptions = useCallback(
    (s: QrState) => {
      const dotsColor = isHexColor(s.dotsColor) ? s.dotsColor : '#111111';
      const cornersSquareColor = isHexColor(s.cornersSquareColor) ? s.cornersSquareColor : '#111111';
      const cornersDotColor = isHexColor(s.cornersDotColor) ? s.cornersDotColor : '#111111';
      const backgroundColor = isHexColor(s.backgroundColor) ? s.backgroundColor : '#ffffff';

      const logoDataUrl = canUseCenterImage ? s.centerImageDataUrl : null;

      return {
        width: s.size,
        height: s.size,
        data: s.data,
        margin: s.margin,
        qrOptions: {
          errorCorrectionLevel: s.errorCorrectionLevel,
        },
        dotsOptions: {
          color: dotsColor,
          type: s.dotsType,
        },
        cornersSquareOptions: {
          color: cornersSquareColor,
          type: s.cornersSquareType,
        },
        cornersDotOptions: {
          color: cornersDotColor,
          type: s.cornersDotType,
        },
        backgroundOptions: {
          color: backgroundColor,
        },
        image:
          canUseCenterImage && typeof logoDataUrl === 'string'
            ? logoDataUrl
            : undefined,
        imageOptions: {
          margin: 0,
          imageSize: 0.4,
          crossOrigin: 'anonymous',
        },
      };
    },
    [canUseCenterImage]
  );

  const apply = useCallback(() => {
    if (!qrStylingScript) return;
    setBusy(true);
    const options = makeQrOptions(formRef.current);
    webviewRef.current?.postMessage(JSON.stringify({ type: 'render', options }));
  }, [makeQrOptions, qrStylingScript]);

  const reset = useCallback(() => {
    updateForm(() => DEFAULT_STATE);
    setPreviewPngDataUrl(null);
  }, [updateForm]);

  const onWebMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg?.type === 'png' && typeof msg.dataUrl === 'string') {
        setPreviewPngDataUrl(msg.dataUrl);
        setBusy(false);
      }
      if (msg?.type === 'error') {
        setBusy(false);
      }
    } catch {
      setBusy(false);
    }
  }, []);

  const centerOverlayText = useMemo(() => {
    if (!canUseCenterText) return null;
    const t = form.centerText.trim().slice(0, 4);
    return t;
  }, [canUseCenterText, form.centerText]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.headerTitle}>
          Generador de QR
        </ThemedText>
        <ThemedText style={styles.headerSubtitle}>Genera códigos QR estilizados (app local)</ThemedText>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Section
          title="Main Options"
          subtitle="data"
          open={openMain}
          onToggle={() => setOpenMain((v) => !v)}>
          <ThemedText style={styles.label}>Data</ThemedText>
          <TextInput
            value={form.data}
            onChangeText={(t) => updateForm((s) => ({ ...s, data: t }))}
            placeholder="Texto, URL, WiFi, etc"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />

          <View style={styles.grid2}>
            <View style={styles.gridItem}>
              <ThemedText style={styles.label}>Width</ThemedText>
              <TextInput
                value={String(form.size)}
                onChangeText={(t) =>
                  updateForm((s) => ({ ...s, size: clampInt(t, s.size, 128, 1024) }))
                }
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
            <View style={styles.gridItem}>
              <ThemedText style={styles.label}>Height</ThemedText>
              <TextInput value={String(form.size)} editable={false} style={[styles.input, styles.inputDisabled]} />
            </View>
          </View>

          <View style={styles.grid2}>
            <View style={styles.gridItem}>
              <ThemedText style={styles.label}>Margin</ThemedText>
              <TextInput
                value={String(form.margin)}
                onChangeText={(t) =>
                  updateForm((s) => ({ ...s, margin: clampInt(t, s.margin, 0, 80) }))
                }
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
            <View style={styles.gridItem}>
              <ThemedText style={styles.label}>Error correction</ThemedText>
              <View style={styles.row}>
                {(['L', 'M', 'Q', 'H'] as const).map((lvl) => (
                  <Pressable
                    key={lvl}
                    onPress={() => updateForm((s) => ({ ...s, errorCorrectionLevel: lvl }))}
                    style={[styles.chip, form.errorCorrectionLevel === lvl && styles.chipActive]}>
                    <ThemedText type="defaultSemiBold">{lvl}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </Section>

        <Section
          title="Dots Options"
          subtitle="color + tipo"
          open={openDots}
          onToggle={() => setOpenDots((v) => !v)}>
          <ThemedText style={styles.label}>Color</ThemedText>
          <TextInput
            value={form.dotsColor}
            onChangeText={(t) => updateForm((s) => ({ ...s, dotsColor: t }))}
            placeholder="#111111"
            autoCapitalize="none"
            style={styles.input}
          />
          <ThemedText style={styles.label}>Type</ThemedText>
          <View style={styles.row}>
            {(
              ['rounded', 'dots', 'classy', 'classy-rounded', 'square', 'extra-rounded'] as const
            ).map((t) => (
              <Pressable
                key={t}
                onPress={() => updateForm((s) => ({ ...s, dotsType: t }))}
                style={[styles.chip, form.dotsType === t && styles.chipActive]}>
                <ThemedText type="defaultSemiBold">{t}</ThemedText>
              </Pressable>
            ))}
          </View>
        </Section>

        <Section
          title="Corners Options"
          subtitle="square + dot"
          open={openCorners}
          onToggle={() => setOpenCorners((v) => !v)}>
          <ThemedText style={styles.label}>Corner square color</ThemedText>
          <TextInput
            value={form.cornersSquareColor}
            onChangeText={(t) => updateForm((s) => ({ ...s, cornersSquareColor: t }))}
            placeholder="#111111"
            autoCapitalize="none"
            style={styles.input}
          />
          <ThemedText style={styles.label}>Corner square type</ThemedText>
          <View style={styles.row}>
            {(['square', 'dot', 'extra-rounded'] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => updateForm((s) => ({ ...s, cornersSquareType: t }))}
                style={[styles.chip, form.cornersSquareType === t && styles.chipActive]}>
                <ThemedText type="defaultSemiBold">{t}</ThemedText>
              </Pressable>
            ))}
          </View>

          <ThemedText style={styles.label}>Corner dot color</ThemedText>
          <TextInput
            value={form.cornersDotColor}
            onChangeText={(t) => updateForm((s) => ({ ...s, cornersDotColor: t }))}
            placeholder="#111111"
            autoCapitalize="none"
            style={styles.input}
          />
          <ThemedText style={styles.label}>Corner dot type</ThemedText>
          <View style={styles.row}>
            {(['dot', 'square'] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => updateForm((s) => ({ ...s, cornersDotType: t }))}
                style={[styles.chip, form.cornersDotType === t && styles.chipActive]}>
                <ThemedText type="defaultSemiBold">{t}</ThemedText>
              </Pressable>
            ))}
          </View>
        </Section>

        <Section
          title="Background Options"
          subtitle="fondo"
          open={openBackground}
          onToggle={() => setOpenBackground((v) => !v)}>
          <ThemedText style={styles.label}>Background</ThemedText>
          <TextInput
            value={form.backgroundColor}
            onChangeText={(t) => updateForm((s) => ({ ...s, backgroundColor: t }))}
            placeholder="#ffffff"
            autoCapitalize="none"
            style={styles.input}
          />
        </Section>

        <Section
          title="Center"
          subtitle="imagen o texto"
          open={openCenter}
          onToggle={() => setOpenCenter((v) => !v)}>
          <View style={styles.row}>
            <Pressable
              onPress={() => updateForm((s) => ({ ...s, centerMode: 'none' }))}
              style={[styles.chip, form.centerMode === 'none' && styles.chipActive]}>
              <ThemedText type="defaultSemiBold">Ninguno</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => updateForm((s) => ({ ...s, centerMode: 'image' }))}
              style={[styles.chip, form.centerMode === 'image' && styles.chipActive]}>
              <ThemedText type="defaultSemiBold">Imagen</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => updateForm((s) => ({ ...s, centerMode: 'text' }))}
              style={[styles.chip, form.centerMode === 'text' && styles.chipActive]}>
              <ThemedText type="defaultSemiBold">Texto</ThemedText>
            </Pressable>
          </View>

          {form.centerMode === 'image' ? (
            <View style={styles.row}>
              <Pressable onPress={pickImage} style={styles.button}>
                <ThemedText type="defaultSemiBold">Elegir imagen</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => updateForm((s) => ({ ...s, centerImageUri: null, centerImageDataUrl: null }))}
                style={[styles.button, styles.buttonSecondary]}>
                <ThemedText type="defaultSemiBold">Quitar</ThemedText>
              </Pressable>
            </View>
          ) : null}

          {form.centerMode === 'text' ? (
            <TextInput
              value={form.centerText}
              onChangeText={(t) => updateForm((s) => ({ ...s, centerText: t }))}
              placeholder="Texto al centro"
              autoCapitalize="characters"
              style={styles.input}
            />
          ) : null}
        </Section>

        <View style={styles.actionsRow}>
          <Pressable onPress={apply} style={[styles.actionButton, styles.actionPrimary]} disabled={busy || !qrStylingScript}>
            <ThemedText type="defaultSemiBold" style={styles.actionPrimaryText}>
              {busy ? 'Aplicando…' : qrStylingScript ? 'Aplicar' : 'Cargando…'}
            </ThemedText>
          </Pressable>
          <Pressable onPress={reset} style={[styles.actionButton, styles.actionSecondary]} disabled={busy}>
            <ThemedText type="defaultSemiBold">Reset</ThemedText>
          </Pressable>
        </View>

        <View style={styles.previewCard}>
          <View style={styles.previewInner}>
            {previewPngDataUrl ? (
              <View style={styles.previewImageWrap}>
                <Image source={{ uri: previewPngDataUrl }} style={[styles.previewImage, { width: form.size, height: form.size }]} />
                {centerOverlayText ? (
                  <View pointerEvents="none" style={styles.centerTextOverlay}>
                    <ThemedText type="defaultSemiBold" style={styles.centerTextOverlayText}>
                      {centerOverlayText}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            ) : (
              <ThemedText>Presiona "Aplicar" para generar el preview.</ThemedText>
            )}
          </View>
        </View>
      </ScrollView>

      {webHtml ? (
        <WebView
          ref={webviewRef}
          source={{ html: webHtml }}
          onMessage={onWebMessage}
          javaScriptEnabled
          originWhitelist={['*']}
          style={styles.hiddenWebview}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F5F6',
  },
  header: {
    backgroundColor: '#6b1f4b',
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  headerTitle: {
    color: '#FFFFFF',
  },
  headerSubtitle: {
    color: '#FFFFFF',
    opacity: 0.9,
    marginTop: 4,
  },
  container: {
    padding: 14,
    gap: 12,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6E6E8',
    overflow: 'hidden',
  },
  sectionHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionSubtitle: {
    opacity: 0.7,
  },
  sectionChevron: {
    fontSize: 18,
    opacity: 0.8,
  },
  sectionBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },
  label: {
    opacity: 0.75,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D0D0D0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  inputDisabled: {
    opacity: 0.55,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  grid2: {
    flexDirection: 'row',
    gap: 12,
  },
  gridItem: {
    flex: 1,
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    borderColor: '#111111',
  },
  button: {
    borderWidth: 1,
    borderColor: '#111111',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  buttonSecondary: {
    borderColor: '#D0D0D0',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  actionPrimary: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  actionPrimaryText: {
    color: '#FFFFFF',
  },
  actionSecondary: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D0D0D0',
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6E6E8',
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewInner: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  previewImageWrap: {
    position: 'relative',
  },
  previewImage: {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  centerTextOverlay: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 76,
    height: 76,
    marginLeft: -38,
    marginTop: -38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerTextOverlayText: {
    fontSize: 18,
    color: '#111111',
  },
  hiddenWebview: {
    width: 1,
    height: 1,
    opacity: 0,
    position: 'absolute',
    left: -10,
    bottom: -10,
  },
});
