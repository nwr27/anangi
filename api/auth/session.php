
<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once '/home/daikokuc/anangi-config/auth.php';

startAnangiSession();

$owner = $_SESSION['owner_id'] ?? null;

if (!in_array($owner, ['nana', 'meysa'], true)) {
  http_response_code(401);

  echo json_encode([
    'authenticated' => false,
    'error' => 'Unauthorized'
  ]);

  exit;
}

echo json_encode([
  'authenticated' => true,
  'owner_id' => $owner
]);
