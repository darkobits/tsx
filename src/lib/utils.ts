import os from 'os';

import chex from '@darkobits/chex';

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
