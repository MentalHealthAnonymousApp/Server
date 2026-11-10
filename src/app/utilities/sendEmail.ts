import { Resend } from 'resend';
import config from '../config';

const sendEmail = async (options: {
    email: string;
    subject: string;
    html: string;
}) => {
    if (!config.email.resend_api_key) {
        throw new Error('RESEND_API_KEY is required to send email.');
    }
    if (!config.email.from_email) {
        throw new Error('RESEND_FROM_EMAIL is required to send email.');
    }

    const resend = new Resend(config.email.resend_api_key);
    const result = await resend.emails.send({
        from: `${config.email.name || 'Mental Health Anonymous'} <${config.email.from_email}>`,
        to: options.email,
        subject: options.subject,
        html: options.html,
    });

    if (result.error) {
        throw new Error(`Resend failed to send email: ${result.error.message}`);
    }
    if (!result.data?.id) {
        throw new Error('Resend did not confirm email delivery.');
    }
};

export default sendEmail;
