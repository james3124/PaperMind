jest.mock('@nozbe/watermelondb', () => {
  class MockModel {}

  return {
    Model: MockModel,
    Database: jest.fn().mockImplementation(({ adapter, modelClasses }) => ({
      adapter,
      modelClasses,
    })),
    appSchema: jest.fn((config) => config),
    tableSchema: jest.fn((config) => config),
  };
});

jest.mock('@nozbe/watermelondb/decorators', () => ({
  field: () => () => undefined,
  date: () => () => undefined,
  readonly: () => undefined,
}));

jest.mock('@nozbe/watermelondb/adapters/sqlite', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((config) => ({ config })),
}));

import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { createDatabaseAdapter, database } from '../database';

describe('database bootstrap', () => {
  it('creates the sqlite adapter with JSI disabled to avoid startup crashes', () => {
    expect(createDatabaseAdapter).toBeDefined();
    expect(SQLiteAdapter).toHaveBeenCalledWith(expect.objectContaining({ jsi: false }));
    expect(database).toBeDefined();
  });
});
