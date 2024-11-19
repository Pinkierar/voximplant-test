import dotenv from 'dotenv';
import { ErrorInfo } from '#includes/ErrorInfo';

dotenv.config({ path: '.env' });

if (!process.env.PRIVATE_KEY) throw new ErrorInfo('config', 'process.env.PRIVATE_KEY is required');
if (!process.env.KEY_ID) throw new ErrorInfo('config', 'process.env.KEY_ID is required');
if (!process.env.ACCOUNT_ID) throw new ErrorInfo('config', 'process.env.ACCOUNT_ID is required');

export const PRIVATE_KEY = process.env.PRIVATE_KEY;
export const KEY_ID = process.env.KEY_ID;
export const ACCOUNT_ID = process.env.ACCOUNT_ID;
