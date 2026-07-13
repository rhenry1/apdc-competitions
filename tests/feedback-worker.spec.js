const { test, expect } = require('@playwright/test');

// Unit tests for the feedback worker's pure logic (no Workers runtime needed).
// The worker is an ES module; import it dynamically from this CJS test.
let worker;
test.beforeAll(async () => { worker = await import('../worker/feedback-worker.mjs'); });

test.describe('validateFeedback', () => {
  test('drops honeypot and too-fast submissions as spam', () => {
    expect(worker.validateFeedback({ message: 'real message', hp: 'gotcha' })).toBe('spam');
    expect(worker.validateFeedback({ message: 'real message', elapsed: 200 })).toBe('spam');
  });

  test('rejects empty / too-short / too-long messages with a reason', () => {
    expect(worker.validateFeedback({ message: '' })).toMatch(/detail/i);
    expect(worker.validateFeedback({ message: 'hi' })).toMatch(/detail/i);
    expect(worker.validateFeedback({ message: 'x'.repeat(5000) })).toMatch(/too long/i);
    expect(worker.validateFeedback(null)).toMatch(/invalid/i);
  });

  test('accepts a normal message (returns null)', () => {
    expect(worker.validateFeedback({ message: 'Please add my studio.', elapsed: 5000, hp: '' })).toBeNull();
  });
});

test.describe('buildIssue', () => {
  test('titles by category and includes the message + metadata + labels', () => {
    const issue = worker.buildIssue({
      message: 'Times are wrong on Monday.\nSecond line.',
      category: 'bug',
      page: '/nationals-2026/index.html?day=mon',
      ts: '2026-07-13T00:00:00.000Z',
      ua: 'TestAgent/1.0'
    });
    expect(issue.title).toBe('Bug: Times are wrong on Monday.');
    expect(issue.body).toContain('Times are wrong on Monday.');
    expect(issue.body).toContain('**Type:** bug');
    expect(issue.body).toContain('/nationals-2026/index.html?day=mon');
    expect(issue.labels).toEqual(['user-feedback', 'bug']);
  });

  test('falls back to "other" for an unknown category', () => {
    const issue = worker.buildIssue({ message: 'Just a note.', category: 'nonsense' });
    expect(issue.title).toMatch(/^Feedback:/);
    expect(issue.labels).toEqual(['user-feedback', 'other']);
  });
});
