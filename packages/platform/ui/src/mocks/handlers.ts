import { http, HttpResponse } from 'msw';

const authBaseUrl = 'http://127.0.0.1:4040';

function authRoute(path: string) {
  return new URL(path, authBaseUrl).toString();
}

export const handlers = [
  http.get(authRoute('/api/auth/get-session'), async () => {
    return new HttpResponse(null, { status: 401 });
  }),
  http.post(authRoute('/api/auth/sign-out'), async () => {
    return HttpResponse.json({ success: true });
  }),
];
