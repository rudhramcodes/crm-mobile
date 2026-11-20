// RTK Query error → { message, fieldErrors } in the server's ApiError shape.
export const apiError = (error, fallback = 'Something went wrong. Please try again.') => {
  if (!error) return { message: '', fieldErrors: [] };
  if (error.status === 'FETCH_ERROR' || error.status === 'TIMEOUT_ERROR') {
    // Dev builds add the real reason: a request that fails inside the app looks the same as a lost connection.
    const why = __DEV__ && error.error ? ` (${error.error})` : '';
    return { message: `Can't reach the server. Check your internet connection.${why}`, fieldErrors: [] };
  }
  return { message: error.data?.message || fallback, fieldErrors: error.data?.errors || [] };
};
