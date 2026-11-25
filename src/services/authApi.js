import { api } from './api';

export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation({ query: (body) => ({ url: '/auth/login', method: 'POST', body }) }),
    getMe: builder.query({ query: () => '/auth/me', transformResponse: (res) => res.data.user }),
    registerPushToken: builder.mutation({ query: (token) => ({ url: '/auth/push-token', method: 'POST', body: { token } }) }),
    unregisterPushToken: builder.mutation({ query: (token) => ({ url: '/auth/push-token', method: 'DELETE', body: { token } }) }),
    logout: builder.mutation({ query: (refreshToken) => ({ url: '/auth/logout', method: 'POST', body: { refreshToken } }) }),
    forgotPassword: builder.mutation({ query: (email) => ({ url: '/auth/forgot-password', method: 'POST', body: { email } }) }),
    resetPassword: builder.mutation({ query: (body) => ({ url: '/auth/reset-password', method: 'POST', body }) }),
    changePassword: builder.mutation({ query: (body) => ({ url: '/auth/password', method: 'PUT', body }) }),
    resendVerification: builder.mutation({ query: (email) => ({ url: '/auth/resend-verification', method: 'POST', body: { email } }) }),
    verifyEmailOtp: builder.mutation({ query: (body) => ({ url: '/auth/verify-email-otp', method: 'POST', body }) }),
  }),
});

export const {
  useLoginMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useChangePasswordMutation,
  useResendVerificationMutation,
  useVerifyEmailOtpMutation,
} = authApi;
