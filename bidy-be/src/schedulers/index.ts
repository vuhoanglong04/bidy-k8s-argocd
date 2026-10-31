import cron from 'node-cron';
import auctionStatusService from '../modules/auction/auction-status.service.js';
import paymentDeadlineService from '../modules/order/payment-deadline.service.js';
import { AdminUserService } from '../modules/admin/admin-user.service.js';
import { WalletCronService } from '../modules/wallet/wallet-cron.service.js';
import { logger } from '../common/util/logger.js';

// Error recovery tracking
let statusJobErrorCount = 0;
let paymentJobErrorCount = 0;
let suspensionJobErrorCount = 0;
const MAX_CONSECUTIVE_ERRORS = 5;

export const startCronJob = () => {
  // Constructed here, not at module scope: the service resolves its repositories in
  // its constructor, and this module is imported before AppDataSource.initialize()
  // runs. startCronJob is called after it.
  const adminUserService = new AdminUserService();
  const walletCronService = new WalletCronService();

  // Optimized: Run every 10 seconds for real-time status updates
  // This provides much better user experience with accurate countdown timers
  const statusJob = cron.schedule('*/10 * * * * *', async () => {
    try {
      // Handle auction lifecycle with VN timezone (start upcoming auctions, end finished ones)
      await auctionStatusService.processAuctionLifecycle();
      statusJobErrorCount = 0; // Reset on success
    } catch (error) {
      statusJobErrorCount++;
      logger.error('[Cron-Status]: Error in auction status job', error, {
        consecutiveErrors: statusJobErrorCount,
      });

      // CRITICAL: Too many consecutive errors - alert and restart
      if (statusJobErrorCount >= MAX_CONSECUTIVE_ERRORS) {
        logger.error(
          '[Cron-Status]: CRITICAL - Too many consecutive errors! Attempting recovery...',
          null,
          {
            consecutiveErrors: statusJobErrorCount,
            action: 'Continuing cronjob (will retry next cycle)',
          },
        );
        statusJobErrorCount = 0;
      }
    }
  });

  // 💰 Payment Deadline Processing - runs every hour
  // Checks for overdue payments and locks accounts after 3 days
  const paymentDeadlineJob = cron.schedule('0 0 * * * *', async () => {
    try {
      // Process payment deadlines and lock accounts for overdue orders
      const result = await paymentDeadlineService.processPaymentDeadlines();
      paymentJobErrorCount = 0; // Reset on success

      if (result && (result.overdueOrders > 0 || result.lockedAccounts > 0)) {
        logger.info('[Cron-Payment]: Payment deadline processing completed', {
          overdueOrders: result.overdueOrders,
          lockedAccounts: result.lockedAccounts,
        });
      }
    } catch (error) {
      paymentJobErrorCount++;
      logger.error('[Cron-Payment]: Error in payment deadline job', error, {
        consecutiveErrors: paymentJobErrorCount,
      });

      if (paymentJobErrorCount >= MAX_CONSECUTIVE_ERRORS) {
        logger.error('[Cron-Payment]: CRITICAL - Too many consecutive errors!', null, {
          consecutiveErrors: paymentJobErrorCount,
        });
        paymentJobErrorCount = 0;
      }
    }
  });

  // ⏳ Suspension expiry - runs every 5 minutes
  // suspendUser writes suspendedUntil but nothing read it back, so a timed
  // suspension never ended on its own: the account stayed locked out until an admin
  // activated it by hand. Five minutes is the granularity a "suspended until" is
  // worth — the user cannot see the difference, and the scan is a single indexed
  // lookup that returns nothing on almost every run.
  const suspensionExpiryJob = cron.schedule('0 */5 * * * *', async () => {
    try {
      const result = await adminUserService.liftExpiredSuspensions();
      suspensionJobErrorCount = 0;

      if (result.lifted > 0) {
        logger.info('[Cron-Suspension]: Expired suspensions lifted', { lifted: result.lifted });
      }
    } catch (error) {
      suspensionJobErrorCount++;
      logger.error('[Cron-Suspension]: Error in suspension expiry job', error, {
        consecutiveErrors: suspensionJobErrorCount,
      });

      if (suspensionJobErrorCount >= MAX_CONSECUTIVE_ERRORS) {
        logger.error('[Cron-Suspension]: CRITICAL - Too many consecutive errors!', null, {
          consecutiveErrors: suspensionJobErrorCount,
        });
        suspensionJobErrorCount = 0;
      }
    }
  });

  // 💳 Withdrawal SLA check - runs every hour (Phase 5)
  // Alerts admin if any pending/processing requests exceeded the 10-day SLA
  const withdrawalSlaJob = cron.schedule('0 * * * *', async () => {
    try {
      await walletCronService.checkWithdrawalSla();
    } catch (error) {
      logger.error('[Cron-Withdrawal-SLA]: Error checking withdrawal SLA', error);
    }
  });

  // ⚖️ Nightly reconciliation & daily summary - runs at 01:00 AM every night (Phase 6)
  // Verifies the 5 financial invariants and aggregates daily summary
  const reconciliationJob = cron.schedule('0 1 * * *', async () => {
    try {
      await walletCronService.runNightlyReconciliation();
    } catch (error) {
      logger.error('[Cron-Reconciliation]: Error in nightly reconciliation', error);
    }
  });

  // Add graceful shutdown handling
  process.on('SIGTERM', () => {
    logger.info('[Cron]: Received SIGTERM, gracefully stopping cron jobs...');
    if (statusJob) statusJob.stop();
    if (paymentDeadlineJob) paymentDeadlineJob.stop();
    if (suspensionExpiryJob) suspensionExpiryJob.stop();
    if (withdrawalSlaJob) withdrawalSlaJob.stop();
    if (reconciliationJob) reconciliationJob.stop();
  });

  process.on('SIGINT', () => {
    logger.info('[Cron]: Received SIGINT, gracefully stopping cron jobs...');
    if (statusJob) statusJob.stop();
    if (paymentDeadlineJob) paymentDeadlineJob.stop();
    if (suspensionExpiryJob) suspensionExpiryJob.stop();
    if (withdrawalSlaJob) withdrawalSlaJob.stop();
    if (reconciliationJob) reconciliationJob.stop();
    process.exit(0);
  });

  logger.info('[Cron]: All cronjobs started successfully', {
    statusJob: 'every 10 seconds',
    paymentDeadlineJob: 'every hour',
    suspensionExpiryJob: 'every 5 minutes',
    withdrawalSlaJob: 'every hour',
    reconciliationJob: 'every day at 01:00',
  });
};
