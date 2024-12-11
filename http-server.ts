/* Building a simple tcp server by converting
 * the callback-based socket api to a promise
 * based one.
 *
 * This was a side exercise in order to practice
 * promises as well as network programming
*/
import * as net from 'net'

const host: string = '127.0.0.1';
const port: number = 1234;
const kMaxHeaderLen = 1024 * 8;

/* types */

type TCPConn = {
	socket: net.Socket,
	err: null | Error,
	ended: boolean,
	//object holding executer function callbacks for promises
	reader: null | {
		resolve: (value: Buffer) => void,
		reject: (reason: Error) => void
	}
}

type HTTPReq = {
	method: string,
	uri: Buffer,
	version: string,
	headers: Buffer[]
}

type BodyReader = {
	length: number,
	read: () => Promise<Buffer>,
}

type HTTPRes = {
	code: number;
	headers: Buffer[];
	body: BodyReader;
}

type DynBuf = {
	data: Buffer,
	length: number,
}

let soInit = (socket: net.Socket): TCPConn => {
	//create our connection object
	const conn: TCPConn = {
		socket: socket,
		err: null,
		ended: false,
		reader: null
	}
	socket.on('data', (data: Buffer) => {
		console.assert(conn.reader);
		// Pause the 'data' event on this socket from being omitted 
		conn.socket.pause();
		conn.reader!.resolve(data);
		conn.reader = null;
	});

	socket.on('end', () => {
		conn.ended = true;
		if (conn.reader) {
			conn.reader.resolve(Buffer.from(''));
			conn.reader = null;
		}
	})

	socket.on('error', (err: Error) => {
		conn.err = err;
		if (conn.reader) {
			conn.reader.reject(err);
			conn.reader = null;
		}
	})

	return conn;

}

let bufPush = (buf: DynBuf, data: Buffer): void => {

	const newLen = buf.length + data.length;

	if (buf.data.length < newLen) {

		let cap = Math.max(buf.data.length, 32);

		while (cap < newLen) {

			cap *= 2;

		}
		const grown = Buffer.alloc(cap);
		buf.data.copy(grown, 0, 0);
		buf.data = grown;
	}

	data.copy(buf.data, buf.length, 0);
	buf.length = newLen;

}
// TODO: We need to understand this function more
let bufPop = (buf: DynBuf, len: number): void => {
	buf.data.copyWithin(0, len, buf.length);
	buf.length -= len;
}

let cutMessage = (buf: DynBuf): null | Buffer => {
	// end of http header is delimited by \r\n\r\n
	const idx = buf.data.subarray(0, buf.length).indexOf('\r\n\r\n');

	if (idx < 0) {
		if (buf.length >= kMaxHeaderLen) {
			// TODO: We need to figure out what to do about our own error type
			//throw new HTTPError(413, 'header is too large');
		}
		return null;
	}



}

let serveClient = async (socket: net.Socket) => {
	//initialize the net.Socket object with event listeners
	const conn: TCPConn = soInit(socket);

	const buf: DynBuf = { data: Buffer.alloc(0), length: 0 }
	while (true) {
		const data = await soRead(conn);
		//the client closes the connection
		if (data.length === 0) {
			console.log('end connection');
			break;
		}
		console.log('data', data.toString());
		await soWrite(conn, data);
	}
}

let newConn = async (socket: net.Socket): Promise<void> => {
	console.log('new connection', socket.remoteAddress, socket.remotePort);
	try {
		await serveClient(socket);

	} catch (exc) {
		console.log(exc);
	} finally {
		socket.destroy();
	}
}

let soRead = (conn: TCPConn): Promise<Buffer> => {
	//ensure this is the only read happening
	console.assert(!conn.reader);
	return new Promise((resolve, reject) => {

		if (conn.err) {
			reject(conn.err);
		}

		if (conn.ended) {
			resolve(Buffer.from(''));
		}

		conn.reader = {
			resolve: resolve,
			reject: reject
		}

		conn.socket.resume();
	})
}

let soWrite = (conn: TCPConn, data: Buffer): Promise<void> => {
	console.assert(data.length > 0);
	return new Promise((resolve, reject) => {
		if (conn.err) {
			reject(conn.err);
			return;
		}

		conn.socket.write(data, (err?: Error) => {
			if (err) {
				reject(err);
			} else {
				resolve();
			}
		});
	});
}

let server = net.createServer({
	pauseOnConnect: true
});

server.on('error', (err: Error) => { throw err });

server.on('connection', newConn);

server.listen({ host: host, port: port }, () => { console.log(`Bind and listen on ${host} port ${port}`) });
