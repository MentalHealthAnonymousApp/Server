import config from '../../config';

interface SharedMessageTemplateInput {
    recipientName?: string;
    customNote?: string;
    topicName: string;
    resources: Array<{ title: string; url: string }>;
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
        const entities: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        };
        return entities[character];
    });
}

function getWebsiteUrl(): URL {
    if (!config.website_url) {
        throw new Error('WEBSITE_URL is required to build resource links.');
    }

    let url: URL;
    try {
        url = new URL(config.website_url);
    } catch {
        throw new Error('WEBSITE_URL must be a valid absolute URL.');
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('WEBSITE_URL must use HTTP or HTTPS.');
    }
    return url;
}

export function getResourceUrl(resource: { slug?: string; id: string }): string {
    const url = getWebsiteUrl();
    url.pathname = `/resources/${encodeURIComponent(resource.slug || resource.id)}`;
    url.search = '';
    url.hash = '';
    return url.toString();
}

export function createMessageEmail(input: SharedMessageTemplateInput): {
    subject: string;
    html: string;
} {
    const greeting = input.recipientName?.trim()
        ? `Hi ${escapeHtml(input.recipientName.trim())},`
        : 'Hello,';
    const note = input.customNote?.trim()
        ? `<p style="margin:20px 0;padding:16px;border-left:3px solid #2e5e52;background:#f4f7f4;color:#33423b;white-space:pre-wrap">${escapeHtml(input.customNote.trim())}</p>`
        : '';
    const resourceItems = input.resources
        .map(
            (resource) =>
                `<tr>
  <td style="padding:0 0 14px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dfe8df;border-radius:12px;background:#fbfcfa">
      <tr>
        <td style="padding:18px">
          <p style="margin:0 0 14px;color:#26332d;font-size:16px;font-weight:700;line-height:1.45">${escapeHtml(resource.title)}</p>
          <a href="${escapeHtml(resource.url)}" style="display:inline-block;padding:11px 18px;border-radius:24px;background:#2e5e52;color:#ffffff;font-size:14px;font-weight:700;line-height:1.2;text-decoration:none">Read this resource</a>
          <p style="margin:12px 0 0;color:#68756e;font-size:12px;line-height:1.5">Select the button above to open this guide.</p>
        </td>
      </tr>
    </table>
  </td>
</tr>`
        )
        .join('');
    const websiteUrl = escapeHtml(getWebsiteUrl().toString());
    const hasMultipleResources = input.resources.length > 1;
    const sharedResourceLabel = hasMultipleResources ? 'resources' : 'resource';
    const sharedResourceHeading = hasMultipleResources
        ? 'Resources were shared with you'
        : 'A resource was shared with you';
    const resourceSection = resourceItems
        ? `<h2 style="margin:28px 0 8px;font-size:18px;line-height:1.4">${hasMultipleResources ? 'Resources' : 'A resource'} picked for you</h2>
      <p style="margin:0 0 16px;color:#56645d;font-size:14px;line-height:1.6">When you are ready, click or tap <strong>Read this resource</strong> below to view it.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${resourceItems}</table>`
        : `<p style="margin-top:24px"><a href="${websiteUrl}" style="display:inline-block;padding:11px 18px;border-radius:24px;background:#2e5e52;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none">Explore the resource library</a></p>`;

    return {
        subject: `Someone shared mental health ${sharedResourceLabel} with you`,
        html: `<!doctype html>
<html lang="en">
<head><meta name="viewport" content="width=device-width, initial-scale=1"><meta charset="utf-8"></head>
  <body style="margin:0;background:#f5f6f2;font-family:Arial,sans-serif;color:#26332d">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f2">
      <tr><td align="center" style="padding:24px 12px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #e1e7e1;border-radius:20px">
          <tr><td style="padding:28px 24px">
            <p style="margin:0 0 20px;color:#2e5e52;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Mental Health Anonymous</p>
            <h1 style="margin:0 0 20px;font-size:25px;line-height:1.3">${sharedResourceHeading}</h1>
            <p>${greeting}</p>
            <p style="line-height:1.6">Someone thought this guide about <strong>${escapeHtml(input.topicName)}</strong> might be useful. There is no pressure to read it; explore it whenever it feels right.</p>
            ${note}
            ${resourceSection}
            <p style="margin-top:32px;color:#68756e;font-size:12px;line-height:1.6">This message was sent through Mental Health Anonymous. The sender's identity is not included. These educational resources are not a substitute for professional care.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
    };
}

export function createMessageSms(input: SharedMessageTemplateInput): string {
    const recipient = input.recipientName?.trim() ? ` ${input.recipientName.trim()},` : '';
    const note = input.customNote?.trim() ? `\n\nA note: ${input.customNote.trim()}` : '';
    const links = input.resources.length
        ? `\n\nResources:\n${input.resources.map((resource) => `${resource.title}: ${resource.url}`).join('\n')}`
        : `\n\nExplore resources: ${getWebsiteUrl().toString()}`;
    return `Someone cares about you${recipient} and wanted to share support for ${input.topicName}.${note}${links}\n\nShared anonymously via Mental Health Anonymous. Educational resources only.`;
}
