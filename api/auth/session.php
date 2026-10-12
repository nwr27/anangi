
<?php

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once '/home/daikokuc/anangi-config/auth.php';

$owner = requireAnangiUser();

echo json_encode([
  'authenticated' => true,
  'owner_id' => $owner
]);
