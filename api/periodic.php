
<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once '/home/daikokuc/anangi-config/database.php';
require_once '/home/daikokuc/anangi-config/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  http_response_code(405);
  header('Allow: GET');
  echo json_encode(['error' => 'Method not allowed']);
  exit;
}

$owner = requireAnangiUser();

try {
  $pdo = getDatabase();

  $stmt = $pdo->prepare("
        SELECT *
        FROM periodic_summary
        WHERE owner_id = :owner
        ORDER BY periodic_date DESC
        LIMIT 52
    ");

  $stmt->execute(['owner' => $owner]);

  echo json_encode([
    'status' => 'ok',
    'owner_id' => $owner,
    'periods' => $stmt->fetchAll()
  ], JSON_THROW_ON_ERROR);
} catch (Throwable $e) {
  error_log('Anangi periodic: ' . $e->getMessage());
  http_response_code(500);
  echo json_encode(['error' => 'Internal server error']);
}
