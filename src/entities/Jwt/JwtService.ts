import jwt from 'jsonwebtoken';
import { ErrorInfo } from '#includes/ErrorInfo';

export class JwtService {
  public static createJwt(key: string, age: number, payload: Record<string, any>): Promise<string> {
    return new Promise<string>((resolve) => {
      jwt.sign(payload, key, { expiresIn: age, algorithm: 'RS256' }, (error, signature) => {
        if (error) throw new ErrorInfo('JwtService.createJwt', error.message, { age, payload }, error.stack);

        if (!signature) throw new ErrorInfo('JwtService.createJwt', 'token not received', { age, payload });

        resolve(signature);
      });
    });
  }
}
