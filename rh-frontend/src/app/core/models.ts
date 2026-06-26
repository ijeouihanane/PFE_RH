export type Role = 'RH' | 'ADMIN' | 'EMPLOYEE' | 'MANAGER';

export interface User {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  role: Role;
  firstLogin: boolean;
  photoUrl?: string | null;
}

export interface LoginResponse {
  token: string;
  firstLogin: boolean;
  user: User;
}
