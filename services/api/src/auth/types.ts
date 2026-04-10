export interface AuthContextEnvelope {
  sub: string;
  sid: string;
  scope: string[];
  role: 'user' | 'admin';
  amr: string[];
  authTime: number;
}
