import { execSync } from 'child_process';
import { CONFIG } from './config';

/**
 * Execute the backend simulate-sepay script via child_process.
 * @param content Transfer note (e.g. BIDYTOPUP001 or BIDY007)
 * @param amount Transfer amount in VNĐ (e.g. 2000000)
 */
export function simulateSepay(content: string, amount: number): string {
  if (!content || amount <= 0) {
    throw new Error(`Invalid arguments for simulateSepay: content="${content}", amount=${amount}`);
  }

  const command = `npm run sepay:simulate -- "${content}" "${amount}"`;
  
  try {
    const stdout = execSync(command, {
      cwd: CONFIG.BE_DIR,
      encoding: 'utf-8',
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
      timeout: 15000,
    });
    return stdout;
  } catch (error: any) {
    const stdout = error.stdout?.toString() || '';
    const stderr = error.stderr?.toString() || '';
    throw new Error(
      `Failed to simulate SePay payment (command: ${command}):\n` +
      `Exit Code: ${error.status}\n` +
      `Stderr: ${stderr}\n` +
      `Stdout: ${stdout}\n` +
      `Message: ${error.message}`
    );
  }
}
