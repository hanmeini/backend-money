export function serializeTransaction(transaction) {
  return {
    id: transaction.id,
    type: transaction.type,
    source: transaction.source,
    amount: transaction.amount,
    note: transaction.note,
    occurredAt: transaction.occurredAt,
    createdAt: transaction.createdAt,
  };
}

export function serializeSmsLog(log) {
  return {
    id: log.id,
    sender: log.sender,
    status: log.status,
    reason: log.reason,
    transactionId: log.transactionId,
    createdAt: log.createdAt,
  };
}