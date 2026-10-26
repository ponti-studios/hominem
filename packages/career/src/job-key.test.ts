import { describe, expect, it } from 'vitest';

import { jobExternalKey, jobPostingUrlKey } from './job-key';

describe('jobPostingUrlKey', () => {
  it('collapses tracking params, www, fragments, protocol and trailing slashes', () => {
    const base = 'jobs.ashbyhq.com/whatnot/7cfa0536-94de-42b7-9fe7-d646f4addc29';
    const variants = [
      `https://${base}`,
      `https://${base}/?utm_source=linkedin&utm_medium=social#apply`,
      `http://${base}?gh_src=abc123&ref=linkedin`,
      `https://JOBS.ashbyhq.com/whatnot/7cfa0536-94de-42b7-9fe7-d646f4addc29/`,
      base,
    ];
    const keys = new Set(variants.map(jobPostingUrlKey));
    expect(keys.size).toBe(1);
    expect(jobPostingUrlKey(base)).toBe(base);
  });

  it('keeps id params so different jobs on one path stay separate', () => {
    const a = jobPostingUrlKey('https://acme.com/careers?gh_jid=4567890&utm_source=x');
    const b = jobPostingUrlKey('https://acme.com/careers?gh_jid=4567891');
    expect(a).toBe('acme.com/careers?gh_jid=4567890');
    expect(a).not.toBe(b);
  });

  it('keeps other id-shaped params like Indeed jk and LinkedIn currentJobId', () => {
    expect(jobPostingUrlKey('https://indeed.com/viewjob?jk=ab12cd34ef56&from=serp')).toBe(
      'indeed.com/viewjob?jk=ab12cd34ef56',
    );
    expect(
      jobPostingUrlKey('https://www.linkedin.com/jobs/search/?currentJobId=3912345678&trk=x'),
    ).toBe('linkedin.com/jobs/search?currentjobid=3912345678');
  });

  it('ignores query param order', () => {
    expect(jobPostingUrlKey('https://acme.com/j?b=20002&a=10001')).toBe(
      jobPostingUrlKey('https://acme.com/j?a=10001&b=20002'),
    );
  });

  it('keeps short numeric and textual job ids so different jobs stay separate', () => {
    const a = jobPostingUrlKey('https://acme.com/careers?jobId=123');
    const b = jobPostingUrlKey('https://acme.com/careers?jobId=456');
    expect(a).toBe('acme.com/careers?jobid=123');
    expect(a).not.toBe(b);
    expect(jobPostingUrlKey('https://acme.com/careers?job=engineer')).not.toBe(
      jobPostingUrlKey('https://acme.com/careers?job=designer'),
    );
  });

  it('drops empty params', () => {
    expect(jobPostingUrlKey('https://acme.com/j/1?foo=&utm_source=x')).toBe('acme.com/j/1');
  });

  it('returns null for empty or unparseable input', () => {
    expect(jobPostingUrlKey('')).toBeNull();
    expect(jobPostingUrlKey('   ')).toBeNull();
    expect(jobPostingUrlKey('http://')).toBeNull();
  });
});

describe('jobExternalKey', () => {
  it('needs both the board and the id, and ignores case on the board', () => {
    expect(jobExternalKey('Ashby', ' 7cfa ')).toBe('ashby:7cfa');
    expect(jobExternalKey(null, '7cfa')).toBeNull();
    expect(jobExternalKey('ashby', '')).toBeNull();
  });
});
