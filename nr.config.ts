import { nr } from '@darkobits/ts';


export default nr(({ script, command }) => {
  script('publish', {
    group: 'Release',
    description: 'Publish the package using re-pack.',
    run: [
      command('re-pack', ['re-pack', ['publish']])
    ]
  });
});
