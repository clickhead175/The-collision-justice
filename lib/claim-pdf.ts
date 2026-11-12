import PDFDocument from 'pdfkit';
import { BRAND, SITE_URL } from '@/lib/brand';
import { extractTrustedFormCertId } from '@/lib/claim-request-metadata';

type ClaimSummary = {
  claimId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  zipCode: string;
  city: string;
  state: string;
  accidentDate: Date;
  accidentType: string;
  injuriesReported: string;
  policeReportFiled: string;
  atFaultStatus: string;
  description: string;
  ipAddress?: string;
  geoLocation?: string;
  trustedFormCertUrl?: string;
  trustedFormCertId?: string;
  trustedFormPingUrl?: string;
  consentAgreed?: boolean;
  consentTimestamp: Date;
  createdAt: Date;
  status: string;
};

const PAGE_WIDTH = 612;
const LEFT = 42;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT * 2;
const COLORS = {
  charcoal: '#0F172A',
  crimson: '#DC2626',
  white: '#FFFFFF',
  emerald: '#059669',
  emeraldTint: '#ECFDF5',
  redTint: '#FEF2F2',
  grayTint: '#F8FAFC',
  border: '#E2E8F0',
  ink: '#1E293B',
  muted: '#64748B',
};

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatFullDateTime(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';
  return `${get('weekday')}, ${get('day')} ${get('month')} ${get('year')} at ${get('hour')}:${get('minute')} ${get('dayPeriod')} UTC`;
}

function formatDateTime(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';
  return `${get('day')} ${get('month')} ${get('year')} · ${get('hour')}:${get('minute')} ${get('dayPeriod')} UTC`;
}

function drawShield(pdf: PDFKit.PDFDocument, x: number, y: number, size: number) {
  const scale = size / 48;
  pdf.save().translate(x, y).scale(scale);
  pdf.moveTo(24, 1).lineTo(45, 8).lineTo(45, 23)
    .bezierCurveTo(45, 36, 36, 44, 24, 48)
    .bezierCurveTo(12, 44, 3, 36, 3, 23)
    .lineTo(3, 8).closePath().fill(COLORS.crimson);
  pdf.lineWidth(1.7).lineCap('round').lineJoin('round').strokeColor(COLORS.white);
  pdf.moveTo(24, 11).lineTo(24, 35).moveTo(13, 17).lineTo(35, 17)
    .moveTo(16, 17).lineTo(11, 27).moveTo(16, 17).lineTo(21, 27)
    .moveTo(32, 17).lineTo(27, 27).moveTo(32, 17).lineTo(37, 27)
    .moveTo(11, 27).lineTo(21, 27).moveTo(27, 27).lineTo(37, 27)
    .moveTo(17, 36).lineTo(31, 36).stroke();
  pdf.restore();
}

function drawHeader(pdf: PDFKit.PDFDocument, compact: boolean) {
  const height = compact ? 76 : 108;
  pdf.rect(0, 0, PAGE_WIDTH, height).fill(COLORS.charcoal);
  drawShield(pdf, LEFT, compact ? 15 : 25, compact ? 42 : 50);
  const titleY = compact ? 22 : 31;
  pdf.font('Helvetica-Bold').fontSize(compact ? 20 : 23).fillColor(COLORS.white)
    .text('The Collision Justice', LEFT + 62, titleY, { width: 460, lineBreak: false });
  if (!compact) {
    pdf.font('Helvetica').fontSize(9).fillColor('#E2E8F0')
      .text('MOTOR VEHICLE ACCIDENT CLAIM SUPPORT · Clear guidance and hands-on document support', LEFT + 62, 63, { width: 460 });
  }
  pdf.rect(0, height, PAGE_WIDTH, 4).fill(COLORS.crimson);
}

function drawFooter(pdf: PDFKit.PDFDocument, claimId: string, generatedAt: Date, page: number) {
  const y = 728;
  pdf.moveTo(LEFT, y).lineTo(PAGE_WIDTH - LEFT, y).lineWidth(0.7).strokeColor(COLORS.border).stroke();
  pdf.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.charcoal)
    .text('The Collision Justice', LEFT, y + 9, { width: 350, lineBreak: false });
  pdf.font('Helvetica').fontSize(7.5).fillColor(COLORS.ink)
    .text(`${BRAND.phone} · ${BRAND.email}`, LEFT, y + 20, { width: 350, lineBreak: false });
  pdf.font('Helvetica').fontSize(6.6).fillColor(COLORS.muted)
    .text('This document confirms the details you submitted. It is not legal representation or a guarantee of recovery.', LEFT, y + 32, { width: 355, height: 20 });
  pdf.font('Helvetica-Bold').fontSize(7.2).fillColor(COLORS.charcoal)
    .text(`Ref ${claimId}`, 425, y + 8, { width: 145, align: 'right', lineBreak: false });
  pdf.font('Helvetica').fontSize(6.8).fillColor(COLORS.muted)
    .text(`Generated ${formatDateTime(generatedAt)}`, 414, y + 20, { width: 156, align: 'right', lineBreak: false });
  pdf.font('Helvetica-Bold').fontSize(7.2).fillColor(COLORS.charcoal)
    .text(`Page ${page}`, 425, y + 34, { width: 145, align: 'right', lineBreak: false });
}

function drawSectionHeading(pdf: PDFKit.PDFDocument, title: string, x: number, y: number) {
  pdf.font('Helvetica-Bold').fontSize(9.4).fillColor(COLORS.charcoal)
    .text(title, x, y, { width: CONTENT_WIDTH, lineBreak: false });
}

function textHeight(pdf: PDFKit.PDFDocument, text: string, width: number, fontSize: number) {
  pdf.font('Helvetica').fontSize(fontSize);
  return pdf.heightOfString(text || ' ', { width, lineGap: 0.5 });
}

function splitTextToFit(pdf: PDFKit.PDFDocument, text: string, width: number, maxHeight: number, fontSize: number) {
  const words = text.split(/\s+/).filter(Boolean);
  let visible = '';
  let lastFittingIndex = 0;
  pdf.font('Helvetica').fontSize(fontSize);
  for (let index = 0; index < words.length; index += 1) {
    const candidate = visible ? `${visible} ${words[index]}` : words[index];
    if (pdf.heightOfString(candidate, { width, lineGap: 0.5 }) > maxHeight) break;
    visible = candidate;
    lastFittingIndex = index + 1;
  }
  return {
    visible,
    remainder: words.slice(lastFittingIndex).join(' '),
  };
}

function drawDetailCell(pdf: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, width: number) {
  pdf.font('Helvetica-Bold').fontSize(6.8).fillColor(COLORS.muted)
    .text(label.toLocaleUpperCase(), x, y + 4, { width, lineBreak: false });
  pdf.font('Helvetica').fontSize(8.5).fillColor(COLORS.ink)
    .text(value || 'Not provided', x, y + 13, { width, lineGap: 0.5 });
  return Math.max(26, textHeight(pdf, value || 'Not provided', width, 8.5) + 17);
}

function makePdf(claim: ClaimSummary, generatedAt: Date) {
  return new Promise<Buffer>((resolve, reject) => {
    const pdf = new PDFDocument({
      size: 'LETTER',
      margin: 0,
      compress: false,
      info: {
        Title: `MVA Claim Intake ${claim.claimId}`,
        Author: BRAND.name,
        Subject: 'Claim intake record and electronic consent',
      },
    });
    const chunks: Buffer[] = [];
    pdf.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdf.on('error', reject);
    pdf.on('end', () => resolve(Buffer.concat(chunks)));

    const fullName = `${claim.firstName} ${claim.lastName}`.trim();
    const submittedAt = claim.createdAt || claim.consentTimestamp;
    const consentAt = claim.consentTimestamp || submittedAt;
    const location = claim.geoLocation || `${claim.city}, ${claim.state} ${claim.zipCode}`;
    const requestUrl = `${SITE_URL}/check-claim?id=${encodeURIComponent(claim.claimId)}`;

    drawHeader(pdf, false);
    pdf.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.crimson)
      .text('CLAIM INTAKE REQUEST', LEFT, 125, { lineBreak: false });
    pdf.font('Helvetica-Bold').fontSize(22).fillColor(COLORS.charcoal)
      .text(fullName, LEFT, 141, { width: CONTENT_WIDTH, height: 28, ellipsis: true, lineBreak: false });

    const calloutY = 176;
    pdf.roundedRect(LEFT, calloutY, CONTENT_WIDTH, 58, 7).fillAndStroke(COLORS.redTint, '#FECACA');
    pdf.font('Helvetica-Bold').fontSize(7).fillColor('#991B1B')
      .text('YOUR CLAIM ID', LEFT + 15, calloutY + 10, { lineBreak: false });
    pdf.font('Helvetica-Bold').fontSize(17).fillColor(COLORS.charcoal)
      .text(claim.claimId, LEFT + 15, calloutY + 24, { lineBreak: false });
    pdf.moveTo(318, calloutY + 10).lineTo(318, calloutY + 48).lineWidth(0.7).strokeColor('#FECACA').stroke();
    pdf.font('Helvetica-Bold').fontSize(7).fillColor('#991B1B')
      .text('STATUS', 336, calloutY + 10, { lineBreak: false });
    pdf.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.charcoal)
      .text(claim.status, 336, calloutY + 22, { width: 210, lineBreak: false });
    pdf.font('Helvetica').fontSize(8).fillColor(COLORS.muted)
      .text(`Submitted ${formatShortDate(submittedAt)}`, 336, calloutY + 39, { width: 220, lineBreak: false });

    drawSectionHeading(pdf, 'CHECK YOUR REQUEST ANY TIME', LEFT, 247);
    pdf.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.crimson)
      .text(requestUrl, LEFT, 263, { width: CONTENT_WIDTH, height: 15, link: requestUrl, underline: true, lineBreak: false });
    pdf.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted)
      .text(`Opens your claim straight away — your Claim ID ${claim.claimId} is already in the link. Keep this page, or save the address.`, LEFT, 279, { width: CONTENT_WIDTH, height: 22 });

    drawSectionHeading(pdf, 'SUBMITTED DETAILS', LEFT, 310);
    const fields: Array<[string, string]> = [
      ['Full name', fullName],
      ['Email', claim.email],
      ['Phone', claim.phone],
      ['Request type', 'MVA Claim Intake'],
      ['City', claim.city],
      ['State', claim.state],
      ['Zipcode', claim.zipCode],
      ['Accident Date', formatShortDate(claim.accidentDate)],
      ['Accident Type', claim.accidentType],
      ['Injuries Reported', claim.injuriesReported],
      ['Police Report Filed', claim.policeReportFiled],
      ['At-Fault Status', claim.atFaultStatus],
    ];
    let tableY = 326;
    const columnGap = 18;
    const cellWidth = (CONTENT_WIDTH - columnGap) / 2;
    for (let index = 0; index < fields.length; index += 2) {
      const left = fields[index];
      const right = fields[index + 1];
      const leftHeight = drawDetailCell(pdf, left[0], left[1], LEFT, tableY, cellWidth);
      const rightHeight = right ? drawDetailCell(pdf, right[0], right[1], LEFT + cellWidth + columnGap, tableY, cellWidth) : 0;
      const rowHeight = Math.max(leftHeight, rightHeight);
      pdf.moveTo(LEFT, tableY + rowHeight).lineTo(LEFT + CONTENT_WIDTH, tableY + rowHeight)
        .lineWidth(0.5).strokeColor(COLORS.border).stroke();
      tableY += rowHeight;
    }

    const notesHeadingY = tableY + 8;
    pdf.font('Helvetica-Bold').fontSize(6.8).fillColor(COLORS.muted)
      .text('ADDITIONAL NOTES', LEFT, notesHeadingY, { lineBreak: false });
    const notes = claim.description || 'Not provided';
    const notesY = notesHeadingY + 10;
    const notesMaxHeight = Math.max(24, 718 - notesY);
    let notesRemainder = '';
    let notesFontSize = 8;
    let notesFit = splitTextToFit(pdf, notes, CONTENT_WIDTH, notesMaxHeight, notesFontSize);
    while (notesFit.remainder && notesFontSize > 6.2) {
      notesFontSize = Math.round((notesFontSize - 0.3) * 10) / 10;
      notesFit = splitTextToFit(pdf, notes, CONTENT_WIDTH, notesMaxHeight, notesFontSize);
    }
    if (!notesFit.visible) {
      notesFit = splitTextToFit(pdf, notes, CONTENT_WIDTH, notesMaxHeight, 6);
      notesFontSize = 6;
    }
    notesRemainder = notesFit.remainder;
    pdf.font('Helvetica').fontSize(notesFontSize).fillColor(COLORS.ink)
      .text(notesFit.visible, LEFT, notesY, { width: CONTENT_WIDTH, height: notesMaxHeight, lineGap: 0.5 });
    drawFooter(pdf, claim.claimId, generatedAt, 1);

    pdf.addPage({ size: 'LETTER', margin: 0 });
    drawHeader(pdf, true);
    drawSectionHeading(pdf, 'SUBMISSION RECORD', LEFT, 96);
    const recordRows: Array<{ label: string; value: string; link?: string }> = [
      { label: 'Location', value: location },
      { label: 'Submitted', value: formatFullDateTime(submittedAt) },
      { label: 'Reference', value: claim.claimId },
    ];
    if (claim.ipAddress) recordRows.splice(1, 0, { label: 'IP address', value: claim.ipAddress });
    if (claim.trustedFormCertUrl) {
      recordRows.push({ label: 'TrustedForm', value: claim.trustedFormCertUrl, link: claim.trustedFormCertUrl });
    }
    const leadId = claim.trustedFormCertId || extractTrustedFormCertId(claim.trustedFormCertUrl || '', '');
    if (leadId) {
      recordRows.push({ label: 'Lead ID', value: leadId });
    }
    if (claim.trustedFormPingUrl) {
      recordRows.push({ label: 'Ping URL', value: claim.trustedFormPingUrl, link: claim.trustedFormPingUrl });
    }
    const recordTop = 113;
    const recordLeft = LEFT + 16;
    const recordWidth = CONTENT_WIDTH - 32;
    const recordValueX = recordLeft + 100;
    const recordValueWidth = recordWidth - 100;
    const measuredRecordRows = recordRows.map((row) => ({
      ...row,
      height: Math.max(15, textHeight(pdf, row.value, recordValueWidth, 7.5)),
    }));
    const recordHeight = 12 + measuredRecordRows.reduce((total, row) => total + row.height + 5, 0);
    pdf.roundedRect(LEFT, recordTop, CONTENT_WIDTH, recordHeight + 10, 7)
      .fillAndStroke(COLORS.grayTint, COLORS.border);
    pdf.rect(LEFT, recordTop, 4, recordHeight + 10).fill(COLORS.crimson);
    let recordY = recordTop + 12;
    for (const row of measuredRecordRows) {
      pdf.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.charcoal)
        .text(row.label, recordLeft, recordY, { width: 92, lineBreak: false });
      pdf.font('Helvetica').fontSize(7.5).fillColor(COLORS.ink)
        .text(row.value, recordValueX, recordY, { width: recordValueWidth, lineGap: 0.5, ...(row.link ? { link: row.link } : {}) });
      recordY += row.height + 5;
    }
    drawSectionHeading(pdf, 'DO NOT CALL / CONTACT CONSENT DISCLAIMER', LEFT, recordTop + recordHeight + 25);
    const consentHeadingY = recordTop + recordHeight + 25;
    const consentBannerY = consentHeadingY + 17;
    const consentBannerHeight = 40;
    pdf.roundedRect(LEFT, consentBannerY, CONTENT_WIDTH, consentBannerHeight, 6)
      .fillAndStroke(COLORS.emeraldTint, '#A7F3D0');
    const consentBanner = `Agreed electronically by ${fullName} on ${formatShortDate(consentAt)} at ${new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' }).format(consentAt)} UTC.`;
    pdf.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.emerald)
      .text(consentBanner, LEFT + 12, consentBannerY + 13, { width: CONTENT_WIDTH - 24, height: 22 });

    const consentParagraphs = [
      `By checking the consent box and submitting this intake, ${fullName} electronically signed and expressly consented to receive calls and text messages from The Collision Justice and its service providers at the telephone number provided about this motor vehicle accident claim-support request. Where permitted by law, those communications may use automatic telephone dialing systems, automated technology, or prerecorded or artificial voice.`,
      'Consent was not a condition of purchasing goods or services. Message and data rates may apply, and message frequency varies. Consent may be revoked at any time by replying STOP to a text message or by contacting The Collision Justice. The consumer understood that this consent may apply even if the number is on a federal or state Do Not Call registry.',
      'This consent is limited to the claim-support request and does not promise legal representation, eligibility, or recovery. The Collision Justice is a legal marketing and claim-support service, not a law firm.',
    ];
    let consentY = consentBannerY + consentBannerHeight + 13;
    for (const paragraph of consentParagraphs) {
      pdf.font('Helvetica').fontSize(8.3).fillColor(COLORS.ink)
        .text(paragraph, LEFT, consentY, { width: CONTENT_WIDTH, lineGap: 2 });
      consentY += textHeight(pdf, paragraph, CONTENT_WIDTH, 8.3) + 10;
    }

    if (notesRemainder) {
      const continuationY = consentY + 2;
      pdf.font('Helvetica-Bold').fontSize(6.8).fillColor(COLORS.muted)
        .text('ADDITIONAL NOTES (CONTINUED)', LEFT, continuationY, { lineBreak: false });
      const continuationTop = continuationY + 10;
      const continuationMaxHeight = Math.max(20, 715 - continuationTop);
      const continuation = splitTextToFit(pdf, notesRemainder, CONTENT_WIDTH, continuationMaxHeight, 7);
      pdf.font('Helvetica').fontSize(7).fillColor(COLORS.ink)
        .text(continuation.visible, LEFT, continuationTop, { width: CONTENT_WIDTH, height: continuationMaxHeight, lineGap: 0.5 });
    }
    drawFooter(pdf, claim.claimId, generatedAt, 2);
    pdf.end();
  });
}

export function createClaimSummaryPdf(claim: ClaimSummary) {
  return makePdf(claim, new Date());
}
