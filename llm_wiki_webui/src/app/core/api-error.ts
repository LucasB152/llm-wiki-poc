import { HttpErrorResponse } from '@angular/common/http';

/**
 * Turns an HttpClient error into a message to show to the user.
 * NestJS errors look like: { statusCode: 400, message: string | string[], error: 'Bad Request' }
 */
export function apiErrorMessage(err: unknown): string {
  if (!(err instanceof HttpErrorResponse)){
    return 'Something went wrong.';
  }
  else if (err.status === 0){
    return 'Cannot reach the server.';
  }
  else if (typeof err.error?.message === 'string'){
    return err.error.message;
  }
  else if (Array.isArray(err.error?.message)){
    return err.error.message.join('. ');
  }
  else{
    return `Request failed (HTTP ${err.status}).`
  }
}
