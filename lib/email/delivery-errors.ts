/** Explicit provider rejection, distinguished from a lost/unknown transport ack.
 * Contains no provider response, diagnostic, credential or message content. */
export class EmailDeliveryRejectedError extends Error {
  constructor() { super("Email provider rejected delivery"); }
}
