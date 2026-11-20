import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { CalendarClock, Check } from 'lucide-react-native';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Input } from './Input';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { BrandMark } from './DashboardParts';
import { brandLabel } from './ClientParts';
import { PROJECT_STAGES } from '@/constants';
import { useTheme } from '@/constants/theme';
import { useChangeProjectStageMutation } from '@/services/projectApi';
import { runAction } from '@/utils/attendance';
import { isProjectLate, shortDate, stageIndex, stageOf } from '@/utils/projects';
import { cn } from '@/utils/cn';

// Five segments, filled up to the current stage; delivered turns green.
export function StageMeter({ stage, className }) {
  const at = stageIndex(stage);
  return (
    <View className={cn('flex-row gap-1', className)} accessible accessibilityLabel={`Stage ${at + 1} of 5: ${stageOf(stage)?.label || 'not set'}`}>
      {PROJECT_STAGES.map((s, i) => (
        <View key={s.value} className={cn('h-1.5 flex-1 rounded-full', i <= at ? (stage === 'delivered' ? 'bg-success' : 'bg-accent') : 'bg-sand')} />
      ))}
    </View>
  );
}

// A project in the list: title, client and venture, stage, deadline and team.
export function ProjectRow({ project: p }) {
  const theme = useTheme();
  const late = isProjectLate(p);
  const team = p.teamMembers || [];
  return (
    <Pressable
      onPress={() => router.push(`/projects/${p._id}`)}
      accessibilityLabel={`${p.title}, ${p.client?.companyName || ''}, ${stageOf(p.stage)?.label || 'no stage'}${p.deadline ? `, due ${shortDate(p.deadline)}` : ''}${late ? ', late' : ''}`}
      className="gap-3 rounded-3xl border border-line bg-surface p-4"
    >
      <View className="flex-row items-start gap-3">
        <View className="flex-1 gap-0.5">
          <Text numberOfLines={2} className="font-body-semibold">{p.title}</Text>
          <View className="flex-row items-center gap-1.5">
            {!!p.client?.brand && <BrandMark brand={p.client.brand} size={16} />}
            <Text numberOfLines={1} className="shrink text-sm text-muted">{[p.client?.companyName, brandLabel(p.client?.brand)].filter(Boolean).join(' · ')}</Text>
          </View>
        </View>
        {!!p.projectCode && <Text className="font-body-medium text-xs tabular-nums text-muted">{p.projectCode}</Text>}
      </View>
      <View className="gap-1.5">
        <StageMeter stage={p.stage} />
        <Text className="text-xs text-muted">{stageOf(p.stage)?.label || 'Needs SOP migration (web)'}</Text>
      </View>
      <View className="flex-row items-center gap-2">
        {!!p.deadline && (
          <View className="flex-row items-center gap-1.5">
            <CalendarClock size={14} color={late ? theme.danger : theme.muted} />
            <Text className={cn('text-sm', late ? 'font-body-semibold text-danger' : 'text-muted')}>{late ? 'Late · ' : ''}{shortDate(p.deadline)}</Text>
          </View>
        )}
        <View className="flex-1" />
        <View className="flex-row">
          {team.slice(0, 4).map((m, i) => <View key={m._id || i} style={{ marginLeft: i ? -8 : 0 }}><Avatar name={m.user?.name || '?'} uri={m.user?.avatar} size={24} /></View>)}
        </View>
        {team.length > 4 && <Text className="text-xs text-muted">+{team.length - 4}</Text>}
      </View>
    </Pressable>
  );
}

// The SOP stage bar. People who can edit tap a stage to move there; moving back asks why (the server requires it).
// Delivered needs admin QC, a closing note and every deliverable delivered: the server says what's missing.
export function StageBar({ project: p, canEdit }) {
  const theme = useTheme();
  const [change, c] = useChangeProjectStageMutation();
  const [back, setBack] = useState(null); // the earlier stage waiting for a reason
  const [reason, setReason] = useState('');
  const at = stageIndex(p.stage);
  const move = async (stage, why) => {
    const ok = await runAction(change({ id: p._id, stage, reason: why }), `Moved to ${stageOf(stage).label}`, "Couldn't change the stage");
    if (ok) { setBack(null); setReason(''); }
  };
  const tap = (s, i) => {
    if (i === at) return;
    if (i < at) { setBack(s.value); setReason(''); return; }
    move(s.value);
  };

  if (!p.stage) return <Text className="text-sm text-muted">This older project needs its SOP stage set on the web first.</Text>;
  return (
    <View className="gap-3">
      <View className="flex-row gap-1.5">
        {PROJECT_STAGES.map((s, i) => {
          const done = i < at || p.stage === 'delivered';
          return (
            <Pressable
              key={s.value}
              disabled={!canEdit || c.isLoading}
              onPress={() => tap(s, i)}
              accessibilityRole="button"
              accessibilityState={{ selected: i === at, disabled: !canEdit }}
              accessibilityLabel={`${s.label}${i === at ? ', current stage' : canEdit ? `. Move here` : ''}`}
              className="flex-1 items-center gap-1.5"
            >
              <View className={cn('h-7 w-7 items-center justify-center rounded-full', done ? (p.stage === 'delivered' ? 'bg-success' : 'bg-accent') : i === at ? 'border-2 border-accent bg-surface' : 'bg-sand')}>
                {done ? <Check size={14} color={theme.bg} /> : <Text className="text-xs font-body-semibold tabular-nums">{i + 1}</Text>}
              </View>
              <Text numberOfLines={1} className={cn('text-[11px]', i === at ? 'font-body-semibold text-ink' : 'text-muted')}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {!!back && (
        <View className="gap-2 rounded-2xl bg-surface-2 p-3">
          <Text className="font-body-semibold">Move back to {stageOf(back).label}?</Text>
          <Input value={reason} onChangeText={setReason} placeholder="Why? The team sees this." accessibilityLabel="Reason for moving back" maxLength={2000} autoFocus />
          <View className="flex-row gap-2">
            <Button title="Cancel" variant="secondary" size="sm" className="flex-1" onPress={() => setBack(null)} />
            <Button title="Move back" size="sm" className="flex-1" disabled={!reason.trim()} loading={c.isLoading} onPress={() => move(back, reason.trim())} />
          </View>
        </View>
      )}
      {canEdit && !back && p.stage !== 'delivered' && <Text className="text-xs text-muted">Tap a stage to move the project. Delivered needs the admin QC and a closing note (on the web for now).</Text>}
    </View>
  );
}
