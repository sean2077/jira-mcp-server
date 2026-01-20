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
exports.logger = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class SimpleLogger {
    logDir;
    logFile;
    currentLogLevel = 'info';
    constructor() {
        this.logDir = path.join(__dirname, '..', '..', 'logs');
        this.logFile = path.join(this.logDir, `jira-${this.getDateString()}.log`);
        this.ensureLogDirectory();
    }
    getDateString() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }
    shouldLog(level) {
        const levels = ['debug', 'info', 'warn', 'error'];
        const currentIndex = levels.indexOf(this.currentLogLevel);
        const messageIndex = levels.indexOf(level);
        return messageIndex >= currentIndex;
    }
    formatLogEntry(level, message, data, error) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
        };
        if (data !== undefined) {
            entry.data = data;
        }
        if (error !== undefined) {
            if (error instanceof Error) {
                entry.error = {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                };
            }
            else {
                entry.error = error;
            }
        }
        return JSON.stringify(entry) + '\n';
    }
    writeToFile(logEntry) {
        try {
            fs.appendFileSync(this.logFile, logEntry, 'utf8');
        }
        catch (err) {
            console.error('Failed to write to log file:', err);
        }
    }
    log(level, message, dataOrError, additionalData) {
        if (!this.shouldLog(level)) {
            return;
        }
        let data = dataOrError;
        let error = undefined;
        if (dataOrError instanceof Error) {
            error = dataOrError;
            data = additionalData;
        }
        else if (additionalData instanceof Error) {
            error = additionalData;
        }
        const logEntry = this.formatLogEntry(level, message, data, error);
        this.writeToFile(logEntry);
        // Also log to console for development
        const consoleMessage = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
        switch (level) {
            case 'debug':
                console.debug(consoleMessage, data || '');
                break;
            case 'info':
                console.info(consoleMessage, data || '');
                break;
            case 'warn':
                console.warn(consoleMessage, data || '');
                break;
            case 'error':
                console.error(consoleMessage, error || data || '');
                break;
        }
    }
    debug(message, data) {
        this.log('debug', message, data);
    }
    info(message, data) {
        this.log('info', message, data);
    }
    warn(message, data) {
        this.log('warn', message, data);
    }
    error(message, error, data) {
        this.log('error', message, error, data);
    }
    setLogLevel(level) {
        this.currentLogLevel = level;
        this.info(`Log level changed to ${level}`);
    }
    logApiRequest(method, url, body, headers) {
        this.info(`API Request: ${method} ${url}`, {
            method,
            url,
            body: body ? JSON.parse(body) : undefined,
            headers: headers || undefined,
        });
    }
    logApiResponse(method, url, status, responseTime, data) {
        const level = status >= 400 ? 'error' : 'info';
        this.log(level, `API Response: ${method} ${url} - ${status} (${responseTime}ms)`, {
            method,
            url,
            status,
            responseTime,
            data: data ? (typeof data === 'object' ? data : { response: data }) : undefined,
        });
    }
    rotateLogFile() {
        const newLogFile = path.join(this.logDir, `jira-${this.getDateString()}.log`);
        if (this.logFile !== newLogFile) {
            this.logFile = newLogFile;
            this.info('Log file rotated', { newFile: this.logFile });
        }
    }
}
exports.logger = new SimpleLogger();
