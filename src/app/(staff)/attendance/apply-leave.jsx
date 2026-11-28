import { useState } from 'react';
import { Platform, View } from 'react-native';
import { useSelector } from 'react-redux';
import { Alert, Button, Chip, DateField, Input, Screen, SheetHeader, Text, leaveDays, backTo } from '@/components';
import { useApplyLeaveMutation, useGetHolidaysQuery, useGetLeaveBalanceQuery } from '@/services/attendanceApi';
import { LEAVE_TYPES } from '@/constants';
import { runAction, ymd } from '@/utils/attendance';
import { apiError } from '@/utils/apiError';
import { getFieldError } from '@/utils/getFieldError';

const HALVES = [{ value: '', label: 'Full day' }, { value: 'first', label: 'First half' }, { value: 'second', label: 'Second half' }];

// Type, full or half day, date range and reason. Casual and sick are checked against the balance here and again on the server.
export default function ApplyLeave() {
  const me = useSelector((s) => s.auth.user);
  const { data } = useGetLeaveBalanceQuery(me._id);
  const [apply, { isLoading, error }] = useApplyLeaveMutation();
  const [leaveType, setType] = useState('casual');
  const [startDate, setStart] = useState(ymd());
  const [endDate, setEnd] = useState(ymd());
  const [halfDay, setHalfDay] = useState(''); // '' = full day(s), else 'first' | 'second'
  const [reason, setReason] = useState('');
  const { message, fieldErrors } = apiError(error);
  const err = (f) => getFieldError(fieldErrors, f);

  // shortcut: holidays of the start year only; the server's count wins for leave that crosses into a new year.
  const { data: hol } = useGetHolidaysQuery({ year: Number(startDate.slice(0, 4)), page: 1, limit: 100 });
  const working = startDate && endDate && endDate >= startDate ? leaveDays(startDate, halfDay ? startDate : endDate, hol?.data || []) : 0;
  const days = halfDay && working ? 0.5 : working;
  const left = data?.data?.balance?.[leaveType]?.balance;
  const over = left != null && days > left;

  const submit = async () => {
    const ok = await runAction(apply({ leaveType, startDate, endDate: halfDay ? startDate : endDate, halfDay: halfDay || undefined, reason: reason.trim() }), 'Leave requested', "Couldn't apply for leave");
    if (ok) backTo();
  };

  return (
    <Screen scroll edges={Platform.OS === 'android' ? ['top', 'bottom'] : ['bottom']} className="gap-4 pt-6">
      <SheetHeader title="Apply for leave" sub="Your manager is notified right away." closeLabel="Cancel" />
      <Alert message={fieldErrors.length ? '' : message} />
      <View className="gap-1.5">
        <Text className="font-body-medium text-sm">Type</Text>
        <View className="flex-row flex-wrap gap-2">
          {LEAVE_TYPES.map((t) => <Chip key={t.value} label={t.label} active={leaveType === t.value} onPress={() => setType(t.value)} />)}
        </View>
      </View>
      <View className="gap-1.5">
        <Text className="font-body-medium text-sm">Duration</Text>
        <View className="flex-row flex-wrap gap-2">
          {HALVES.map((h) => <Chip key={h.value} label={h.label} active={halfDay === h.value} onPress={() => setHalfDay(h.value)} />)}
        </View>
      </View>
      <DateField label={halfDay ? 'Date' : 'From'} value={startDate} onChange={(d) => { setStart(d); if (d > endDate) setEnd(d); }} minDate={ymd()} error={err('startDate')} />
      {!halfDay && <DateField label="To" value={endDate} onChange={setEnd} minDate={startDate} error={err('endDate')} />}
      {!days && !!startDate && <Alert tone="info" message="Only Sundays or holidays in these dates, so no leave is needed." />}
      {days > 0 && (
        <Alert
          tone={over ? 'error' : 'info'}
          message={`${halfDay ? 'Half day' : `${days} ${days === 1 ? 'day' : 'days'}`}${left != null ? `. ${left} ${leaveType} ${left === 1 ? 'day' : 'days'} left.` : ', not counted against a balance.'}${over ? ' This exceeds your balance.' : ''}`}
        />
      )}
      <Input
        label="Reason"
        value={reason}
        onChangeText={setReason}
        placeholder="Family function out of town"
        multiline
        maxLength={1000}
        style={{ height: 112, paddingTop: 14, textAlignVertical: 'top' }}
        hint="At least 10 characters."
        error={err('reason')}
      />
      <Button title="Send request" loading={isLoading} disabled={over || !days || reason.trim().length < 10} onPress={submit} />
    </Screen>
  );
}
