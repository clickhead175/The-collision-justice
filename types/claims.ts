export type ClaimReceipt = {
  claimId: string;
  status: string;
  pdfUrl: string;
};

export type ClaimStatusResponse = ClaimReceipt & {
  createdAt: string;
  details: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    city: string;
    state: string;
    locationSource?: string;
    zipCode: string;
    accidentDate: string;
    accidentType: string;
    injuriesReported: string;
    policeReportFiled: string;
    atFaultStatus: string;
    description: string;
    consentAgreed: boolean;
    consentTimestamp: string;
  };
};
