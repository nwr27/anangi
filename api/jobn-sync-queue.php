<?php
declare(strict_types=1);

/**
 * Mencatat perubahan Expense untuk sinkronisasi JOBN.
 * Function ini harus dipanggil dalam transaksi database ANANGI.
 */
function queueJobnExpenseSync(
  PDO $pdo,
  string $sourceId,
  string $action,
  ?array $expense = null
): void {
  if (!in_array($action, ['UPSERT', 'DELETE'], true)) {
    throw new InvalidArgumentException('Action sinkronisasi tidak valid.');
  }

  if ($action === 'UPSERT') {
    if ($expense === null) {
      throw new InvalidArgumentException('Data Expense wajib tersedia.');
    }

    $payload = [
      'action' => 'UPSERT',
      'source_transaction_id' => $sourceId,
      'code' => 'NMI',
      'transaction_date' => $expense['date_expense'],
      'amount' => $expense['amount'],
      'description' => $expense['expense_name'],
      'category' => null,
    ];
  } else {
    $payload = [
      'action' => 'DELETE',
      'source_transaction_id' => $sourceId,
      'code' => 'NMI',
    ];
  }

  $json = json_encode($payload, JSON_THROW_ON_ERROR);

  $stmt = $pdo->prepare("
        INSERT INTO anangi_jobn_sync_queue
            (source_transaction_id, action, payload, status, attempts, last_error)
        VALUES (?, ?, ?, 'PENDING', 0, NULL)
        ON DUPLICATE KEY UPDATE
            action = VALUES(action),
            payload = VALUES(payload),
            status = 'PENDING',
            attempts = 0,
            last_error = NULL
    ");

  $stmt->execute([$sourceId, $action, $json]);
}
