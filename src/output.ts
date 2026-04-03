/**
 * Output formatting: table, JSON, Markdown, CSV, YAML.
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

export interface RenderOptions {
  fmt?: string;
  columns?: string[];
  title?: string;
  elapsed?: number;
  source?: string;
  footerExtra?: string;
  outputFile?: string;
}

interface WebSearchMeta {
  sourceCounts?: Record<string, number>;
  sourceSummary?: string;
}

interface WebSearchResult {
  _meta?: WebSearchMeta;
  _data?: unknown[];
}

function isWebSearchResult(data: unknown): data is WebSearchResult {
  return (
    typeof data === 'object' &&
    data !== null &&
    '_meta' in data &&
    '_data' in data
  );
}

function normalizeRows(data: unknown): Record<string, unknown>[] {
  // Handle web/search results with metadata
  if (isWebSearchResult(data) && Array.isArray(data._data)) {
    return data._data as Record<string, unknown>[];
  }
  return Array.isArray(data) ? data : [data as Record<string, unknown>];
}

function resolveColumns(rows: Record<string, unknown>[], opts: RenderOptions): string[] {
  return opts.columns ?? Object.keys(rows[0] ?? {});
}

/** Collect written lines when rendering to a buffer. */
class OutputCollector {
  lines: string[] = [];
  write(line: string): void { this.lines.push(line); }
  toString(): string { return this.lines.join('\n') + '\n'; }
}

export function render(data: unknown, opts: RenderOptions = {}): void {
  const fmt = opts.fmt ?? 'table';
  if (data === null || data === undefined) {
    console.log(data);
    return;
  }

  // Handle web/search results with metadata
  let sourceSummary: string | undefined;
  if (isWebSearchResult(data)) {
    sourceSummary = data._meta?.sourceSummary;
  }

  // If outputFile is set, collect output into a buffer instead of console.log
  const collector = opts.outputFile ? new OutputCollector() : null;

  switch (fmt) {
    case 'json': renderJson(data, collector); break;
    case 'md': case 'markdown': renderMarkdown(data, opts, collector); break;
    case 'csv': renderCsv(data, opts, collector); break;
    case 'yaml': case 'yml': renderYaml(data, collector); break;
    default: {
      const tableOpts = { ...opts };
      if (sourceSummary) {
        const existingFooter = opts.footerExtra || '';
        tableOpts.footerExtra = existingFooter
          ? `${existingFooter} · ${sourceSummary}`
          : sourceSummary;
      }
      renderTable(data, tableOpts, collector);
      break;
    }
  }

  if (collector && opts.outputFile) {
    fs.mkdirSync(path.dirname(opts.outputFile), { recursive: true });
    fs.writeFileSync(opts.outputFile, collector.toString());
    const rows = normalizeRows(data);
    const count = rows.length;
    const hint = sourceSummary ? ` (${sourceSummary})` : '';
    console.log(chalk.green(`✓ 已保存至 ${opts.outputFile}${count ? ` · ${count} 条结果${hint}` : ''}`));
  }
}

function out(collector: OutputCollector | null, line: string): void {
  if (collector) {
    collector.write(line);
  } else {
    console.log(line);
  }
}

function renderTable(data: unknown, opts: RenderOptions, collector: OutputCollector | null = null): void {
  const rows = normalizeRows(data);
  if (!rows.length) { out(collector, chalk.dim('(no data)')); return; }
  const columns = resolveColumns(rows, opts);

  const header = columns.map(c => capitalize(c));
  const table = new Table({
    head: header.map(h => chalk.bold(h)),
    style: { head: [], border: [] },
    wordWrap: true,
    wrapOnWordBoundary: true,
  });

  for (const row of rows) {
    table.push(columns.map(c => {
      const v = (row as Record<string, unknown>)[c];
      return v === null || v === undefined ? '' : String(v);
    }));
  }

  out(collector, '');
  if (opts.title) out(collector, chalk.dim(`  ${opts.title}`));
  out(collector, table.toString());
  const footer: string[] = [];
  footer.push(`${rows.length} items`);
  if (opts.elapsed) footer.push(`${opts.elapsed.toFixed(1)}s`);
  if (opts.source) footer.push(opts.source);
  if (opts.footerExtra) footer.push(opts.footerExtra);
  out(collector, chalk.dim(footer.join(' · ')));

  // Show file path if any row has it
  const filePath = rows.find((r) => r.filePath)?.filePath as string | undefined;
  if (filePath) {
    out(collector, chalk.green(`→ 已保存至 ${filePath}`));
  }
}

function renderJson(data: unknown, collector: OutputCollector | null = null): void {
  out(collector, JSON.stringify(data, null, 2));
}

function renderMarkdown(data: unknown, opts: RenderOptions, collector: OutputCollector | null = null): void {
  const rows = normalizeRows(data);
  if (!rows.length) return;
  const columns = resolveColumns(rows, opts);
  out(collector, '| ' + columns.join(' | ') + ' |');
  out(collector, '| ' + columns.map(() => '---').join(' | ') + ' |');
  for (const row of rows) {
    out(collector, '| ' + columns.map(c => String((row as Record<string, unknown>)[c] ?? '')).join(' | ') + ' |');
  }
}

function renderCsv(data: unknown, opts: RenderOptions, collector: OutputCollector | null = null): void {
  const rows = normalizeRows(data);
  if (!rows.length) return;
  const columns = resolveColumns(rows, opts);
  out(collector, columns.join(','));
  for (const row of rows) {
    out(collector, columns.map(c => {
      const v = String((row as Record<string, unknown>)[c] ?? '');
      return v.includes(',') || v.includes('"') || v.includes('\n') || v.includes('\r')
        ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(','));
  }
}

function renderYaml(data: unknown, collector: OutputCollector | null = null): void {
  out(collector, yaml.dump(data, { sortKeys: false, lineWidth: 120, noRefs: true }));
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
