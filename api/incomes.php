<?php
require_once __DIR__ . '/finance-common.php';
$owner=financeOwner();
$method=$_SERVER['REQUEST_METHOD'];
if (!in_array($method,['GET','POST','PUT','DELETE'],true)) financeJson(405,['error'=>'Method not allowed']);
if ($method!=='GET') { financeRequireSameOrigin(); }
function incomeAllocation(PDO $pdo,string $owner,string $id,string $date,string $period,string $amount,string $note,string $type): void {
    // Same as PostgreSQL round(amount)::bigint for positive numeric values.
    $whole=(int)round((float)$amount,0,PHP_ROUND_HALF_UP);
    if ($whole<=0) financeJson(422,['error'=>'Nominal harus minimal Rp1 setelah pembulatan']);
    $rows=[];$balance=null;
    if ($type==='auto') {
        // Integer arithmetic avoids floating-point rounding differences.
        $b=intdiv($whole*30+50,100);$n=intdiv($whole*30+50,100);$w=intdiv($whole*30+50,100);$u=intdiv($whole*10+50,100);
        $w+=$whole-$b-$n-$w-$u;
        $balance=$b;$rows=[['nest_egg',$n],['wedding',$w],['umrah',$u]];
    } elseif ($type==='balance') $balance=$whole;
    else $rows=[[$type,$whole]];
    $prefix=$type==='auto'?'auto - ':'manual - ';
    if ($balance!==null) {
        $stmt=$pdo->prepare('INSERT INTO balance_allocations (id,source_id,date_allocation,amount,note,periodic_date,created_at,owner_id) VALUES (?,?,?,?,?,?,NOW(6),?)');
        $stmt->execute([financeNewUuid(),$id,$date,$balance,$prefix.$note,$period,$owner]);
    }
    $stmt=$pdo->prepare('INSERT INTO savings_ledger (id,source_id,date_save,type_save,amount,note,periodic_date,created_at,owner_id) VALUES (?,?,?,?,?,?,?,NOW(6),?)');
    foreach ($rows as [$saveType,$saveAmount]) $stmt->execute([financeNewUuid(),$id,$date,$saveType,$saveAmount,$prefix.$note,$period,$owner]);
}
function incomeCleanup(PDO $pdo,string $owner,string $id): void {
    // Guard against source_id collision with saving_uses before deleting allocations.
    $check=$pdo->prepare('SELECT id FROM saving_uses WHERE id=? AND owner_id=? LIMIT 1');
    $check->execute([$id,$owner]);
    if ($check->fetchColumn()) throw new RuntimeException('Income source_id collides with saving_uses');
    foreach (['balance_allocations','savings_ledger'] as $table) {
        $stmt=$pdo->prepare("DELETE FROM $table WHERE source_id=? AND owner_id=?");$stmt->execute([$id,$owner]);
    }
}
try {
    $pdo=getDatabase();
    if ($method==='GET') {
        $sql='SELECT id,date_income,amount,note,allocation_type,periodic_date,created_at FROM incomes WHERE owner_id=?';
        $params=[$owner];
        if (isset($_GET['id'])) {$sql.=' AND id=?';$params[]=financeUuid($_GET['id']);}
        $sql.=' ORDER BY date_income DESC,created_at DESC,id DESC LIMIT 5000';
        $stmt=$pdo->prepare($sql);$stmt->execute($params);
        financeJson(200,['status'=>'ok','incomes'=>$stmt->fetchAll(PDO::FETCH_ASSOC)]);
    }
    $body=financeBody();$id=$method==='POST'?financeNewUuid():financeUuid($body['id']??null);
    // All changes to income and its allocations must commit atomically.
    $pdo->beginTransaction();
    if ($method!=='POST') {
        $lock=$pdo->prepare('SELECT id FROM incomes WHERE id=? AND owner_id=? FOR UPDATE');$lock->execute([$id,$owner]);
        if (!$lock->fetchColumn()) {$pdo->rollBack();financeJson(404,['error'=>'Income tidak ditemukan']);}
        incomeCleanup($pdo,$owner,$id);
    }
    if ($method==='DELETE') {
        $stmt=$pdo->prepare('DELETE FROM incomes WHERE id=? AND owner_id=?');$stmt->execute([$id,$owner]);
    } else {
        $date=financeDate($body['date_income']??null);
        $amount=financeAmount($body['amount']??null);
        $note=financeText($body['note']??'',2000);
        $type=$body['allocation_type']??null;
        if (!in_array($type,['auto','balance','nest_egg','wedding','umrah','piggy','trading'],true)) {
            $pdo->rollBack();financeJson(422,['error'=>'Alokasi tidak valid']);
        }
        $period=financePeriod($date);
        if ($method==='POST') {
            $stmt=$pdo->prepare('INSERT INTO incomes (id,date_income,amount,note,allocation_type,periodic_date,created_at,owner_id) VALUES (?,?,?,?,?,?,NOW(6),?)');
            $stmt->execute([$id,$date,$amount,$note,$type,$period,$owner]);
        } else {
            $stmt=$pdo->prepare('UPDATE incomes SET date_income=?,amount=?,note=?,allocation_type=?,periodic_date=? WHERE id=? AND owner_id=?');
            $stmt->execute([$date,$amount,$note,$type,$period,$id,$owner]);
        }
        incomeAllocation($pdo,$owner,$id,$date,$period,$amount,$note,$type);
    }
    $pdo->commit();financeJson(200,['status'=>'ok','id'=>$id]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log('Anangi incomes: '.$e->getMessage());financeJson(500,['error'=>'Internal server error']);
}
