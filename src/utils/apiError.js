// RTK Query error → { message, fieldErrors } in the server's ApiError shape.
export const apiError = (error, fallback = 'Something went wrong. Please try again.') => {
  if (!error) return { message: '', fieldErrors: [] };
  if (error.status === 'FETCH_ERROR' || error.status === 'TIMEOUT_ERROR') {
    return { message: "Can't reach the server. Check your internet connection.", fieldErrors: [] };
  }
  return { message: error.data?.message || fallback, fieldErrors: error.data?.errors || [] };
};
