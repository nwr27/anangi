<?php
require_once __DIR__ . '/finance-common.php';
$owner = financeOwner();
$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'GET') financeWriteGuard();
try {
    $pdo = getDatabase();
    $sql = 'SELECT id, date_expense, expense_name, code, amount, periodic_date, created_at FROM expenses WHERE owner_id = ?';
    $params = [$owner];
    if (isset($_GET['id'])) {
        $sql .= ' AND id = ?'; $params[] = financeUuid($_GET['id']);
    } else {
        if (isset($_GET['from'])) { $sql .= ' AND date_expense >= ?'; $params[] = financeDate($_GET['from']); }
        if (isset($_GET['to'])) { $sql .= ' AND date_expense <= ?'; $params[] = financeDate($_GET['to']); }
    }
    $sql .= ' ORDER BY date_expense ASC, created_at ASC, id ASC LIMIT 5000';
    $stmt = $pdo->prepare($sql); $stmt->execute($params);
    financeJson(200, ['status'=>'ok','expenses'=>$stmt->fetchAll(PDO::FETCH_ASSOC)]);
} catch (Throwable $e) {
    error_log('Anangi expenses: '.$e->getMessage());
    financeJson(500,['error'=>'Internal server error']);
}
