<?php
require_once __DIR__ . '/finance-common.php';
$owner=financeOwner();
$method=$_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method,['GET','POST','PUT','DELETE'],true)) financeJson(405,['error'=>'Method not allowed']);
if ($method!=='GET') financeRequireSameOrigin();
try {
    $pdo=getDatabase();
    if ($method==='GET') {
        $sql='SELECT id,date_use,from_save,to_target,amount,note,periodic_date,created_at FROM saving_uses WHERE owner_id=?';
        $params=[$owner];
        if (isset($_GET['id'])) {$sql.=' AND id=?';$params[]=financeUuid($_GET['id']);}
        $sql.=' ORDER BY date_use DESC,created_at DESC,id DESC LIMIT 5000';
        $stmt=$pdo->prepare($sql);$stmt->execute($params);
        financeJson(200,['status'=>'ok','saving_uses'=>$stmt->fetchAll(PDO::FETCH_ASSOC)]);
    }
    $body=financeBody();
    $id=$method==='POST'?financeNewUuid():financeUuid($body['id']??null);
    // Serialize concurrent modifications for the same owner, including savings-use updates.
    $pdo->beginTransaction();
    financeLockOwner($pdo,$owner);
    if ($method!=='POST') {
        $stmt=$pdo->prepare('SELECT id FROM saving_uses WHERE id=? AND owner_id=? FOR UPDATE');
        $stmt->execute([$id,$owner]);
        if (!$stmt->fetchColumn()) {$pdo->rollBack();financeJson(404,['error'=>'Saving use tidak ditemukan']);}
        // Only delete derived records from this saving-use source; income records are separate.
        $stmt=$pdo->prepare('DELETE FROM savings_ledger WHERE source_id=? AND owner_id=?');$stmt->execute([$id,$owner]);
        $stmt=$pdo->prepare('DELETE FROM balance_allocations WHERE source_id=? AND owner_id=?');$stmt->execute([$id,$owner]);
    }
    if ($method==='DELETE') {
        $stmt=$pdo->prepare('DELETE FROM saving_uses WHERE id=? AND owner_id=?');$stmt->execute([$id,$owner]);
    } else {
        $date=financeDate($body['date_use']??null);
        $amount=financeAmount($body['amount']??null);
        if (!preg_match('/^\d{1,15}$/D',$amount)) {$pdo->rollBack();financeJson(422,['error'=>'Nominal saving use harus rupiah bulat']);}
        $from=$body['from_save']??null;
        if (!in_array($from,['nest_egg','wedding','umrah','piggy','trading'],true)) {$pdo->rollBack();financeJson(422,['error'=>'Sumber tabungan tidak valid']);}
        $to=$body['to_target']??null;
        if ($to!=='balance') {$pdo->rollBack();financeJson(422,['error'=>'Tujuan tidak valid']);}
        $note=financeText($body['note']??'',2000);
        $period=financePeriod($date);
        if ($method==='POST') {
            $stmt=$pdo->prepare('INSERT INTO saving_uses (id,date_use,from_save,to_target,amount,note,periodic_date,created_at,owner_id) VALUES (?,?,?,?,?,?,?,NOW(6),?)');
            $stmt->execute([$id,$date,$from,$to,$amount,$note,$period,$owner]);
        } else {
            $stmt=$pdo->prepare('UPDATE saving_uses SET date_use=?,from_save=?,to_target=?,amount=?,note=?,periodic_date=? WHERE id=? AND owner_id=?');
            $stmt->execute([$date,$from,$to,$amount,$note,$period,$id,$owner]);
        }
        $ledger=$pdo->prepare('INSERT INTO savings_ledger (id,source_id,date_save,type_save,amount,note,periodic_date,created_at,owner_id) VALUES (?,?,?,?,?,?,?,NOW(6),?)');
        $ledger->execute([financeNewUuid(),$id,$date,$from,'-'.$amount,'use - '.$note,$period,$owner]);
        $balance=$pdo->prepare('INSERT INTO balance_allocations (id,source_id,date_allocation,amount,note,periodic_date,created_at,owner_id) VALUES (?,?,?,?,?,?,NOW(6),?)');
        $balance->execute([financeNewUuid(),$id,$date,$amount,'saving use - '.$from.' to balance',$period,$owner]);
    }
    financeAssertSavingsNonnegative($pdo,$owner);
    $pdo->commit();financeJson(200,['status'=>'ok','id'=>$id]);
} catch (DomainException $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    financeJson(422,['error'=>$e->getMessage()]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log('Anangi saving-uses: '.$e->getMessage());financeJson(500,['error'=>'Internal server error']);
}
