import {
  Button,
  DashboardState,
  EmptyState,
  Input,
  PageHeader,
  Pager,
  Screen,
  UserRow,
  usePullRefresh,
} from "@/components";
import { LOCATIONS } from "@/constants";
import { useTheme } from "@/constants/theme";
import { usePage, usePageNav } from "@/hooks/usePaged";
import { useGetUsersQuery } from "@/services/userApi";
import { isAdmin } from "@/utils/attendance";
import { cleanParams } from "@/utils/leads";
import { teamName } from "@/utils/users";
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams } from "expo-router";
import { MapPin, Search } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useSelector } from "react-redux";

const LIMIT = 20;

// People in one location team (active staff). Admins tap someone to edit them (e.g. move them to another office).
export default function LocationTeam() {
  const { location } = useLocalSearchParams();
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const admin = isAdmin(me);
  const valid = LOCATIONS.includes(location) || (location === "none" && admin);
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearch(typed.trim()), 350);
    return () => clearTimeout(t);
  }, [typed]);

  const listRef = useRef(null);
  const filters = cleanParams({ location, search, isActive: true });
  const [page, setPage] = usePage(JSON.stringify(filters));
  const q = useGetUsersQuery({ ...filters, page, limit: LIMIT }, { skip: !valid });
  const refreshControl = usePullRefresh(q.refetch);
  const people = q.data?.data?.users || [];
  const total = q.data?.data?.total ?? people.length;
  const pages = q.data?.data?.totalPages;
  const goTo = usePageNav(listRef, page, setPage, pages);

  if (!valid) {
    return (
      <Screen>
        <PageHeader title="Teams" fallback="/teams" />
        <EmptyState icon={MapPin} title="Team not found" message="Pick Surat, Mumbai or Delhi from Teams." />
      </Screen>
    );
  }

  const header = (
    <View className="gap-4 pb-4 pt-2">
      <PageHeader
        caption={`${total} ${total === 1 ? "PERSON" : "PEOPLE"}`}
        title={teamName(location)}
        fallback="/teams"
      />
      <Input
        value={typed}
        onChangeText={setTyped}
        onSubmitEditing={() => setSearch(typed.trim())}
        placeholder="Search by name or email..."
        accessibilityLabel="Search team"
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        right={
          <View className="h-11 w-11 items-center justify-center">
            <Search size={18} color={theme.muted} />
          </View>
        }
      />
    </View>
  );

  const empty =
    q.isLoading || q.isError ? (
      <DashboardState isLoading={q.isLoading} isError={q.isError} refetch={q.refetch} />
    ) : (
      <EmptyState
        icon={MapPin}
        title={search ? "No one matches" : "No one here yet"}
        message={
          search
            ? "Try another name or email."
            : admin
              ? "Set a person's location in Users to add them."
              : "Admins add people by setting their location."
        }
      />
    );

  return (
    <Screen className="px-0">
      <FlashList
        ref={listRef}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        data={people}
        keyExtractor={(u) => u._id}
        renderItem={({ item }) => (
          <View className={q.isFetching ? "pb-2 opacity-50" : "pb-2"}>
            <UserRow user={item} readOnly={!admin} />
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          q.isError && people.length ? (
            <Button title="Couldn't load this page. Try again" variant="ghost" size="sm" onPress={q.refetch} />
          ) : (
            <Pager page={page} pages={pages} total={total} limit={LIMIT} loading={q.isFetching} onChange={goTo} />
          )
        }
        refreshControl={refreshControl}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
      />
    </Screen>
  );
}
