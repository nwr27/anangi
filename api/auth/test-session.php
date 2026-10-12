
<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once '/home/daikokuc/anangi-config/auth.php';

startAnangiSession();

echo json_encode([
  'status' => 'ok',
  'session_active' => session_status() === PHP_SESSION_ACTIVE,
  'cookie_received' => isset($_COOKIE['ANANGI_SESSION']),
  'authenticated' => in_array(
    $_SESSION['owner_id'] ?? null,
    ['nana', 'meysa'],
    true
  )
]);
