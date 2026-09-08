import type { Remnant } from './remnant.js';

export type OutputRenderMode = 'summary' | 'full' | 'none';

export interface RenderRemnantOptions {
  maxChars?: number;
  includeOutputs?: OutputRenderMode;
  includeVerification?: boolean;
}

function line(label: string, value: string): string {
  return `${label}: ${value}`;
}

function section(title: string, lines: string[]): string[] {
  if (lines.length === 0) return [];
  return [title, ...lines, ''];
}

export function renderRemnantForAgent(
  remnant: Remnant,
  options: RenderRemnantOptions = {},
): string {
  const maxChars = options.maxChars ?? 6000;
  const includeOutputs = options.includeOutputs ?? 'summary';
  const includeVerification = options.includeVerification ?? true;

  const parts: string[] = [
    `REMNANT ${remnant.id}`,
    line('STATUS', remnant.status),
    line('AS OF', remnant.asOf),
    line('PRODUCER', remnant.producer),
    line('GOAL', remnant.goal),
    '',
  ];

  if (includeOutputs !== 'none') {
    const outputLines = remnant.outputs.map((output) => {
      if (output.kind === 'file') {
        const hash = output.sha256 ? ', sha256 present' : '';
        return `- ${output.path} (${output.mediaType}${hash})`;
      }
      if (output.kind === 'text') {
        if (includeOutputs === 'full') {
          return `- text ${output.name ?? ''}: ${output.text}`;
        }
        const preview = output.text.length > 120 ? `${output.text.slice(0, 117)}...` : output.text;
        return `- text${output.name ? ` ${output.name}` : ''}: ${preview}`;
      }
      if (output.kind === 'data') {
        return `- data${output.name ? ` ${output.name}` : ''}`;
      }
      return `- reference ${output.uri}`;
    });
    parts.push(...section('OUTPUTS', outputLines));
  }

  if (includeVerification) {
    const verified = remnant.verification.map((record) => {
      const bound = record.doesNotProve?.length
        ? ` (does not prove: ${record.doesNotProve.join('; ')})`
        : '';
      return `- ${record.result.toUpperCase()}: ${record.claim} via \`${record.method}\`${bound}`;
    });
    parts.push(...section('VERIFIED', verified));
  }

  const assumptions = remnant.assumptions.map((a) => `- [${a.basis}] ${a.statement}`);
  parts.push(...section('ASSUMPTIONS', assumptions));

  const unknowns = remnant.unknowns.map((u) => `- ${u}`);
  parts.push(...section('UNKNOWNS', unknowns));

  if (remnant.effects?.length) {
    const effects = remnant.effects.map((e) => `- ${e.status}: ${e.action}`);
    parts.push(...section('EFFECTS', effects));
  }

  if (remnant.supersedes?.length) {
    parts.push(...section('SUPERSEDES', remnant.supersedes.map((id) => `- ${id}`)));
  }

  const stops = remnant.stop.map((s) => `- ${s}`);
  parts.push(...section('STOP', stops));

  if (remnant.nextAction) {
    parts.push(...section('NEXT', [`- ${remnant.nextAction}`]));
  }

  const text = parts.join('\n').trimEnd();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 20))}\n…[truncated]`;
}
