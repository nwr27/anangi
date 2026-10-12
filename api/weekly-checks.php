<?php
require_once __DIR__ . '/finance-common.php';
$owner=financeOwner();
$method=$_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method,['GET','POST','PUT','DELETE'],true)) financeJson(405,['error'=>'Method not allowed']);
if ($method!=='GET') financeRequireSameOrigin();
try {
    $pdo=getDatabase();
    if ($method==='GET') {
        $sql='SELECT id,periodic_date,cash,dana,gopay,bca,real_balance,note,created_at FROM weekly_checks WHERE owner_id=?';
        $params=[$owner];
        if (isset($_GET['id'])) {$sql.=' AND id=?';$params[]=financeUuid($_GET['id']);}
        $sql.=' ORDER BY periodic_date DESC,created_at DESC,id DESC LIMIT 5000';
        $stmt=$pdo->prepare($sql);$stmt->execute($params);
        financeJson(200,['status'=>'ok','weekly_checks'=>$stmt->fetchAll(PDO::FETCH_ASSOC)]);
    }
    $body=financeBody();$id=$method==='POST'?financeNewUuid():financeUuid($body['id']??null);
    $pdo->beginTransaction();
    if ($method!=='POST') {
        $stmt=$pdo->prepare('SELECT id FROM weekly_checks WHERE id=? AND owner_id=? FOR UPDATE');$stmt->execute([$id,$owner]);
        if (!$stmt->fetchColumn()) {$pdo->rollBack();financeJson(404,['error'=>'Weekly check tidak ditemukan']);}
    }
    if ($method==='DELETE') {
        $stmt=$pdo->prepare('DELETE FROM weekly_checks WHERE id=? AND owner_id=?');$stmt->execute([$id,$owner]);
    } else {
        $period=financeDate($body['periodic_date']??null);
        if ((int)(new DateTimeImmutable($period))->format('w')!==3) {$pdo->rollBack();financeJson(422,['error'=>'Tanggal weekly harus hari Rabu']);}
        $values=[];
        foreach (['cash','dana','gopay','bca'] as $field) {
            $value=$body[$field]??0;
            if (!is_scalar($value) || !preg_match('/^\d{1,15}$/D',(string)$value)) {$pdo->rollBack();financeJson(422,['error'=>'Saldo '.$field.' harus bilangan bulat non-negatif']);}
            $values[]=(string)$value;
        }
        $total=array_sum(array_map('intval',$values));
        $note=financeText($body['note']??'',2000);
        $dup=$pdo->prepare('SELECT id FROM weekly_checks WHERE owner_id=? AND periodic_date=? AND id<>? LIMIT 1 FOR UPDATE');
        $dup->execute([$owner,$period,$id]);
        if ($dup->fetchColumn()) {$pdo->rollBack();financeJson(409,['error'=>'Weekly check periode ini sudah ada. Gunakan Edit.']);}
        if ($method==='POST') {
            $stmt=$pdo->prepare('INSERT INTO weekly_checks (id,periodic_date,cash,dana,gopay,bca,real_balance,note,created_at,owner_id) VALUES (?,?,?,?,?,?,?,?,NOW(6),?)');
            $stmt->execute([$id,$period,...$values,$total,$note,$owner]);
        } else {
            $stmt=$pdo->prepare('UPDATE weekly_checks SET periodic_date=?,cash=?,dana=?,gopay=?,bca=?,real_balance=?,note=? WHERE id=? AND owner_id=?');
            $stmt->execute([$period,...$values,$total,$note,$id,$owner]);
        }
    }
    $pdo->commit();financeJson(200,['status'=>'ok','id'=>$id]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log('Anangi weekly-checks: '.$e->getMessage());financeJson(500,['error'=>'Internal server error']);
}
