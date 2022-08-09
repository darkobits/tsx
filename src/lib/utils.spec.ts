
import chex from '@darkobits/chex';
import { faker } from '@faker-js/faker';
import { mockDeep } from 'jest-mock-extended';

import {
  gitDescribe,
  readDotenvUp
} from './utils';

jest.mock('@darkobits/chex');
jest.mock('dotenv');
jest.mock('lib/log', () => mockDeep());


describe('gitDescribe', () => {
  const chexMock = chex as jest.MockedFn<typeof chex>;

  describe('when there is at least 1 tag in the Git history', () => {
    const DESC = ['v1.2.3', '456be27'];

    beforeEach(() => {
      chexMock.mockImplementation(async (): Promise<any> => {
        return async () => {
          return {
            stdout: DESC.join('-g')
          };
        };
      });
    });

    it('should return the latest tag and current Git SHA', async () => {
      expect(await gitDescribe()).toBe(DESC.join('-'));
    });
  });

});

describe('readDotenvUp', () => {
  let readDotenvUpLocal: typeof readDotenvUp;

  beforeEach(() => {
    jest.resetModules();
  });

  describe('in CI environments', () => {
    beforeEach(() => {
      jest.doMock('is-ci', () => true);
      readDotenvUpLocal = require('./utils').readDotenvUp;
    });

    it('should no-op', async () => {
      const result = await readDotenvUpLocal();
      expect(result).toBeUndefined();
    });
  });

  describe('in non-CI environments', () => {
    const directory = faker.system.directoryPath();
    const dotenvPath = faker.system.filePath();
    const parsedConfig = faker.datatype.json();

    const findUpMock = {
      findUp: jest.fn(() => dotenvPath)
    };

    const dotenvMock = {
      config: jest.fn(() => ({
        parsed: parsedConfig
      }))
    };

    const dotenvErrorMock = {
      config: jest.fn(() => ({
        error: new Error('Error')
      }))
    };

    beforeEach(() => {
      jest.doMock('is-ci', () => false);
      jest.doMock('find-up', () => findUpMock);
    });

    describe('when provided a directory', () => {
      beforeEach(() => {
        jest.doMock('dotenv', () => dotenvMock);
        readDotenvUpLocal = require('./utils').readDotenvUp;
      });

      it('should return the contents of the nearest .env file', async () => {
        const result = await readDotenvUpLocal(directory);
        expect(findUpMock.findUp).toHaveBeenCalledWith('.env', { cwd: directory });
        expect(dotenvMock.config).toHaveBeenCalledWith({ path: dotenvPath });
        expect(result).toBe(parsedConfig);
      });
    });

    describe('when not provided a directory', () => {
      beforeEach(() => {
        jest.doMock('dotenv', () => dotenvMock);
        readDotenvUpLocal = require('./utils').readDotenvUp;
      });

      it('should return the contents of the nearest .env file', async () => {
        const result = await readDotenvUpLocal();
        expect(findUpMock.findUp).toHaveBeenCalledWith('.env');
        expect(dotenvMock.config).toHaveBeenCalledWith({ path: dotenvPath });
        expect(result).toBe(parsedConfig);
      });
    });

    describe('when a .env file could not be found', () => {
      beforeEach(() => {
        jest.doMock('dotenv', () => dotenvErrorMock);
        readDotenvUpLocal = require('./utils').readDotenvUp;
      });

      it('should return an empty object', async () => {
        const result = await readDotenvUpLocal();
        expect(findUpMock.findUp).toHaveBeenCalledWith('.env');
        expect(dotenvErrorMock.config).toHaveBeenCalledWith({ path: dotenvPath });
        expect(result).toMatchObject({});
      });
    });
  });
});
