import cron from 'node-cron';
import { errorLogger } from '../../shared/logger';
import MessageServices from './message.service';

let running = false;

const runAutoApproval = async () => {
    if (running) return; // skip if the previous run is still going
    running = true;
    try {
        await MessageServices.autoApproveOverdueMessages();
    } catch (error) {
        errorLogger.error('Message auto-approval job failed', error);
    } finally {
        running = false;
    }
};

/**
 * Auto-approves and sends messages that no admin reviewed within 3 days.
 * Runs every 10 minutes and once at startup to catch up after downtime.
 * Safe with multiple server instances: each message is claimed atomically before sending.
 */
export const startMessageAutoApprovalJob = () => {
    cron.schedule('*/10 * * * *', runAutoApproval);
    MessageServices.migrateLegacyMessages()
        .catch((error) => errorLogger.error('Legacy message migration failed', error))
        .finally(() => void runAutoApproval());
};

export default startMessageAutoApprovalJob;
