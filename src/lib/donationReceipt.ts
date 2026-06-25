import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

export interface DonationReceiptInput {
  receiptNumber: string;
  donorName: string;
  donorPan?: string;
  amount: number;
  donationDate: string;
  paymentMode?: string;
  purpose?: string;
  orgName?: string;
  orgAddress?: string;
  orgPan?: string;
  org80G?: string;
}

export async function generate80GReceiptDocx(input: DonationReceiptInput): Promise<Blob> {
  const org = input.orgName ?? "SVITECH Foundation";
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: "Donation Receipt (80G)", bold: true })],
          }),
          new Paragraph({ children: [new TextRun(org)] }),
          new Paragraph({ children: [new TextRun(input.orgAddress ?? "Maharashtra, India")] }),
          new Paragraph({ text: "" }),
          new Paragraph({ children: [new TextRun(`Receipt No: ${input.receiptNumber}`)] }),
          new Paragraph({ children: [new TextRun(`Date: ${input.donationDate}`)] }),
          new Paragraph({ text: "" }),
          new Paragraph({ children: [new TextRun(`Received with thanks from: ${input.donorName}`)] }),
          ...(input.donorPan ? [new Paragraph({ children: [new TextRun(`PAN: ${input.donorPan}`)] })] : []),
          new Paragraph({
            children: [
              new TextRun({
                text: `Amount: ₹${input.amount.toLocaleString("en-IN")} (${input.paymentMode ?? "Donation"})`,
                bold: true,
              }),
            ],
          }),
          ...(input.purpose ? [new Paragraph({ children: [new TextRun(`Purpose: ${input.purpose}`)] })] : []),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [
              new TextRun(
                "This donation is eligible for deduction under Section 80G of the Income Tax Act, 1961, subject to applicable limits and valid registration."
              ),
            ],
          }),
          ...(input.org80G
            ? [new Paragraph({ children: [new TextRun(`80G Registration: ${input.org80G}`)] })]
            : []),
          ...(input.orgPan ? [new Paragraph({ children: [new TextRun(`Organization PAN: ${input.orgPan}`)] })] : []),
          new Paragraph({ text: "" }),
          new Paragraph({ children: [new TextRun("Authorized signatory: _________________________")] }),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}

export function nextReceiptNumber(): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 90000) + 10000;
  return `80G-${year}-${seq}`;
}
