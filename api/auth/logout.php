
<?php

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once '/home/daikokuc/anangi-config/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  header('Allow: POST');
  echo json_encode(['error' => 'Method not allowed']);
  exit;
}

requireSameOrigin();
startAnangiSession();

$_SESSION = [];

$params = session_get_cookie_params();

setcookie(session_name(), '', [
  'expires' => time() - 3600,
  'path' => $params['path'],
  'secure' => true,
  'httponly' => true,
  'samesite' => 'Strict'
]);

session_destroy();

echo json_encode(['status' => 'ok']);
