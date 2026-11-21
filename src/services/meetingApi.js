import { api } from './api';

export const meetingApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getMeetings: builder.query({
      query: (params) => ({
        url: '/meetings',
        params,
      }),
      providesTags: ['Meeting'],
      keepUnusedDataFor: 0,
    }),

    // Pages of 20 for the list; all loaded pages refetch together when the Meeting tag is invalidated.
    getMeetingPages: builder.infiniteQuery({
      infiniteQueryOptions: {
        initialPageParam: 1,
        getNextPageParam: (last) => (last.pagination?.hasNextPage ? last.pagination.page + 1 : undefined),
      },
      query: ({ queryArg, pageParam }) => ({ url: '/meetings', params: { ...queryArg, page: pageParam, limit: 20 } }),
      providesTags: ['Meeting'],
    }),

    getMeetingById: builder.query({
      query: (id) => `/meetings/${id}`,
      providesTags: (result, error, id) => [{ type: 'Meeting', id }],
    }),

    createMeeting: builder.mutation({
      query: (body) => ({
        url: '/meetings',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Meeting'],
    }),

    generateMeetingLink: builder.mutation({
      query: (body) => ({
        url: '/meetings/generate-link',
        method: 'POST',
        body,
      }),
      transformResponse: (r) => r.data?.link,
    }),

    updateMeeting: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/meetings/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Meeting', id },
        'Meeting',
      ],
    }),

    updateMeetingNotes: builder.mutation({
      query: ({ id, notes }) => ({
        url: `/meetings/${id}/notes`,
        method: 'PATCH',
        body: { notes },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Meeting', id },
        'Meeting',
      ],
    }),

    deleteMeeting: builder.mutation({
      query: ({ id, allSeries }) => ({
        url: `/meetings/${id}`,
        method: 'DELETE',
        params: allSeries ? { allSeries: true } : undefined,
      }),
      invalidatesTags: ['Meeting'],
    }),

    addActionItem: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/meetings/${id}/action-items`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Meeting', id },
        'Meeting',
      ],
    }),

    updateActionItem: builder.mutation({
      query: ({ id, itemId, ...body }) => ({
        url: `/meetings/${id}/action-items/${itemId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Meeting', id },
        'Meeting',
      ],
    }),

    removeActionItem: builder.mutation({
      query: ({ id, itemId }) => ({
        url: `/meetings/${id}/action-items/${itemId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Meeting', id },
        'Meeting',
      ],
    }),

    convertActionItem: builder.mutation({
      // The server needs an assignee and deadline when the item has none (the web drops them and gets a 400).
      query: ({ id, itemId, projectId, assignedTo, dueDate }) => ({
        url: `/meetings/${id}/action-items/${itemId}/convert`,
        method: 'POST',
        body: { projectId, assignedTo, dueDate },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Meeting', id },
        'Meeting',
        'Task',
      ],
    }),
  }),
});

export const {
  useGetMeetingsQuery,
  useGetMeetingPagesInfiniteQuery,
  useGetMeetingByIdQuery,
  useCreateMeetingMutation,
  useGenerateMeetingLinkMutation,
  useUpdateMeetingMutation,
  useUpdateMeetingNotesMutation,
  useDeleteMeetingMutation,
  useAddActionItemMutation,
  useUpdateActionItemMutation,
  useRemoveActionItemMutation,
  useConvertActionItemMutation,
} = meetingApi;
