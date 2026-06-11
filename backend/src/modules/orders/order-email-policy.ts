export function shouldSendOrderConfirmation(paymentStatus: string) {
  return paymentStatus === "PAID";
}
