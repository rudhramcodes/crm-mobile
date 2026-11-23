import { useState } from 'react';
import { View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { Camera, ImagePlus, KeyRound } from 'lucide-react-native';
import { Alert, Avatar, Button, Input, InfoRow, ListRow, PageHeader, Pressable, Screen, SettingsSection, Text, changedFields, showToast } from '@/components';
import { ROLE_LABELS } from '@/constants';
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

// Photo is saved straight away (camera or gallery); name and phone save with the button. Email is fixed: the server ignores changes.
export default function Profile() {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const [initial, setInitial] = useState(() => ({ name: user.name || '', phone: user.phone || '' }));
  const [f, setF] = useState(initial);
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
  const removePhoto = async () => {
    if (await runAction(update({ avatar: '' }), 'Photo removed', "Couldn't remove the photo")) dispatch(setUser({ avatar: '' }));
  };
  const busy = up.isLoading || u.isLoading;

  return (
    <Screen scroll className="gap-5 pt-2">
      <PageHeader caption="SETTINGS" title="Profile" fallback="/settings" />
      <View className="items-center gap-3">
        <Pressable onPress={gallery} disabled={busy} accessibilityLabel="Change photo" className={busy ? 'opacity-50' : ''}>
          <Avatar name={user.name} uri={user.avatar || undefined} size={96} />
        </Pressable>
        <View className="flex-row gap-2">
          <Button title="Gallery" icon={ImagePlus} size="sm" variant="secondary" loading={up.isLoading} disabled={busy} onPress={gallery} />
          <Button title="Camera" icon={Camera} size="sm" variant="secondary" disabled={busy} onPress={camera} />
        </View>
        {!!user.avatar && (
          <Pressable onPress={removePhoto} disabled={busy} accessibilityLabel="Remove photo" className="py-1">
            <Text className="text-sm text-danger">Remove photo</Text>
          </Pressable>
        )}
      </View>

      <Alert message={fieldErrors.length ? '' : message} />
      <Input label="Full name *" value={f.name} onChangeText={(name) => setF((x) => ({ ...x, name }))} maxLength={100} autoComplete="name" error={(f.name !== initial.name && nameError) || err('name')} />
      <Input label="Email" value={user.email} editable={false} hint="Ask an admin to change your email" className="opacity-70" />
      <Input
        label="Phone"
        value={f.phone}
        onChangeText={(v) => setF((x) => ({ ...x, phone: v.replace(/[^\d+]/g, '') }))}
        placeholder="+91 98765 43210"
        keyboardType="phone-pad"
        autoComplete="tel"
        maxLength={20}
        error={phoneError || err('phone')}
      />
      <Button title="Save changes" loading={u.isLoading} disabled={!ready} onPress={save} />

      <SettingsSection title="Account details">
        <InfoRow label="Role" value={ROLE_LABELS[user.role] ?? user.role} />
        <InfoRow label="Email verified" value={user.isEmailVerified ? 'Yes' : 'No'} />
        {!!user.createdAt && <InfoRow label="Member since" value={formatDate(user.createdAt)} />}
      </SettingsSection>
      <SettingsSection>
        <ListRow icon={KeyRound} label="Change password" onPress={() => router.push('/change-password')} />
      </SettingsSection>
    </Screen>
  );
}
