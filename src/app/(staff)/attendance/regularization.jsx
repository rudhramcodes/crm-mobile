import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { Check, FilePenLine, Plus, X } from 'lucide-react-native';
import {
  Avatar, Button, Card, DashboardState, EmptyState, Input, PageHeader, RequestBadge, Screen, Section, Text, longDate, usePullRefresh,
} from '@/components';
import { useApproveRegularizationMutation, useGetAttendanceListQuery, useGetRegularizationRequestsQuery } from '@/services/attendanceApi';
import { isLead, runAction, ymd } from '@/utils/attendance';
import { toDisplay } from '@/utils/time';

const asked = (q) => [q?.clockInTime && `${toDisplay(q.clockInTime)} → ${toDisplay(q.clockOutTime)}`, q?.breakMinutes ? `${q.breakMinutes}m break` : null].filter(Boolean).join(' · ') || 'Status review only';

// A pending correction with approve, or reject behind a required reason.
function PendingRequest({ r }) {
  const [review, { isLoading }] = useApproveRegularizationMutation();
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState('');
  const q = r.regularization.request;
  const act = (action) => runAction(review({ id: r._id, action, comment: comment.trim() || undefined }), action === 'approved' ? 'Correction approved' : 'Correction rejected');

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-3">
        <Avatar name={r.employee?.name || '?'} uri={r.employee?.avatar} size={40} />
        <View className="flex-1">
          <Text className="font-body-semibold">{r.employee?.name || 'Unknown employee'}</Text>
          <Text className="text-sm text-muted">{longDate(ymd(r.date))}</Text>
        </View>
      </View>
      <Text className="font-body-medium tabular-nums">{asked(q)}</Text>
      {!!q.reason && <Text className="text-sm text-muted">{q.reason}</Text>}
      {rejecting && <Input label="Reason for rejecting" value={comment} onChangeText={setComment} maxLength={500} autoFocus placeholder="Tell them what to fix" />}
      <View className="flex-row gap-3">
        {rejecting ? (
          <>
            <Button title="Cancel" variant="ghost" size="sm" className="flex-1" onPress={() => setRejecting(false)} />
            <Button title="Reject" icon={X} variant="danger" size="sm" className="flex-1" loading={isLoading} disabled={!comment.trim()} onPress={() => act('rejected')} />
          </>
        ) : (
          <>
            <Button title="Reject" icon={X} variant="secondary" size="sm" className="flex-1" onPress={() => setRejecting(true)} />
            <Button title="Approve" icon={Check} size="sm" className="flex-1" loading={isLoading} onPress={() => act('approved')} />
          </>
        )}
      </View>
    </Card>
  );
}

// Admins and managers review pending corrections here; everyone sees their own requests and their status.
export default function Regularization() {
  const me = useSelector((s) => s.auth.user);
  const lead = isLead(me);
  const pending = useGetRegularizationRequestsQuery('pending', { skip: !lead });
  const [from] = useState(() => ymd(new Date(Date.now() - 90 * 864e5)));
  const mine = useGetAttendanceListQuery({ employee: me._id, dateFrom: from, limit: 100, sort: '-date' });
  const refreshControl = usePullRefresh(() => Promise.all([mine.refetch(), ...(lead ? [pending.refetch()] : [])]));
  const requests = pending.data?.data?.requests || [];
  const myRequests = (mine.data?.data || []).filter((r) => r.regularization?.approval?.status);

  return (
    <Screen scroll className="gap-5 pt-2" refreshControl={refreshControl}>
      <PageHeader caption="ATTENDANCE" title="Regularization" right={<Button title="New" icon={Plus} size="sm" onPress={() => router.push('/attendance/regularize')} />} />

      {lead && (
        <View className="gap-3">
          <Text className="text-caption text-muted">WAITING FOR YOU · {requests.length}</Text>
          {pending.isLoading ? <DashboardState isLoading /> : requests.length ? requests.map((r) => <PendingRequest key={r._id} r={r} />) : (
            <Text className="text-sm text-muted">No corrections waiting. You’re all caught up.</Text>
          )}
        </View>
      )}

      <Section title="My requests" sub="Last 90 days">
        {mine.isLoading ? <DashboardState isLoading /> : myRequests.length ? myRequests.map((r) => (
          <View key={r._id} className="gap-1">
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 font-body-semibold">{longDate(ymd(r.date))}</Text>
              <RequestBadge status={r.regularization.approval.status} />
            </View>
            <Text className="text-sm tabular-nums">{asked(r.regularization.request)}</Text>
            {!!r.regularization.approval.comment && <Text className="text-sm text-muted">{`${r.regularization.approval.approvedBy?.name || 'Reviewer'}: ${r.regularization.approval.comment}`}</Text>}
          </View>
        )) : (
          <EmptyState icon={FilePenLine} title="No requests yet" message="Missed a clock-in or punched the wrong time? Ask for a correction." actionTitle="Request a correction" onAction={() => router.push('/attendance/regularize')} />
        )}
      </Section>
    </Screen>
  );
}
