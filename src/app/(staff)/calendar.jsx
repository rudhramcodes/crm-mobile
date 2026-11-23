import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Card, CalendarLegend, DashboardState, DayAgenda, MonthGrid, PageHeader, Screen, useCalendarItems, usePullRefresh } from '@/components';
import { ymd } from '@/utils/attendance';

// Full month of my tasks and meetings. Opens on ?day= (from the Home card) or today.
export default function CalendarScreen() {
  const params = useLocalSearchParams();
  const [day, setDay] = useState(() => (typeof params.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : ymd()));
  const [month, setMonth] = useState(() => ({ y: Number(day.slice(0, 4)), m: Number(day.slice(5, 7)) - 1 }));
  const from = ymd(new Date(month.y, month.m, 1));
  const to = ymd(new Date(month.y, month.m + 1, 0));
  const { byDay, isFetching, isError, refetch } = useCalendarItems(from, to);
  const refreshControl = usePullRefresh(refetch);

  // Changing month selects its 1st (or today, if it's this month) so the list below always matches the grid.
  const onMonth = (next) => {
    setMonth(next);
    const first = ymd(new Date(next.y, next.m, 1));
    setDay(ymd().slice(0, 7) === first.slice(0, 7) ? ymd() : first);
  };

  return (
    <Screen scroll className="gap-5 pt-2" refreshControl={refreshControl}>
      <PageHeader caption="WORKSPACE" title="Calendar" fallback="/" />
      <Card className="gap-3 p-4">
        <MonthGrid month={month} onMonth={onMonth} day={day} onSelect={setDay} byDay={byDay} loading={isFetching} />
        <CalendarLegend />
      </Card>
      {isError ? <DashboardState isError refetch={refetch} /> : <DayAgenda day={day} items={byDay[day]} />}
    </Screen>
  );
}
