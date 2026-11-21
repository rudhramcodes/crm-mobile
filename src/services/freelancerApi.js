import { api } from './api';
import { uploadPart } from './taskApi';

export const freelancerApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getFreelancers: builder.query({
      query: (params) => ({ url: '/freelancers', params }),
      providesTags: ['Freelancer'],
      keepUnusedDataFor: 0,
    }),
    getFreelancerStats: builder.query({
      query: () => '/freelancers/stats',
      providesTags: ['Freelancer'],
      keepUnusedDataFor: 0,
    }),
    getFreelancerById: builder.query({
      query: (id) => `/freelancers/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Freelancer', id }],
    }),
    createFreelancer: builder.mutation({
      query: (body) => ({ url: '/freelancers', method: 'POST', body }),
      invalidatesTags: ['Freelancer'],
    }),
    createFreelancerPublic: builder.mutation({
      query: (body) => ({ url: '/freelancers/public/apply', method: 'POST', body }),
    }),
    updateFreelancer: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/freelancers/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_result, _error, { id }) => ['Freelancer', { type: 'Freelancer', id }],
    }),
    deleteFreelancer: builder.mutation({
      query: (id) => ({ url: `/freelancers/${id}/hard`, method: 'DELETE' }),
      invalidatesTags: ['Freelancer'],
    }),
    // Same route as the web photo picker (the path really is doubled); returns { url } of a 500px Cloudinary image.
    uploadFreelancerPhoto: builder.mutation({
      query: (photo) => {
        const body = new FormData();
        body.append('file', uploadPart(photo));
        return { url: '/freelancers/upload/upload', method: 'POST', body };
      },
    }),
    archiveFreelancer: builder.mutation({
      query: (id) => ({ url: `/freelancers/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Freelancer'],
    }),
  }),
});

export const {
  useGetFreelancersQuery,
  useGetFreelancerStatsQuery,
  useGetFreelancerByIdQuery,
  useCreateFreelancerMutation,
  useCreateFreelancerPublicMutation,
  useUpdateFreelancerMutation,
  useUploadFreelancerPhotoMutation,
  useArchiveFreelancerMutation,
  useDeleteFreelancerMutation,
} = freelancerApi;
