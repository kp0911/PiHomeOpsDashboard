package com.homeops.nas.domain;

public enum AuditEventType {
    LOGIN_SUCCESS,
    LOGIN_FAILED,
    ACCOUNT_LOCKED,
    IP_BLOCKED,
    ACCESS_DENIED,
    FILE_UPLOAD,
    FILE_DOWNLOAD,
    FILE_DELETE,
    FILE_RENAME,
    AGENT_REGISTERED,
    AGENT_METRIC_RECEIVED
}
