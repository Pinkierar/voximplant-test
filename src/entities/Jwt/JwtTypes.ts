import type { JwtPayload as JwtLibPayload } from 'jsonwebtoken';

export type JwtPayload<T extends Record<string, any> = Record<string, any>> = T &
  Pick<JwtLibPayload, 'iss' | 'sub' | 'aud' | 'exp' | 'nbf' | 'iat' | 'jti'>;
