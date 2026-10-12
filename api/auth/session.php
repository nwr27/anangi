
<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

ini_set('log_errors', '1');
ini_set(
  'error_log',
  '/home/daikokuc/anangi-config/session-error.log'
);

try {
  require_once '/home/daikokuc/anangi-config/auth.php';

  $owner = requireAnangiUser();

  echo json_encode([
    'authenticated' => true,
    'owner_id' => $owner
  ], JSON_THROW_ON_ERROR);
} catch (Throwable $e) {
  error_log(
    'Anangi session: ' .
      $e->getMessage() .
      ' in ' . $e->getFile() .
      ':' . $e->getLine()
  );

  http_response_code(500);

  echo json_encode([
    'error' => 'Internal server error'
  ]);
}
\