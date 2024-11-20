import dotenv from 'dotenv';
import { ErrorInfo } from '#includes/ErrorInfo';

dotenv.config({ path: '.env' });

if (!process.env.VOXIMPLANT_CREDENTIALS) throw new ErrorInfo('dotenv config', 'VOXIMPLANT_CREDENTIALS is required');

export const VOXIMPLANT_CREDENTIALS = process.env.VOXIMPLANT_CREDENTIALS;
