import assert from 'node:assert/strict'
import test from 'node:test'
import { eventTimeInput, parseEventTime } from './igloo.ts'

test('New York wall times use the correct seasonal offset', () => {
  assert.equal(parseEventTime('2026-01-15T19:00').iso, '2026-01-16T00:00:00.000Z')
  assert.equal(parseEventTime('2026-07-15T19:00').iso, '2026-07-15T23:00:00.000Z')
  assert.equal(parseEventTime('2026-10-22T19:00').iso, '2026-10-22T23:00:00.000Z')
})

test('editing UTC timestamps displays New York wall times, including midnight', () => {
  assert.equal(eventTimeInput('2026-01-16T00:00:00.000Z'), '2026-01-15T19:00')
  assert.equal(eventTimeInput('2026-07-15T23:00:00.000Z'), '2026-07-15T19:00')
  assert.equal(eventTimeInput('2026-07-16T04:00:00.000Z'), '2026-07-16T00:00')
})

test('spring DST gap is rejected instead of silently shifting the time', () => {
  const result = parseEventTime('2026-03-08T02:30')
  assert.equal(result.iso, '')
  assert.match(result.error, /does not exist/)
  assert.equal(parseEventTime('2026-03-08T01:30').iso, '2026-03-08T06:30:00.000Z')
  assert.equal(parseEventTime('2026-03-08T03:30').iso, '2026-03-08T07:30:00.000Z')
})

test('autumn repeated hour is rejected instead of choosing a hidden offset', () => {
  const result = parseEventTime('2026-11-01T01:30')
  assert.equal(result.iso, '')
  assert.match(result.error, /occurs twice/)
  assert.equal(parseEventTime('2026-11-01T00:30').iso, '2026-11-01T04:30:00.000Z')
  assert.equal(parseEventTime('2026-11-01T02:30').iso, '2026-11-01T07:30:00.000Z')
})

test('invalid dates, absent values, and non-minute inputs are rejected', () => {
  for (const value of ['', 'not-a-date', '2026-02-30T12:00', '2026-01-15T24:00', '2026-01-15T12:00:59']) {
    assert.equal(parseEventTime(value).iso, '')
    assert.match(parseEventTime(value).error, /valid New York/)
  }
  assert.equal(eventTimeInput(), '')
  assert.equal(eventTimeInput('invalid'), '')
})
