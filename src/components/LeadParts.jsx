import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { Card } from './Card';
import { Chip } from './Chip';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { ConfirmDelete } from './AttendanceParts';
import { BrandMark } from './DashboardParts';
import { showToast } from './Toast';
import { ZoomLink } from './ZoomLink';
import { LEAD_BRANDS, LEAD_SOURCES, LEAD_STATUS } from '@/constants';
import { useBulkDeleteLeadsMutation, useBulkUpdateLeadsMutation, useUpdateLeadMutation } from '@/services/leadApi';
import { useTheme } from '@/constants/theme';
import { isAdmin, runAction } from '@/utils/attendance';
import { BULK_STATUSES, clientIdOf, statusStep } from '@/utils/leads';
import { cn } from '@/utils/cn';

export const leadStatus = (v) => LEAD_STATUS.find((s) => s.value === v) || { value: v, label: v || 'Unknown', color: 'bg-surface-2 text-muted' };
export const labelOf = (list, v) => list.find((x) => x.value === v)?.label || v || '';

export function LeadStatusBadge({ status }) {
  const m = leadStatus(status);
  return <Badge label={m.label} color={m.color} />;
}

// Opens the community-group check; `then` = call | whatsapp opens that app after it instead of changing status.
export const openCommunity = (lead, params) => router.push({
  pathname: '/leads/community',
  params: { id: lead._id, name: lead.name, brand: lead.brand || '', clientId: clientIdOf(lead), phone: lead.phone || '', ...params },
});

// One entry point for every status change (detail chips, board arrows), so the web rules apply everywhere.
export function useLeadStatus() {
  const [update] = useUpdateLeadMutation();
  return (lead, next) => {
    switch (statusStep(lead, next)) {
      case 'contact_first':
        return showToast({ title: 'Contact the lead first', message: "A new lead can't be marked lost." });
      case 'lost':
        return router.push({ pathname: '/leads/lost', params: { id: lead._id, name: lead.name } });
      case 'community':
        return openCommunity(lead, { status: next });
      case 'update':
        return runAction(update({ id: lead._id, status: next }), next === 'won' ? 'Converted to client' : `Moved to ${leadStatus(next).label}`, "Couldn't change the stage");
      default:
        return null;
    }
  };
}

// Name, company or email, stage, unread dot. Long-press starts selecting.
export function LeadRow({ lead: l, selecting, selected, onToggleSelect }) {
  const theme = useTheme();
  const open = () => onToggleSelect(l._id); // while selecting; otherwise the row is a zoom link
  return (
    <ZoomLink href={selecting ? null : `/leads/${l._id}`}>
      <Pressable
        onPress={selecting ? open : undefined}
        onLongPress={onToggleSelect && !selecting ? () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onToggleSelect(l._id); } : undefined}
        accessibilityLabel={`${l.name}${l.isRead === false ? ', unread' : ''}, ${leadStatus(l.status).label}${l.company ? `, ${l.company}` : ''}`}
        accessibilityState={selecting ? { selected: !!selected } : undefined}
        className={cn('flex-row items-center gap-3 rounded-3xl border bg-surface p-4', selected ? 'border-accent' : 'border-line')}
      >
        {selecting ? (
          <View className={cn('h-6 w-6 items-center justify-center rounded-full border-[1.5px]', selected ? 'border-ink bg-ink' : 'border-line')}>
            {selected && <Check size={14} color={theme.bg} />}
          </View>
        ) : <Avatar name={l.name} size={36} />}
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            {l.isRead === false && <View className="h-2 w-2 rounded-full bg-accent" />}
            <Text numberOfLines={1} className={cn('flex-1', l.isRead === false ? 'font-body-semibold' : 'font-body-medium')}>{l.name}</Text>
            {!!l.brand && (
              <View className="max-w-[45%] flex-row items-center gap-1.5">
                <BrandMark brand={l.brand} size={18} />
                <Text numberOfLines={1} className="shrink text-xs text-muted">{labelOf(LEAD_BRANDS, l.brand)}</Text>
              </View>
            )}
          </View>
          <Text numberOfLines={1} className="text-sm text-muted">
            {[l.company || l.email, labelOf(LEAD_SOURCES, l.source)].filter(Boolean).join(' · ')}
          </Text>
          <LeadStatusBadge status={l.status} />
        </View>
      </Pressable>
    </ZoomLink>
  );
}

const row = (items) => <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4" contentContainerClassName="gap-2 px-4">{items}</ScrollView>;
const ALL = { value: '', label: 'All' };

// Stage and source. Search and the venture row live above it.
export function LeadFilters({ f, set }) {
  return (
    <Card className="gap-3 p-4">
      <Text className="text-caption text-muted">STAGE</Text>
      {row([ALL, ...LEAD_STATUS].map((s) => <Chip key={s.value || 'all'} label={s.label} active={f.status === s.value} onPress={() => set({ status: s.value })} />))}
      <Text className="text-caption text-muted">SOURCE</Text>
      {row([ALL, ...LEAD_SOURCES].map((s) => <Chip key={s.value || 'all'} label={s.label} active={f.source === s.value} onPress={() => set({ source: s.value })} />))}
    </Card>
  );
}

// Always-visible venture switcher: logo (or initial) + name per venture.
// noneLabel={null} hides the "all/none" chip (venture required); counts = { [brand or '']: n } adds a count pill.
export function VentureChips({ value, onChange, noneLabel = 'All ventures', counts }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-2 px-5">
      {(noneLabel === null ? LEAD_BRANDS : [ALL, ...LEAD_BRANDS]).map((b) => {
        const active = value === b.value;
        const count = counts?.[b.value];
        return (
          <Pressable
            key={b.value || 'all'}
            onPress={() => onChange(b.value)}
            accessibilityLabel={`${b.value ? `Venture ${b.label}` : noneLabel}${count != null ? `, ${count}` : ''}`}
            accessibilityState={{ selected: active }}
            className={cn('h-10 flex-row items-center gap-2 rounded-full pr-4', b.value ? 'pl-1.5' : 'pl-4', active ? 'bg-ink' : 'bg-surface-2')}
          >
            {!!b.value && <BrandMark brand={b.value} size={28} />}
            <Text className={cn('font-body-medium text-sm', active ? 'text-bg' : 'text-ink')}>{b.value ? b.label : noneLabel}</Text>
            {count != null && (
              <View className={cn('rounded-full px-1.5', active ? 'bg-bg/20' : 'bg-bg')}>
                <Text className={cn('text-xs tabular-nums', active ? 'text-bg' : 'text-muted')}>{count}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// Bulk stage (early stages only, like the server) and admin delete.
export function LeadBulkBar({ leads, selected, onSelect, onClear }) {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const [bulk, { isLoading }] = useBulkUpdateLeadsMutation();
  const [remove, d] = useBulkDeleteLeadsMutation();
  const picked = leads.filter((l) => selected.includes(l._id));
  const n = selected.length;
  const all = !!leads.length && n === leads.length;

  const set = async (status) => {
    if (isLoading) return;
    // The group check is per lead, so a new lead leaving "new" goes through it alone (web behaviour).
    const needsGroup = picked.find((l) => statusStep(l, status) === 'community' && l.status === 'new');
    if (needsGroup) {
      showToast({ title: 'Confirm the community group first', message: `${needsGroup.name} is still new.` });
      return openCommunity(needsGroup, { status });
    }
    if (await runAction(bulk({ ids: selected, data: { status } }), `${n} ${n === 1 ? 'lead' : 'leads'} moved to ${leadStatus(status).label}`, "Couldn't update")) onClear();
  };
  const del = async () => {
    if (await runAction(remove(selected), `${n} deleted`, "Couldn't delete")) onClear();
  };

  return (
    <Card className="gap-3 border-accent p-4">
      <View className="flex-row items-center">
        <Text className="flex-1 font-body-semibold">{n} of {leads.length} selected</Text>
        <Pressable onPress={() => onSelect(all ? [] : leads.map((l) => l._id))} accessibilityLabel={all ? 'Deselect all' : `Select all ${leads.length}`} className="h-11 justify-center px-2">
          <Text className="font-body-semibold text-accent-ink">{all ? 'Deselect all' : 'Select all'}</Text>
        </Pressable>
        <Pressable onPress={onClear} accessibilityLabel="Clear selection" className="h-11 w-11 items-center justify-center"><X size={20} color={theme.ink} /></Pressable>
      </View>
      {!!n && (
        <>
          <Text className="text-caption text-muted">SET STAGE</Text>
          <View className="flex-row flex-wrap gap-2">
            {BULK_STATUSES.map((s) => <Chip key={s} label={leadStatus(s).label} onPress={() => set(s)} />)}
          </View>
          {isAdmin(me) && <ConfirmDelete label={`Delete ${n}`} loading={d.isLoading} onConfirm={del} />}
        </>
      )}
    </Card>
  );
}

// Kanban: one column per stage. Move mode shows arrows (no drag on a phone); every move goes through the rules.
export function LeadBoard({ leads, canWrite }) {
  const [moving, setMoving] = useState(false);
  const change = useLeadStatus();

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2">
        {canWrite && <Chip label={moving ? 'Done moving' : 'Move cards'} active={moving} onPress={() => setMoving((m) => !m)} />}
        <Text className="flex-1 text-sm text-muted">Swipe sideways for more stages.</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={292} decelerationRate="fast" className="-mx-5" contentContainerClassName="gap-3 px-5">
        {LEAD_STATUS.map((s, si) => {
          const col = leads.filter((l) => l.status === s.value);
          const prev = LEAD_STATUS[si - 1];
          const next = LEAD_STATUS[si + 1];
          return (
            <View key={s.value} className="w-[280px] gap-2 rounded-3xl bg-surface-2 p-3">
              <View className="flex-row items-center gap-2 px-1 py-1.5">
                <Text className="flex-1 font-body-semibold">{s.label}</Text>
                <Text className="text-sm text-muted tabular-nums">{col.length}</Text>
              </View>
              {col.map((l) => (
                <View key={l._id} className="gap-1">
                  <LeadRow lead={l} />
                  {moving && (
                    <View className="flex-row justify-between px-1">
                      <MoveBtn icon={ChevronLeft} label={prev ? `Move to ${prev.label}` : 'Already first stage'} disabled={!prev} onPress={() => change(l, prev?.value)} />
                      <MoveBtn icon={ChevronRight} label={next ? `Move to ${next.label}` : 'Already last stage'} disabled={!next} onPress={() => change(l, next?.value)} />
                    </View>
                  )}
                </View>
              ))}
              {!col.length && <Text className="px-1 py-6 text-center text-sm text-muted">No leads</Text>}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function MoveBtn({ icon: Icon, label, disabled, onPress }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityLabel={label} className={cn('h-11 w-14 items-center justify-center rounded-full bg-surface', disabled && 'opacity-30')}>
      <Icon size={18} color={theme.ink} />
    </Pressable>
  );
}
