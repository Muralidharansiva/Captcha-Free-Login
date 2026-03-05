import { getAccessToken } from '@/utils/auth';

export const getFirebaseToken = async (): Promise<string> => {
  const token = getAccessToken();
  if (!token) throw new Error('User not authenticated');
  return token;
};
