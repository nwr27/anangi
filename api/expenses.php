<?php
require_once __DIR__ . '/finance-common.php';
$owner = financeOwner();
$method = $_SERVER['REQUEST_METHOD'];
if (!in_array($method, ['GET','POST','PUT','DELETE'], true)) financeJson(405,['error'=>'Method not allowed']);
if ($method !== 'GET') { financeRequireSameOrigin(); financeWriteGuard(); }
try {
    $pdo = getDatabase();
    if ($method === 'GET') {
        $sql = 'SELECT id,date_expense,expense_name,code,amount,periodic_date,created_at FROM expenses WHERE owner_id=?';
        $params=[$owner];
        if (isset($_GET['id'])) { $sql.=' AND id=?'; $params[]=financeUuid($_GET['id']); }
        else {
            if (isset($_GET['from'])) { $sql.=' AND date_expense>=?'; $params[]=financeDate($_GET['from']); }
            if (isset($_GET['to'])) { $sql.=' AND date_expense<=?'; $params[]=financeDate($_GET['to']); }
        }
        $sql.=' ORDER BY date_expense ASC,created_at ASC,id ASC LIMIT 5000';
        $stmt=$pdo->prepare($sql);$stmt->execute($params);
        financeJson(200,['status'=>'ok','expenses'=>$stmt->fetchAll(PDO::FETCH_ASSOC)]);
    }
    $body=financeBody();
    $id=$method==='POST'?financeNewUuid():financeUuid($body['id']??null);
    $pdo->beginTransaction();
    if ($method==='DELETE') {
        $stmt=$pdo->prepare('DELETE FROM expenses WHERE id=? AND owner_id=?');
        $stmt->execute([$id,$owner]);
        if ($stmt->rowCount()!==1) { $pdo->rollBack();financeJson(404,['error'=>'Expense tidak ditemukan']); }
    } else {
        $date=financeDate($body['date_expense']??null);
        $name=financeText($body['expense_name']??null,2000,true);
        $code=financeText($body['code']??'',50);
        $amount=financeAmount($body['amount']??null);
        $period=financePeriod($date);
        if ($method==='POST') {
            $stmt=$pdo->prepare('INSERT INTO expenses (id,date_expense,expense_name,code,amount,periodic_date,created_at,owner_id) VALUES (?,?,?,?,?,?,NOW(6),?)');
            $stmt->execute([$id,$date,$name,$code?:null,$amount,$period,$owner]);
        } else {
            $stmt=$pdo->prepare('UPDATE expenses SET date_expense=?,expense_name=?,code=?,amount=?,periodic_date=? WHERE id=? AND owner_id=?');
            $stmt->execute([$date,$name,$code?:null,$amount,$period,$id,$owner]);
            if ($stmt->rowCount()===0) {
                $check=$pdo->prepare('SELECT id FROM expenses WHERE id=? AND owner_id=?');$check->execute([$id,$owner]);
                if (!$check->fetchColumn()) { $pdo->rollBack();financeJson(404,['error'=>'Expense tidak ditemukan']); }
            }
        }
    }
    $pdo->commit();financeJson(200,['status'=>'ok','id'=>$id]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log('Anangi expenses: '.$e->getMessage());financeJson(500,['error'=>'Internal server error']);
}
