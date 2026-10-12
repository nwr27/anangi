
<?php

$password = readline('Password: 0123');

echo password_hash(
    $password,
    PASSWORD_BCRYPT
) . PHP_EOL;