
<?php
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

try {
  startAnangiSession();

  $owner = $_SESSION['owner_id'] ?? null;

  if (!in_array($owner, ['nana', 'meysa'], true)) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
  }

  $limit = filter_var(
    $_GET['limit'] ?? 50,
    FILTER_VALIDATE_INT,
    ['options' => [
      'default' => 50,
      'min_range' => 1,
      'max_range' => 200
    ]]
  );

  $pdo = getDatabase();

  $stmt = $pdo->prepare(
    "SELECT owner_id, transaction_date, transaction_type,
                title, category, amount, periodic_date, created_at
         FROM transaction_history
         WHERE owner_id = ?
         ORDER BY transaction_date DESC, created_at DESC
         LIMIT $limit"
  );

  $stmt->execute([$owner]);

  echo json_encode([
    'status' => 'ok',
    'owner_id' => $owner,
    'transactions' => $stmt->fetchAll(PDO::FETCH_ASSOC)
  ], JSON_THROW_ON_ERROR);
} catch (Throwable $e) {
  error_log('Anangi transactions: ' . $e->getMessage());

  http_response_code(500);
  echo json_encode(['error' => 'Internal server error']);
}
