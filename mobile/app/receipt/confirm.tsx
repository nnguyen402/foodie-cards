import { demoFixtures } from '@foodie-cards/shared/fixtures';
import { ReceiptConfirmation } from '@/features/receipts/receipt-confirmation';

export default function ConfirmReceiptScreen() {
  return <ReceiptConfirmation draft={demoFixtures.receiptDraft.draft} />;
}
