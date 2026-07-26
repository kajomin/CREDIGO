// Sends an autoresponse confirmation email to whoever submits any of the
// site's Netlify Forms. Netlify automatically invokes a function named
// exactly "submission-created" after every verified form submission —
// this exact filename is required, it is not configurable.
//
// Requires a RESEND_API_KEY environment variable (Site configuration ->
// Environment variables in the Netlify dashboard) and a verified
// credigo.cz domain in Resend (https://resend.com) so mail can be sent
// as info@credigo.cz.

const fs = require('fs');
const path = require('path');

const PDF_PATH = path.join(__dirname, 'assets', 'credigo-prehled.pdf');

let pdfBase64 = null;
try {
  pdfBase64 = fs.readFileSync(PDF_PATH).toString('base64');
} catch (err) {
  console.error('Could not read PDF attachment, sending emails without it:', err);
}

const MESSAGES = {
  poptavka: {
    subject: 'Potvrzení přijetí poptávky — Credigo',
    greeting: 'Dobrý den',
    body: 'děkujeme za vaši poptávku ohledně pojištění pohledávek. Ozveme se vám co nejdříve s dalším postupem.',
    signOff: 'S pozdravem,\nTým Credigo'
  },
  'poptavka-zaruka': {
    subject: 'Potvrzení přijetí poptávky záruky — Credigo',
    greeting: 'Dobrý den',
    body: 'děkujeme za vaši poptávku ohledně bondingu (pojištění záruk). Ozveme se vám co nejdříve s dalším postupem.',
    signOff: 'S pozdravem,\nTým Credigo'
  },
  'poptavka-en': {
    subject: 'Your inquiry has been received — Credigo',
    greeting: 'Hello',
    body: "thank you for your inquiry about trade credit insurance. We'll get back to you as soon as possible with next steps.",
    signOff: 'Best regards,\nThe Credigo team'
  },
  'poptavka-zaruka-en': {
    subject: 'Your guarantee inquiry has been received — Credigo',
    greeting: 'Hello',
    body: "thank you for your inquiry about bonding (surety insurance). We'll get back to you as soon as possible with next steps.",
    signOff: 'Best regards,\nThe Credigo team'
  },
  'poptavka-de': {
    subject: 'Ihre Anfrage wurde empfangen — Credigo',
    greeting: 'Hallo',
    body: 'vielen Dank für Ihre Anfrage zur Warenkreditversicherung. Wir melden uns so schnell wie möglich mit den nächsten Schritten.',
    signOff: 'Mit freundlichen Grüßen,\nIhr Credigo-Team'
  },
  'poptavka-zaruka-de': {
    subject: 'Ihre Garantieanfrage wurde empfangen — Credigo',
    greeting: 'Hallo',
    body: 'vielen Dank für Ihre Anfrage zu Bonding (Kautionsversicherung). Wir melden uns so schnell wie möglich mit den nächsten Schritten.',
    signOff: 'Mit freundlichen Grüßen,\nIhr Credigo-Team'
  }
};

exports.handler = async (event) => {
  const payload = JSON.parse(event.body).payload;
  const data = payload.data || {};

  // Honeypot: if the hidden bot-field was filled in, silently drop it.
  if (data['bot-field']) {
    return { statusCode: 200, body: 'ignored (honeypot)' };
  }

  const formName = payload.form_name;
  const toEmail = data.email;
  const name = data.jmeno;

  const msg = MESSAGES[formName];
  if (!toEmail || !msg) {
    return { statusCode: 200, body: 'ignored (no matching form/email)' };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY is not set — skipping autoresponse email.');
    return { statusCode: 200, body: 'no api key' };
  }

  const html = [
    `<p>${msg.greeting}${name ? ', ' + name : ''},</p>`,
    `<p>${msg.body}</p>`,
    `<p>${msg.signOff.replace(/\n/g, '<br>')}</p>`
  ].join('');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Credigo <info@credigo.cz>',
      to: [toEmail],
      subject: msg.subject,
      html,
      ...(pdfBase64 && {
        attachments: [
          { filename: 'Credigo-prehled-sluzeb.pdf', content: pdfBase64 }
        ]
      })
    })
  });

  if (!res.ok) {
    console.error('Resend API error:', res.status, await res.text());
    return { statusCode: 502, body: 'resend error' };
  }

  return { statusCode: 200, body: 'sent' };
};
