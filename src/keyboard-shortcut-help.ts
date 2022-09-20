// because I don't remember what all these things do

const fs = require('fs');
const os = require('os');
const path = require('path');

type Rule = {
  description: string;
  manipulators: [
    {
      // TODO: more options than this
      type: 'basic';
      from: {
        key_code: string;
        modifiers: {
          mandatory: [string, string, string];
          optional: [string];
        };
      };
      to: [
        {
          // TODO: more options than this
          shell_command: string;
        }
      ];
    }
  ];
};

// parse the karabiner config file
const karabinerJson = fs.readFileSync(
  path.join(os.homedir(), '.config/karabiner/karabiner.json'),
  'utf8'
);
const karabinerConfig = JSON.parse(karabinerJson);

const profile = karabinerConfig.profiles[0];
const rules: Rule[] = profile.complex_modifications.rules;

console.log('Karabiner shortcuts:');
rules
  .map((r) => r.description)
  .sort()
  .forEach((rule) => {
    console.log(` ${rule}`);
  });
