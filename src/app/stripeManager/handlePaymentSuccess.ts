/* eslint-disable @typescript-eslint/no-explicit-any */
import { PackagePurchase } from '../modules/package_purchase/package_purchase.model';
import { errorLogger } from '../shared/logger';

const handlePaymentSuccess = async (
    metaData: any,
    transactionId: string,
    amount: number
) => {
    try {
        if (metaData?.purchaseId) {
            await PackagePurchase.findByIdAndUpdate(metaData.purchaseId, {
                status: 'completed',
                transactionId,
                amount,
            });
        }
    } catch (error) {
        errorLogger.error('Failed to handle payment success', error);
    }
};

export default handlePaymentSuccess;
