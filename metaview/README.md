# MetaView
MetaView is a tiny convenience library that provides a stream-like view into your JavaScript `DataView` objects. It automatically handles resizing the `ArrayBuffer`as needed.

In addition to the following examples, the source code is clean and documented with [Docco](https://jashkenas.github.io/docco/). It can be found [here](https://need12648430.github.io/metaview/docs).

## Properties

`MetaView.cursor`

This is the cursor, tracking the current position in the `ArrayBuffer`.
All IO occurs from this point, it is automatically updated by `read` and `write` methods.
It is *not* read-only, you can move it as needed.

`MetaView.endianness`

Specifies the desired endianness of the IO methods.

## Methods

`MetaView.readUint8 (length)`
`MetaView.readUint16 (length)`
`MetaView.readUint32 (length)`
`MetaView.readInt8 (length)`
`MetaView.readInt16 (length)`
`MetaView.readInt32 (length)`
`MetaView.readFloat32 (length)`
`MetaView.readFloat64 (length)`

Reads `length` elements of a certain size (8 bits, 16 bits, 32 bits, 64 bits) and type (Uint, Int, Float), moving the cursor accordingly. If no length is specified it will simply read 1 element.

Returns data read an `Array`.

`MetaView.peekUint8 (length)`
`MetaView.peekUint16 (length)`
`MetaView.peekUint32 (length)`
`MetaView.peekInt8 (length)`
`MetaView.peekInt16 (length)`
`MetaView.peekInt32 (length)`
`MetaView.peekFloat32 (length)`
`MetaView.peekFloat64 (length)`

Reads `length` elements of a certain size and type, but retains the current cursor position. If no length is specified it will simply read 1 unit.

Returns data read as an `Array`.

`MetaView.writeUint8 (data)`
`MetaView.writeUint16 (data)`
`MetaView.writeUint32 (data)`
`MetaView.writeInt8 (data)`
`MetaView.writeInt16 (data)`
`MetaView.writeInt32 (data)`
`MetaView.writeFloat32 (data)`
`MetaView.writeFloat64 (data)`

Writes `data` - an `Array` of integers - to the buffer.

`MetaView.finalize ()`

Trims any space allocated but not used from the internal `ArrayBuffer`.

It then returns the `ArrayBuffer`.

`MetaView.toDataURI (type)`

Generates a string containing a data URI, useful for presenting the user with a download link.


## Examples

### Open file with MetaView

	var fileInput; /// <input type="file" />
	var fileReader = new FileReader();

	function readFile () {
		var data = new MetaView(reader.result);
		// do stuff
	}

	fileReader.addEventListener("load", readFile)
	fileReader.readAsArrayBuffer(fileInput.files[0]);

### Save file with MetaView

	var output; // populated MetaView instance
	var type = "image/png"; // internet media type
	output.finalize();
	location.href = output.toDataURI("image/png");

### Serialization

Serialization is often useful in games to provide save states in an efficient
manner. Assuming the `output` and `input` arguments are `MetaView` instances, an
implementation might look a bit like this:

	GameObject.prototype.write = function (output) {
		output.writeUTF8String(this.name);
		output.writeUint16(this.health);
		output.writeFloat64(this.position.x);
		output.writeFloat64(this.position.y);
	}

	GameObject.prototype.read = function (input) {
		this.name = input.readUTF8String();
		this.health = input.readUint16(this.health);
		this.position.x = input.readFloat64();
		this.position.y = input.readFloat64();
	}
