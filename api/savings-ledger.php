<?php
require_once __DIR__ . '/finance-common.php';
$owner = financeOwner();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['GET','POST','PUT','DELETE'], true)) financeJson(405, ['error'=>'Method not allowed']);
if ($method !== 'GET') financeWriteGuard();
try {
    $pdo = getDatabase();
    $sql = 'SELECT id, source_id, date_save, type_save, amount, note, periodic_date, created_at FROM savings_ledger WHERE owner_id = ?';
    $params = [$owner];
    if (isset($_GET['id'])) {
        $sql .= ' AND id = ?';
        $params[] = financeUuid($_GET['id']);
    }
    $sql .= ' ORDER BY date_save DESC, created_at DESC, id DESC LIMIT 5000';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    financeJson(200, ['status'=>'ok', 'savings_ledger'=>$stmt->fetchAll(PDO::FETCH_ASSOC)]);
} catch (Throwable $e) {
    error_log('Anangi savings_ledger: '.$e->getMessage());
    financeJson(500, ['error'=>'Internal server error']);
}
