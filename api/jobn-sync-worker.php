<?php
declare(strict_types=1);
// Hanya boleh dijalankan melalui PHP CLI, bukan browser.
if (PHP_SAPI !== 'cli') {
  http_response_code(403);
  exit;
}

require_once '/home/daikokuc/anangi-config/database.php';

$config = require '/home/daikokuc/anangi-config/jobn-sync.php';

$endpoint = $config['endpoint'] ?? '';
$token = $config['token'] ?? '';

if (
  $endpoint !== 'https://jobn.daikoku.co.id/api/finance/anangi-sync.php' ||
  !is_string($token) ||
  strlen($token) < 32 ||
  !function_exists('curl_init')
) {
  error_log('JOBN sync: konfigurasi atau ekstensi cURL tidak valid.');
  exit(1);
}

try {
  $pdo = getDatabase();

  // Mencegah dua worker berjalan bersamaan.
  $lock = $pdo->query("SELECT GET_LOCK('anangi_jobn_sync', 0)")
    ->fetchColumn();

  if ((int)$lock !== 1) {
    exit(0);
  }

  $stmt = $pdo->query("
        SELECT source_transaction_id, action, payload
        FROM anangi_jobn_sync_queue
        WHERE status = 'PENDING'
        ORDER BY updated_at ASC
        LIMIT 20
    ");

  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

  foreach ($rows as $row) {
    $ch = curl_init($endpoint);

    curl_setopt_array($ch, [
      CURLOPT_POST => true,
      CURLOPT_POSTFIELDS => $row['payload'],
      CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $token,
      ],
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_CONNECTTIMEOUT => 5,
      CURLOPT_TIMEOUT => 15,
      CURLOPT_FOLLOWLOCATION => false,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    $result = is_string($response)
      ? json_decode($response, true)
      : null;

    $success = $httpCode === 200
      && is_array($result)
      && ($result['success'] ?? false) === true;

    if ($success) {
      $update = $pdo->prepare("
                UPDATE anangi_jobn_sync_queue
                SET status = 'SYNCED',
                    attempts = attempts + 1,
                    last_error = NULL
                WHERE source_transaction_id = ?
                  AND action = ?
                  AND payload = ?
                  AND status = 'PENDING'
            ");

      $update->execute([
        $row['source_transaction_id'],
        $row['action'],
        $row['payload'],
      ]);
    } else {
      $error = $curlError !== ''
        ? $curlError
        : 'HTTP ' . $httpCode;

      $update = $pdo->prepare("
                UPDATE anangi_jobn_sync_queue
                SET attempts = attempts + 1,
                    last_error = ?
                WHERE source_transaction_id = ?
                  AND action = ?
                  AND payload = ?
                  AND status = 'PENDING'
            ");

      $update->execute([
        substr($error, 0, 255),
        $row['source_transaction_id'],
        $row['action'],
        $row['payload'],
      ]);

      error_log(
        'JOBN sync gagal untuk ' .
          $row['source_transaction_id'] . ': ' . $error
      );
    }
  }

  $pdo->query("SELECT RELEASE_LOCK('anangi_jobn_sync')");

  echo "JOBN sync: " . count($rows) . " antrean diperiksa.\n";
} catch (Throwable $e) {
  error_log('JOBN sync worker: ' . $e->getMessage());
  exit(1);
}
