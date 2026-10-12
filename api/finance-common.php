<?php
// Shared helpers for finance endpoints. No public output without session.
require_once '/home/daikokuc/anangi-config/database.php';
require_once '/home/daikokuc/anangi-config/auth.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function financeOwner(): string {
    startAnangiSession();
    $owner = $_SESSION['owner_id'] ?? null;
    if (!in_array($owner, ['nana','meysa'], true)) {
        http_response_code(401); echo json_encode(['error'=>'Unauthorized']); exit;
    }
    return $owner;
}
function financeJson(int $status, array $payload): void {
    http_response_code($status);
    echo json_encode($payload, JSON_THROW_ON_ERROR);
    exit;
}
function financeDate($value): string {
    if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D', $value)) financeJson(422,['error'=>'Tanggal tidak valid']);
    $dt = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    if (!$dt || $dt->format('Y-m-d') !== $value) financeJson(422,['error'=>'Tanggal tidak valid']);
    return $value;
}
function financePeriod(string $date): string {
    $dt = new DateTimeImmutable($date);
    $offset = (3 - (int)$dt->format('w') + 7) % 7;
    return $dt->modify('+' . $offset . ' days')->format('Y-m-d');
}
function financeAmount($value): string {
    if (!is_int($value) && !is_float($value) && !is_string($value)) financeJson(422,['error'=>'Nominal tidak valid']);
    $value = (string)$value;
    if (!preg_match('/^\d{1,18}(?:\.\d{1,2})?$/D', $value) || (float)$value <= 0) financeJson(422,['error'=>'Nominal harus lebih besar dari nol']);
    return $value;
}
function financeBody(): array {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) financeJson(400,['error'=>'JSON tidak valid']);
    return $body;
}
function financeUuid($value): string {
    if (!is_string($value) || !preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iD', $value)) financeJson(422,['error'=>'ID tidak valid']);
    return $value;
}
function financeNewUuid(): string {
    $hex = bin2hex(random_bytes(16));
    $hex[12]='4';
    $hex[16]=dechex((hexdec($hex[16]) & 3) | 8);
    return substr($hex,0,8).'-'.substr($hex,8,4).'-'.substr($hex,12,4).'-'.substr($hex,16,4).'-'.substr($hex,20);
}
function financeWriteGuard(): void {
    // Deliberately locked until final data synchronization and reconciliation.
    financeJson(423, ['error'=>'Penulisan MySQL dikunci sampai sinkronisasi akhir Supabase selesai']);
}

function financeRequireSameOrigin(): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $expected = 'https://anangi.daikoku.co.id';
    if ($origin !== $expected) financeJson(403, ['error'=>'Origin tidak diizinkan']);
}
function financeText($value, int $max, bool $required = false): string {
    if (!is_string($value)) financeJson(422, ['error'=>'Teks tidak valid']);
    $value = trim($value);
    if ($required && $value === '') financeJson(422, ['error'=>'Kolom wajib diisi']);
    if (strlen($value) > $max) financeJson(422, ['error'=>'Teks terlalu panjang']);
    return $value;
}

// Serialize balance-affecting writes per owner using an existing, stable user row.
function financeLockOwner(PDO $pdo, string $owner): void {
    $stmt = $pdo->prepare('SELECT owner_id FROM app_users WHERE owner_id=? FOR UPDATE');
    $stmt->execute([$owner]);
    if (!$stmt->fetchColumn()) throw new RuntimeException('Owner not found');
}
function financeAssertSavingsNonnegative(PDO $pdo, string $owner): void {
    $stmt=$pdo->prepare("SELECT type_save, SUM(amount) AS total FROM savings_ledger WHERE owner_id=? AND type_save IN ('nest_egg','wedding','umrah','piggy','trading') GROUP BY type_save HAVING SUM(amount)<0");
    $stmt->execute([$owner]);
    $negative=$stmt->fetch(PDO::FETCH_ASSOC);
    if ($negative) {
        $names=['nest_egg'=>'Nest Egg','wedding'=>'Wedding','umrah'=>'Umrah','piggy'=>'Piggy','trading'=>'Trading'];
        $label=$names[$negative['type_save']] ?? $negative['type_save'];
        // Caller must roll back before returning a response.
        throw new DomainException('Saldo '.$label.' tidak mencukupi. Transaksi dibatalkan.');
    }
}
