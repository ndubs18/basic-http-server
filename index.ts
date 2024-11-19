//converting callback based socket api into promise based
import * as net from 'net'

const host: string = '127.0.0.1';
const port: number = 1234;

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

let serveClient = async (socket: net.Socket) => {
	//initialize the net.Socket object with event listeners
	const conn: TCPConn = soInit(socket);

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


type TCPConn = {
	socket: net.Socket,
	err: null | Error,
	ended: boolean,

	reader: null | {
		resolve: (value: Buffer) => void,
		reject: (reason: Error) => void
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
