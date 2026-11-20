import { api } from './api';

// Saved groups of people ("Edit team") for the task people picker.
export const teamApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getTeams: builder.query({
      query: () => '/teams',
      transformResponse: (r) => r.data?.teams || [],
      providesTags: ['Team'],
    }),
    saveTeam: builder.mutation({
      query: ({ _id, ...body }) => ({ url: _id ? `/teams/${_id}` : '/teams', method: _id ? 'PATCH' : 'POST', body }),
      invalidatesTags: ['Team'],
    }),
    deleteTeam: builder.mutation({
      query: (id) => ({ url: `/teams/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Team'],
    }),
  }),
});

export const { useGetTeamsQuery, useSaveTeamMutation, useDeleteTeamMutation } = teamApi;
