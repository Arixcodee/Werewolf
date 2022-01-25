const LOG_LEVEL = require('../config/globals').LOG_LEVEL;
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const secure = require("express-force-https");

const ServerBootstrapper = {
    processCLIArgs: () => {
        try {
            const args = Array.from(process.argv.map((arg) => arg.trim().toLowerCase()));
            const useHttps = args.includes('protocol=https');
            const port = process.env.PORT || args
                .filter((arg) => {
                    return /port=\d+/.test(arg);
                })
                .map((arg) => {
                    return /port=(\d+)/.exec(arg)[1];
                })[0] || 5000;
            const logLevel = process.env.LOG_LEVEL || args
                .filter((arg) => {
                    return /loglevel=[a-zA-Z]+/.test(arg);
                })
                .map((arg) => {
                    return /loglevel=([a-zA-Z]+)/.exec(arg)[1];
                })[0] || LOG_LEVEL.INFO;

            return {
                useHttps: useHttps,
                port: port,
                logLevel: logLevel
            };
        } catch (e) {
            throw new Error('Your server run command is malformed. Consult the codebase wiki for proper usage. Error: ' + e);
        }
    },

    createServerWithCorrectHTTPProtocol: (app, useHttps, port, logger) => {
        let main;
        if (process.env.NODE_ENV.trim() === 'development') {
            logger.info('starting main in DEVELOPMENT mode.');
            if (
                useHttps
                && fs.existsSync(path.join(__dirname, '../../client/certs/localhost-key.pem'))
                && fs.existsSync(path.join(__dirname, '../../client/certs/localhost.pem'))
            ) {
                const key = fs.readFileSync(path.join(__dirname, '../../client/certs/localhost-key.pem'), 'utf-8');
                const cert = fs.readFileSync(path.join(__dirname, '../../client/certs/localhost.pem'), 'utf-8');
                logger.info('local certs detected. Using HTTPS.');
                main = https.createServer({ key, cert }, app);
                logger.info(`navigate to https://localhost:${port}`);
            } else {
                logger.info('https not specified or no local certs detected. Certs should reside in /client/certs. Using HTTP.');
                main = http.createServer(app);
                logger.info(`navigate to http://localhost:${port}`);
            }
        } else {
            logger.warn('starting main in PRODUCTION mode. This should not be used for local development.');
            app.use(secure);
            main = http.createServer(app);
        }

        return main;
    },

    createSocketServer: (main, app, port) => {
        let io;
        if (process.env.NODE_ENV.trim() === 'development') {
            io = require('socket.io')(main, {
                cors: { origin: 'http://localhost:' + port }
            });
        } else {
            io = require('socket.io')(main, {
                cors: { origin: 'https://playwerewolf.uk.r.appspot.com' }
            });
        }

        return io.of('/in-game');
    }
};

module.exports = ServerBootstrapper;
