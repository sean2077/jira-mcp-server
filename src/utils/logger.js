"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.FileLogger = void 0;
exports.getLogger = getLogger;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * File-based logger for Jira MCP Server
 * Logs to a file in the logs directory with rotation support
 */
class FileLogger {
    logFilePath;
    maxFileSize = 10 * 1024 * 1024; // 10MB default
    maxFiles = 5; // Keep 5 log files
    logLevel = "info";
    constructor(logFileName = "jira-users.log", logDir = path.join(process.cwd(), "logs")) {
        // Ensure log directory exists
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        this.logFilePath = path.join(logDir, logFileName);
        // Set log level from environment
        const envLogLevel = process.env.JIRA_LOG_LEVEL?.toLowerCase();
        if (envLogLevel && ['debug', 'info', 'warn', 'error'].includes(envLogLevel)) {
            this.logLevel = envLogLevel;
        }
        // Initialize log file
        this.initializeLogFile();
    }
    initializeLogFile() {
        try {
            if (!fs.existsSync(this.logFilePath)) {
                const header = `=== Jira Users Service Log Started at ${new Date().toISOString()} ===\n`;
                fs.writeFileSync(this.logFilePath, header);
            }
        }
        catch (error) {
            console.error("Failed to initialize log file:", error);
        }
    }
    shouldLog(level) {
        const levels = { debug: 0, info: 1, warn: 2, error: 3 };
        return levels[level] >= levels[this.logLevel];
    }
    rotateLogIfNeeded() {
        try {
            const stats = fs.statSync(this.logFilePath);
            if (stats.size > this.maxFileSize) {
                // Rotate log files
                const logDir = path.dirname(this.logFilePath);
                const logFileName = path.basename(this.logFilePath, ".log");
                // Delete oldest log if we have max files
                const oldestLog = path.join(logDir, `${logFileName}.${this.maxFiles}.log`);
                if (fs.existsSync(oldestLog)) {
                    fs.unlinkSync(oldestLog);
                }
                // Rotate existing logs
                for (let i = this.maxFiles - 1; i > 0; i--) {
                    const oldPath = path.join(logDir, `${logFileName}.${i}.log`);
                    const newPath = path.join(logDir, `${logFileName}.${i + 1}.log`);
                    if (fs.existsSync(oldPath)) {
                        fs.renameSync(oldPath, newPath);
                    }
                }
                // Move current log to .1.log
                fs.renameSync(this.logFilePath, path.join(logDir, `${logFileName}.1.log`));
                // Create new log file
                this.initializeLogFile();
            }
        }
        catch (error) {
            console.error("Failed to rotate log:", error);
        }
    }
    formatMessage(level, message, context) {
        const timestamp = new Date().toISOString();
        const pid = process.pid;
        let formatted = `[${timestamp}] [${level.toUpperCase()}] [PID:${pid}] ${message}`;
        if (context) {
            formatted +=
                "\n  Context: " +
                    JSON.stringify(context, null, 2).replace(/\n/g, "\n  ");
        }
        return formatted + "\n";
    }
    writeToFile(message) {
        try {
            this.rotateLogIfNeeded();
            fs.appendFileSync(this.logFilePath, message);
        }
        catch (error) {
            console.error("Failed to write to log file:", error);
        }
    }
    debug(message, context) {
        if (this.shouldLog("debug")) {
            const formatted = this.formatMessage("debug", message, context);
            this.writeToFile(formatted);
            // Log to console in development or when explicitly enabled
            if (process.env.NODE_ENV === "development" || process.env.JIRA_LOG_CONSOLE === "true") {
                console.debug(message, context || '');
            }
        }
    }
    info(message, context) {
        if (this.shouldLog("info")) {
            const formatted = this.formatMessage("info", message, context);
            this.writeToFile(formatted);
            // Always log to console in development mode
            if (process.env.NODE_ENV === "development" || process.env.JIRA_LOG_CONSOLE === "true") {
                console.info(message, context || '');
            }
        }
    }
    warn(message, context) {
        if (this.shouldLog("warn")) {
            const formatted = this.formatMessage("warn", message, context);
            this.writeToFile(formatted);
            console.warn(message, context);
        }
    }
    error(message, error, context) {
        if (this.shouldLog("error")) {
            const errorDetails = {
                message: error?.message || "No error message",
                stack: error?.stack || "No stack trace",
                ...context,
            };
            const formatted = this.formatMessage("error", message, errorDetails);
            this.writeToFile(formatted);
            console.error(message, error);
        }
    }
    // Log API requests
    logApiRequest(method, url, params, headers) {
        this.info(`API Request: ${method} ${url}`, {
            method,
            url,
            params,
            headers: this.sanitizeHeaders(headers),
        });
    }
    // Log API responses
    logApiResponse(method, url, status, responseTime, data) {
        const level = status >= 400 ? "error" : "info";
        const message = `API Response: ${method} ${url} - ${status} (${responseTime}ms)`;
        if (level === "error") {
            this.error(message, undefined, { status, responseTime, data });
        }
        else {
            this.info(message, {
                status,
                responseTime,
                dataSize: JSON.stringify(data || {}).length,
            });
        }
    }
    // Sanitize sensitive headers
    sanitizeHeaders(headers) {
        if (!headers)
            return headers;
        const sanitized = { ...headers };
        const sensitiveKeys = ["authorization", "api-key", "token", "cookie"];
        for (const key of Object.keys(sanitized)) {
            if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
                sanitized[key] = "[REDACTED]";
            }
        }
        return sanitized;
    }
    // Get log file path
    getLogFilePath() {
        return this.logFilePath;
    }
    // Get all log files
    getLogFiles() {
        const logDir = path.dirname(this.logFilePath);
        const logFileName = path.basename(this.logFilePath, ".log");
        const files = [this.logFilePath];
        for (let i = 1; i <= this.maxFiles; i++) {
            const rotatedFile = path.join(logDir, `${logFileName}.${i}.log`);
            if (fs.existsSync(rotatedFile)) {
                files.push(rotatedFile);
            }
        }
        return files;
    }
    // Clear all logs
    clearLogs() {
        try {
            const files = this.getLogFiles();
            for (const file of files) {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                }
            }
            this.initializeLogFile();
            this.info("Logs cleared");
        }
        catch (error) {
            console.error("Failed to clear logs:", error);
        }
    }
}
exports.FileLogger = FileLogger;
// Create singleton instance
let loggerInstance = null;
function getLogger(logFileName) {
    if (!loggerInstance) {
        loggerInstance = new FileLogger(logFileName);
    }
    return loggerInstance;
}
// Export convenience logging functions
exports.logger = {
    debug: (message, context) => getLogger().debug(message, context),
    info: (message, context) => getLogger().info(message, context),
    warn: (message, context) => getLogger().warn(message, context),
    error: (message, error, context) => getLogger().error(message, error, context),
    logApiRequest: (method, url, params, headers) => getLogger().logApiRequest(method, url, params, headers),
    logApiResponse: (method, url, status, responseTime, data) => getLogger().logApiResponse(method, url, status, responseTime, data),
};
