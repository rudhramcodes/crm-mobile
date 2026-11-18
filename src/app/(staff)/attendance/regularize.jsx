import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Alert, Button, DateField, Input, Screen, SheetHeader, backTo } from '@/components';
import { useRequestRegularizationMutation } from '@/services/attendanceApi';
import { runAction, ymd } from '@/utils/attendance';
import { apiError } from '@/utils/apiError';
import { getFieldError } from '@/utils/getFieldError';
import { parseTime } from '@/utils/time';

// Ask for a correction: the day, why, and optionally the real in/out times and break (in and out go together).
export default function RegularizeForm() {
  const params = useLocalSearchParams();
  const [send, { isLoading, error }] = useRequestRegularizationMutation();
  const [date, setDate] = useState(params.date || ymd());
  const [reason, setReason] = useState('');
  const [inTime, setIn] = useState('');
  const [outTime, setOut] = useState('');
  const [breakMin, setBreak] = useState('');
  const { message, fieldErrors } = apiError(error);
  const err = (f) => getFieldError(fieldErrors, f);

  const submit = async () => {
    // Unparseable text goes as typed so the server's "must be HH:mm" message shows on the field.
    const body = { date, reason: reason.trim(), clockInTime: parseTime(inTime) || inTime.trim(), clockOutTime: parseTime(outTime) || outTime.trim(), breakMinutes: Number(breakMin) || 0 };
    const ok = await runAction(send(body), 'Correction requested', "Couldn't send request");
    if (ok) backTo();
  };

  return (
    <Screen scroll edges={['bottom']} className="gap-4 pt-6">
      <SheetHeader title="Request a correction" sub="Your manager reviews it and the day updates once approved." closeLabel="Cancel" />
      <Alert message={fieldErrors.length ? '' : message} />
      <DateField label="Day" value={date} onChange={setDate} maxDate={ymd()} error={err('attendanceId') || err('date')} />
      <Input label="Clock in" value={inTime} onChangeText={setIn} placeholder="9:30 AM" hint="Leave both times empty to ask for a status review only." error={err('clockInTime')} autoCapitalize="none" />
      <Input label="Clock out" value={outTime} onChangeText={setOut} placeholder="6:30 PM" error={err('clockOutTime')} autoCapitalize="none" />
      <Input label="Break (minutes)" value={breakMin} onChangeText={(t) => setBreak(t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="0" error={err('breakMinutes')} />
      <Input
        label="Reason"
        value={reason}
        onChangeText={setReason}
        placeholder="Forgot to clock out after the client visit"
        multiline
        maxLength={500}
        style={{ height: 112, paddingTop: 14, textAlignVertical: 'top' }}
        hint="At least 10 characters."
        error={err('reason')}
      />
      <Button title="Send request" loading={isLoading} disabled={reason.trim().length < 10} onPress={submit} />
    </Screen>
  );
}
