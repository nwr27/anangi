<?php
require_once __DIR__ . '/finance-common.php';
$owner = financeOwner();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['GET','POST','PUT','DELETE'], true)) financeJson(405, ['error'=>'Method not allowed']);
if ($method !== 'GET') financeWriteGuard();
try {
    $pdo = getDatabase();
    $sql = 'SELECT id, periodic_date, cash, dana, gopay, bca, real_balance, note, created_at FROM weekly_checks WHERE owner_id = ?';
    $params = [$owner];
    if (isset($_GET['id'])) {
        $sql .= ' AND id = ?';
        $params[] = financeUuid($_GET['id']);
    }
    $sql .= ' ORDER BY periodic_date DESC, created_at DESC, id DESC LIMIT 5000';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    financeJson(200, ['status'=>'ok', 'weekly_checks'=>$stmt->fetchAll(PDO::FETCH_ASSOC)]);
} catch (Throwable $e) {
    error_log('Anangi weekly_checks: '.$e->getMessage());
    financeJson(500, ['error'=>'Internal server error']);
}
