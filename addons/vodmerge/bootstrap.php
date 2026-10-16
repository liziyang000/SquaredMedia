<?php

foreach (['Payload', 'Playlist', 'Jev', 'Service', 'AuditMatch', 'LibraryAudit', 'Workbench', 'Runtime'] as $vodmergeClass) {
    require_once __DIR__ . '/service/' . $vodmergeClass . '.php';
}
unset($vodmergeClass);
