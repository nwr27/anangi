
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

  // A database row lock serializes login attempts for the same account and IP.
  $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
  $key = hash('sha256', $owner . '|' . $ip);
  $pdo->beginTransaction();
  $pdo->prepare('INSERT IGNORE INTO login_attempts (attempt_key, failed_count, window_start) VALUES (?,0,NOW())')->execute([$key]);
  $rate = $pdo->prepare('SELECT failed_count, window_start FROM login_attempts WHERE attempt_key=? FOR UPDATE');
  $rate->execute([$key]);
  $entry = $rate->fetch(PDO::FETCH_ASSOC);
  $expired = strtotime($entry['window_start']) <= time() - 900;
  if ($expired) {
    $pdo->prepare('UPDATE login_attempts SET failed_count=0,window_start=NOW() WHERE attempt_key=?')->execute([$key]);
  } elseif ((int)$entry['failed_count'] >= 5) {
    $pdo->commit();
    http_response_code(429);
    header('Retry-After: 900');
    echo json_encode(['error'=>'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.']);
    exit;
  }

  $stmt = $pdo->prepare(
    'SELECT password_hash
         FROM app_users
         WHERE owner_id = ?'
  );

  $stmt->execute([$owner]);
  $hash = $stmt->fetchColumn();

  if (!$hash || !password_verify($password, $hash)) {
    $pdo->prepare('UPDATE login_attempts SET failed_count=failed_count+1 WHERE attempt_key=?')->execute([$key]);
    $pdo->commit();
    http_response_code(401);
    echo json_encode(['error' => 'Invalid credentials']);
    exit;
  }

  $pdo->prepare('DELETE FROM login_attempts WHERE attempt_key=?')->execute([$key]);
  $pdo->commit();
  session_regenerate_id(true);
  $_SESSION['owner_id'] = $owner;

  echo json_encode([
    'status' => 'ok',
    'owner_id' => $owner
  ]);
} catch (Throwable $e) {
  if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
  error_log('Anangi login: ' . $e->getMessage());

  http_response_code(500);
  echo json_encode(['error' => 'Internal server error']);
}
