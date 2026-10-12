
<?php

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once '/home/daikokuc/anangi-config/database.php';
require_once '/home/daikokuc/anangi-config/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  header('Allow: POST');
  echo json_encode(['error' => 'Method not allowed']);
  exit;
}

requireSameOrigin();
startAnangiSession();

$input = json_decode(file_get_contents('php://input'), true);

$owner = $input['owner_id'] ?? null;
$password = $input['password'] ?? null;

if (
  !is_string($owner) ||
  !in_array($owner, ['nana', 'meysa'], true) ||
  !is_string($password) ||
  $password === ''
) {
  http_response_code(400);
  echo json_encode(['error' => 'Invalid input']);
  exit;
}

try {
  $pdo = getDatabase();

  $stmt = $pdo->prepare(
    'SELECT password_hash
         FROM app_users
         WHERE owner_id = ?'
  );

  $stmt->execute([$owner]);
  $hash = $stmt->fetchColumn();

  if (!$hash || !password_verify($password, $hash)) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid credentials']);
    exit;
  }

  session_regenerate_id(true);
  $_SESSION['owner_id'] = $owner;

  echo json_encode([
    'status' => 'ok',
    'owner_id' => $owner
  ]);
} catch (Throwable $e) {
  error_log('Anangi login: ' . $e->getMessage());

  http_response_code(500);
  echo json_encode(['error' => 'Internal server error']);
}
