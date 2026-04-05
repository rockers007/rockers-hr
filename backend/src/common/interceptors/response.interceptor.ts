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

/**
 * Convert camelCase keys to snake_case recursively.
 * Handles plain objects, arrays, and Date instances.
 */
function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

function transformKeys(value: any): any {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(transformKeys);
  if (typeof value === 'object' && value.constructor === Object) {
    const result: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      result[toSnakeCase(key)] = transformKeys(value[key]);
    }
    return result;
  }
  // Handle TypeORM entity instances (not plain objects)
  if (typeof value === 'object' && value.constructor !== Object) {
    const result: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      result[toSnakeCase(key)] = transformKeys(value[key]);
    }
    return result;
  }
  return value;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((responseData) => {
        const transformed = transformKeys(responseData);

        // If the response already has a `data` key, pass through (already wrapped)
        if (transformed && typeof transformed === 'object' && 'data' in transformed) {
          return transformed;
        }
        return { data: transformed };
      }),
    );
  }
}
