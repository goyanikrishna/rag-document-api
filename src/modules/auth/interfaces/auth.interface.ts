export interface IRegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface ILoginInput {
  email: string;
  password: string;
}

export interface ICreateUserInput {
  name: string;
  email: string;
  passwordHash: string;
}

export interface IAuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    created_at: Date;
  };
  token: string;
}

export interface IUserProfileResponse {
  id: string;
  name: string;
  email: string;
  created_at: Date;
}
