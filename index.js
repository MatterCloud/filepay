/*
Originally forked from Unwriter's Datapay https://github.com/unwriter/datapay
Copied by MatterCloud (Matter Web Services Inc.) as base for 'filepay' development.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy,
modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice
shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
const mingo = require("mingo")
const _Buffer = require('buffer/')
const bitcoin = require('bsv');
const axios = require('axios');
const defaults = {
  api_key: '', // If rate limit exceeds 3 requests/second. Get API key at https://www.mattercloud.net
  rpc: "https://api.mattercloud.net",
  fee: 400,
  feeb: 1.4,
}
// The end goal of 'build' is to create a hex formated transaction object
// therefore this function must end with _tx() for all cases
// and return a hex formatted string of either a tranaction or a script
var build = function(options, callback) {
  let script = null;
  let rpcaddr = (options.pay && options.pay.rpc) ? options.pay.rpc : defaults.rpc;
  if (options.tx) {
    // if tx exists, check to see if it's already been signed.
    // if it's a signed transaction
    // and the request is trying to override using 'data' or 'pay',
    // we should throw an error
    let tx = new bitcoin.Transaction(options.tx)
    // transaction is already signed
    if (tx.inputs.length > 0 && tx.inputs[0].script) {
      if (options.pay || options.data) {
        callback(new Error("the transaction is already signed and cannot be modified"))
        return;
      }
    }
  } else {
    // construct script only if transaction doesn't exist
    // if a 'transaction' attribute exists, the 'data' should be ignored to avoid confusion
    if (options.data) {
      script = _script(options)
    }
  }
  // Instantiate pay
  if (options.pay && options.pay.key) {
    // key exists => create a signed transaction
    let key = options.pay.key;
    const privateKey = new bitcoin.PrivateKey(key);
    const address = privateKey.toAddress();
    let rpcaddr = (options.pay && options.pay.rpc) ? options.pay.rpc : defaults.rpc;
    axios.get(`${rpcaddr}/api/v3/main/address/${address}/utxo`,
      { headers: { key: this.options.api_key } }
    ).then((res) => {
        console.log('getunspent utxos', address, res);
        if (options.pay.filter && options.pay.filter.q && options.pay.filter.q.find) {
          let f = new mingo.Query(options.pay.filter.q.find)
          res = res.filter(function(item) {
            return f.test(item)
          })
        }
        let tx = new bitcoin.Transaction(options.tx).from(res);

        if (script) {
          tx.addOutput(new bitcoin.Transaction.Output({ script: script, satoshis: 0 }));
        }
        if (options.pay.to && Array.isArray(options.pay.to)) {
          options.pay.to.forEach(function(receiver) {
            tx.to(receiver.address, receiver.value)
          })
        }

        tx.fee(defaults.fee).change(address);
        let opt_pay = options.pay || {};
        let myfee = opt_pay.fee || Math.ceil(tx._estimateSize()* (opt_pay.feeb || defaults.feeb));
        tx.fee(myfee);

        // Check all the outputs for dust
        for(var i=0;i<tx.outputs.length;i++){
          if(tx.outputs[i]._satoshis>0 && tx.outputs[i]._satoshis<546){
            tx.outputs.splice(i,1);
            i--;
          }
        }
        let transaction = tx.sign(privateKey);
        callback(null, transaction);
      }).catch((ex) => {
        console.log('filepay ex', ex);
        callback(ex);
    })
  } else {
    // key doesn't exist => create an unsigned transaction
    let fee = (options.pay && options.pay.fee) ? options.pay.fee : defaults.fee;
    let tx = new bitcoin.Transaction(options.tx).fee(fee);
    if (script) {
      tx.addOutput(new bitcoin.Transaction.Output({ script: script, satoshis: 0 }));
    }
    callback(null, tx)
  }
}
var send = function(options, callback) {
  if (!callback) {
    callback = function() {};
  }

  build(options, function(err, tx) {
    if (err) {
      callback(err);
      return;
    }

    let rpcaddr = (options.pay && options.pay.rpc) ? options.pay.rpc : defaults.rpc;
    axios.post(`${rpcaddr}/api/v3/main/merchants/tx/broadcast`,
      { rawtx: tx.toString() },
      { headers: { key: this.options.api_key } }
    ).then((res) => {
      callback(res);
    }).catch((ex) => {
      console.log('filepay ex', ex);
      callback(ex);
    });
  })
}
// compose script
var _script = function(options) {
  var s = null;
  if (options.data) {
    if (Array.isArray(options.data)) {
      s = new bitcoin.Script();
      if (!options.hasOwnProperty("safe")) {
        options.safe = true;
      }
      if (options.safe) {
        s.add(bitcoin.Opcode.OP_FALSE);
      }
      // Add op_return
      s.add(bitcoin.Opcode.OP_RETURN);
      options.data.forEach(function(item) {
        // add push data
        if (item.constructor.name === 'ArrayBuffer') {
          let buffer = _Buffer.Buffer.from(item)
          s.add(buffer)
        } else if (item.constructor.name === 'Buffer') {
          s.add(item)
        } else if (typeof item === 'string') {
          if (/^0x/i.test(item)) {
            // ex: 0x6d02
            s.add(Buffer.from(item.slice(2), "hex"))
          } else {
            // ex: "hello"
            s.add(Buffer.from(item))
          }
        } else if (typeof item === 'object' && item.hasOwnProperty('op')) {
          s.add({ opcodenum: item.op })
        }
      })
    } else if (typeof options.data === 'string') {
      // Exported transaction
      s = bitcoin.Script.fromHex(options.data);
    }
  }
  return s;
}


var callbackAndResolve = function (resolveOrReject, data, callback) {
  if (callback) {
      callback(data);
  }
  if (resolveOrReject) {
      return resolveOrReject(data)
  }
}

var hexEncode = function(str) {
  function buf2hex(buffer) {
    const hexStr = Array.prototype.map.call(new Uint8Array(buffer), (x) => ('00' + x.toString(16)).slice(-2)).join('');
    return hexStr.toLowerCase();
  }
  const checkHexPrefixRegex = /^0x(.*)/i;
  const match = checkHexPrefixRegex.exec(str);
  if (match) {
      return str;
  } else {
      let enc = new textEncoder.TextEncoder().encode(str);
      return buf2hex(enc)
  }
}

var hexEncodeIfNeeded = function(data) {
  if (!data) {
      return '0x00';
  }
  const checkHexPrefixRegex = /^0x(.*)/i;
  const match = checkHexPrefixRegex.exec(data);
  if (match && match[1]) {
      return data.toLowerCase();
  }
  return '0x' + hexEncode(data).toLowerCase();
}

var isUtf8 = function(data) {
  if (!encoding || /\s*/i.test(encoding)) {
      return true;
  }
  return /utf\-?8$/i.test(encoding);
}

var buildFile = function(request, callback) {
    return new Promise((resolve, reject) => {
        if (!request.file) {
            return callbackAndResolve(resolve, {
                success: false,
                message: 'file required'
            }, callback);
        }

        if (!request.file.content) {
            return callbackAndResolve(resolve, {
                success: false,
                message: 'content required'
            }, callback);
        }

        if (!request.file.contentType) {
            return callbackAndResolve(resolve, {
                success: false,
                message: 'contentType required'
            }, callback);
        }

        try {
            let encoding = request.file.encoding ? request.file.encoding : 'utf-8';
            if (isUtf8(encoding)) {
                encoding = 'utf-8';
            }
            let args = [
                '0x' + Buffer.from("19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut").toString('hex'),
                hexEncodeIfNeeded(request.file.content),
                hexEncodeIfNeeded(request.file.contentType),
                hexEncodeIfNeeded(encoding)
            ];
            const hasFileName = request.file.name && request.file.name !== '';
            let filename = request.file.name ? request.file.name : '0x00';
            args.push(hexEncodeIfNeeded(filename));
            if (request.file.tags) {
                request.file.tags.map((tag) => args.push(hexEncodeIfNeeded(tag)));
            }
            // Attach signatures if they are provided
            if (request.signatures && Array.isArray(request.signatures)) {
                for (const signatureKey of request.signatures) {
                    if (!signatureKey.key || /^\s*$/.test(signatureKey.key)) {
                        return callbackAndResolve(resolve, {
                            success: false,
                            message: 'signature key required'
                        }, callback);
                    }
                    const identityPrivateKey = new datapay.bsv.PrivateKey(signatureKey.key);
                    const identityAddress = identityPrivateKey.toAddress().toLegacyAddress();
                    args.push('0x' + Buffer.from('|').toString('hex'));
                    const opReturnHexArray = Utils.buildAuthorIdentity({
                        args: args,
                        address: identityAddress,
                        key: signatureKey.key,
                        indexes: signatureKey.indexes ? signatureKey.indexes : undefined
                    });
                    args = args.concat(opReturnHexArray);
                }
            }
            return callbackAndResolve(resolve, {
                success: true,
                data: args,
            }, callback);

        } catch (ex) {
            console.log('ex', ex);
            callbackAndResolve(resolve, {
                success: false,
                message: ex.message ? ex.message : ex.toString()
            }, callback)
        }
    });
}

var putFile = async (request, callback) => {
    if (!request.pay || !request.pay.key || request.pay.key === '') {
        return new Promise((resolve) => {
            return callbackAndResolve(resolve, {
                success: false,
                message: 'key required'
            }, request.callback);
        });
    }

    const buildResult = await buildFile(request);
    if (!buildResult.success) {
        return new Promise((resolve) => {
            callbackAndResolve(resolve, {
                success: false,
                message: buildResult.message
            }, request.callback);
        });
    }
    const newArgs = [];
    for (const i of buildResult.data) {
        const checkHexPrefixRegex = /^0x(.*)/i;
        const match = checkHexPrefixRegex.exec(i);
        if (match && match[1]) {
            newArgs.push(i);
        } else {
            newArgs.push('0x' + i);
        }
    }
    return send({
        data: newArgs,
        pay: request.pay,
        rpc: request.rpc,
        api_key: request.api_key
    }, callback);
}

module.exports = {
  putFile: putFile,
  build: build,
  send: send,
  bsv: bitcoin,
}

