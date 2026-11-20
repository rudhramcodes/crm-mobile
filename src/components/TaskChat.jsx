import { useState } from 'react';
import { Modal, ScrollView, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { useSelector } from 'react-redux';
import { GestureDetector, GestureHandlerRootView, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, CornerUpLeft, FileText, ImagePlus, Paperclip, Trash2, X } from 'lucide-react-native';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Card } from './Card';
import { ConfirmDialog } from './ConfirmDialog';
import { Input } from './Input';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { showToast } from './Toast';
import { useAddTaskCommentMutation, useDeleteTaskCommentMutation } from '@/services/taskApi';
import { useGetUsersQuery } from '@/services/userApi';
import { API_BASE_URL } from '@/constants';
import { useTheme } from '@/constants/theme';
import { isAdmin, runAction } from '@/utils/attendance';
import { getTimeAgo } from '@/utils/formatters';
import { idOf, plainMentions } from '@/utils/tasks';

const MAX_FILES = 5;
const MAX_BYTES = 10 * 1024 * 1024;
// Local-dev uploads come back as "/uploads/…" on the API host.
const fileUrl = (u = '') => (u.startsWith('/') ? API_BASE_URL.replace(/\/api\/?$/, '') + u : u);
const isImage = (f) => f.mime?.startsWith('image/');
const sizeLabel = (b) => (!b ? '' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const openFile = (f) => WebBrowser.openBrowserAsync(fileUrl(f.url)).catch(() => showToast({ title: "Couldn't open the file" }));
const preview = (c) => (c.text ? plainMentions(c.text) : `📎 ${c.files?.length === 1 ? c.files[0].name : `${c.files?.length || 0} files`}`);

// Every photo and file posted in the task chat, newest first.
export const taskFiles = (task) => (task.comments || []).flatMap((c) => c.files || []).reverse();

function PdfChip({ file, onPress, onRemove }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityLabel={`Open ${file.name}`} className="h-14 max-w-[220px] flex-row items-center gap-2 rounded-2xl bg-surface-2 px-3">
      <FileText size={20} color={theme['accent-ink']} />
      <View className="shrink">
        <Text numberOfLines={1} className="font-body-medium text-sm">{file.name}</Text>
        {!!file.size && <Text className="text-xs text-muted tabular-nums">{sizeLabel(file.size)}</Text>}
      </View>
      {onRemove && (
        <Pressable onPress={onRemove} hitSlop={10} accessibilityLabel={`Remove ${file.name}`}><X size={16} color={theme.muted} /></Pressable>
      )}
    </Pressable>
  );
}

const MAX_ZOOM = 5;
const TAP_ZOOM = 2.5;

// One photo in the viewer. Pinch zooms around your fingers, drag moves it while zoomed (never past its edges),
// double-tap zooms into the spot you tapped and back out. Gestures sit on a fixed frame; only the photo inside moves.
function ZoomImage({ uri, width: W, height: H, onZoom }) {
  const s = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const pinchStart = useSharedValue({ s: 1, x: 0, y: 0, fx: 0, fy: 0 });
  const panStart = useSharedValue({ x: 0, y: 0 });
  const pinching = useSharedValue(false);
  const fit = useSharedValue({ w: W, h: H }); // the photo's on-screen size at 1x (contain)
  const [zoomed, setZoomed] = useState(false);
  const report = (z) => { setZoomed(z); onZoom(z); };

  // How far the photo may move at a scale before an edge would come away from the screen edge.
  const limits = (scale) => {
    'worklet';
    return { mx: Math.max(0, (fit.value.w * scale - W) / 2), my: Math.max(0, (fit.value.h * scale - H) / 2) };
  };
  const clamp = (v, max) => {
    'worklet';
    return Math.min(max, Math.max(-max, v));
  };
  // Animate to a resting state that is always valid: between 1x and MAX_ZOOM, edges inside the screen.
  const settle = (scale, tx, ty) => {
    'worklet';
    const sc = scale < 1.05 ? 1 : Math.min(scale, MAX_ZOOM);
    const { mx, my } = limits(sc);
    s.value = withTiming(sc);
    x.value = withTiming(clamp(tx, mx));
    y.value = withTiming(clamp(ty, my));
    scheduleOnRN(report, sc > 1);
  };

  const pinch = usePinchGesture({
    onActivate: (e) => {
      pinching.value = true;
      scheduleOnRN(report, true); // stop the photo-to-photo swipe while two fingers are down

      pinchStart.value = { s: s.value, x: x.value, y: y.value, fx: e.focalX - W / 2, fy: e.focalY - H / 2 };
    },
    onUpdate: (e) => {
      // Keep the point that was under the fingers under the fingers (they can also move the photo while pinching).
      const st = pinchStart.value;
      const sc = Math.min(MAX_ZOOM, Math.max(0.8, st.s * e.scale));
      s.value = sc;
      x.value = e.focalX - W / 2 - ((st.fx - st.x) * sc) / st.s;
      y.value = e.focalY - H / 2 - ((st.fy - st.y) * sc) / st.s;
    },
    onDeactivate: () => {
      pinching.value = false;
      panStart.value = { x: x.value, y: y.value };
      settle(s.value, x.value, y.value);
    },
  });
  const pan = usePanGesture({
    enabled: zoomed,
    maxPointers: 1,
    onActivate: () => { panStart.value = { x: x.value, y: y.value }; },
    onUpdate: (e) => {
      if (pinching.value) return;
      const { mx, my } = limits(s.value);
      // A little give past the edge so it feels physical; settle pulls it back.
      x.value = clamp(panStart.value.x + e.translationX, mx + 40);
      y.value = clamp(panStart.value.y + e.translationY, my + 40);
    },
    onDeactivate: () => { if (!pinching.value) settle(s.value, x.value, y.value); },
  });
  const tap = useTapGesture({
    numberOfTaps: 2,
    onActivate: (e) => {
      if (s.value > 1.05) return settle(1, 0, 0);
      // Zoom so the tapped spot stays where the finger is.
      settle(TAP_ZOOM, -(e.x - W / 2) * (TAP_ZOOM - 1), -(e.y - H / 2) * (TAP_ZOOM - 1));
    },
  });
  const gesture = useSimultaneousGestures(pinch, pan, tap);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }, { scale: s.value }] }));
  const onLoad = (e) => {
    const { width: iw, height: ih } = e.source;
    if (!iw || !ih) return;
    const r = Math.min(W / iw, H / ih);
    fit.value = { w: iw * r, h: ih * r };
  };
  return (
    <GestureDetector gesture={gesture}>
      <View style={{ width: W, height: H, overflow: 'hidden' }}>
        <Animated.View style={[{ width: W, height: H }, style]}>
          <Image source={{ uri }} style={{ width: W, height: H }} contentFit="contain" onLoad={onLoad} accessibilityIgnoresInvertColors />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

// Full-screen photos: swipe between them, pinch or double-tap to zoom.
export function ImageViewer({ images, index, onClose }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(index ?? 0);
  const [zoomed, setZoomed] = useState(false);
  if (index == null) return null;
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent supportedOrientations={['portrait', 'landscape']}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 bg-black">
          <ScrollView
            horizontal
            pagingEnabled
            scrollEnabled={!zoomed}
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: index * width, y: 0 }}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          >
            {images.map((f, i) => <ZoomImage key={`${f.url}-${i}`} uri={fileUrl(f.url)} width={width} height={height} onZoom={setZoomed} />)}
          </ScrollView>
          <View className="absolute left-0 right-0 flex-row items-center justify-between px-4" style={{ top: insets.top + 8 }}>
            <Text className="font-body-semibold text-white tabular-nums">{images.length > 1 ? `${page + 1} / ${images.length}` : ''}</Text>
            <Pressable onPress={onClose} accessibilityLabel="Close photo" className="h-11 w-11 items-center justify-center rounded-full bg-white/15">
              <X size={22} color="#fff" />
            </Pressable>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

// All the task's photos and PDFs in one row; tap a photo to see it full screen.
export function FilesStrip({ task }) {
  const files = taskFiles(task);
  const images = files.filter(isImage);
  const [open, setOpen] = useState(null);
  if (!files.length) return null;
  return (
    <View className="gap-2">
      <Text className="text-caption text-muted">FILES · {files.length}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {files.map((f, i) => (isImage(f) ? (
          <Pressable key={`${f.url}-${i}`} onPress={() => setOpen(images.indexOf(f))} accessibilityLabel={`Open photo ${f.name || ''}`}>
            <Image source={{ uri: fileUrl(f.url) }} style={{ width: 56, height: 56, borderRadius: 16 }} contentFit="cover" />
          </Pressable>
        ) : <PdfChip key={`${f.url}-${i}`} file={f} onPress={() => openFile(f)} />))}
      </ScrollView>
      <ImageViewer key={open} images={images} index={open} onClose={() => setOpen(null)} />
    </View>
  );
}

export function MessageFiles({ files, onOpenImage }) {
  const images = files.filter(isImage);
  const docs = files.filter((f) => !isImage(f));
  return (
    <View className="gap-2 pt-1">
      {!!images.length && (
        <View className="flex-row flex-wrap gap-2">
          {images.map((f, i) => (
            <Pressable key={`${f.url}-${i}`} onPress={() => onOpenImage(f)} accessibilityLabel={`Open photo ${f.name || ''}`}>
              <Image source={{ uri: fileUrl(f.url) }} style={{ width: images.length === 1 ? 200 : 96, height: images.length === 1 ? 150 : 96, borderRadius: 16 }} contentFit="cover" />
            </Pressable>
          ))}
        </View>
      )}
      {docs.map((f, i) => <PdfChip key={`${f.url}-${i}`} file={f} onPress={() => openFile(f)} />)}
    </View>
  );
}

// Photos (camera or gallery) and PDFs waiting to be sent: up to 5, 10 MB each.
export function useAttachments() {
  const [files, setFiles] = useState([]);
  const attach = (picked) => {
    const fit = picked.filter((f) => !f.size || f.size <= MAX_BYTES);
    if (fit.length < picked.length) showToast({ title: 'Files over 10 MB were skipped' });
    if (files.length + fit.length > MAX_FILES) showToast({ title: `Up to ${MAX_FILES} files per message` });
    setFiles([...files, ...fit].slice(0, MAX_FILES));
  };
  const fromImages = (r) => !r.canceled && attach(r.assets.map((a) => ({
    uri: a.uri, file: a.file, name: a.fileName || `photo-${Date.now()}.jpg`, mime: a.mimeType || 'image/jpeg', size: a.fileSize,
  })));
  const camera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return showToast({ title: 'Camera access is off', message: 'Allow it in Settings to take photos.' });
    fromImages(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 }));
  };
  const gallery = async () => fromImages(await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: MAX_FILES - files.length, quality: 0.7,
    // iPhone photos are HEIC, which Chrome and Android can't show: ask iOS for JPEG instead.
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  }));
  const pdf = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', multiple: true });
    if (!r.canceled) attach(r.assets.map((a) => ({ uri: a.uri, file: a.file, name: a.name, mime: a.mimeType || 'application/pdf', size: a.size })));
  };
  const full = files.length >= MAX_FILES;
  return { files, setFiles, camera, gallery, pdf, full, remove: (i) => setFiles(files.filter((_, j) => j !== i)) };
}

// The picked files, each with a remove button.
export function PendingFiles({ files, remove }) {
  const theme = useTheme();
  if (!files.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
      {files.map((f, i) => (isImage(f) ? (
        <View key={`${f.uri}-${i}`}>
          <Image source={{ uri: f.uri }} style={{ width: 56, height: 56, borderRadius: 16 }} contentFit="cover" />
          <Pressable onPress={() => remove(i)} hitSlop={8} accessibilityLabel={`Remove ${f.name}`} className="absolute -right-1 -top-1 h-6 w-6 items-center justify-center rounded-full bg-ink">
            <X size={14} color={theme.bg} />
          </Pressable>
        </View>
      ) : <PdfChip key={`${f.uri}-${i}`} file={f} onRemove={() => remove(i)} />))}
    </ScrollView>
  );
}

// Camera, gallery and PDF buttons.
export function AttachButtons({ camera, gallery, pdf, full }) {
  const theme = useTheme();
  return [[Camera, 'Take a photo', camera], [ImagePlus, 'Add photos', gallery], [Paperclip, 'Add a PDF', pdf]].map(([Icon, label, onPress]) => (
    <Pressable key={label} onPress={onPress} disabled={full} accessibilityLabel={label} className={`h-11 w-11 items-center justify-center rounded-full bg-surface-2 ${full ? 'opacity-40' : ''}`}>
      <Icon size={20} color={theme.ink} />
    </Pressable>
  ));
}

// Task chat: text, photos (camera or gallery), PDFs, @mentions and replies. Everyone on the task is notified.
export function TaskChat({ task }) {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const [add, { isLoading }] = useAddTaskCommentMutation();
  const [remove, r] = useDeleteTaskCommentMutation();
  const [deleting, setDeleting] = useState(null); // the message waiting for "Delete?" confirmation
  const [shown, setShown] = useState(10); // newest messages first on screen; older ones on request
  const [text, setText] = useState('');
  const att = useAttachments();
  const { files, setFiles } = att;
  const [replyTo, setReplyTo] = useState(null);
  const [viewing, setViewing] = useState(null);
  const mention = text.match(/@(\w{1,20})$/)?.[1];
  const client = me.role === 'client'; // clients chat with the team but can't look up staff to @mention
  const users = useGetUsersQuery({ search: mention, isActive: true, limit: 5 }, { skip: !mention || client });
  const people = (mention ? users.data?.data?.users || [] : []).filter((u) => u.role !== 'client');
  const pick = (u) => setText((t) => t.replace(/@\w{1,20}$/, `@[${u.name}](${u._id}) `));
  const comments = task.comments || [];
  const byId = Object.fromEntries(comments.map((c) => [c._id, c]));
  const allImages = taskFiles(task).filter(isImage);
  const send = async () => {
    const ok = await runAction(add({ id: task._id, text: text.trim(), replyTo: replyTo?._id, files }), null, "Couldn't send");
    if (ok) { setText(''); setFiles([]); setReplyTo(null); }
  };

  return (
    <Card className="gap-4 p-4">
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 font-display text-title">Chat</Text>
        <Text className="text-sm text-muted tabular-nums">{comments.length}</Text>
      </View>
      {!client && !!task.project?.client && <Text className="-mt-2 text-xs text-muted">The client can read this chat.</Text>}

      {comments.length > shown && (
        <Button title={`Show ${Math.min(20, comments.length - shown)} earlier`} variant="ghost" size="sm" onPress={() => setShown((n) => n + 20)} />
      )}
      {comments.slice(-shown).map((c) => {
        const parent = c.replyTo && byId[c.replyTo];
        const mine = idOf(c.createdBy) === me._id;
        return (
          <View key={c._id} className="flex-row gap-3">
            <Avatar name={c.createdBy?.name} uri={c.createdBy?.avatar} size={32} />
            <View className="flex-1 gap-1">
              <Text className="text-sm"><Text className="font-body-semibold text-sm">{mine ? 'You' : c.createdBy?.name || 'Someone'}</Text><Text className="text-xs text-muted"> · {getTimeAgo(c.createdAt)}</Text></Text>
              {!!c.replyTo && (
                <View className="rounded-xl border-l-2 border-accent bg-surface-2 px-3 py-1.5">
                  <Text numberOfLines={2} className="text-xs text-muted">{parent ? `${parent.createdBy?.name || 'Someone'}: ${preview(parent)}` : 'Message deleted'}</Text>
                </View>
              )}
              {!!c.text && <Text>{plainMentions(c.text)}</Text>}
              {!!c.files?.length && <MessageFiles files={c.files} onOpenImage={(f) => setViewing(allImages.indexOf(f))} />}
              <View className="-ml-2 flex-row">
                <Pressable onPress={() => setReplyTo(c)} accessibilityLabel={`Reply to ${c.createdBy?.name || 'message'}`} className="h-9 flex-row items-center gap-1 px-2">
                  <CornerUpLeft size={14} color={theme.muted} />
                  <Text className="text-xs font-body-semibold text-muted">Reply</Text>
                </Pressable>
                {(mine || isAdmin(me)) && (
                  <Pressable onPress={() => setDeleting(c)} accessibilityLabel="Delete message" className="h-9 flex-row items-center gap-1 px-2">
                    <Trash2 size={14} color={theme.muted} />
                    <Text className="text-xs font-body-semibold text-muted">Delete</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        );
      })}
      {!comments.length && <Text className="text-sm text-muted">{client ? 'No messages yet. Ask the team anything here.' : 'No messages yet. Share an update, a photo or a PDF.'}</Text>}
      <ConfirmDialog
        visible={!!deleting}
        title="Delete this message?"
        message={deleting?.files?.length ? 'Its photos and files are deleted too. This can’t be undone.' : 'This can’t be undone.'}
        loading={r.isLoading}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => { await runAction(remove({ id: task._id, commentId: deleting?._id }), 'Message deleted', "Couldn't delete"); setDeleting(null); }}
      />

      <View className="gap-2 border-t border-line pt-4">
        {replyTo && (
          <View className="flex-row items-center gap-2 rounded-xl border-l-2 border-accent bg-surface-2 py-1.5 pl-3">
            <Text numberOfLines={1} className="flex-1 text-xs text-muted">Replying to {replyTo.createdBy?.name || 'message'}: {preview(replyTo)}</Text>
            <Pressable onPress={() => setReplyTo(null)} accessibilityLabel="Cancel reply" className="h-9 w-9 items-center justify-center"><X size={16} color={theme.muted} /></Pressable>
          </View>
        )}
        <PendingFiles files={files} remove={att.remove} />
        <Input value={text} onChangeText={setText} placeholder={client ? 'Write a message' : 'Write a message. Type @ to mention.'} accessibilityLabel="Message" multiline maxLength={5000} style={{ minHeight: 52, height: undefined, paddingTop: 14, paddingBottom: 14, textAlignVertical: 'top' }} />
        {people.map((u) => (
          <Pressable key={u._id} onPress={() => pick(u)} accessibilityLabel={`Mention ${u.name}`} className="flex-row items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2">
            <Avatar name={u.name} uri={u.avatar} size={28} />
            <Text className="flex-1 font-body-medium">{u.name}</Text>
          </Pressable>
        ))}
        <View className="flex-row items-center gap-1">
          <AttachButtons {...att} />
          <View className="flex-1" />
          <Button title="Send" size="sm" disabled={!text.trim() && !files.length} loading={isLoading} onPress={send} />
        </View>
      </View>
      <ImageViewer key={viewing} images={allImages} index={viewing} onClose={() => setViewing(null)} />
    </Card>
  );
}
