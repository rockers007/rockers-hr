import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { DataSource } from 'typeorm';

describe('HealthController', () => {
  let controller: HealthController;
  let mockDataSource: Partial<DataSource>;

  beforeEach(async () => {
    mockDataSource = {
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should return ok status when DB is healthy', async () => {
    const result = await controller.check();
    expect(result).toEqual({ status: 'ok', db: 'ok' });
  });

  it('should return db error when DB query fails', async () => {
    (mockDataSource.query as jest.Mock).mockRejectedValue(new Error('connection refused'));
    const result = await controller.check();
    expect(result).toEqual({ status: 'ok', db: 'error' });
  });
});
