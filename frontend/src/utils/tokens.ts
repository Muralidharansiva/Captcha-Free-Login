import { auth } from '@/firebase';

export const getFirebaseToken = async (): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  return await user.getIdToken();
};
