/**
 * Template System for Progress Reporting
 *
 * Provides customizable output formats with built-in templates and variable substitution.
 */

import type { ProgressState } from './index.js';

/**
 * Template variables available for substitution
 */
export interface TemplateVariables {
  /** Percentage complete (0-100) */
  percentage: number;
  /** Current value */
  current: number;
  /** Total value */
  total: number;
  /** User message */
  message: string;
  /** Elapsed seconds */
  elapsed: number;
  /** Animated spinner character */
  spinner: string;
  /** Progress bar string */
  bar: string;
  /** Estimated time remaining (seconds) */
  eta: number;
}

/**
 * Template definition
 */
export type Template = string | ((vars: TemplateVariables) => string);

/**
 * Spinner frame sets
 */
export const spinners = {
  dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  line: ['|', '/', '-', '\\'],
  arrows: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'],
  box: ['◰', '◳', '◲', '◱'],
  clock: ['🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛'],
} as const;

/**
 * Template engine state
 */
interface TemplateEngineState {
  /** Current spinner frame index */
  spinnerFrame: number;
  /** Spinner frames to use */
  spinnerFrames: readonly string[];
  /** Progress bar width in characters */
  barWidth: number;
}

/**
 * Template engine for rendering progress output
 */
export class TemplateEngine {
  private state: TemplateEngineState;

  constructor(options: {
    spinnerFrames?: readonly string[];
    barWidth?: number;
  } = {}) {
    this.state = {
      spinnerFrame: 0,
      spinnerFrames: options.spinnerFrames || spinners.dots,
      barWidth: options.barWidth || 20,
    };
  }

  /**
   * Render a template with progress state
   */
  render(template: Template, progressState: ProgressState): string {
    const vars = this.buildVariables(progressState);

    if (typeof template === 'function') {
      return template(vars);
    }

    return this.substituteVariables(template, vars);
  }

  /**
   * Build template variables from progress state
   */
  private buildVariables(state: ProgressState): TemplateVariables {
    const elapsed = Math.floor((state.updatedTime - state.startTime) / 1000);
    const eta = this.calculateETA(state, elapsed);

    return {
      percentage: state.percentage,
      current: state.current,
      total: state.total,
      message: state.message,
      elapsed,
      spinner: this.getSpinner(),
      bar: this.renderBar(state.percentage),
      eta,
    };
  }

  /**
   * Substitute template variables in string
   */
  private substituteVariables(template: string, vars: TemplateVariables): string {
    return template
      .replace(/\{\{percentage\}\}/g, vars.percentage.toFixed(0))
      .replace(/\{\{current\}\}/g, vars.current.toString())
      .replace(/\{\{total\}\}/g, vars.total.toString())
      .replace(/\{\{message\}\}/g, vars.message)
      .replace(/\{\{elapsed\}\}/g, vars.elapsed.toString())
      .replace(/\{\{spinner\}\}/g, vars.spinner)
      .replace(/\{\{bar\}\}/g, vars.bar)
      .replace(/\{\{eta\}\}/g, vars.eta > 0 ? `${vars.eta}s` : '');
  }

  /**
   * Get current spinner frame and advance to next
   */
  private getSpinner(): string {
    const frame = this.state.spinnerFrames[this.state.spinnerFrame] || '·';
    this.state.spinnerFrame = (this.state.spinnerFrame + 1) % this.state.spinnerFrames.length;
    return frame;
  }

  /**
   * Render progress bar using Unicode block characters
   */
  private renderBar(percentage: number): string {
    const filled = Math.round((percentage / 100) * this.state.barWidth);
    const empty = this.state.barWidth - filled;

    const filledBar = '█'.repeat(filled);
    const emptyBar = '░'.repeat(empty);

    return `[${filledBar}${emptyBar}]`;
  }

  /**
   * Calculate estimated time remaining
   */
  private calculateETA(state: ProgressState, elapsed: number): number {
    if (state.current === 0 || elapsed === 0) {
      return 0;
    }

    const rate = state.current / elapsed; // items per second
    const remaining = state.total - state.current;

    return Math.ceil(remaining / rate);
  }

  /**
   * Reset spinner animation to first frame
   */
  resetSpinner(): void {
    this.state.spinnerFrame = 0;
  }

  /**
   * Set spinner frames
   */
  setSpinnerFrames(frames: readonly string[]): void {
    this.state.spinnerFrames = frames;
    this.state.spinnerFrame = 0;
  }

  /**
   * Set progress bar width
   */
  setBarWidth(width: number): void {
    if (width < 1) {
      throw new Error('Bar width must be at least 1');
    }
    this.state.barWidth = width;
  }
}

/**
 * Built-in template definitions
 */
export const templates = {
  /**
   * Progress bar template: [████░░░░] 50%
   */
  bar: '{{bar}} {{percentage}}%',

  /**
   * Spinner template: ⠋ Processing...
   */
  spinner: '{{spinner}} {{message}}',

  /**
   * Percentage only template: 50%
   */
  percentage: '{{percentage}}%',

  /**
   * Detailed template: [50%] 50/100 - Processing (5s)
   */
  detailed: '[{{percentage}}%] {{current}}/{{total}} - {{message}} ({{elapsed}}s)',

  /**
   * Minimal template: Processing... 50%
   */
  minimal: '{{message}} {{percentage}}%',

  /**
   * Full template with ETA: [████░░░░] 50% - Processing (5s elapsed, ~10s remaining)
   */
  full: '{{bar}} {{percentage}}% - {{message}} ({{elapsed}}s elapsed{{eta}})',

  /**
   * Spinner with progress: ⠋ [50%] Processing...
   */
  spinnerProgress: '{{spinner}} [{{percentage}}%] {{message}}',
} as const;

/**
 * Create a template engine instance
 */
export function createTemplateEngine(options?: {
  spinnerFrames?: readonly string[];
  barWidth?: number;
}): TemplateEngine {
  return new TemplateEngine(options);
}
