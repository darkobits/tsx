import {
  describe,
  it,
  expect,
  beforeEach,
  vi
} from 'vitest';


describe('gitDescribe', () => {
  describe('when there is at least 1 tag in the Git history', () => {
    const DESC = ['v1.2.3', '456be27'];

    beforeEach(() => {
      vi.doMock('@darkobits/chex', () => ({
        default: () => vi.fn(async () => ({
          stdout: DESC.join('-g')
        }))
      }));
    });

    it('should return the latest tag and current Git SHA', async () => {
      const { gitDescribe } = await import('lib/utils');
      expect(await gitDescribe()).toBe(DESC.join('-'));
    });
  });
});
