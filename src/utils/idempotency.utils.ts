import { createHash } from "node:crypto";

export const hashProcessPaymentRequest = (
  orderUuid: string,
  mode: string,
  amountTendered: number
): string => {
  const requestString = JSON.stringify({
    orderUuid,
    mode,
    amountTendered,
  });

  return createHash("sha256")
    .update(requestString)
    .digest("hex");
};