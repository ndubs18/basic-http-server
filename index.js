"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var net = require("net");
var newConn = function (socket) {
    console.log('new connection', socket.remoteAddress, socket.remotePort);
    socket.on('end', function () {
        console.log('EOF');
        socket.destroy();
    });
    socket.on('data', function (data) {
        console.log("data: ".concat(data));
        socket.write(data);
        if (data.includes('q')) {
            console.log('closing...');
            socket.end();
        }
    });
};
var server = net.createServer({ allowHalfOpen: true });
server.on('error', function (err) { throw err; });
server.on('connection', newConn);
server.listen({ host: '127.0.0.1', port: 1234 });
