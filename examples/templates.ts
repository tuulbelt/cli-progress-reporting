/**
 * Example: Customizing Output with Templates
 *
 * Demonstrates the TemplateEngine for customizable progress output,
 * including built-in templates, custom templates, and spinners.
 *
 * Run: npx tsx examples/templates.ts
 */

import {
  ProgressTracker,
  TemplateEngine,
  templates,
  spinners,
  type Template,
} from '../src/index.js';

async function simulateWork(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('Template System Example\n');

  const tracker = new ProgressTracker({ id: 'template-demo' });
  tracker.init(20, 'Processing items');

  // Demo 1: Built-in Templates
  console.log('=== Built-in Templates ===\n');

  const engine1 = new TemplateEngine({ barWidth: 20 });
  const state = tracker.get();

  if (state.ok) {
    console.log('templates.bar:');
    console.log(`  ${engine1.render(templates.bar, state.value)}\n`);

    console.log('templates.spinner:');
    console.log(`  ${engine1.render(templates.spinner, state.value)}\n`);

    console.log('templates.detailed:');
    console.log(`  ${engine1.render(templates.detailed, state.value)}\n`);

    console.log('templates.full:');
    console.log(`  ${engine1.render(templates.full, state.value)}\n`);

    console.log('templates.minimal:');
    console.log(`  ${engine1.render(templates.minimal, state.value)}\n`);
  }

  // Demo 2: Different Spinners
  console.log('=== Different Spinner Styles ===\n');

  const spinnerStyles = [
    { name: 'dots', frames: spinners.dots },
    { name: 'line', frames: spinners.line },
    { name: 'arrows', frames: spinners.arrows },
    { name: 'box', frames: spinners.box },
    { name: 'clock', frames: spinners.clock },
  ];

  for (const style of spinnerStyles) {
    const engine = new TemplateEngine({ spinnerFrames: style.frames });
    const currentState = tracker.get();

    if (currentState.ok) {
      console.log(`${style.name.padEnd(8)}: ${engine.render(templates.spinner, currentState.value)}`);
    }
  }

  console.log();

  // Demo 3: Custom Templates
  console.log('=== Custom Templates ===\n');

  const customTemplates: Array<{ name: string; template: Template }> = [
    {
      name: 'Simple',
      template: '{{spinner}} {{percentage}}%',
    },
    {
      name: 'Compact',
      template: '[{{current}}/{{total}}] {{message}}',
    },
    {
      name: 'Detailed with ETA',
      template: '{{bar}} {{percentage}}% - {{message}} ({{elapsed}}s elapsed{{eta}})',
    },
    {
      name: 'Function-based',
      template: (vars) => {
        const eta = vars.eta > 0 ? ` | ETA: ${vars.eta}s` : '';
        return `${vars.spinner} ${vars.percentage}% (${vars.current}/${vars.total})${eta} - ${vars.message}`;
      },
    },
  ];

  const engine3 = new TemplateEngine();
  const customState = tracker.get();

  if (customState.ok) {
    for (const { name, template } of customTemplates) {
      console.log(`${name}:`);
      console.log(`  ${engine3.render(template, customState.value)}\n`);
    }
  }

  // Demo 4: Animated Progress
  console.log('=== Animated Progress ===\n');

  const animEngine = new TemplateEngine({ spinnerFrames: spinners.dots, barWidth: 30 });

  for (let i = 1; i <= 20; i++) {
    await simulateWork(150);

    tracker.increment(1, `Processing item ${i}`);
    const animState = tracker.get();

    if (animState.ok) {
      // Clear line and render animated template
      process.stdout.write('\r\x1b[K'); // Clear line
      process.stdout.write(animEngine.render(templates.full, animState.value));
    }
  }

  console.log('\n\n✅ All items processed!\n');

  // Clean up
  tracker.clear();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
