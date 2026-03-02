let accessToken: string | null = null;

export const setAccessToken = (token: string) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

export const clearTokens = () => {
  accessToken = null;
  localStorage.removeItem("refresh_token");
};

export const setRefreshToken = (token: string) => {
  localStorage.setItem("refresh_token", token);
};

export const getRefreshToken = () => {
  return localStorage.getItem("refresh_token");
};