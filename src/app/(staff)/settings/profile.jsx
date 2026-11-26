import { useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert as NativeAlert, Platform, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { BadgeCheck, KeyRound, LogOut, MailWarning, Pencil } from 'lucide-react-native';
import { Alert, Avatar, Badge, Button, ImageViewer, Input, InfoRow, ListRow, PageHeader, Pressable, Screen, SettingsSection, Text, changedFields, confirmSignOut, showToast } from '@/components';
import { ROLE_LABELS } from '@/constants';
import { useTheme } from '@/constants/theme';
import { useUpdateProfileMutation, useUploadAvatarMutation } from '@/services/settingsApi';
import { setUser } from '@/store/authSlice';
import { apiError } from '@/utils/apiError';
import { runAction } from '@/utils/attendance';
import { getFieldError } from '@/utils/getFieldError';
import { formatDate } from '@/utils/formatters';

const MAX_PHOTO = 5 * 1024 * 1024; // the server's upload limit
const PHONE = /^[\d\s+\-()]{7,20}$/;
const pickOpts = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.7,
  // iPhone photos are HEIC; ask iOS for JPEG so every device can show it.
  preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
};

// Apple-style account page: photo hero, then grouped cards. Tap the photo to view it full screen (pinch to zoom);
// the pencil opens the photo sheet. Photo changes save straight away; name and phone save with the button.
// Email is fixed: the server ignores changes.
export default function Profile() {
  const theme = useTheme();
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const [initial, setInitial] = useState(() => ({ name: user.name || '', phone: user.phone || '' }));
  const [f, setF] = useState(initial);
  const [viewing, setViewing] = useState(false);
  const [update, u] = useUpdateProfileMutation();
  const [upload, up] = useUploadAvatarMutation();
  const { message, fieldErrors } = apiError(u.error);
  const err = (k) => getFieldError(fieldErrors, k);

  const name = f.name.trim();
  const nameError = name.length < 2 ? 'Name must be at least 2 characters' : '';
  const phoneError = f.phone && !PHONE.test(f.phone) ? 'Enter a valid phone number' : '';
  const changes = changedFields({ name, phone: f.phone.trim() }, initial);
  const ready = !nameError && !phoneError && Object.keys(changes).length > 0;

  const save = async () => {
    const res = await runAction(update(changes), 'Profile saved', "Couldn't save your profile");
    if (!res) return;
    dispatch(setUser(res.data?.user ?? changes));
    setInitial({ name, phone: f.phone.trim() });
  };

  const sendPhoto = async (r) => {
    if (r.canceled) return;
    const a = r.assets[0];
    if (a.fileSize && a.fileSize > MAX_PHOTO) return showToast({ title: 'Photo is over 5 MB', message: 'Pick a smaller one.' });
    const res = await runAction(upload({ uri: a.uri, file: a.file, name: a.fileName || `avatar-${Date.now()}.jpg`, mime: a.mimeType || 'image/jpeg' }), 'Photo updated', "Couldn't upload the photo");
    if (res?.data?.user) dispatch(setUser({ avatar: res.data.user.avatar }));
  };
  const gallery = async () => sendPhoto(await ImagePicker.launchImageLibraryAsync(pickOpts));
  const camera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return showToast({ title: 'Camera access is off', message: 'Allow it in Settings to take photos.' });
    sendPhoto(await ImagePicker.launchCameraAsync(pickOpts));
  };
  const removePhoto = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    NativeAlert.alert('Remove profile photo?', 'Your initials will show instead.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => { if (await runAction(update({ avatar: '' }), 'Photo removed', "Couldn't remove the photo")) dispatch(setUser({ avatar: '' })); },
      },
    ]);
  };
  // Native action sheet on iOS; Android gets the same choices as a dialog.
  const photoSheet = () => {
    const actions = [['Take Photo', camera], ['Choose from Library', gallery], ...(user.avatar ? [['Remove Photo', removePhoto]] : [])];
    if (Platform.OS === 'ios') {
      return ActionSheetIOS.showActionSheetWithOptions(
        { title: 'Profile photo', options: [...actions.map(([t]) => t), 'Cancel'], cancelButtonIndex: actions.length, destructiveButtonIndex: user.avatar ? 2 : undefined, tintColor: theme.ink },
        (i) => actions[i]?.[1](),
      );
    }
    NativeAlert.alert('Profile photo', undefined, [
      ...actions.map(([text, onPress]) => ({ text, onPress, style: text === 'Remove Photo' ? 'destructive' : 'default' })),
      // Android shows at most 3 buttons; with "Remove" there's no room for Cancel, so tap outside / back closes it.
      ...(actions.length < 3 ? [{ text: 'Cancel', style: 'cancel' }] : []),
    ], { cancelable: true });
  };
  const busy = up.isLoading || u.isLoading;

  return (
    <Screen scroll className="gap-7 pt-2">
      <PageHeader title="Profile" fallback="/settings" />

      <View className="items-center gap-3">
        <View>
          {/* With a photo, tap views it; without one, the only thing to do is add one. */}
          <Pressable onPress={user.avatar ? () => setViewing(true) : photoSheet} disabled={busy} accessibilityLabel={user.avatar ? 'View photo' : 'Add photo'}>
            <Avatar ring name={user.name} uri={user.avatar || undefined} size={112} />
            {busy && (
              <View className="absolute inset-0 items-center justify-center rounded-full bg-black/40">
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </Pressable>
          <Pressable onPress={photoSheet} disabled={busy} accessibilityLabel="Edit photo" className="absolute bottom-0 right-0 h-9 w-9 items-center justify-center rounded-full border-2 border-bg bg-accent">
            <Pencil size={16} color={theme.surface} />
          </Pressable>
        </View>
        <View className="items-center gap-1">
          <Text className="font-display text-2xl" numberOfLines={1}>{user.name}</Text>
          <Text className="text-sm text-muted" numberOfLines={1}>{user.email}</Text>
        </View>
        <Badge label={ROLE_LABELS[user.role] ?? user.role} className="self-center" />
      </View>

      <SettingsSection title="Personal info" className="gap-4 p-4">
        <Alert message={fieldErrors.length ? '' : message} />
        <Input label="Full name" value={f.name} onChangeText={(v) => setF((x) => ({ ...x, name: v }))} maxLength={100} autoComplete="name" textContentType="name" returnKeyType="next" error={(f.name !== initial.name && nameError) || err('name')} />
        <Input
          label="Phone"
          value={f.phone}
          onChangeText={(v) => setF((x) => ({ ...x, phone: v.replace(/[^\d+]/g, '') }))}
          placeholder="+91 98765 43210"
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          maxLength={20}
          error={phoneError || err('phone')}
        />
        <Input label="Email" value={user.email} editable={false} hint="Ask an admin to change your email" className="opacity-70" />
        <Button title="Save changes" loading={u.isLoading} disabled={!ready} onPress={save} />
      </SettingsSection>

      <SettingsSection title="Account">
        {user.isEmailVerified ? (
          <ListRow icon={BadgeCheck} label="Email verified" hint={user.email} />
        ) : (
          <ListRow icon={MailWarning} label="Verify your email" hint="We'll send a 6-digit code" onPress={() => router.push('/verify-email')} />
        )}
        {!!user.createdAt && <InfoRow label="Member since" value={formatDate(user.createdAt)} />}
      </SettingsSection>

      <SettingsSection title="Security">
        <ListRow icon={KeyRound} label="Change password" onPress={() => router.push('/change-password')} />
      </SettingsSection>

      <SettingsSection>
        <ListRow icon={LogOut} label="Sign out" danger onPress={() => confirmSignOut(dispatch)} />
      </SettingsSection>

      {viewing && <ImageViewer images={[{ url: user.avatar }]} index={0} onClose={() => setViewing(false)} />}
    </Screen>
  );
}
