import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { Check, Plane, Plus, X } from 'lucide-react-native';
import {
  Avatar, BalanceCards, Button, Card, Chip, DashboardState, EmptyState, Input, PageHeader, RequestBadge, Screen, Text, leaveDays, longDate, usePullRefresh,
} from '@/components';
import { useApproveLeaveMutation, useGetLeaveBalanceQuery, useGetLeavesQuery, useRejectLeaveMutation } from '@/services/attendanceApi';
import { LEAVE_TYPES } from '@/constants';
import { isLead, runAction, ymd } from '@/utils/attendance';

const typeLabel = (v) => LEAVE_TYPES.find((t) => t.value === v)?.label || v;
const STATUS = [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']];

// One request; admins and managers can approve or reject someone else's pending leave with an optional comment.
function LeaveCard({ l, canReview, showName }) {
  const [approve, a] = useApproveLeaveMutation();
  const [reject, r] = useRejectLeaveMutation();
  const [acting, setActing] = useState(null);
  const [comment, setComment] = useState('');
  const s = ymd(l.startDate);
  const e = ymd(l.endDate);
  const days = leaveDays(s, e);
  const go = () => runAction((acting === 'approve' ? approve : reject)({ id: l._id, comment: comment.trim() || undefined }), acting === 'approve' ? 'Leave approved' : 'Leave rejected');

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-3">
        {showName && <Avatar name={l.employee?.name || '?'} uri={l.employee?.avatar} size={40} />}
        <View className="flex-1">
          <Text className="font-body-semibold">{showName ? l.employee?.name : `${typeLabel(l.leaveType)} leave`}</Text>
          <Text className="text-sm text-muted">{showName ? `${typeLabel(l.leaveType)} · ` : ''}{days} {days === 1 ? 'day' : 'days'}</Text>
        </View>
        <RequestBadge status={l.status} />
      </View>
      <Text className="font-body-medium">{s === e ? longDate(s) : `${longDate(s)} → ${longDate(e)}`}</Text>
      <Text className="text-sm text-muted">{l.reason}</Text>
      {!!l.comment && <Text className="text-sm">{`${l.approvedBy?.name || 'Reviewer'}: ${l.comment}`}</Text>}
      {canReview && l.status === 'pending' && (acting ? (
        <View className="gap-3">
          <Input label={acting === 'approve' ? 'Comment (optional)' : 'Reason (optional)'} value={comment} onChangeText={setComment} maxLength={500} autoFocus />
          <View className="flex-row gap-3">
            <Button title="Cancel" variant="ghost" size="sm" className="flex-1" onPress={() => setActing(null)} />
            <Button title={acting === 'approve' ? 'Approve' : 'Reject'} variant={acting === 'approve' ? 'primary' : 'danger'} size="sm" className="flex-1" loading={a.isLoading || r.isLoading} onPress={go} />
          </View>
        </View>
      ) : (
        <View className="flex-row gap-3">
          <Button title="Reject" icon={X} variant="secondary" size="sm" className="flex-1" onPress={() => setActing('reject')} />
          <Button title="Approve" icon={Check} size="sm" className="flex-1" onPress={() => setActing('approve')} />
        </View>
      ))}
    </Card>
  );
}

// Balance, my requests, and for admins and managers everyone's requests to approve.
export default function Leaves() {
  const me = useSelector((s) => s.auth.user);
  const lead = isLead(me);
  const [status, setStatus] = useState(lead ? 'pending' : 'all');
  const [team, setTeam] = useState(lead);
  // shortcut: newest 50 only; add paging when a filter routinely holds more.
  const list = useGetLeavesQuery({ status, page: 1, limit: 50, employee: team ? undefined : me._id });
  const bal = useGetLeaveBalanceQuery(me._id);
  const refreshControl = usePullRefresh(() => Promise.all([list.refetch(), bal.refetch()]));
  const leaves = list.data?.data || [];
  const pendingCount = list.data?.pagination?.pendingCount ?? 0;

  return (
    <Screen scroll className="gap-5 pt-2" refreshControl={refreshControl}>
      <PageHeader caption="ATTENDANCE" title="Leaves" right={<Button title="Apply" icon={Plus} size="sm" onPress={() => router.push('/attendance/apply-leave')} />} />
      <BalanceCards balance={bal.data?.data?.balance} />
      <Text className="-mt-2 text-xs text-muted">Maternity and paternity leave aren’t counted against a balance.</Text>

      {lead && (
        <View className="flex-row gap-2">
          <Chip label="Team" active={team} onPress={() => setTeam(true)} />
          <Chip label="Mine" active={!team} onPress={() => setTeam(false)} />
        </View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5 -mt-2" contentContainerClassName="gap-2 px-5">
        {STATUS.map(([v, label]) => <Chip key={v} label={label} count={v === 'pending' ? pendingCount : undefined} active={status === v} onPress={() => setStatus(v)} />)}
      </ScrollView>

      {list.isLoading || list.isError ? <DashboardState isLoading={list.isLoading} isError={list.isError} refetch={list.refetch} /> : leaves.length ? (
        <View className="gap-3">
          {leaves.map((l) => <LeaveCard key={l._id} l={l} showName={team} canReview={lead && (l.employee?._id || l.employee) !== me._id} />)}
        </View>
      ) : (
        <EmptyState icon={Plane} title={status === 'pending' ? 'Nothing pending' : 'No leave requests'} message="Requests show up here with their status." actionTitle="Apply for leave" onAction={() => router.push('/attendance/apply-leave')} />
      )}
    </Screen>
  );
}
