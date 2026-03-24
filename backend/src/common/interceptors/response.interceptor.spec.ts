import { ResponseInterceptor } from './response.interceptor';
import { of } from 'rxjs';
import { ExecutionContext, CallHandler } from '@nestjs/common';

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor<any>;
  const mockExecutionContext = {} as ExecutionContext;

  beforeEach(() => {
    interceptor = new ResponseInterceptor();
  });

  it('should wrap plain data in { data } envelope', (done) => {
    const mockHandler: CallHandler = {
      handle: () => of({ name: 'test' }),
    };

    interceptor.intercept(mockExecutionContext, mockHandler).subscribe((result) => {
      expect(result).toEqual({ data: { name: 'test' } });
      done();
    });
  });

  it('should pass through data already wrapped with data key', (done) => {
    const mockHandler: CallHandler = {
      handle: () => of({ data: [1, 2, 3], meta: { total: 3 } }),
    };

    interceptor.intercept(mockExecutionContext, mockHandler).subscribe((result) => {
      expect(result).toEqual({ data: [1, 2, 3], meta: { total: 3 } });
      done();
    });
  });

  it('should wrap arrays in { data } envelope', (done) => {
    const mockHandler: CallHandler = {
      handle: () => of([1, 2, 3]),
    };

    interceptor.intercept(mockExecutionContext, mockHandler).subscribe((result) => {
      expect(result).toEqual({ data: [1, 2, 3] });
      done();
    });
  });
});
