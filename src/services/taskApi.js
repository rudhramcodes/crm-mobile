import { File } from 'expo-file-system';
import { api } from './api';

// Expo's fetch (installed as the global fetch in this SDK) can't send React Native's { uri } parts and fails before the request
// leaves the phone. It sends anything with name, type and bytes(), so read the picked file that way.
const uploadPart = (f) => f.file ?? { name: f.name, type: f.mime, bytes: () => new File(f.uri).bytes() };

export const taskApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getTasks: builder.query({
      query: (params) => ({ url: '/tasks', params }),
      providesTags: ['Task'],
      keepUnusedDataFor: 0,
    }),
    getTaskById: builder.query({
      query: (id) => `/tasks/${id}`,
      providesTags: (result, error, id) => [{ type: 'Task', id }],
    }),
    createTask: builder.mutation({
      query: (body) => ({ url: '/tasks', method: 'POST', body }),
      invalidatesTags: ['Task'],
    }),
    updateTask: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/tasks/${id}`, method: 'PATCH', body }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Task', id }, 'Task'],
    }),
    deleteTask: builder.mutation({
      query: (id) => ({ url: `/tasks/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Task'],
    }),
    getSubtasks: builder.query({
      query: (id) => `/tasks/${id}/subtasks`,
      providesTags: (result, error, id) => [{ type: 'Task', id }, 'Task'],
    }),
    getDependencies: builder.query({
      query: (id) => `/tasks/${id}/dependencies`,
      providesTags: (result, error, id) => [{ type: 'Task', id }],
    }),
    addDependency: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/tasks/${id}/dependencies`, method: 'POST', body }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Task', id }, 'Task'],
    }),
    removeDependency: builder.mutation({
      query: ({ id, depId }) => ({ url: `/tasks/${id}/dependencies/${depId}`, method: 'DELETE' }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Task', id }, 'Task'],
    }),
    addTaskComment: builder.mutation({
      // With files it goes as multipart: web pickers give a File, native ones are read through uploadPart.
      query: ({ id, text, replyTo, files = [] }) => {
        if (!files.length) return { url: `/tasks/${id}/comments`, method: 'POST', body: { text, replyTo } };
        const body = new FormData();
        if (text) body.append('text', text);
        if (replyTo) body.append('replyTo', replyTo);
        files.forEach((f) => body.append('files', uploadPart(f)));
        return { url: `/tasks/${id}/comments`, method: 'POST', body };
      },
      invalidatesTags: (result, error, { id }) => [{ type: 'Task', id }, 'Task'],
    }),
    deleteTaskComment: builder.mutation({
      query: ({ id, commentId }) => ({ url: `/tasks/${id}/comments/${commentId}`, method: 'DELETE' }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Task', id }, 'Task'],
    }),
    addChecklistItem: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/tasks/${id}/checklist`, method: 'POST', body }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Task', id }, 'Task'],
    }),
    updateChecklistItem: builder.mutation({
      query: ({ id, itemId, ...body }) => ({ url: `/tasks/${id}/checklist/${itemId}`, method: 'PATCH', body }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Task', id }, 'Task'],
    }),
    removeChecklistItem: builder.mutation({
      query: ({ id, itemId }) => ({ url: `/tasks/${id}/checklist/${itemId}`, method: 'DELETE' }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Task', id }, 'Task'],
    }),
    watchTask: builder.mutation({
      query: (id) => ({ url: `/tasks/${id}/watch`, method: 'POST' }),
      invalidatesTags: (result, error, id) => [{ type: 'Task', id }, 'Task'],
    }),
    unwatchTask: builder.mutation({
      query: (id) => ({ url: `/tasks/${id}/watch`, method: 'DELETE' }),
      invalidatesTags: (result, error, id) => [{ type: 'Task', id }, 'Task'],
    }),
    getWatchedTasks: builder.query({
      query: (params) => ({ url: '/tasks/watching', params }),
      providesTags: ['Task'],
    }),
    addTimeEntry: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/tasks/${id}/time`, method: 'POST', body }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Task', id }, 'Task'],
    }),
    removeTimeEntry: builder.mutation({
      query: ({ id, entryId }) => ({ url: `/tasks/${id}/time/${entryId}`, method: 'DELETE' }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Task', id }, 'Task'],
    }),
    reorderTasks: builder.mutation({
      query: (body) => ({ url: '/tasks/reorder', method: 'PATCH', body }),
      invalidatesTags: ['Task'],
    }),
    bulkUpdateTasks: builder.mutation({
      query: (body) => ({ url: '/tasks/bulk', method: 'PATCH', body }),
      invalidatesTags: ['Task'],
    }),
  }),
});

export const {
  useGetTasksQuery, useGetTaskByIdQuery, useCreateTaskMutation,
  useUpdateTaskMutation, useDeleteTaskMutation,
  useGetSubtasksQuery, useGetDependenciesQuery,
  useAddDependencyMutation, useRemoveDependencyMutation,
  useAddTaskCommentMutation, useDeleteTaskCommentMutation,
  useAddChecklistItemMutation, useUpdateChecklistItemMutation, useRemoveChecklistItemMutation,
  useWatchTaskMutation, useUnwatchTaskMutation, useGetWatchedTasksQuery,
  useAddTimeEntryMutation, useRemoveTimeEntryMutation,
  useReorderTasksMutation, useBulkUpdateTasksMutation,
} = taskApi;
