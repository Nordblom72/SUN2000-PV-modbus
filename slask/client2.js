// create an empty modbus client
const ModbusRTU = require("modbus-serial");
const client = new ModbusRTU();

const { REGISTERS, StringRegister } = require('./registers');
const { ACCUMULATED_YIELD_ENERGY } = require("./register_names");

// open connection to a tcp line
client.connectTCP("192.168.1.212", { port: 502 });
client.setID(1);

//let strReg = new StringRegister(30000, 15)
//console.log(strReg.decode([ 21333,  20018,  12336,  12333,  14411,  21580,  11597,  12544,  12337,  12343,  13363,  12336,  11568,  12338,  0]));


console.log("dddddd ", JSON.stringify(REGISTERS, null, 2))



function get_multiple (regs=[]) {
  let totalLength = 0;
  //console.log("FFF ", regs);
  regs.forEach(s => console.log(REGISTERS[s].length))
  //console.log("TOT LEN = ",totalLength)
}

// read the values of 10 registers starting at address 0
// on device number 1. and log the values to the console.
setInterval(function() {
  get_multiple([ACCUMULATED_YIELD_ENERGY, MODEL_NAME])
  client.readHoldingRegisters(30000, 15, function(err, data) {
    if (err) throw err;
      //console.log(data.data)
      //console.log(JSON.stringify(data, null, 2));
      //console.log(new Buffer.from(data.data).toString())
  });
}, 2000);