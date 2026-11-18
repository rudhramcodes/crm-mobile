import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  Alert, Avatar, Button, Chip, DashboardState, DateField, Input, Pressable, Screen, SheetHeader, Text, Toggle, UserPicker, backTo,
} from '@/components';
import { useGetAttendanceSummaryQuery, useManualEntryMutation } from '@/services/attendanceApi';
import { ATTENDANCE_STATUS } from '@/constants';
import { runAction, ymd } from '@/utils/attendance';
import { apiError } from '@/utils/apiError';
import { getFieldError } from '@/utils/getFieldError';
import { parseTime, toDisplay } from '@/utils/time';

const OFF = ['absent', 'leave', 'holiday', 'weekend'];
const hhmm = (t) => (t ? `${String(new Date(t).getHours()).padStart(2, '0')}:${String(new Date(t).getMinutes()).padStart(2, '0')}` : '');

// The form itself; mounted once the day's record (if any) is loaded so the fields start from it.
function EntryForm({ employee, name, date, setDate, record, onChangeEmployee }) {
  const [save, { isLoading, error }] = useManualEntryMutation();
  const sessions = record?.sessions || [];
  const [status, setStatus] = useState(record?.status || 'present');
  const [inTime, setIn] = useState(toDisplay(hhmm(sessions[0]?.clockIn?.time)));
  const [outTime, setOut] = useState(toDisplay(hhmm(sessions.at(-1)?.clockOut?.time)));
  const [isWFH, setWFH] = useState(!!record?.isWFH);
  const [notes, setNotes] = useState('');
  const { message, fieldErrors } = apiError(error);
  const err = (f) => getFieldError(fieldErrors, f);
  const off = OFF.includes(status);

  const submit = async () => {
    const body = {
      recordId: record?._id,
      employee,
      date,
      status,
      clockInTime: off ? undefined : parseTime(inTime) || undefined,
      clockOutTime: off ? undefined : parseTime(outTime) || undefined,
      isWFH: off ? false : isWFH || status === 'wfh',
      notes: notes.trim(),
    };
    if (await runAction(save(body), record ? 'Day updated' : 'Entry added', "Couldn't save")) backTo();
  };
  const badTime = (t) => !!t.trim() && !parseTime(t);

  return (
    <>
      <Alert message={fieldErrors.length ? '' : message} />
      <Pressable onPress={onChangeEmployee} disabled={!onChangeEmployee} accessibilityLabel={`Employee: ${name}${onChangeEmployee ? '. Change' : ''}`} className="flex-row items-center gap-3">
        <Avatar name={name} size={40} />
        <Text className="flex-1 font-body-semibold">{name}</Text>
        {!!onChangeEmployee && <Text className="font-body-semibold text-accent-ink">Change</Text>}
      </Pressable>
      <DateField label="Day" value={date} onChange={setDate} maxDate={ymd()} error={err('date')} />
      {record && <Alert tone="info" message="Saving replaces this day's sessions with the times below." />}
      <View className="gap-1.5">
        <Text className="font-body-medium text-sm">Status</Text>
        <View className="flex-row flex-wrap gap-2">
          {ATTENDANCE_STATUS.map((s) => <Chip key={s.value} label={s.label} active={status === s.value} onPress={() => setStatus(s.value)} />)}
        </View>
      </View>
      {!off && (
        <>
          <Input label="Clock in" value={inTime} onChangeText={setIn} placeholder="9:30 AM" autoCapitalize="none" error={badTime(inTime) ? 'Use a time like 9:30 AM' : err('clockInTime')} />
          <Input label="Clock out" value={outTime} onChangeText={setOut} placeholder="6:30 PM" autoCapitalize="none" hint="Leave empty to keep the session open." error={badTime(outTime) ? 'Use a time like 6:30 PM' : err('clockOutTime')} />
          <View className="flex-row items-center gap-3">
            <Text className="flex-1 font-body-medium">Worked from home</Text>
            <Toggle value={isWFH || status === 'wfh'} onValueChange={setWFH} label="Worked from home" />
          </View>
        </>
      )}
      <Input
        label="Reason"
        value={notes}
        onChangeText={setNotes}
        placeholder="Biometric was down, confirmed with the team lead"
        multiline
        maxLength={500}
        style={{ height: 96, paddingTop: 14, textAlignVertical: 'top' }}
        hint="Saved on the record as the note."
        error={err('notes')}
      />
      <Button title={record ? 'Save changes' : 'Add entry'} loading={isLoading} disabled={!notes.trim() || badTime(inTime) || badTime(outTime)} onPress={submit} />
    </>
  );
}

// Admin: add or correct any employee's day. One POST /manual for both; recordId makes it an edit.
export default function EditAttendance() {
  const p = useLocalSearchParams();
  const [person, setPerson] = useState(p.employee ? { _id: p.employee, name: p.name || 'Employee' } : null);
  const [date, setDate] = useState(p.date || ymd());
  const { data, isFetching, isError, refetch } = useGetAttendanceSummaryQuery({ employeeId: person?._id, date }, { skip: !person });
  const record = data?.data?.summary?.record;

  return (
    <Screen scroll edges={['bottom']} className="gap-4 pt-6">
      <SheetHeader title={record ? 'Edit day' : 'Add entry'} sub="The employee sees the change on their calendar." closeLabel="Cancel" />
      {!person ? <UserPicker onPick={setPerson} /> : isFetching || isError ? (
        <DashboardState isLoading={isFetching} isError={isError} refetch={refetch} />
      ) : (
        <EntryForm
          key={`${person._id}-${date}-${record?._id || 'new'}`}
          employee={person._id}
          name={person.name}
          date={date}
          setDate={setDate}
          record={record}
          onChangeEmployee={p.employee ? undefined : () => setPerson(null)}
        />
      )}
    </Screen>
  );
}
