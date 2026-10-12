<?php
require_once __DIR__ . '/finance-common.php';
$owner = financeOwner();
$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'GET') financeWriteGuard();
try {
    $pdo = getDatabase();
    $sql = 'SELECT id, date_income, amount, note, allocation_type, periodic_date, created_at FROM incomes WHERE owner_id = ?';
    $params = [$owner];
    if (isset($_GET['id'])) { $sql .= ' AND id = ?'; $params[] = financeUuid($_GET['id']); }
    $sql .= ' ORDER BY date_income DESC, created_at DESC, id DESC LIMIT 5000';
    $stmt = $pdo->prepare($sql); $stmt->execute($params);
    financeJson(200, ['status'=>'ok','incomes'=>$stmt->fetchAll(PDO::FETCH_ASSOC)]);
} catch (Throwable $e) {
    error_log('Anangi incomes: '.$e->getMessage());
    financeJson(500,['error'=>'Internal server error']);
}
