const net = require('net');
const WebSocket = require('ws');
const logcb = (...args) => console.log.bind(this, ...args);
const errcb = (...args) => console.error.bind(this, ...args);

const uuid = (process.env.UUID || 'ae30b9df-4a54-4f01-be56-dfa718f97786').replace(/-/g, '');
const port = process.env.PORT || 51200;

const wss = new WebSocket.Server({ port }, logcb('[startup] listen:', port, 'at', new Date().toLocaleString()));

wss.on('connection', ws => {
    console.log("[%s] new connection", new Date().toLocaleString());

    ws.once('message', msg => {
        const [VERSION] = msg;
        const id = msg.slice(1, 17);

        if (!id.every((v, i) => v === parseInt(uuid.substr(i * 2, 2), 16))) return;

        let i = msg.slice(17, 18).readUInt8() + 19;
        const targetPort = msg.slice(i, i += 2).readUInt16BE(0);
        const ATYP = msg.slice(i, i += 1).readUInt8();
        const host = ATYP === 1 ? msg.slice(i, i += 4).join('.') : // IPV4
            (ATYP === 2 ? new TextDecoder().decode(msg.slice(i + 1, i += 1 + msg.slice(i, i + 1).readUInt8())) : // domain
                (ATYP === 3 ? msg.slice(i, i += 16).reduce((s, b, i, a) => (i % 2 ? s.concat(a.slice(i - 1, i + 1)) : s), []).map(b => b.readUInt16BE(0).toString(16)).join(':') : '')); // IPV6

        console.log('[%s] conn:', new Date().toLocaleString(), host, targetPort);

        ws.send(new Uint8Array([VERSION, 0]));

        const duplex = WebSocket.createWebSocketStream(ws);

        net.connect({ host, port: targetPort }, function () {
            this.write(msg.slice(i));
            duplex.on('error', errcb('E1:')).pipe(this).on('error', errcb('E2:')).pipe(duplex);
        }).on('error', errcb('Conn-Err:', { host, port: targetPort }));
    }).on('error', errcb('E3:'));
});
