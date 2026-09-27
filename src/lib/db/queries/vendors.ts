/**
 * Reads from vendors and vendor_notes (SPEC.md section 5).
 * TODO(tiger data prompt): implement.
 */
export async function getVendorByName(name: string): Promise<unknown> {
  void name;
  throw new Error("TODO: implement getVendorByName — see SPEC.md section 5");
}

/** Writes vendor_notes + a vendor_detail_changes row (verified = false), per SPEC.md section 7. */
export async function updateVendorPaymentDetails(params: {
  vendorId: string;
  newAddress: string;
  reason: string;
  sourceEmailId: string;
}): Promise<void> {
  void params;
  throw new Error("TODO: implement updateVendorPaymentDetails — see SPEC.md section 7");
}
