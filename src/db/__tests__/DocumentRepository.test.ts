// WatermelonDB's SQLite adapter can't run in Node (JSI), so we mock the
// database instance and test the repository interface shape only.
jest.mock('../database', () => ({
  database: {
    get: () => ({
      query: () => ({observe: () => ({})}),
      find: async () => null,
      create: async () => ({}),
    }),
    write: async (fn: () => unknown) => fn(),
  },
}));

import {documentRepository} from '../DocumentRepository';

describe('documentRepository interface', () => {
  it('exports getAll function', () => {
    expect(typeof documentRepository.getAll).toBe('function');
  });

  it('exports getById function', () => {
    expect(typeof documentRepository.getById).toBe('function');
  });

  it('exports create function', () => {
    expect(typeof documentRepository.create).toBe('function');
  });

  it('exports update function', () => {
    expect(typeof documentRepository.update).toBe('function');
  });

  it('exports duplicate function', () => {
    expect(typeof documentRepository.duplicate).toBe('function');
  });

  it('exports delete function', () => {
    expect(typeof documentRepository.delete).toBe('function');
  });
});
