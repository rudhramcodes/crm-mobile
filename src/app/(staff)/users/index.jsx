import {
  Button,
  Chip,
  ConfirmDialog,
  DashboardState,
  EmptyState,
  Input,
  PageHeader,
  Pager,
  Screen,
  Text,
  UserRow,
  usePullRefresh,
} from "@/components";
import { ROLE_LABELS } from "@/constants";
import { useTheme } from "@/constants/theme";
import { usePage, usePageNav } from "@/hooks/usePaged";
import {
  useDeleteUserMutation,
  useGetUserStatsQuery,
  useGetUsersQuery,
} from "@/services/userApi";
import { canAccessPayroll } from "@/utils/access";
import { isAdmin, runAction } from "@/utils/attendance";
import { cleanParams } from "@/utils/leads";
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { Plus, Search, ShieldAlert, UsersRound } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSelector } from "react-redux";

const LIMIT = 20;

// Users & Employees: same as the web — role counts + filter, search, paged list, delete for super admins.
export default function Users() {
  const me = useSelector((s) => s.auth.user);
  if (!isAdmin(me)) {
    return (
      <Screen>
        <PageHeader title="Users & Employees" oneLine fallback="/more" />
        <EmptyState
          icon={ShieldAlert}
          title="Admins only"
          message="Only admins can manage people and employees."
        />
      </Screen>
    );
  }
  return <UserList me={me} />;
}

function UserList({ me }) {
  const theme = useTheme();
  const payroll = canAccessPayroll(me);
  const [role, setRole] = useState("");
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [del, d] = useDeleteUserMutation();

  useEffect(() => {
    const t = setTimeout(() => setSearch(typed.trim()), 350);
    return () => clearTimeout(t);
  }, [typed]);

  const listRef = useRef(null);
  const filters = cleanParams({ search, role });
  const [page, setPage] = usePage(JSON.stringify(filters));
  const q = useGetUsersQuery({ ...filters, page, limit: LIMIT });
  const statsQ = useGetUserStatsQuery();
  const stats = statsQ.data?.data;
  const refreshControl = usePullRefresh(() => {
    statsQ.refetch();
    return q.refetch();
  });
  const users = q.data?.data?.users || [];
  const total = q.data?.data?.total ?? users.length;
  const pages = q.data?.data?.totalPages;
  const goTo = usePageNav(listRef, page, setPage, pages);
  const filtered = !!(search || role);
  const reset = () => {
    setTyped("");
    setSearch("");
    setRole("");
  };
  const count = (n) => (stats ? ` ${n || 0}` : "");

  const header = (
    <View className="gap-4 pb-4 pt-2">
      <PageHeader
        caption={`${total} ${total === 1 ? "PERSON" : "PEOPLE"}`}
        title="Users & Employees"
        oneLine
        fallback="/more"
        right={
          <Button
            title="New"
            icon={Plus}
            size="sm"
            onPress={() => router.push("/users/new")}
          />
        }
      />
      <Text className="text-sm text-muted">
        Manage employee records, and payroll-ready details.
      </Text>
      <Input
        value={typed}
        onChangeText={setTyped}
        onSubmitEditing={() => setSearch(typed.trim())}
        placeholder="Search by name or email..."
        accessibilityLabel="Search people"
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        right={
          <View className="h-11 w-11 items-center justify-center">
            <Search size={18} color={theme.muted} />
          </View>
        }
      />
      {/* Role counts double as the role filter (the web's stat cards + role select). */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-5"
        contentContainerClassName="gap-2 px-5"
      >
        <Chip
          label={`All${count(stats?.total)}`}
          active={!role}
          onPress={() => setRole("")}
        />
        {Object.entries(ROLE_LABELS).map(([value, label]) => (
          <Chip
            key={value}
            label={`${label}${count(stats?.[value])}`}
            active={role === value}
            onPress={() => setRole(value)}
          />
        ))}
      </ScrollView>
    </View>
  );

  const empty =
    q.isLoading || q.isError ? (
      <DashboardState
        isLoading={q.isLoading}
        isError={q.isError}
        refetch={q.refetch}
      />
    ) : (
      <EmptyState
        icon={UsersRound}
        title="No users found"
        message={
          filtered
            ? "Try another search or role."
            : "Create a user to get started."
        }
        actionTitle={filtered ? "Clear filters" : "Create User"}
        onAction={filtered ? reset : () => router.push("/users/new")}
      />
    );

  return (
    <Screen className="px-0">
      <FlashList
        ref={listRef}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        data={users}
        keyExtractor={(u) => u._id}
        renderItem={({ item }) => (
          <View className={q.isFetching ? "pb-2 opacity-50" : "pb-2"}>
            <UserRow
              user={item}
              showSalary={payroll}
              onDelete={
                me?.role === "super_admin" && item.role !== "super_admin"
                  ? setDeleting
                  : undefined
              }
            />
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          q.isError && users.length ? (
            <Button
              title="Couldn't load this page. Try again"
              variant="ghost"
              size="sm"
              onPress={q.refetch}
            />
          ) : (
            <Pager
              page={page}
              pages={pages}
              total={total}
              limit={LIMIT}
              loading={q.isFetching}
              onChange={goTo}
            />
          )
        }
        refreshControl={refreshControl}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
      />

      <ConfirmDialog
        visible={!!deleting}
        title="Delete User"
        message="Are you sure you want to delete this user? Users with payroll history cannot be deleted."
        confirmLabel="Delete"
        loading={d.isLoading}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          await runAction(
            del(deleting?._id),
            "User deleted",
            "Failed to delete user",
          );
          setDeleting(null);
        }}
      />
    </Screen>
  );
}
