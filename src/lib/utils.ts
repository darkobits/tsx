import os from 'os';

import dotenv from 'dotenv';
import IS_CI from 'is-ci';

import log from 'lib/log';


/**
 * Returns an array of all local IP addresses for the host machine.
 */
export function getLocalIpAddresses() {
  return Object.values(os.networkInterfaces()).flatMap(interfaces => {
    return interfaces?.map(i => (i.family === 'IPv4' ? i.address : false)).filter(Boolean);
  }) as Array<string>;
}


/**
 * Returns a short description of the current Git commit using 'git describe'.
 *
 * Example: "v0.12.7-17-9d2f0dc"
 */
export async function gitDescribe() {
  const { default: chex } = await import('@darkobits/chex');
  const git = await chex('git');
  const result = await git(['describe', '--tags', '--always']);

  const parsed = result.stdout
    // Remove the 'g' that immediately precedes the commit SHA.
    .replace(/-g(\w{7,})$/g, '-$1')
    // Replace the 'commits since last tag' segment with a dash.
    .replace(/-\d+-/g, '-');

  log.verbose(log.prefix('gitDescribe'), `Current Git description: ${log.chalk.green(result)}`);
  return parsed;
}


/**
 * Searches for and loads the nearest .env file by crawling up the directory
 * tree starting at `cwd`, process.cwd() if none was provided.
 *
 * Note: IS_CI is used here to bail rather than argv.mode so that users can
 * run production builds locally for testing/debugging.
 */
export async function readDotenvUp(cwd?: string) {
  if (IS_CI) {
    log.warn(log.prefix('readDotenvUp'), 'Not loading .env because a CI environment has been detected.');
    return;
  }

  const { findUp } = await import('find-up');
  const envFilePath = cwd
    ? await findUp('.env', { cwd })
    : await findUp('.env');

  if (!envFilePath) {
    return {};
  }

  const result = dotenv.config({ path: envFilePath });

  if (result.error) {
    // @ts-expect-error
    if (result.error.code !== 'ENOENT') {
      log.warn(log.prefix('readDotenvUp'), `Error loading .env file: ${result.error.message}`);
    }

    return {};
  }

  log.verbose(log.prefix('readDotenvUp'), `Loaded ${log.chalk.yellow(Object.keys(result.parsed ?? {}).length)} variables from ${log.chalk.green(envFilePath)}.`);

  return result.parsed;
}
