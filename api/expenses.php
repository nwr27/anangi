
<?php
require_once __DIR__ . '/finance-common.php';
require_once __DIR__ . '/jobn-sync-queue.php';

$owner = financeOwner();
$method = $_SERVER['REQUEST_METHOD'];

if (!in_array($method, ['GET', 'POST', 'PUT', 'DELETE'], true)) {
    financeJson(405, ['error' => 'Method not allowed']);
}

if ($method !== 'GET') {
    financeRequireSameOrigin();
}

try {
    $pdo = getDatabase();

    // GET tetap menggunakan perilaku lama.
    if ($method === 'GET') {
        $sql = 'SELECT id,date_expense,expense_name,code,amount,periodic_date,created_at
                FROM expenses WHERE owner_id=?';
        $params = [$owner];

        if (isset($_GET['id'])) {
            $sql .= ' AND id=?';
            $params[] = financeUuid($_GET['id']);
        } else {
            if (isset($_GET['from'])) {
                $sql .= ' AND date_expense>=?';
                $params[] = financeDate($_GET['from']);
            }
            if (isset($_GET['to'])) {
                $sql .= ' AND date_expense<=?';
                $params[] = financeDate($_GET['to']);
            }
        }

        $sql .= ' ORDER BY date_expense ASC,created_at ASC,id ASC LIMIT 5000';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        financeJson(200, [
            'status' => 'ok',
            'expenses' => $stmt->fetchAll(PDO::FETCH_ASSOC)
        ]);
    }

    $body = financeBody();
    $id = $method === 'POST'
        ? financeNewUuid()
        : financeUuid($body['id'] ?? null);

    $pdo->beginTransaction();

    // Baca data lama untuk UPDATE dan DELETE.
    $oldExpense = null;

    if ($method !== 'POST') {
        $stmt = $pdo->prepare(
            'SELECT id, code FROM expenses
             WHERE id=? AND owner_id=? FOR UPDATE'
        );
        $stmt->execute([$id, $owner]);
        $oldExpense = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$oldExpense) {
            $pdo->rollBack();
            financeJson(404, ['error' => 'Expense tidak ditemukan']);
        }
    }

    if ($method === 'DELETE') {
        $stmt = $pdo->prepare(
            'DELETE FROM expenses WHERE id=? AND owner_id=?'
        );
        $stmt->execute([$id, $owner]);

        if ($owner === 'nana' && $oldExpense['code'] === 'NMI') {
            queueJobnExpenseSync($pdo, $id, 'DELETE');
        }
    } else {
        $date = financeDate($body['date_expense'] ?? null);
        $name = financeText($body['expense_name'] ?? null, 2000, true);
        $code = financeText($body['code'] ?? '', 50);
        $amount = financeAmount($body['amount'] ?? null);
        $period = financePeriod($date);

        // Batas data mengikuti kolom dan validasi API JOBN.
        if ($owner === 'nana' && $code === 'NMI') {
            if (mb_strlen($name) > 255 || (float)$amount > 9999999999999.99) {
                $pdo->rollBack();
                financeJson(422, [
                    'error' => 'Keterangan atau nominal NMI melebihi batas JOBN'
                ]);
            }
        }

        if ($method === 'POST') {
            $stmt = $pdo->prepare(
                'INSERT INTO expenses
                (id,date_expense,expense_name,code,amount,periodic_date,created_at,owner_id)
                VALUES (?,?,?,?,?,?,NOW(6),?)'
            );
            $stmt->execute([
                $id,
                $date,
                $name,
                $code ?: null,
                $amount,
                $period,
                $owner
            ]);
        } else {
            $stmt = $pdo->prepare(
                'UPDATE expenses
                 SET date_expense=?,expense_name=?,code=?,amount=?,periodic_date=?
                 WHERE id=? AND owner_id=?'
            );
            $stmt->execute([
                $date,
                $name,
                $code ?: null,
                $amount,
                $period,
                $id,
                $owner
            ]);
        }

        if ($owner === 'nana') {
            if ($code === 'NMI') {
                queueJobnExpenseSync($pdo, $id, 'UPSERT', [
                    'date_expense' => $date,
                    'expense_name' => $name,
                    'amount' => $amount
                ]);
            } elseif (
                $oldExpense !== null &&
                $oldExpense['code'] === 'NMI'
            ) {
                // Kode berubah dari NMI menjadi ED/FM/lainnya.
                queueJobnExpenseSync($pdo, $id, 'DELETE');
            }
        }
    }

    // Expense dan antrean disimpan dalam satu transaksi database.
    $pdo->commit();

    financeJson(200, [
        'status' => 'ok',
        'id' => $id
    ]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log('Anangi expenses: ' . $e->getMessage());

    financeJson(500, [
        'error' => 'Internal server error'
    ]);
}
