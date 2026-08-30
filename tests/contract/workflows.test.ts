import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

type Workflow = {
  name?: string;
  on?: {
    workflow_dispatch?: {
      inputs?: Record<string, {
        description?: string;
        required?: boolean;
        type?: string;
        default?: string;
        options?: string[];
      }>;
    };
  };
  permissions?: unknown;
  jobs?: Record<string, unknown>;
};

const workflowDirectory = path.join(process.cwd(), '.github', 'workflows');

describe('GitHub Actions contracts', () => {
  it('parses every workflow and keeps explicit permissions', async () => {
    const filenames = (await readdir(workflowDirectory)).filter((name) => /\.ya?ml$/.test(name));
    expect(filenames.length).toBeGreaterThan(0);

    for (const filename of filenames) {
      const workflow = parse(await readFile(path.join(workflowDirectory, filename), 'utf8')) as Workflow;
      expect(workflow.name, `${filename} has a name`).toBeTruthy();
      expect(workflow.on, `${filename} has triggers`).toBeTruthy();
      expect(workflow.permissions, `${filename} has explicit permissions`).toBeTruthy();
      expect(Object.keys(workflow.jobs ?? {}), `${filename} has jobs`).not.toHaveLength(0);
    }
  });

  it('keeps every production confirmation as a separate dispatch input', async () => {
    const workflow = parse(
      await readFile(path.join(workflowDirectory, 'production-release.yml'), 'utf8'),
    ) as Workflow;
    const inputs = workflow.on?.workflow_dispatch?.inputs;

    expect(Object.keys(inputs ?? {}).sort()).toEqual([
      'asset_tier',
      'confirm_legal_approval',
      'confirm_sol_review',
    ]);
    expect(inputs?.asset_tier).toMatchObject({
      required: true,
      type: 'choice',
      default: 'free',
      options: ['free', 'paid'],
    });
  });
});
