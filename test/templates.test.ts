/**
 * Template system tests
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TemplateEngine, templates, spinners, createTemplateEngine } from '../src/templates.js';
import type { ProgressState } from '../src/index.js';

// Helper to create test progress state
function createTestState(overrides: Partial<ProgressState> = {}): ProgressState {
  const now = Date.now();
  return {
    total: 100,
    current: 50,
    message: 'Processing',
    percentage: 50,
    startTime: now - 5000, // 5 seconds ago
    updatedTime: now,
    complete: false,
    ...overrides,
  };
}

test('TemplateEngine', async (t) => {
  await t.test('constructor creates engine with default options', () => {
    const engine = new TemplateEngine();
    assert(engine !== null);
  });

  await t.test('constructor accepts custom spinner frames', () => {
    const customFrames = ['a', 'b', 'c'];
    const engine = new TemplateEngine({ spinnerFrames: customFrames });

    const state = createTestState();
    const result = engine.render('{{spinner}}', state);
    assert(customFrames.includes(result));
  });

  await t.test('constructor accepts custom bar width', () => {
    const engine = new TemplateEngine({ barWidth: 10 });

    const state = createTestState({ percentage: 50 });
    const result = engine.render('{{bar}}', state);

    // Bar should be 12 chars total: [█████░░░░░]
    assert.strictEqual(result.length, 12); // 10 + 2 brackets
  });

  await t.test('render() substitutes {{percentage}}', () => {
    const engine = new TemplateEngine();
    const state = createTestState({ percentage: 75 });

    const result = engine.render('Progress: {{percentage}}%', state);
    assert.strictEqual(result, 'Progress: 75%');
  });

  await t.test('render() substitutes {{current}} and {{total}}', () => {
    const engine = new TemplateEngine();
    const state = createTestState({ current: 30, total: 100 });

    const result = engine.render('{{current}}/{{total}}', state);
    assert.strictEqual(result, '30/100');
  });

  await t.test('render() substitutes {{message}}', () => {
    const engine = new TemplateEngine();
    const state = createTestState({ message: 'Downloading files' });

    const result = engine.render('Status: {{message}}', state);
    assert.strictEqual(result, 'Status: Downloading files');
  });

  await t.test('render() substitutes {{elapsed}}', () => {
    const engine = new TemplateEngine();
    const now = Date.now();
    const state = createTestState({
      startTime: now - 10000, // 10 seconds ago
      updatedTime: now,
    });

    const result = engine.render('Elapsed: {{elapsed}}s', state);
    assert.strictEqual(result, 'Elapsed: 10s');
  });

  await t.test('render() substitutes {{spinner}}', () => {
    const engine = new TemplateEngine({ spinnerFrames: ['a', 'b', 'c'] });
    const state = createTestState();

    const result = engine.render('{{spinner}}', state);
    assert.strictEqual(result, 'a'); // First frame
  });

  await t.test('render() substitutes {{bar}}', () => {
    const engine = new TemplateEngine({ barWidth: 4 });
    const state = createTestState({ percentage: 50 });

    const result = engine.render('{{bar}}', state);
    assert.strictEqual(result, '[██░░]');
  });

  await t.test('render() substitutes {{eta}}', () => {
    const engine = new TemplateEngine();
    const now = Date.now();
    const state = createTestState({
      current: 50,
      total: 100,
      startTime: now - 10000, // 10 seconds ago (50 items in 10s = 5/s rate)
      updatedTime: now,
    });

    const result = engine.render('ETA: {{eta}}', state);
    assert(result.includes('ETA: 10s')); // 50 remaining at 5/s = 10s
  });

  await t.test('render() supports function templates', () => {
    const engine = new TemplateEngine();
    const state = createTestState();

    const template = (vars: any) => `Custom: ${vars.percentage}%`;
    const result = engine.render(template, state);

    assert.strictEqual(result, 'Custom: 50%');
  });

  await t.test('render() handles multiple variables in one template', () => {
    const engine = new TemplateEngine();
    const state = createTestState({
      current: 25,
      total: 100,
      message: 'Working',
      percentage: 25,
    });

    const result = engine.render('[{{percentage}}%] {{current}}/{{total}} - {{message}}', state);
    assert.strictEqual(result, '[25%] 25/100 - Working');
  });

  await t.test('resetSpinner() resets to first frame', () => {
    const engine = new TemplateEngine({ spinnerFrames: ['a', 'b', 'c'] });
    const state = createTestState();

    // Advance spinner
    engine.render('{{spinner}}', state);
    engine.render('{{spinner}}', state);

    // Reset
    engine.resetSpinner();

    const result = engine.render('{{spinner}}', state);
    assert.strictEqual(result, 'a'); // Back to first frame
  });

  await t.test('setSpinnerFrames() changes spinner frames', () => {
    const engine = new TemplateEngine({ spinnerFrames: ['a', 'b'] });
    const state = createTestState();

    engine.setSpinnerFrames(['x', 'y', 'z']);

    const result = engine.render('{{spinner}}', state);
    assert.strictEqual(result, 'x');
  });

  await t.test('setBarWidth() changes bar width', () => {
    const engine = new TemplateEngine({ barWidth: 10 });

    engine.setBarWidth(5);

    const state = createTestState({ percentage: 50 });
    const result = engine.render('{{bar}}', state);

    assert.strictEqual(result.length, 7); // 5 + 2 brackets
  });

  await t.test('setBarWidth() throws on invalid width', () => {
    const engine = new TemplateEngine();

    assert.throws(() => {
      engine.setBarWidth(0);
    }, /Bar width must be at least 1/);
  });
});

test('TemplateEngine - spinner animation', async (t) => {
  await t.test('spinner advances through frames', () => {
    const engine = new TemplateEngine({ spinnerFrames: ['a', 'b', 'c'] });
    const state = createTestState();

    const frame1 = engine.render('{{spinner}}', state);
    const frame2 = engine.render('{{spinner}}', state);
    const frame3 = engine.render('{{spinner}}', state);
    const frame4 = engine.render('{{spinner}}', state); // Should wrap to 'a'

    assert.strictEqual(frame1, 'a');
    assert.strictEqual(frame2, 'b');
    assert.strictEqual(frame3, 'c');
    assert.strictEqual(frame4, 'a');
  });

  await t.test('spinner works with built-in dot frames', () => {
    const engine = new TemplateEngine({ spinnerFrames: spinners.dots });
    const state = createTestState();

    const result = engine.render('{{spinner}}', state);
    assert(spinners.dots.includes(result));
  });

  await t.test('spinner works with built-in line frames', () => {
    const engine = new TemplateEngine({ spinnerFrames: spinners.line });
    const state = createTestState();

    const result = engine.render('{{spinner}}', state);
    assert(spinners.line.includes(result));
  });
});

test('TemplateEngine - progress bar rendering', async (t) => {
  await t.test('bar renders correctly at 0%', () => {
    const engine = new TemplateEngine({ barWidth: 10 });
    const state = createTestState({ percentage: 0 });

    const result = engine.render('{{bar}}', state);
    assert.strictEqual(result, '[░░░░░░░░░░]');
  });

  await t.test('bar renders correctly at 50%', () => {
    const engine = new TemplateEngine({ barWidth: 10 });
    const state = createTestState({ percentage: 50 });

    const result = engine.render('{{bar}}', state);
    assert.strictEqual(result, '[█████░░░░░]');
  });

  await t.test('bar renders correctly at 100%', () => {
    const engine = new TemplateEngine({ barWidth: 10 });
    const state = createTestState({ percentage: 100 });

    const result = engine.render('{{bar}}', state);
    assert.strictEqual(result, '[██████████]');
  });

  await t.test('bar renders correctly with small width', () => {
    const engine = new TemplateEngine({ barWidth: 4 });
    const state = createTestState({ percentage: 25 });

    const result = engine.render('{{bar}}', state);
    assert.strictEqual(result, '[█░░░]');
  });

  await t.test('bar renders correctly with large width', () => {
    const engine = new TemplateEngine({ barWidth: 40 });
    const state = createTestState({ percentage: 50 });

    const result = engine.render('{{bar}}', state);

    const filled = result.match(/█/g)?.length || 0;
    const empty = result.match(/░/g)?.length || 0;

    assert.strictEqual(filled, 20);
    assert.strictEqual(empty, 20);
  });
});

test('TemplateEngine - ETA calculation', async (t) => {
  await t.test('ETA is 0 when current is 0', () => {
    const engine = new TemplateEngine();
    const state = createTestState({ current: 0, total: 100 });

    const result = engine.render('{{eta}}', state);
    assert.strictEqual(result, '');
  });

  await t.test('ETA is 0 when elapsed is 0', () => {
    const engine = new TemplateEngine();
    const now = Date.now();
    const state = createTestState({
      current: 50,
      total: 100,
      startTime: now,
      updatedTime: now,
    });

    const result = engine.render('{{eta}}', state);
    assert.strictEqual(result, '');
  });

  await t.test('ETA calculates correctly', () => {
    const engine = new TemplateEngine();
    const now = Date.now();
    const state = createTestState({
      current: 50,
      total: 100,
      startTime: now - 10000, // 10 seconds ago
      updatedTime: now,
    });

    const result = engine.render('{{eta}}', state);
    assert.strictEqual(result, '10s'); // 50 items in 10s = 5/s, 50 remaining = 10s
  });
});

test('Built-in templates', async (t) => {
  const engine = new TemplateEngine({ barWidth: 10 });
  const state = createTestState({ percentage: 50, current: 50, total: 100, message: 'Processing' });

  await t.test('templates.bar renders correctly', () => {
    const result = engine.render(templates.bar, state);
    assert(result.includes('[█████░░░░░]'));
    assert(result.includes('50%'));
  });

  await t.test('templates.spinner renders correctly', () => {
    const result = engine.render(templates.spinner, state);
    assert(result.includes('Processing'));
  });

  await t.test('templates.percentage renders correctly', () => {
    const result = engine.render(templates.percentage, state);
    assert.strictEqual(result, '50%');
  });

  await t.test('templates.detailed renders correctly', () => {
    const result = engine.render(templates.detailed, state);
    assert(result.includes('[50%]'));
    assert(result.includes('50/100'));
    assert(result.includes('Processing'));
    assert(result.includes('5s'));
  });

  await t.test('templates.minimal renders correctly', () => {
    const result = engine.render(templates.minimal, state);
    assert.strictEqual(result, 'Processing 50%');
  });

  await t.test('templates.full renders correctly', () => {
    const result = engine.render(templates.full, state);
    assert(result.includes('[█████░░░░░]'));
    assert(result.includes('50%'));
    assert(result.includes('Processing'));
    assert(result.includes('5s elapsed'));
  });

  await t.test('templates.spinnerProgress renders correctly', () => {
    const result = engine.render(templates.spinnerProgress, state);
    assert(result.includes('[50%]'));
    assert(result.includes('Processing'));
  });
});

test('createTemplateEngine factory', async (t) => {
  await t.test('creates engine with default options', () => {
    const engine = createTemplateEngine();
    assert(engine instanceof TemplateEngine);
  });

  await t.test('creates engine with custom options', () => {
    const engine = createTemplateEngine({
      spinnerFrames: ['x', 'y'],
      barWidth: 15,
    });

    const state = createTestState({ percentage: 50 });
    const result = engine.render('{{bar}}', state);

    assert.strictEqual(result.length, 17); // 15 + 2 brackets
  });
});

test('spinners', async (t) => {
  await t.test('spinners.dots has 10 frames', () => {
    assert.strictEqual(spinners.dots.length, 10);
  });

  await t.test('spinners.line has 4 frames', () => {
    assert.strictEqual(spinners.line.length, 4);
  });

  await t.test('spinners.arrows has 8 frames', () => {
    assert.strictEqual(spinners.arrows.length, 8);
  });

  await t.test('spinners.box has 4 frames', () => {
    assert.strictEqual(spinners.box.length, 4);
  });

  await t.test('spinners.clock has 12 frames', () => {
    assert.strictEqual(spinners.clock.length, 12);
  });
});
