// # MetaView
// ----------------------------------------------------------------------------
// MetaView is a tiny convenience library for working with JavaScript
// [DataViews](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView).
// It provides stream-like functions for reading and writing binary data,
// similar to AS3's ByteArray.

/*
Copyright (c) 2017 Jahn Johansen

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// ## ArrayBuffer.transfer
// ----------------------------------------------------------------------------
// A simple, tiny polyfill for
// [ArrayBuffer.transfer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer/transfer).
if (!ArrayBuffer.transfer)
	ArrayBuffer.transfer = function (oldBuffer, newLength) {
		newLength = newLength || oldBuffer.byteLength;
		var newBuffer = new ArrayBuffer(newLength);
		new Uint8Array(newBuffer).set(new Uint8Array(oldBuffer));
		return newBuffer;
	}

// ## TextEncoder / TextDecoder
// ----------------------------------------------------------------------------
// A simple, tiny polyfill for
// [encoding APIs](https://developer.mozilla.org/en-US/docs/Web/API/Encoding_API),
// it only supports UTF-8.
if (!TextEncoder) {
	function TextEncoder (encoding) {}
	TextEncoder.prototype.encode = function (buffer) {
		buffer = unescape(encodeURIComponent(buffer));
		var ab = new ArrayBuffer(buffer.length),
			u8 = new Uint8Array(ab);
		for (var i = 0; i < buffer.length; i ++)
			u8[i] = buffer.charCodeAt(i);
		return u8;
	}
	function TextDecoder () {}
	TextDecoder.prototype.decode = function (buffer) {
		return decodeURIComponent(escape(String.fromCharCode.apply(null, Array.from(buffer))));
	}
}

var MetaView = (function () {
// ## MetaView
// ----------------------------------------------------------------------------
// This is the MetaView class. It optionally takes an ArrayBuffer as its sole
// argument, which will be used to populate its internal buffer.
	function MetaView (from) {
		if (from)
			this.contents = ArrayBuffer.transfer(from);
		else
			this.contents = new ArrayBuffer(1);

		// It provides stream-like behaviour via a 'cursor' that gets updated with
		// reads and writes.
		this.cursor = 0;

		// And it can work with either big-endian or little-endian data. After creating
		// an instance of MetaView, set `metaViewInstance.endianness` to either `MetaView.LE`
		// for little-endian or `MetaView.BE` for big-endian.
		this.endianness = MetaView.LE;
		
		// ### Dynamic methods
		// ------------------------------------------------------------------------
		// The vast majority of its methods are created dynamically on construction
		// via function binds, but they follow the same general structure.
		//
		// Possible [TYPE] [BITS] combinations:
		//
		// 	* Int
		// 		* 8
		// 		* 16
		// 		* 32
		// 	* Uint
		// 		* 8
		// 		* 16
		// 		* 32
		// 	* Float
		// 		* 32
		// 		* 64
		var types = {"Int": [8,16,32], "Uint": [8,16,32], "Float": [32,64]};
		for (var type in types) {
			for (var i = 0, size; i < types[type].length; i ++) {
				size = types[type][i];
				// ### MetaView.read [TYPE] [BITS] (LENGTH)
				// ----------------------------------------------------------------------------
				// For example, `metaViewInstance.readUint8(4)` would return the next
				// 4 Uint8 values, updating the cursor to the following data.
				MetaView.prototype["read" + type + size] = MetaView.prototype.readData.bind(this, type, size);
				// ### MetaView.peek [TYPE] [BITS] (LENGTH)
				// ----------------------------------------------------------------------------
				// For example, `metaViewInstance.peekUint8(4)` would return the next
				// 4 Uint8 values, but the cursor would still point to the data for later
				// reading.
				MetaView.prototype["peek" + type + size] = MetaView.prototype.peekData.bind(this, type, size);
				// ### MetaView.write [TYPE] [BITS] (DATA)
				// ----------------------------------------------------------------------------
				//  For example, `metaViewInstance.writeUint8([0, 0, 0, 0])` would write 4 null
				//  bytes to a newly created ArrayBuffer.
				MetaView.prototype["write" + type + size] = MetaView.prototype.writeData.bind(this, type, size);
			}
		}

		this.farthestWrite = 0;
	}

	MetaView.LE = true;
	MetaView.BE = false;

	MetaView.prototype = {
		// ### MetaView.expandToContain(size)
		// ------------------------------------------------------------------------
		// Used internally, expands internal ArrayBuffer to contain new data, if necessary.
		expandToContain: function (dataSize) {
			if (this.cursor + dataSize < this.contents.byteLength)
				return;

			var newLength = this.contents.byteLength;

			while (this.cursor + dataSize > newLength)
				newLength *= 2;

			this.contents = ArrayBuffer.transfer(this.contents, newLength);
		},

		// ### MetaView.finalize()
		// ------------------------------------------------------------------------
		// Snips off any excess memory we've allocated and returns the internal ArrayBuffer.
		finalize: function () {
			return this.contents = this.contents.slice(0, this.farthestWrite);
		},

		// ### MetaView.readData(type, bits, data)
		// ------------------------------------------------------------------------
		// Used internally, reads data of an arbitrary size from the buffer.
		readData: function (type, bits, length) {
			length = length || 1;

			var dv = new DataView(this.contents);
			var result = [];
			while (length --) {
				result.push(dv["get" + type + bits](this.cursor, this.endianness));
				this.cursor += bits / 8;
			}

			return result.length == 1 ? result[0] : result;
		},

		// ### MetaView.peekData(type, bits, data)
		// ------------------------------------------------------------------------
		// Used internally, peeks at data of an arbitrary size from the buffer.
		peekData: function (type, bits, length) {
			var data = this.readData(type, bits, length);
			this.cursor -= (bits / 8) * length;
			return data;
		},

		// ### MetaView.writeData(type, bits, data)
		// ------------------------------------------------------------------------
		// Used internally, writes data of an arbitrary size to the buffer.
		writeData: function (type, bits, data) {
			var bytes = bits / 8, dataLength = data.length || 1;

			this.expandToContain(dataLength * bytes);

			var dv = new DataView(this.contents);
			for (var i = 0; i < dataLength; i ++) {
				dv["set" + type + bits](this.cursor, data[i] || data, this.endianness);
				this.cursor += bytes;
			}

			this.farthestWrite = Math.max(this.cursor, this.farthestWrite);
		},

		// ### MetaView.readUTF8String()
		// ------------------------------------------------------------------------
		// Uses bound functions to read a UTF-8 formatted string from the buffer.
		readUTF8String: function () {
			var encoded = this.readUint8(this.readUint32());
			return new TextDecoder("utf-8").decode(new Uint8Array(encoded));
		},

		// ### MetaView.peekUTF8String()
		// ------------------------------------------------------------------------
		// Uses bound functions to peek at a UTF-8 formatted string from the buffer.
		peekUTF8String: function () {
			var c = this.cursor;
			var encoded = this.readUint8(this.readUint32());
			this.cursor = c;

			return new TextDecoder("utf-8").decode(new Uint8Array(encoded));
		},

		// ### MetaView.writeUTF8String(string)
		// ------------------------------------------------------------------------
		// Uses bound functions to write a UTF-8 formatted `string` to the buffer.
		writeUTF8String: function (string) {
			var encoded = new TextEncoder("utf-8").encode(string);
			this.writeUint32(encoded.byteLength);
			this.writeUint8(encoded);
		},

		// ### MetaView.toDataURI(type)
		// ------------------------------------------------------------------------
		// Converts the buffer, as it is, into a Data URI format more useful for the
		// end user. `type` is a standard media type, e.g. "image/png"
		//
		// You'll probably want to call `MetaView.finalize()` first.
		toDataURI: function (type) {
			var bytes = new Uint8Array(this.contents),
					binary = '';
			for (var i = 0; i < bytes.byteLength; i ++)
				binary += String.fromCharCode(bytes[i]);
			return "data:" + type + ";base64,"  + btoa(binary);
		}
	};

	return MetaView;
})();
