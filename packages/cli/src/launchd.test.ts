import { describe, expect, it } from 'vitest';

import { escapeXml, renderPlist } from './launchd.js';

describe('renderPlist', () => {
  it('escapes XML special characters in the binary path', () => {
    const plist = renderPlist({
      label: 'l',
      binary: '/Users/a&b/<bin>/hominem',
      log: '/tmp/log',
      home: '/h',
    });
    expect(plist).toContain('<string>/Users/a&amp;b/&lt;bin&gt;/hominem</string>');
    expect(plist).not.toContain('a&b');
  });

  it('runs `auth check --notify` daily at 9:00', () => {
    const plist = renderPlist({ label: 'l', binary: '/bin/hominem', log: '/tmp/log', home: '/h' });
    expect(plist).toMatch(
      /<string>auth<\/string>\s*<string>check<\/string>\s*<string>--notify<\/string>/,
    );
    expect(plist).toMatch(/<key>Hour<\/key>\s*<integer>9<\/integer>/);
  });

  it('hands the job the token directory it was installed with', () => {
    const plist = renderPlist({ label: 'l', binary: '/b', log: '/l', home: '/Users/a&b/.hominem' });
    expect(plist).toMatch(
      /<key>HOMINEM_HOME<\/key>\s*<string>\/Users\/a&amp;b\/\.hominem<\/string>/,
    );
  });

  it('escapeXml handles all three characters', () => {
    expect(escapeXml('&<>')).toBe('&amp;&lt;&gt;');
  });
});
