import { API_BASE_URL } from '@/constants';
import { loggedOut, setCredentials } from '@/store/authSlice';
import { clearRefreshToken, getRefreshToken, saveRefreshToken } from '@/utils/refreshToken';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// Mobile has no cookies: send the access token as Bearer and refresh with the stored refresh token.
const baseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth.accessToken;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Client', 'mobile');
    return headers;
  },
});

let refreshing = null;

const refresh = async (api, extraOptions) => {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return false;
  const res = await baseQuery({ url: '/auth/refresh-token', method: 'POST', body: { refreshToken } }, api, extraOptions);
  const tokens = res.data?.data;
  if (!tokens?.accessToken) return false;
  if (tokens.refreshToken) await saveRefreshToken(tokens.refreshToken);
  api.dispatch(setCredentials({ accessToken: tokens.accessToken }));
  return true;
};

const baseQueryWithReauth = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);
  if (result.error?.status !== 401) return result;

  // One refresh at a time: parallel 401s wait for the same rotation instead of racing it.
  refreshing ??= refresh(api, extraOptions).finally(() => { refreshing = null; });
  if (await refreshing) return baseQuery(args, api, extraOptions);

  await clearRefreshToken();
  api.dispatch(loggedOut());
  return result;
};

export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'ProjectActivities',
    'ProjectStats',
    'EmailPreviews',
    'Lead',
    'LeadStats',
    'Client',
    'ClientMe',
    'PortalStaff',
    'Meeting',
    'Project',
    'Task',
    'Team',
    'Invoice',
    'InvoiceStats',
    'Quotation',
    'QuotationStats',
    'Payment',
    'PaymentStats',
    'Dashboard',
    'Report',
    'Notification',
    'User',
    'UserStats',
    'NotifPrefs',
    'OrgSettings',
    'RolesPerms',
    'SecuritySettings',
    'IntegrationSettings',
    'Attendance',
    'AttendanceToday',
    'AttendanceStats',
    'AttendanceReport',
    'Leave',
    'LeaveBalance',
    'Shift',
    'Holiday',
    'Freelancer',
    'PayrollRun',
    'SalarySlip',
  ],
  endpoints: () => ({}),
});
