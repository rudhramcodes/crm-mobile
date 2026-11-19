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

// Pinch to zoom, drag while zoomed, double-tap to toggle 2.5x.
function ZoomImage({ uri, width, height, onZoom }) {
  const scale = useSharedValue(1);
  const saved = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);
  const [zoomed, setZoomed] = useState(false);
  const report = (z) => { setZoomed(z); onZoom(z); };
  const reset = () => {
    'worklet';
    scale.value = withTiming(1); saved.value = 1;
    x.value = withTiming(0); y.value = withTiming(0); sx.value = 0; sy.value = 0;
    scheduleOnRN(report, false);
  };
  const pinch = usePinchGesture({
    onUpdate: (e) => { scale.value = Math.min(5, Math.max(1, saved.value * e.scale)); },
    onDeactivate: () => {
      saved.value = scale.value;
      if (scale.value <= 1.05) reset();
      else scheduleOnRN(report, true);
    },
  });
  const pan = usePanGesture({
    enabled: zoomed,
    onUpdate: (e) => { x.value = sx.value + e.translationX; y.value = sy.value + e.translationY; },
    onDeactivate: () => { sx.value = x.value; sy.value = y.value; },
  });
  const tap = useTapGesture({
    numberOfTaps: 2,
    onDeactivate: () => {
      if (saved.value > 1) return reset();
      scale.value = withTiming(2.5); saved.value = 2.5;
      scheduleOnRN(report, true);
    },
  });
  const gesture = useSimultaneousGestures(pinch, pan, tap);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }] }));
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ width, height, alignItems: 'center', justifyContent: 'center' }, style]}>
        <Image source={{ uri }} style={{ width, height }} contentFit="contain" accessibilityIgnoresInvertColors />
      </Animated.View>
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

function MessageFiles({ files, onOpenImage }) {
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

// Task chat: text, photos (camera or gallery), PDFs, @mentions and replies. Everyone on the task is notified.
export function TaskChat({ task }) {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const [add, { isLoading }] = useAddTaskCommentMutation();
  const [remove] = useDeleteTaskCommentMutation();
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [viewing, setViewing] = useState(null);
  const mention = text.match(/@(\w{1,20})$/)?.[1];
  const users = useGetUsersQuery({ search: mention, isActive: true, limit: 5 }, { skip: !mention });
  const people = (mention ? users.data?.data?.users || [] : []).filter((u) => u.role !== 'client');
  const pick = (u) => setText((t) => t.replace(/@\w{1,20}$/, `@[${u.name}](${u._id}) `));
  const comments = task.comments || [];
  const byId = Object.fromEntries(comments.map((c) => [c._id, c]));
  const allImages = taskFiles(task).filter(isImage);

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
  }));
  const pdf = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', multiple: true });
    if (!r.canceled) attach(r.assets.map((a) => ({ uri: a.uri, file: a.file, name: a.name, mime: a.mimeType || 'application/pdf', size: a.size })));
  };
  const send = async () => {
    const ok = await runAction(add({ id: task._id, text: text.trim(), replyTo: replyTo?._id, files }), null, "Couldn't send");
    if (ok) { setText(''); setFiles([]); setReplyTo(null); }
  };
  const full = files.length >= MAX_FILES;

  return (
    <Card className="gap-4 p-4">
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 font-display text-title">Chat</Text>
        <Text className="text-sm text-muted tabular-nums">{comments.length}</Text>
      </View>

      {comments.map((c) => {
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
                  <Pressable onPress={() => runAction(remove({ id: task._id, commentId: c._id }), 'Message deleted', "Couldn't delete")} accessibilityLabel="Delete message" className="h-9 flex-row items-center gap-1 px-2">
                    <Trash2 size={14} color={theme.muted} />
                    <Text className="text-xs font-body-semibold text-muted">Delete</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        );
      })}
      {!comments.length && <Text className="text-sm text-muted">No messages yet. Share an update, a photo or a PDF.</Text>}

      <View className="gap-2 border-t border-line pt-4">
        {replyTo && (
          <View className="flex-row items-center gap-2 rounded-xl border-l-2 border-accent bg-surface-2 py-1.5 pl-3">
            <Text numberOfLines={1} className="flex-1 text-xs text-muted">Replying to {replyTo.createdBy?.name || 'message'}: {preview(replyTo)}</Text>
            <Pressable onPress={() => setReplyTo(null)} accessibilityLabel="Cancel reply" className="h-9 w-9 items-center justify-center"><X size={16} color={theme.muted} /></Pressable>
          </View>
        )}
        {!!files.length && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {files.map((f, i) => (isImage(f) ? (
              <View key={`${f.uri}-${i}`}>
                <Image source={{ uri: f.uri }} style={{ width: 56, height: 56, borderRadius: 16 }} contentFit="cover" />
                <Pressable onPress={() => setFiles(files.filter((_, j) => j !== i))} hitSlop={8} accessibilityLabel={`Remove ${f.name}`} className="absolute -right-1 -top-1 h-6 w-6 items-center justify-center rounded-full bg-ink">
                  <X size={14} color={theme.bg} />
                </Pressable>
              </View>
            ) : <PdfChip key={`${f.uri}-${i}`} file={f} onRemove={() => setFiles(files.filter((_, j) => j !== i))} />))}
          </ScrollView>
        )}
        <Input value={text} onChangeText={setText} placeholder="Write a message. Type @ to mention." accessibilityLabel="Message" multiline maxLength={5000} style={{ minHeight: 52, height: undefined, paddingTop: 14, paddingBottom: 14, textAlignVertical: 'top' }} />
        {people.map((u) => (
          <Pressable key={u._id} onPress={() => pick(u)} accessibilityLabel={`Mention ${u.name}`} className="flex-row items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2">
            <Avatar name={u.name} uri={u.avatar} size={28} />
            <Text className="flex-1 font-body-medium">{u.name}</Text>
          </Pressable>
        ))}
        <View className="flex-row items-center gap-1">
          {[[Camera, 'Take a photo', camera], [ImagePlus, 'Add photos', gallery], [Paperclip, 'Add a PDF', pdf]].map(([Icon, label, onPress]) => (
            <Pressable key={label} onPress={onPress} disabled={full} accessibilityLabel={label} className={`h-11 w-11 items-center justify-center rounded-full bg-surface-2 ${full ? 'opacity-40' : ''}`}>
              <Icon size={20} color={theme.ink} />
            </Pressable>
          ))}
          <View className="flex-1" />
          <Button title="Send" size="sm" disabled={!text.trim() && !files.length} loading={isLoading} onPress={send} />
        </View>
      </View>
      <ImageViewer key={viewing} images={allImages} index={viewing} onClose={() => setViewing(null)} />
    </Card>
  );
}
