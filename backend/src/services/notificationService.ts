export interface NotificationRecipient {
  role: string;
  address: string;
}

/**
 * Dispatches a bounty lifecycle notification to recipients (email, webhook, etc.).
 * MVP: no-op; extend when outbound channels are configured.
 */
export async function sendNotification(
  _recipients: NotificationRecipient[],
  _event: string,
  _payload: Record<string, unknown>,
): Promise<void> {
  await Promise.resolve();
}
