import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Alert, Button, Chip, ConfirmDelete, DateField, Input, Screen, SheetHeader, Text, Toggle, backTo } from '@/components';
import { useCreateHolidayMutation, useDeleteHolidayMutation, useUpdateHolidayMutation } from '@/services/attendanceApi';
import { HOLIDAY_TYPES } from '@/constants';
import { runAction } from '@/utils/attendance';
import { apiError } from '@/utils/apiError';
import { getFieldError } from '@/utils/getFieldError';

// Admin: add or edit a holiday (prefilled from the list through params), or delete it.
export default function HolidayForm() {
  const p = useLocalSearchParams();
  const [create, c] = useCreateHolidayMutation();
  const [update, u] = useUpdateHolidayMutation();
  const [remove, d] = useDeleteHolidayMutation();
  const [name, setName] = useState(p.name || '');
  const [date, setDate] = useState(p.date || '');
  const [type, setType] = useState(p.type || 'company');
  const [description, setDescription] = useState(p.description || '');
  const [isRecurring, setRecurring] = useState(!!p.isRecurring);
  const { message, fieldErrors } = apiError(c.error || u.error);
  const err = (f) => getFieldError(fieldErrors, f);

  const save = async () => {
    const body = { name: name.trim(), date, type, description: description.trim() || undefined, isRecurring };
    const ok = await runAction(p.id ? update({ id: p.id, ...body }) : create(body), p.id ? 'Holiday updated' : 'Holiday added');
    if (ok) backTo();
  };
  const del = async () => {
    if (await runAction(remove(p.id), 'Holiday deleted', "Couldn't delete")) backTo();
  };

  return (
    <Screen scroll edges={['bottom']} className="gap-4 pt-6">
      <SheetHeader title={p.id ? 'Edit holiday' : 'Add holiday'} sub="Nobody can clock in on a holiday." closeLabel="Cancel" />
      <Alert message={fieldErrors.length ? '' : message} />
      <Input label="Name" value={name} onChangeText={setName} placeholder="Diwali" maxLength={100} error={err('name')} />
      <DateField label="Date" value={date} onChange={setDate} error={err('date')} />
      <View className="gap-1.5">
        <Text className="font-body-medium text-sm">Type</Text>
        <View className="flex-row flex-wrap gap-2">
          {HOLIDAY_TYPES.map((t) => <Chip key={t.value} label={t.label} active={type === t.value} onPress={() => setType(t.value)} />)}
        </View>
      </View>
      <Input label="Description (optional)" value={description} onChangeText={setDescription} maxLength={500} error={err('description')} />
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Text className="font-body-medium">Repeats every year</Text>
          <Text className="text-sm text-muted">Same date each year.</Text>
        </View>
        <Toggle value={isRecurring} onValueChange={setRecurring} label="Repeats every year" />
      </View>
      <Button title={p.id ? 'Save changes' : 'Add holiday'} loading={c.isLoading || u.isLoading} disabled={!name.trim() || !date} onPress={save} />
      {!!p.id && <ConfirmDelete label="Delete holiday" loading={d.isLoading} onConfirm={del} />}
    </Screen>
  );
}
