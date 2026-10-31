import { execSync } from 'child_process';
import { TestInfo } from '@playwright/test';
import { CONFIG } from './config';

/**
 * Executes wallet:reconcile on backend, asserts exit code 0, and attaches stdout to Playwright test report.
 */
export function runReconcile(testInfo?: TestInfo): string {
  const command = 'npm run wallet:reconcile';
  
  try {
    const stdout = execSync(command, {
      cwd: CONFIG.BE_DIR,
      encoding: 'utf-8',
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
      timeout: 30000,
    });

    if (testInfo) {
      testInfo.attach('wallet-reconciliation-output', {
        body: stdout,
        contentType: 'text/plain',
      });
    }

    return stdout;
  } catch (error: any) {
    const stdout = error.stdout?.toString() || '';
    const stderr = error.stderr?.toString() || '';
    
    if (testInfo) {
      testInfo.attach('wallet-reconciliation-failure', {
        body: `Stdout:\n${stdout}\n\nStderr:\n${stderr}\n\nError:\n${error.message}`,
        contentType: 'text/plain',
      });
    }

    throw new Error(
      `Wallet reconciliation failed with exit code ${error.status}:\n` +
      `Stderr: ${stderr}\n` +
      `Stdout: ${stdout}`
    );
  }
}
