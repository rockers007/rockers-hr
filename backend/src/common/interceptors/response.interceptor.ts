import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, any>;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((responseData) => {
        // If the response already has a `data` key, pass through (already wrapped)
        if (responseData && typeof responseData === 'object' && 'data' in responseData) {
          return responseData;
        }
        return { data: responseData };
      }),
    );
  }
}
