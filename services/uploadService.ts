import { API_BASE } from '../components/utils/config';

export const uploadImageToAPI = async (file: File | Blob): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);

  const token = localStorage.getItem('token');
  let userId = '';
  try {
    const u = localStorage.getItem('currentUser');
    if (u) userId = JSON.parse(u).id;
  } catch {}

  const headers: Record<string, string> = {
    'x-user-id': userId || '',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  const data = await res.json();
  return data.secure_url;
};
