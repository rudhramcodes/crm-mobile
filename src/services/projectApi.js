import { api } from './api';
import { uploadPart } from './taskApi';

export const projectApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getProjects: builder.query({
      query: (params) => ({ url: '/projects', params }),
      providesTags: ['Project'],
    }),
    // Server-side pages of 20 for the lists; every loaded page refetches together when the Project tag is invalidated.
    getProjectPages: builder.infiniteQuery({
      infiniteQueryOptions: {
        initialPageParam: 1,
        getNextPageParam: (last) => (last.pagination?.hasNextPage ? last.pagination.page + 1 : undefined),
      },
      query: ({ queryArg, pageParam }) => ({ url: '/projects', params: { ...queryArg, page: pageParam, limit: 20 } }),
      providesTags: ['Project'],
    }),
    getProjectById: builder.query({
      query: (id) => `/projects/${id}`,
      providesTags: (result, error, id) => [{ type: 'Project', id }],
    }),
    getProjectStats: builder.query({
      query: () => '/projects/stats',
      providesTags: ['ProjectStats'],
    }),
    createProject: builder.mutation({
      query: (body) => ({ url: '/projects', method: 'POST', body }),
      invalidatesTags: ['Project', 'ProjectStats'],
    }),
    updateProject: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/projects/${id}`, method: 'PATCH', body }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Project', id }, 'Project', 'ProjectStats'],
    }),
    deleteProject: builder.mutation({
      query: (id) => ({ url: `/projects/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Project', 'ProjectStats'],
    }),
    getProjectActivities: builder.query({
      query: (id) => `/projects/${id}/activities`,
      providesTags: (result, error, id) => [{ type: 'ProjectActivities', id }],
    }),
    updateProjectMilestones: builder.mutation({
      query: ({ id, milestones, reason }) => ({
        url: `/projects/${id}/milestones`,
        method: 'PATCH',
        body: { milestones, ...(reason ? { reason } : {}) },
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Project', id }, 'Project', 'ProjectStats'],
    }),
    changeProjectStage: builder.mutation({
      query: ({ id, stage, reason }) => ({
        url: `/projects/${id}/stage`,
        method: 'PATCH',
        body: { stage, ...(reason ? { reason } : {}) },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Project', id }, 'Project', 'ProjectStats', { type: 'ProjectActivities', id },
      ],
    }),
    saveProjectQualityCheck: builder.mutation({
      query: ({ id, ...checks }) => ({
        url: `/projects/${id}/quality-check`,
        method: 'PATCH',
        body: checks,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Project', id }, 'Project', { type: 'ProjectActivities', id },
      ],
    }),
    saveProjectClosingNote: builder.mutation({
      query: ({ id, ...note }) => ({
        url: `/projects/${id}/closing-note`,
        method: 'PATCH',
        body: note,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Project', id }, 'Project', { type: 'ProjectActivities', id },
      ],
    }),
    addProjectTask: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/projects/${id}/tasks`, method: 'POST', body }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Project', id }, 'Project'],
    }),
    updateProjectTask: builder.mutation({
      query: ({ id, taskId, ...body }) => ({ url: `/projects/${id}/tasks/${taskId}`, method: 'PATCH', body }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Project', id }, 'Project'],
    }),
    deleteProjectTask: builder.mutation({
      query: ({ id, taskId }) => ({ url: `/projects/${id}/tasks/${taskId}`, method: 'DELETE' }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Project', id }, 'Project'],
    }),
    // Text, or multipart with up to 5 photos (field "images"), the same way task chat sends files.
    addProjectMessage: builder.mutation({
      query: ({ id, text, files = [] }) => {
        if (!files.length) return { url: `/projects/${id}/messages`, method: 'POST', body: { text } };
        const body = new FormData();
        if (text) body.append('text', text);
        files.forEach((f) => body.append('images', uploadPart(f)));
        return { url: `/projects/${id}/messages`, method: 'POST', body };
      },
      invalidatesTags: (result, error, { id }) => [{ type: 'Project', id }, { type: 'ProjectActivities', id }],
    }),
    getProjectMessages: builder.query({
      query: ({ id }) => `/projects/${id}/messages`,
      // Also the project's own tag, so a live "project changed" event refreshes the chat.
      providesTags: (result, error, { id }) => [{ type: 'ProjectActivities', id }, { type: 'Project', id }],
    }),
    deleteProjectMessage: builder.mutation({
      query: ({ id, messageId }) => ({
        url: `/projects/${id}/messages/${messageId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Project', id }, { type: 'ProjectActivities', id }],
    }),
  }),
});

export const {
  useGetProjectsQuery,
  useGetProjectPagesInfiniteQuery,
  useGetProjectByIdQuery,
  useGetProjectStatsQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  useGetProjectActivitiesQuery,
  useAddProjectTaskMutation,
  useUpdateProjectTaskMutation,
  useDeleteProjectTaskMutation,
  useUpdateProjectMilestonesMutation,
  useChangeProjectStageMutation,
  useSaveProjectQualityCheckMutation,
  useSaveProjectClosingNoteMutation,
  useAddProjectMessageMutation,
  useGetProjectMessagesQuery,
  useDeleteProjectMessageMutation,
} = projectApi;
