/**
 * Encodes an object as a standard SSE data frame.
 * Prepends 'data: ' and appends double newlines for proper event separation.
 *
 * @param data - The object to encode as JSON
 * @returns Uint8Array ready for controller.enqueue()
 */
export const encodeSSE = (data: object): Uint8Array => {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
};
