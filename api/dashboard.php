
<?php

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once '/home/daikokuc/anangi-config/database.php';
require_once '/home/daikokuc/anangi-config/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  http_response_code(405);
  header('Allow: GET');

  echo json_encode([
    'error' => 'Method not allowed'
  ]);
  exit;
}


startAnangiSession();

echo json_encode([
  'session_name' => session_name(),
  'cookie_received' => isset($_COOKIE[session_name()]),
  'session_active' => session_status() === PHP_SESSION_ACTIVE,
  'owner_id' => $_SESSION['owner_id'] ?? null,
]);

exit;


try {
  $pdo = getDatabase();

  // Ambil ringkasan saldo
  $stmt = $pdo->prepare(
    'SELECT *
         FROM realtime_summary
         WHERE owner_id = ?
         LIMIT 1'
  );

  $stmt->execute([$owner]);
  $summary = $stmt->fetch() ?: null;

  // Ambil audit mingguan
  $stmt = $pdo->prepare(
    'SELECT *
         FROM weekly_summary
         WHERE owner_id = ?
         ORDER BY periodic_date DESC
         LIMIT 12'
  );

  $stmt->execute([$owner]);
  $weekly = $stmt->fetchAll();

  echo json_encode([
    'status' => 'ok',
    'owner_id' => $owner,
    'summary' => $summary,
    'weekly' => $weekly
  ], JSON_THROW_ON_ERROR);
} catch (Throwable $e) {
  error_log('Anangi dashboard: ' . $e->getMessage());

  http_response_code(500);

  echo json_encode([
    'error' => 'Internal server error'
  ]);
}
