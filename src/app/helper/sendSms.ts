import twilio, { type Twilio } from 'twilio';
import config from '../config';
import { errorLogger } from '../shared/logger';

const E164_PHONE_NUMBER = /^\+[1-9]\d{7,14}$/;
const MAX_SMS_LENGTH = 1600;

export interface SmsResponse {
    sid: string;
    status: string;
    to: string;
}

export class SmsDeliveryError extends Error {
    readonly code?: number | string;
    readonly status?: number;

    constructor(message: string, options?: { code?: number | string; status?: number }) {
        super(message);
        this.name = 'SmsDeliveryError';
        this.code = options?.code;
        this.status = options?.status;
    }
}

let twilioClient: Twilio | undefined;

function getTwilioClient(): Twilio {
    const { accountSid, authToken } = config.twilio;
    if (!accountSid || !authToken) {
        throw new SmsDeliveryError(
            'Twilio is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.'
        );
    }

    if (!twilioClient) {
        twilioClient = twilio(accountSid, authToken, {
            autoRetry: true,
            maxRetries: 2,
            timeout: 10_000,
        });
    }

    return twilioClient;
}

export const sendSMS = async (
    phoneNumber: string,
    smsMessage: string
): Promise<SmsResponse> => {
    const to = phoneNumber.trim();
    const body = smsMessage.trim();

    if (!E164_PHONE_NUMBER.test(to)) {
        throw new SmsDeliveryError('Recipient phone number must use international E.164 format.');
    }
    if (!body) {
        throw new SmsDeliveryError('SMS message cannot be empty.');
    }
    if (body.length > MAX_SMS_LENGTH) {
        throw new SmsDeliveryError(`SMS message cannot exceed ${MAX_SMS_LENGTH} characters.`);
    }

    const { phoneNumber: from, messagingServiceSid } = config.twilio;
    if (!from && !messagingServiceSid) {
        throw new SmsDeliveryError(
            'Twilio sender is not configured. Set TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID.'
        );
    }

    try {
        const message = await getTwilioClient().messages.create({
            to,
            body,
            ...(messagingServiceSid ? { messagingServiceSid } : { from }),
        });

        return {
            sid: message.sid,
            status: message.status,
            to: message.to,
        };
    } catch (error) {
        const providerError =
            typeof error === 'object' && error !== null
                ? (error as { code?: number | string; status?: number })
                : undefined;
        const code = providerError?.code;
        const status = providerError?.status;

        errorLogger.error('Twilio SMS send failed', {
            code,
            status,
        });

        throw new SmsDeliveryError('Twilio could not send the SMS.', { code, status });
    }
};

export default sendSMS;
