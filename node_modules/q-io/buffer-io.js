
var BufferIO = require("q-io/buffer-io").BufferIO;

var io = BufferIO();
io.write([1,2,3]);
io.write([4,5,6]);
console.log(io.toBuffer());
console.log(io.toBuffer());
console.log(io.read());
console.log(io.read());
io.write([7,8,9]);
console.log(io.read());

